import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  MendError,
  PublicLocationSchema,
  sha256Hex,
  stableStringify,
} from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { authFromHeaders, ROLE_MATRIX, requireRole } from '../auth.js';
import { clusterView, reportPrivateView, reportView, triageView } from '../serializers.js';
import { auditEvent } from '../services/audit.js';
import { decodeBase64Image, stripImageMetadata } from '../services/evidence.js';

const preciseLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().optional(),
  capturedAt: z.string().optional(),
});

const createReportInput = z.object({
  assetId: z.string().min(1),
  description: z.string().min(1).max(4000),
  publicLocation: PublicLocationSchema,
  preciseLocation: preciseLocationSchema.optional(),
  mediaBase64: z.string().min(1).optional(),
  mediaContentType: z.enum(['image/jpeg', 'image/png']).optional(),
  mediaFileName: z.string().max(200).optional(),
  perceptualHash: z.string().min(8).max(128).optional(),
  redaction: z.object({ applied: z.boolean() }).optional(),
});

const reportPatchInput = z.object({
  status: z.enum(['SUBMITTED', 'TRIAGED', 'CLUSTERED', 'DUPLICATE', 'ACCEPTED']).optional(),
  clusterId: z.string().nullable().optional(),
});

const clusterInput = z.object({
  reportIds: z.array(z.string()).min(1),
  confidenceBps: z.number().int().min(0).max(10_000),
  rationale: z.string().min(1).max(2000),
});

const clusterPatchInput = z.object({
  reportIds: z.array(z.string()).min(1).optional(),
  confidenceBps: z.number().int().min(0).max(10_000).optional(),
  rationale: z.string().min(1).max(2000).optional(),
  status: z.enum(['SUGGESTED', 'CONFIRMED', 'REJECTED']).optional(),
});

const STAFF_READ_ROLES = ['STEWARD', 'ADMIN', 'DAO', 'COORDINATOR_AI', 'REVIEWER_AI'] as const;

function caseLinkFrom(request: {
  headers: Record<string, string | string[] | undefined>;
  query: unknown;
}): string | undefined {
  const header = request.headers['x-mend-case-link'];
  if (Array.isArray(header)) return header[0];
  if (typeof header === 'string') return header;
  const query = request.query as { caseLink?: unknown } | undefined;
  return typeof query?.caseLink === 'string' ? query.caseLink : undefined;
}

export async function registerReportRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.post('/v1/reports', async (request, reply) => {
    const input = createReportInput.parse(request.body);
    const asset = await deps.repo.getAsset(input.assetId);
    if (!asset) throw new MendError('NOT_FOUND', 'Asset not found', { assetId: input.assetId });
    if (input.mediaBase64 && !input.mediaContentType) {
      throw new MendError('VALIDATION_ERROR', 'mediaContentType is required with mediaBase64');
    }

    const seq = await deps.repo.nextSequence('report');
    if (seq > 999) throw new MendError('INVALID_STATE', 'Demo report ID space exhausted (R-001..R-999)');
    const reportId = `R-${String(seq).padStart(3, '0')}`;
    if (await deps.repo.getReport(reportId)) {
      throw new MendError('INVALID_STATE', 'Report ID allocation collided with existing data', { reportId });
    }

    let redactedMediaHash: string | undefined;
    let privateMediaKey: string | undefined;
    if (input.mediaBase64 && input.mediaContentType) {
      const original = decodeBase64Image(input.mediaBase64, deps.config.evidence.maxBytes);
      const stripped = stripImageMetadata(original, input.mediaContentType);
      redactedMediaHash = stripped.sha256;
      const extension = input.mediaContentType === 'image/png' ? 'png' : 'jpg';
      privateMediaKey = `reports/${reportId.toLowerCase()}/${stripped.sha256}.${extension}`;
      if (!deps.evidenceStore.available) {
        throw new MendError('UPSTREAM_UNAVAILABLE', deps.evidenceStore.unavailableReason ?? 'Private media storage unavailable', {
          adapter: deps.evidenceStore.kind,
        });
      }
      await deps.evidenceStore.put(privateMediaKey, stripped.bytes);
    }

    const caseLink = `case_${randomBytes(16).toString('base64url')}`;
    const createdAt = deps.clock.now().toISOString();

    const report = await deps.repo.transaction(async (tx) => {
      const created = await tx.createReport({
        id: reportId,
        assetId: input.assetId,
        description: input.description,
        publicLocation: input.publicLocation,
        ...(redactedMediaHash ? { redactedMediaHash } : {}),
        ...(input.perceptualHash ? { perceptualHash: input.perceptualHash } : {}),
        exifStripped: Boolean(input.mediaBase64),
        status: 'SUBMITTED',
        createdAt,
        source: 'WALLETLESS',
        isDemo: false,
      });
      await tx.createReportPrivate({
        reportId,
        ...(input.preciseLocation ? { preciseLocation: input.preciseLocation } : {}),
        reporterCaseLink: caseLink,
        caseLinkHash: sha256Hex(caseLink),
        ...(privateMediaKey ? { privateMediaKey } : {}),
        ...(redactedMediaHash ? { privateMediaHash: redactedMediaHash } : {}),
        retentionUntil: new Date(deps.clock.now().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return created;
    }).catch(async (error) => {
      if (privateMediaKey) await deps.evidenceStore.delete(privateMediaKey).catch(() => undefined);
      throw error;
    });

    await auditEvent(deps, 'report_submitted', 'walletless-reporter', { assetId: input.assetId }, {
      reportId: report.id,
      hasMedia: Boolean(redactedMediaHash),
      exifStripped: report.exifStripped,
      redactedMediaHash: report.redactedMediaHash ?? null,
      redactionApplied: input.redaction?.applied ?? null,
      // Precise location is deliberately not written to the audit trail.
    });
    return reply.status(201).send(reportView(report, caseLink));
  });

  app.get('/v1/reports', async (request) => {
    requireRole(authFromHeaders(request.headers, deps.config), STAFF_READ_ROLES, 'report:list');
    const query = request.query as { status?: string; assetId?: string; clusterId?: string };
    const reports = await deps.repo.listReports({
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.clusterId ? { clusterId: query.clusterId } : {}),
    });
    return reports.map((report) => reportView(report));
  });

  app.get<{ Params: { reportId: string } }>('/v1/reports/:reportId', async (request) => {
    const report = await deps.repo.getReport(request.params.reportId);
    if (!report) throw new MendError('NOT_FOUND', 'Report not found', { reportId: request.params.reportId });
    const privateRecord = await deps.repo.getReportPrivate(report.id);
    const caseLink = caseLinkFrom({ headers: request.headers, query: request.query });
    if (!caseLink) {
      throw new MendError('UNAUTHORIZED', 'Reporter case link is required', {
        header: 'x-mend-case-link',
      });
    }
    if (!privateRecord || sha256Hex(caseLink) !== privateRecord.caseLinkHash) {
      throw new MendError('NOT_FOUND', 'Report not found', { reportId: request.params.reportId });
    }
    const [cluster, triage] = await Promise.all([
      report.clusterId ? deps.repo.getCluster(report.clusterId) : Promise.resolve(null),
      deps.repo.listTriageSuggestions(report.id),
    ]);
    return {
      report: reportView(report, privateRecord.reporterCaseLink),
      duplicateStatus: report.status,
      cluster: cluster ? clusterView(cluster) : null,
      latestTriage: triage.length > 0 ? triageView(triage[triage.length - 1]!) : null,
    };
  });

  app.patch<{ Params: { reportId: string } }>('/v1/reports/:reportId', async (request) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['report:update'], 'report:update');
    const report = await deps.repo.getReport(request.params.reportId);
    if (!report) throw new MendError('NOT_FOUND', 'Report not found');
    const patch = reportPatchInput.parse(request.body);
    if (patch.clusterId) {
      const cluster = await deps.repo.getCluster(patch.clusterId);
      if (!cluster) throw new MendError('NOT_FOUND', 'Report cluster not found', { clusterId: patch.clusterId });
    }
    const updated = await deps.repo.updateReport(report.id, patch);
    await auditEvent(deps, 'report_updated', auth.account, { assetId: report.assetId }, {
      reportId: report.id,
      fields: Object.keys(patch),
      status: patch.status ?? null,
    });
    return reportView(updated!);
  });

  app.get<{ Params: { reportId: string } }>('/v1/reports/:reportId/private-location', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['report:private_location'],
      'report:private_location',
    );
    const privateRecord = await deps.repo.getReportPrivate(request.params.reportId);
    if (!privateRecord) throw new MendError('NOT_FOUND', 'Private report data not found');
    await auditEvent(deps, 'private_location_accessed', auth.account, {}, { reportId: request.params.reportId });
    reply.header('cache-control', 'no-store');
    return reportPrivateView(privateRecord);
  });

  app.post<{ Params: { reportId: string } }>('/v1/reports/:reportId/triage', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['report:triage'], 'report:triage');
    const report = await deps.repo.getReport(request.params.reportId);
    if (!report) throw new MendError('NOT_FOUND', 'Report not found');
    const privateRecord = await deps.repo.getReportPrivate(report.id);
    const existing = await deps.repo.listReports({ assetId: report.assetId });
    const result = await deps.triage.inspect({
      report,
      existingReports: existing,
      hasPreciseLocation: Boolean(privateRecord?.preciseLocation),
    });
    const now = deps.clock.now().toISOString();
    let attestationId: string | undefined;
    if (result.attestation) {
      const artifactHash = sha256Hex(stableStringify(result.attestation.artifact));
      const attestation = await deps.repo.createAttestation({
        id: `ATT-${String(await deps.repo.nextSequence('attestation')).padStart(4, '0')}`,
        kind: result.attestation.kind,
        subjectHash: sha256Hex(stableStringify({ reportId: report.id, provider: result.provider })),
        artifact: result.attestation.artifact,
        artifactHash,
        ...(result.attestation.signature ? { signature: result.attestation.signature } : {}),
        verified: result.verified,
        ...(result.unavailableReason ? { unavailableReason: result.unavailableReason } : {}),
        createdAt: now,
        isDemo: report.isDemo,
      });
      attestationId = attestation.id;
    }
    const seq = await deps.repo.nextSequence('triage');
    const suggestion = await deps.repo.createTriageSuggestion({
      id: `TRG-${String(seq).padStart(4, '0')}`,
      reportId: report.id,
      provider: result.provider,
      ...(result.model ? { model: result.model } : {}),
      available: result.available,
      ...(result.confidenceBps !== undefined ? { confidenceBps: result.confidenceBps } : {}),
      ...(result.rationale ? { rationale: result.rationale } : {}),
      duplicateCandidates: result.duplicateCandidates,
      ...(result.scope ? { scope: result.scope } : {}),
      ...(attestationId ? { attestationId } : {}),
      ...(result.unavailableReason ? { unavailableReason: result.unavailableReason } : {}),
      createdAt: now,
      isDemo: report.isDemo,
    });
    if (report.status === 'SUBMITTED') {
      await deps.repo.updateReport(report.id, { status: 'TRIAGED' });
    }
    await auditEvent(deps, 'report_triaged', auth.account, { assetId: report.assetId }, {
      reportId: report.id,
      suggestionId: suggestion.id,
      available: result.available,
      confidenceBps: result.confidenceBps ?? null,
      attestationId: attestationId ?? null,
    });
    return reply.status(201).send({
      suggestion: triageView(suggestion),
      verified: result.verified,
      label: result.available
        ? (result.verified ? 'VERIFIED_INFERENCE' : 'UNVERIFIED_INFERENCE')
        : 'UNAVAILABLE — deterministic duplicate heuristic only',
      available: result.available,
    });
  });

  app.get<{ Params: { reportId: string } }>('/v1/reports/:reportId/triage', async (request) => {
    requireRole(authFromHeaders(request.headers, deps.config), STAFF_READ_ROLES, 'report:triage:read');
    const suggestions = await deps.repo.listTriageSuggestions(request.params.reportId);
    if (suggestions.length === 0) throw new MendError('NOT_FOUND', 'No triage suggestion exists for this report');
    const latest = suggestions[suggestions.length - 1]!;
    return {
      suggestion: triageView(latest),
      history: suggestions.map(triageView),
    };
  });

  app.get('/v1/report-clusters', async () => {
    const clusters = await deps.repo.listClusters();
    return clusters.map(clusterView);
  });

  app.get<{ Params: { clusterId: string } }>('/v1/report-clusters/:clusterId', async (request) => {
    const cluster = await deps.repo.getCluster(request.params.clusterId);
    if (!cluster) throw new MendError('NOT_FOUND', 'Report cluster not found');
    const reports = await Promise.all(cluster.reportIds.map((id) => deps.repo.getReport(id)));
    return {
      ...clusterView(cluster),
      reports: reports.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => reportView(r)),
    };
  });

  app.post('/v1/report-clusters', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['cluster:create'], 'cluster:create');
    const input = clusterInput.parse(request.body);
    for (const reportId of input.reportIds) {
      if (!(await deps.repo.getReport(reportId))) {
        throw new MendError('NOT_FOUND', 'Report in cluster not found', { reportId });
      }
    }
    const seq = await deps.repo.nextSequence('cluster');
    const cluster = await deps.repo.createCluster({
      id: `CL-${String(seq).padStart(4, '0')}`,
      reportIds: input.reportIds,
      confidenceBps: input.confidenceBps,
      rationale: input.rationale,
      status: 'SUGGESTED',
      createdAt: deps.clock.now().toISOString(),
      isDemo: false,
    });
    await auditEvent(deps, 'report_cluster_suggested', auth.account, {}, {
      clusterId: cluster.id,
      reportIds: cluster.reportIds,
      confidenceBps: cluster.confidenceBps,
    });
    return reply.status(201).send(clusterView(cluster));
  });

  app.patch<{ Params: { clusterId: string } }>('/v1/report-clusters/:clusterId', async (request) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['cluster:update'], 'cluster:update');
    const cluster = await deps.repo.getCluster(request.params.clusterId);
    if (!cluster) throw new MendError('NOT_FOUND', 'Report cluster not found');
    const patch = clusterPatchInput.parse(request.body);
    if (patch.status === 'CONFIRMED') {
      const updatedCluster = await deps.repo.updateCluster(cluster.id, { ...patch, confirmedBy: auth.account });
      if (!updatedCluster) throw new MendError('NOT_FOUND', 'Report cluster not found');
      for (const reportId of updatedCluster.reportIds) {
        await deps.repo.updateReport(reportId, { status: 'CLUSTERED', clusterId: updatedCluster.id });
      }
      await auditEvent(deps, 'report_cluster_confirmed', auth.account, {}, {
        clusterId: updatedCluster.id,
        reportIds: updatedCluster.reportIds,
        humanConfirmation: true,
      });
      return clusterView(updatedCluster);
    }
    if (patch.status === 'REJECTED') {
      const updatedCluster = await deps.repo.updateCluster(cluster.id, { ...patch, confirmedBy: auth.account });
      if (!updatedCluster) throw new MendError('NOT_FOUND', 'Report cluster not found');
      for (const reportId of cluster.reportIds) {
        await deps.repo.updateReport(reportId, { status: 'TRIAGED', clusterId: null });
      }
      await auditEvent(deps, 'report_cluster_rejected', auth.account, {}, { clusterId: cluster.id });
      return clusterView(updatedCluster);
    }
    const updated = await deps.repo.updateCluster(cluster.id, patch);
    await auditEvent(deps, 'report_cluster_updated', auth.account, {}, {
      clusterId: cluster.id,
      fields: Object.keys(patch),
    });
    return clusterView(updated!);
  });
}
