import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HASH_PATTERN, MendError, sha256Hex, stableStringify } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { authFromHeaders, requireRole, ROLE_MATRIX } from '../auth.js';
import { attestationView, evidencePackageView } from '../serializers.js';
import { auditEvent } from '../services/audit.js';
import {
  decodeBase64Image,
  evidenceAccessUrl,
  signEvidenceAccess,
  stripImageMetadata,
  verifyEvidenceAccess,
} from '../services/evidence.js';
import type { AttestationRecord } from '@mend/db';

const uploadInput = z.object({
  workOrderId: z.string().min(1),
  kind: z.enum(['COMPLETION', 'REMEDIATION', 'DURABILITY']),
  contentType: z.enum(['image/jpeg', 'image/png']),
  dataBase64: z.string().min(1),
  fileName: z.string().max(200).optional(),
  checklist: z.record(z.string(), z.boolean()).default({}),
});

const verificationInput = z.object({
  kind: z.enum(['NEAR_AI', 'OUTLAYER', 'DAO', 'TRANSACTION', 'HUMAN']),
  subjectHash: z.string().regex(HASH_PATTERN),
  artifact: z.record(z.string(), z.unknown()),
  signature: z.string().max(4000).optional(),
  unavailableReason: z.string().max(1000).optional(),
});

/** Recomputes the artifact hash. Modified bytes must fail. */
export function artifactIntegrity(attestation: AttestationRecord): boolean {
  return sha256Hex(stableStringify(attestation.artifact)) === attestation.artifactHash;
}

function downloadQuery(request: { query: unknown }): { objectId: string; expires: number; token: string } {
  const query = request.query as { objectId?: unknown; expires?: unknown; token?: unknown };
  if (typeof query.objectId !== 'string' || typeof query.token !== 'string') {
    throw new MendError('VALIDATION_ERROR', 'objectId and token are required');
  }
  const expires = Number(query.expires);
  if (!Number.isFinite(expires)) throw new MendError('VALIDATION_ERROR', 'expires must be a unix timestamp');
  return { objectId: query.objectId, expires, token: query.token };
}

export async function registerEvidenceRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  async function requireWorkOrder(id: string) {
    const workOrder = await deps.repo.getWorkOrder(id);
    if (!workOrder) throw new MendError('NOT_FOUND', 'Work order not found', { workOrderId: id });
    return workOrder;
  }

  async function upload(
    body: unknown,
    pathWorkOrderId: string | undefined,
    headers: Record<string, string | string[] | undefined>,
    reply: { status: (code: number) => { send: (payload: unknown) => unknown }; header: (key: string, value: string) => unknown },
  ) {
    const auth = requireRole(authFromHeaders(headers, deps.config), ROLE_MATRIX['evidence:upload'], 'evidence:upload');
    const input = uploadInput.parse(body);
    if (pathWorkOrderId && input.workOrderId !== pathWorkOrderId) {
      throw new MendError('VALIDATION_ERROR', 'Body workOrderId does not match the path', {
        path: pathWorkOrderId,
        body: input.workOrderId,
      });
    }
    const workOrder = await requireWorkOrder(input.workOrderId);
    if (!deps.evidenceStore.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', deps.evidenceStore.unavailableReason ?? 'Private storage unavailable');
    }
    if (input.kind === 'DURABILITY') {
      if (workOrder.status !== 'DURABILITY_PENDING') {
        throw new MendError('INVALID_STATE', 'Durability evidence requires DURABILITY_PENDING', { status: workOrder.status });
      }
      if (auth.role === 'CONTRACTOR') {
        throw new MendError('FORBIDDEN_ROLE', 'The awarded contractor cannot supply durability evidence');
      }
    } else {
      if (!['IN_PROGRESS', 'WARRANTY_REOPENED'].includes(workOrder.status)) {
        throw new MendError('INVALID_STATE', 'Completion evidence requires work in progress', { status: workOrder.status });
      }
      if (auth.role === 'CONTRACTOR' && workOrder.contractorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Only the awarded contractor can submit completion evidence');
      }
    }

    const original = decodeBase64Image(input.dataBase64, deps.config.evidence.maxBytes);
    const stripped = stripImageMetadata(original, input.contentType);
    const seq = await deps.repo.nextSequence('evidence');
    const evidenceId = `EV-${String(seq).padStart(4, '0')}`;
    const extension = input.contentType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `evidence/${workOrder.id.toLowerCase()}/${evidenceId.toLowerCase()}/${stripped.sha256}.${extension}`;
    await deps.evidenceStore.put(storageKey, stripped.bytes);
    const now = deps.clock.now().toISOString();
    const objectId = `EVO-${String(await deps.repo.nextSequence('evidence-object')).padStart(4, '0')}`;

    const pkg = await deps.repo.transaction(async (tx) => {
      const created = await tx.createEvidencePackage({
        id: evidenceId,
        workOrderId: workOrder.id,
        kind: input.kind,
        evidenceHashes: [stripped.sha256],
        checklist: input.checklist,
        redacted: true,
        submittedBy: auth.account,
        submittedAt: now,
        isDemo: workOrder.isDemo,
      });
      await tx.createEvidenceObject({
        id: objectId,
        evidencePackageId: evidenceId,
        storageKey,
        sha256: stripped.sha256,
        contentType: input.contentType,
        sizeBytes: stripped.bytes.length,
        redacted: true,
        createdAt: now,
      });
      return created;
    }).catch(async (error) => {
      await deps.evidenceStore.delete(storageKey).catch(() => undefined);
      throw error;
    });
    const objects = await deps.repo.listEvidenceObjects(pkg.id);
    await auditEvent(deps, 'evidence_submitted', auth.account, { workOrderId: workOrder.id, assetId: workOrder.assetId }, {
      evidenceId: pkg.id,
      kind: pkg.kind,
      evidenceHash: stripped.sha256,
      exifMetadataRemoved: stripped.stripped,
    });
    reply.header('cache-control', 'no-store');
    return reply.status(201).send(evidencePackageView(pkg, objects));
  }

  app.post('/v1/evidence', async (request, reply) => upload(request.body, undefined, request.headers, reply));
  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/evidence', async (request, reply) =>
    upload(request.body, request.params.workOrderId, request.headers, reply),
  );

  app.get<{ Params: { evidenceId: string } }>('/v1/evidence/:evidenceId', async (request) => {
    const pkg = await deps.repo.getEvidencePackage(request.params.evidenceId);
    if (!pkg) throw new MendError('NOT_FOUND', 'Evidence package not found');
    const objects = await deps.repo.listEvidenceObjects(pkg.id);
    return evidencePackageView(pkg, objects);
  });

  app.get<{ Params: { evidenceId: string } }>('/v1/evidence/:evidenceId/access', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['evidence:access'],
      'evidence:access',
    );
    const pkg = await deps.repo.getEvidencePackage(request.params.evidenceId);
    if (!pkg) throw new MendError('NOT_FOUND', 'Evidence package not found');
    const workOrder = await deps.repo.getWorkOrder(pkg.workOrderId);
    if (auth.role === 'CONTRACTOR' && workOrder?.contractorId !== auth.account) {
      throw new MendError('FORBIDDEN_ROLE', 'Contractor is not assigned to this work order');
    }
    if (auth.role === 'INSPECTOR' && !workOrder) {
      throw new MendError('FORBIDDEN_ROLE', 'Inspector cannot access evidence for an unknown work order');
    }
    if (auth.role === 'INSPECTOR' && workOrder) {
      const approval = await deps.repo.getDaoApproval(workOrder.daoApprovalId);
      if (!approval || !approval.inspectorRoster.includes(auth.account)) {
        throw new MendError('NOT_ROSTERED', 'Inspector is not on the DAO-approved roster');
      }
    }
    if (!deps.evidenceStore.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', deps.evidenceStore.unavailableReason ?? 'Private storage unavailable');
    }
    const objects = await deps.repo.listEvidenceObjects(pkg.id);
    const object = objects[0];
    if (!object) throw new MendError('NOT_FOUND', 'No private object exists for this evidence package');
    const expiresAt = Math.floor(deps.clock.now().getTime() / 1000) + deps.config.evidence.signedUrlTtlSeconds;
    const token = signEvidenceAccess({
      secret: deps.config.evidence.signingSecret,
      evidenceId: pkg.id,
      objectId: object.id,
      storageKey: object.storageKey,
      expiresAt,
    });
    await auditEvent(deps, 'evidence_access_granted', auth.account, { workOrderId: pkg.workOrderId, assetId: workOrder?.assetId }, {
      evidenceId: pkg.id,
      objectId: object.id,
      expiresAt,
    });
    reply.header('cache-control', 'no-store');
    return {
      evidenceId: pkg.id,
      objectId: object.id,
      sha256: object.sha256,
      contentType: object.contentType,
      expiresAt,
      url: evidenceAccessUrl(deps.config, pkg.id, object.id, expiresAt, token),
      note: 'Signed, time-limited access. Never place this URL in public state or on-chain.',
    };
  });

  app.get<{ Params: { evidenceId: string } }>('/v1/evidence/:evidenceId/download', async (request, reply) => {
    const { objectId, expires, token } = downloadQuery(request);
    const object = await deps.repo.getEvidenceObject(objectId);
    if (!object || object.evidencePackageId !== request.params.evidenceId) {
      throw new MendError('NOT_FOUND', 'Evidence object not found');
    }
    verifyEvidenceAccess({
      secret: deps.config.evidence.signingSecret,
      evidenceId: request.params.evidenceId,
      objectId: object.id,
      storageKey: object.storageKey,
      expiresAt: expires,
      token,
      now: deps.clock.now(),
    });
    const bytes = await deps.evidenceStore.get(object.storageKey);
    reply.header('content-type', object.contentType);
    reply.header('cache-control', 'private, no-store');
    return reply.send(bytes);
  });

  app.get<{ Params: { reportId: string } }>('/v1/reports/:reportId/media/access', async (request, reply) => {
    const auth = authFromHeaders(request.headers, deps.config);
    const privateRecord = await deps.repo.getReportPrivate(request.params.reportId);
    if (!privateRecord?.privateMediaKey) throw new MendError('NOT_FOUND', 'No private media exists for this report');
    const query = request.query as { caseLink?: string };
    const caseLink = typeof request.headers['x-mend-case-link'] === 'string'
      ? request.headers['x-mend-case-link']
      : query.caseLink;
    const reporterAuthorized = typeof caseLink === 'string' && sha256Hex(caseLink) === privateRecord.caseLinkHash;
    const staffAuthorized = auth !== null && ['STEWARD', 'DAO', 'ADMIN'].includes(auth.role);
    if (!reporterAuthorized && !staffAuthorized) {
      throw new MendError('FORBIDDEN_ROLE', 'A valid reporter case link or staff role is required');
    }
    const expiresAt = Math.floor(deps.clock.now().getTime() / 1000) + deps.config.evidence.signedUrlTtlSeconds;
    const objectId = 'media';
    const token = signEvidenceAccess({
      secret: deps.config.evidence.signingSecret,
      evidenceId: `report:${request.params.reportId}`,
      objectId,
      storageKey: privateRecord.privateMediaKey,
      expiresAt,
    });
    await auditEvent(deps, 'report_media_access_granted', auth?.account ?? 'reporter-case-link', {}, {
      reportId: request.params.reportId,
      expiresAt,
    });
    reply.header('cache-control', 'no-store');
    const url = new URL(`${deps.config.publicBaseUrl}/v1/reports/${request.params.reportId}/media/download`);
    url.searchParams.set('objectId', objectId);
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('token', token);
    return {
      reportId: request.params.reportId,
      expiresAt,
      url: url.toString(),
      sha256: privateRecord.privateMediaHash ?? null,
      note: 'Signed, time-limited access to the EXIF-stripped private media. Never public.',
    };
  });

  app.get<{ Params: { reportId: string } }>('/v1/reports/:reportId/media/download', async (request, reply) => {
    const { objectId, expires, token } = downloadQuery(request);
    if (objectId !== 'media') throw new MendError('VALIDATION_ERROR', 'Invalid media object');
    const privateRecord = await deps.repo.getReportPrivate(request.params.reportId);
    if (!privateRecord?.privateMediaKey) throw new MendError('NOT_FOUND', 'No private media exists for this report');
    verifyEvidenceAccess({
      secret: deps.config.evidence.signingSecret,
      evidenceId: `report:${request.params.reportId}`,
      objectId,
      storageKey: privateRecord.privateMediaKey,
      expiresAt: expires,
      token,
      now: deps.clock.now(),
    });
    const bytes = await deps.evidenceStore.get(privateRecord.privateMediaKey);
    reply.header('content-type', privateRecord.privateMediaKey.endsWith('.png') ? 'image/png' : 'image/jpeg');
    reply.header('cache-control', 'private, no-store');
    return reply.send(bytes);
  });

  app.post('/v1/verification', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['verification:create'],
      'verification:create',
    );
    const input = verificationInput.parse(request.body);
    const artifactHash = sha256Hex(stableStringify(input.artifact));
    const attestation = await deps.repo.createAttestation({
      id: `ATT-${String(await deps.repo.nextSequence('attestation')).padStart(4, '0')}`,
      kind: input.kind,
      subjectHash: input.subjectHash,
      artifact: input.artifact,
      artifactHash,
      ...(input.signature ? { signature: input.signature } : {}),
      verified: false,
      unavailableReason: input.unavailableReason
        ?? 'Signature verification is not implemented in this wave; integrity is checked by re-hashing the artifact.',
      createdAt: deps.clock.now().toISOString(),
      isDemo: false,
    });
    await auditEvent(deps, 'verification_artifact_recorded', auth.account, {}, {
      attestationId: attestation.id,
      kind: attestation.kind,
      subjectHash: attestation.subjectHash,
      artifactHash,
      verified: false,
    });
    return reply.status(201).send(attestationView(attestation, artifactIntegrity(attestation) && attestation.verified));
  });

  app.get<{ Params: { subjectHash: string } }>('/v1/verification/:subjectHash', async (request) => {
    const attestations = await deps.repo.listAttestationsBySubject(request.params.subjectHash);
    return {
      subjectHash: request.params.subjectHash,
      artifacts: attestations.map((attestation) =>
        attestationView(attestation, artifactIntegrity(attestation) && attestation.verified),
      ),
      note: 'Artifacts are re-hashed on read. Modified artifacts fail verification; verified=false means no signature-backed claim.',
    };
  });

  app.get<{ Params: { attestationId: string } }>('/v1/verification/artifact/:attestationId', async (request) => {
    const attestation = await deps.repo.getAttestation(request.params.attestationId);
    if (!attestation) throw new MendError('NOT_FOUND', 'Verification artifact not found');
    return attestationView(attestation, artifactIntegrity(attestation) && attestation.verified);
  });
}
