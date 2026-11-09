import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ASSET_ID_PATTERN,
  FIXTURE_ACCOUNTS,
  MendError,
  PublicLocationSchema,
  REPLAY_LABEL,
} from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { authFromHeaders, ROLE_MATRIX, requireRole } from '../auth.js';
import {
  assetView,
  chainCommandView,
  escrowView,
  inspectionView,
  paymentView,
  reportView,
  scoreView,
  warrantyView,
  workOrderView,
} from '../serializers.js';
import { auditEvent } from '../services/audit.js';

const assetInput = z.object({
  id: z.string().regex(ASSET_ID_PATTERN, 'invalid asset id'),
  publicDescription: z.string().min(1).max(2000),
  assetType: z.enum(['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other']),
  publicLocation: PublicLocationSchema,
  passportTokenId: z.string().min(1).max(128).optional(),
});

const assetPatch = z.object({
  publicDescription: z.string().min(1).max(2000).optional(),
  assetType: z.enum(['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other']).optional(),
  publicLocation: PublicLocationSchema.optional(),
});

export async function registerAssetRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  async function requireAsset(assetId: string) {
    const asset = await deps.repo.getAsset(assetId);
    if (!asset) throw new MendError('NOT_FOUND', 'Asset not found', { assetId });
    return asset;
  }

  app.get('/v1/assets', async () => {
    const assets = await deps.repo.listAssets();
    return assets.map(assetView);
  });

  app.post('/v1/assets', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['asset:create'], 'asset:create');
    const input = assetInput.parse(request.body);
    if (await deps.repo.getAsset(input.id)) {
      throw new MendError('VALIDATION_ERROR', 'Asset already exists', { assetId: input.id });
    }
    const asset = await deps.repo.createAsset({
      id: input.id,
      publicDescription: input.publicDescription,
      assetType: input.assetType,
      publicLocation: input.publicLocation,
      ...(input.passportTokenId ? { passportTokenId: input.passportTokenId } : {}),
      createdAt: deps.clock.now().toISOString(),
      isDemo: false,
    });
    await auditEvent(deps, 'asset_created', auth.account, { assetId: asset.id }, {
      assetType: asset.assetType,
      publicLocation: asset.publicLocation,
    });
    return reply.status(201).send(assetView(asset));
  });

  app.get<{ Params: { assetId: string } }>('/v1/assets/:assetId', async (request) => {
    return assetView(await requireAsset(request.params.assetId));
  });

  app.patch<{ Params: { assetId: string } }>('/v1/assets/:assetId', async (request) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['asset:update'], 'asset:update');
    await requireAsset(request.params.assetId);
    const patch = assetPatch.parse(request.body);
    if (Object.keys(patch).length === 0) throw new MendError('VALIDATION_ERROR', 'No asset fields supplied');
    const updated = await deps.repo.updateAsset(request.params.assetId, patch);
    if (!updated) throw new MendError('NOT_FOUND', 'Asset not found');
    await auditEvent(deps, 'asset_updated', auth.account, { assetId: updated.id }, { fields: Object.keys(patch) });
    return assetView(updated);
  });

  app.delete<{ Params: { assetId: string } }>('/v1/assets/:assetId', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['asset:delete'], 'asset:delete');
    const asset = await requireAsset(request.params.assetId);
    const [reports, workOrders] = await Promise.all([
      deps.repo.listReports({ assetId: asset.id }),
      deps.repo.listWorkOrders({ assetId: asset.id }),
    ]);
    if (reports.length > 0 || workOrders.length > 0) {
      throw new MendError('INVALID_STATE', 'Assets with history cannot be deleted', {
        reports: reports.length,
        workOrders: workOrders.length,
      });
    }
    await deps.repo.deleteAsset(asset.id);
    await auditEvent(deps, 'asset_deleted', auth.account, { assetId: asset.id }, {});
    return reply.status(204).send();
  });

  app.post<{ Params: { assetId: string } }>('/v1/assets/:assetId/passport/mint', async (request) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['asset:passport_mint'],
      'asset:passport_mint',
    );
    const asset = await requireAsset(request.params.assetId);
    if (asset.passportTokenId) {
      throw new MendError('INVALID_STATE', 'Passport already minted', { tokenId: asset.passportTokenId });
    }
    const command = await deps.commands.submit(deps.repo, {
      workOrderId: undefined,
      action: 'mint_passport',
      method: 'mint_passport',
      args: { assetId: asset.id, tokenId: asset.id, nonTransferable: true },
      isDemo: false,
    });
    if (command.state !== 'SUCCESS') {
      return { command: chainCommandView(command), asset: assetView(asset), applied: false };
    }
    const updated = await deps.repo.updateAsset(asset.id, { passportTokenId: asset.id });
    await auditEvent(deps, 'passport_minted', auth.account, { assetId: asset.id }, {
      tokenId: asset.id,
      nonTransferable: true,
      realTransaction: command.realTransaction,
    });
    return {
      command: chainCommandView(command),
      asset: updated ? assetView(updated) : assetView(asset),
      applied: true,
      label: command.realTransaction ? null : REPLAY_LABEL,
    };
  });

  async function passportFor(assetId: string) {
    const asset = await requireAsset(assetId);
    const [workOrders, reports] = await Promise.all([
      deps.repo.listWorkOrders({ assetId }),
      deps.repo.listReports({ assetId }),
    ]);
    const approvals = await deps.repo.listDaoApprovals();
    const daoAccount = approvals.find((approval) => workOrders.some((w) => w.daoApprovalId === approval.id))?.daoAccount
      ?? approvals[0]?.daoAccount
      ?? FIXTURE_ACCOUNTS.dao;
    const evidenceHashes: string[] = [];
    const payments = [];
    const inspections = [];
    const warranties = [];
    const contractors = new Set<string>();
    const inspectors = new Set<string>();
    let repairVsReplace = 'REPAIR';
    let repeatFailures = 0;
    for (const workOrder of workOrders) {
      if (workOrder.contractorId) contractors.add(workOrder.contractorId);
      if (workOrder.inspectorId) inspectors.add(workOrder.inspectorId);
      repeatFailures += workOrder.reopenCount;
      if (workOrder.reopenCount > 0) repairVsReplace = 'REPAIR_WITH_REPEAT_FAILURE';
      const [packages, woInspections, woPayments, woWarranties] = await Promise.all([
        deps.repo.listEvidencePackages(workOrder.id),
        deps.repo.listInspections(workOrder.id),
        deps.repo.listPayments(workOrder.id),
        deps.repo.listWarrantyCases(workOrder.id),
      ]);
      for (const pkg of packages) evidenceHashes.push(...pkg.evidenceHashes);
      inspections.push(...woInspections);
      payments.push(...woPayments);
      warranties.push(...woWarranties);
    }
    return {
      tokenId: asset.passportTokenId ?? null,
      minted: Boolean(asset.passportTokenId),
      nonTransferable: true,
      transferDisabled: true,
      owner: daoAccount,
      ownerNote: 'The passport is held by the DAO/protocol for maintenance history. It is not legal ownership of the physical asset.',
      legalOwnership: 'NONE — this token records maintenance history only.',
      asset: assetView(asset),
      lifecycleState: workOrders[0]?.status ?? 'NO_WORK_ORDER',
      workOrders: workOrders.map(workOrderView),
      workOrderHashes: workOrders.map((w) => ({ workOrderId: w.id, scopeHash: w.scopeHash, policyHash: w.policyHash })),
      evidenceHashes,
      reports: reports.map((report) => reportView(report)),
      contractors: [...contractors],
      inspectors: [...inspectors],
      payments: payments.map(paymentView),
      inspections: inspections.map(inspectionView),
      warranties: warranties.map(warrantyView),
      repeatFailures,
      repairVsReplace,
    };
  }

  app.get<{ Params: { assetId: string } }>('/v1/assets/:assetId/passport', async (request) => {
    return passportFor(request.params.assetId);
  });

  app.get<{ Params: { tokenId: string } }>('/v1/passport/:tokenId', async (request) => {
    const assets = await deps.repo.listAssets();
    const asset = assets.find((candidate) => candidate.passportTokenId === request.params.tokenId);
    if (!asset) throw new MendError('NOT_FOUND', 'Passport not found', { tokenId: request.params.tokenId });
    return passportFor(asset.id);
  });

  app.get<{ Params: { assetId: string } }>('/v1/assets/:assetId/history', async (request) => {
    const passport = await passportFor(request.params.assetId);
    const workOrders = await deps.repo.listWorkOrders({ assetId: request.params.assetId });
    const timeline = [];
    for (const workOrder of workOrders) {
      const [escrow, payments, inspections, warranties, scores, commands] = await Promise.all([
        deps.repo.getEscrow(workOrder.id),
        deps.repo.listPayments(workOrder.id),
        deps.repo.listInspections(workOrder.id),
        deps.repo.listWarrantyCases(workOrder.id),
        deps.repo.listScoreExecutions(workOrder.id),
        deps.repo.listChainCommands(workOrder.id),
      ]);
      timeline.push({
        workOrder: workOrderView(workOrder),
        escrow: escrow ? escrowView(escrow) : null,
        payments: payments.map(paymentView),
        inspections: inspections.map(inspectionView),
        warranties: warranties.map(warrantyView),
        scores: scores.map(scoreView),
        commands: commands.map(chainCommandView),
      });
    }
    const audit = await deps.repo.listAudit({ assetId: request.params.assetId });
    return {
      ...passport,
      timeline,
      audit: audit.map((event) => ({
        id: event.id,
        name: event.name,
        actor: event.actor,
        at: event.at,
        data: event.data,
      })),
      note: 'History is append-only. Replay transactions are labelled and are not live transactions.',
    };
  });

  app.post<{ Params: { tokenId: string } }>('/v1/passport/:tokenId/transfer', async (request) => {
    let actor = 'anonymous';
    try {
      actor = authFromHeaders(request.headers, deps.config)?.account ?? actor;
    } catch {
      // Transfer must fail regardless of header validity.
    }
    await auditEvent(deps, 'passport_transfer_rejected', actor, {}, {
      tokenId: request.params.tokenId,
      reason: 'TRANSFER_DISABLED',
    });
    throw new MendError('TRANSFER_DISABLED', 'MEND maintenance passports are non-transferable', {
      tokenId: request.params.tokenId,
    });
  });
}
