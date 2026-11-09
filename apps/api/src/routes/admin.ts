import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MendError, ROLES } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { authFromHeaders, requireRole, ROLE_MATRIX } from '../auth.js';
import { agentView } from '../serializers.js';
import { auditEvent } from '../services/audit.js';
import { demoStateFingerprint, isDemoScenario, resetDemoState } from '../services/demo-reset.js';

const agentInput = z.object({
  account: z.string().min(2).max(64),
  role: z.enum(ROLES),
  keyKind: z.enum(['FUNCTION_CALL', 'HUMAN_WALLET', 'CONTRACT']),
  allowedReceiver: z.string().min(2).max(64),
  allowedMethods: z.array(z.string().min(1)).min(1),
  allowanceMicro: z.string().regex(/^\d+$/).optional(),
  label: z.string().min(1).max(200),
});

const demoResetInput = z.object({
  scenario: z.string().min(1).optional(),
});

const quoteInput = z.object({
  dry: z.boolean().default(true),
  srcChain: z.string().min(1).max(40),
  srcAsset: z.string().min(1).max(80),
  dstAsset: z.string().min(1).max(80),
  amountIn: z.string().regex(/^\d+$/),
  recipient: z.string().min(2).max(64),
  workOrderId: z.string().min(1).optional(),
  refundTo: z.string().min(2).max(64).optional(),
});

const daoApprovalInput = z.object({
  id: z.string().min(1).max(80).optional(),
  daoAccount: z.string().min(2).max(64),
  proposalId: z.string().regex(/^\d{1,10}$/),
  budgetMicro: z.string().regex(/^\d+$/),
  contractorRoster: z.array(z.string().min(2).max(64)).min(1),
  inspectorRoster: z.array(z.string().min(2).max(64)).min(1),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(['PROPOSED', 'APPROVED', 'REJECTED', 'EXPIRED']).default('APPROVED'),
  approvedAt: z.string().optional(),
});

export async function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/v1/dao-approvals', async () => {
    return deps.repo.listDaoApprovals();
  });

  app.get<{ Params: { approvalId: string } }>('/v1/dao-approvals/:approvalId', async (request) => {
    const approval = await deps.repo.getDaoApproval(request.params.approvalId);
    if (!approval) throw new MendError('NOT_FOUND', 'DAO approval not found');
    return approval;
  });

  app.post('/v1/dao-approvals', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['dao_approval:create'],
      'dao_approval:create',
    );
    const input = daoApprovalInput.parse(request.body);
    const id = input.id ?? `dao-${input.proposalId}`;
    if (await deps.repo.getDaoApproval(id)) {
      throw new MendError('VALIDATION_ERROR', 'DAO approval already exists', { id });
    }
    const approval = await deps.repo.createDaoApproval({
      id,
      daoAccount: input.daoAccount,
      proposalId: input.proposalId,
      budgetMicro: input.budgetMicro,
      contractorRoster: input.contractorRoster,
      inspectorRoster: input.inspectorRoster,
      policyHash: input.policyHash,
      state: input.state,
      ...(input.approvedAt ? { approvedAt: input.approvedAt } : {}),
      isDemo: false,
    });
    await auditEvent(deps, 'dao_approval_recorded', auth.account, {}, {
      approvalId: approval.id,
      proposalId: approval.proposalId,
      state: approval.state,
      policyHash: approval.policyHash,
    });
    return reply.status(201).send(approval);
  });

  app.get('/v1/agents', async () => {
    return (await deps.repo.listAgents()).map(agentView);
  });

  app.get<{ Params: { account: string } }>('/v1/agents/:account', async (request) => {
    const agents = (await deps.repo.listAgents()).filter((agent) => agent.account === request.params.account);
    if (agents.length === 0) throw new MendError('NOT_FOUND', 'Agent identity not found');
    return agents.map(agentView);
  });

  app.post('/v1/agents', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['agent:upsert'], 'agent:upsert');
    const input = agentInput.parse(request.body);
    const agent = await deps.repo.upsertAgent({
      ...input,
      canReleaseEscrow: false,
      isDemo: false,
    });
    await auditEvent(deps, 'agent_identity_upserted', auth.account, {}, {
      account: agent.account,
      role: agent.role,
      allowedReceiver: agent.allowedReceiver,
      allowedMethods: agent.allowedMethods,
      canReleaseEscrow: false,
    });
    return reply.status(201).send(agentView(agent));
  });

  app.get('/v1/audit', async (request) => {
    requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['audit:read'], 'audit:read');
    const query = request.query as { workOrderId?: string; assetId?: string; name?: string; limit?: string; offset?: string };
    const events = await deps.repo.listAudit({
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.name ? { name: query.name } : {}),
      ...(query.limit ? { limit: Number(query.limit) } : {}),
      ...(query.offset ? { offset: Number(query.offset) } : {}),
    });
    return {
      appendOnly: true,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        actor: event.actor,
        ...(event.workOrderId ? { workOrderId: event.workOrderId } : {}),
        ...(event.assetId ? { assetId: event.assetId } : {}),
        at: event.at,
        data: event.data,
      })),
    };
  });

  app.get('/v1/demo/state', async (request) => {
    if (!deps.config.demo.resetEnabled || deps.config.nodeEnv === 'production') {
      throw new MendError('NOT_FOUND', 'Demo controls are disabled');
    }
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['demo:reset'], 'demo:state');
    if (auth.account !== deps.config.demo.account) {
      throw new MendError('FORBIDDEN_ROLE', 'Only the designated demo account may read demo state', {
        demoAccount: deps.config.demo.account,
      });
    }
    return {
      scenario: deps.config.demo.defaultScenario,
      fingerprint: await demoStateFingerprint(deps.repo),
      mode: deps.config.mode,
    };
  });

  app.post('/v1/demo/reset', async (request, reply) => {
    // No production reset route exists: the handler is unreachable in production
    // and behaves as a 404 when demo controls are disabled.
    if (!deps.config.demo.resetEnabled || deps.config.nodeEnv === 'production') {
      throw new MendError('NOT_FOUND', 'Demo reset is not available');
    }
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['demo:reset'], 'demo:reset');
    if (auth.account !== deps.config.demo.account) {
      throw new MendError('FORBIDDEN_ROLE', 'Only the designated demo account may reset demo data', {
        demoAccount: deps.config.demo.account,
      });
    }
    const input = demoResetInput.parse(request.body ?? {});
    const scenario = input.scenario ?? deps.config.demo.defaultScenario;
    if (!isDemoScenario(scenario)) {
      throw new MendError('VALIDATION_ERROR', 'Unknown demo scenario', {
        supported: ['successfulRepair', 'duplicateReport', 'failedDurability', 'closed'],
      });
    }
    const result = await resetDemoState(deps.repo, scenario);
    await auditEvent(deps, 'demo_reset', auth.account, {}, {
      scenario: result.scenario,
      fingerprint: result.fingerprint,
      onlyDemoData: true,
    });
    return reply.status(200).send({
      reset: true,
      scenario: result.scenario,
      fingerprint: result.fingerprint,
      resetAt: deps.clock.now().toISOString(),
      note: 'Only rows marked as demo data were replaced. Audit events are append-only and survive resets. No production reset route exists.',
    });
  });

  app.get('/v1/intents/capabilities', async () => {
    return deps.intentsCapabilities();
  });

  app.post('/v1/intents/quote', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['intents:quote'], 'intents:quote');
    const input = quoteInput.parse(request.body);
    if (!input.dry && !deps.config.intents.allowLive) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live Intents quotes are disabled; only dry previews may be requested', {
        mainnetOnly: true,
        allowLive: false,
      });
    }
    if (input.workOrderId) {
      const workOrder = await deps.repo.getWorkOrder(input.workOrderId);
      if (!workOrder) throw new MendError('NOT_FOUND', 'Work order not found', { workOrderId: input.workOrderId });
    }
    const result = await deps.intents.quote({
      dry: input.dry,
      srcChain: input.srcChain,
      srcAsset: input.srcAsset,
      dstAsset: input.dstAsset,
      amountIn: input.amountIn,
      recipient: input.recipient,
      ...(input.workOrderId ? { workOrderId: input.workOrderId } : {}),
      ...(input.refundTo ? { refundTo: input.refundTo } : {}),
    });
    const seq = await deps.repo.nextSequence('intent-quote');
    const quote = await deps.repo.createIntentQuote({
      id: `IQ-${String(seq).padStart(4, '0')}`,
      dry: input.dry,
      srcChain: input.srcChain,
      srcAsset: input.srcAsset,
      dstChain: 'near',
      dstAsset: input.dstAsset,
      amountIn: input.amountIn,
      amountOut: result.amountOut,
      ...(result.feesUsd !== undefined ? { feesUsd: result.feesUsd } : {}),
      recipient: input.recipient,
      ...(result.depositAddress ? { depositAddress: result.depositAddress } : {}),
      ...(result.depositMemo ? { depositMemo: result.depositMemo } : {}),
      ...(result.deadline ? { deadline: result.deadline } : {}),
      status: 'PENDING',
      ...(input.workOrderId ? { workOrderId: input.workOrderId } : {}),
      raw: result.raw,
      createdAt: deps.clock.now().toISOString(),
      isDemo: false,
    });
    await auditEvent(deps, 'intent_quote_created', auth.account, {}, {
      quoteId: quote.id,
      dry: quote.dry,
      mainnetOnly: true,
      workOrderId: quote.workOrderId ?? null,
    });
    return reply.status(201).send({
      ...quote,
      mainnetOnly: true,
      note: 'NEAR Intents operates on mainnet only. A dry quote is not a payment and no transfer is initiated here.',
    });
  });

  app.get<{ Params: { quoteId: string } }>('/v1/intents/status/:quoteId', async (request) => {
    requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['intents:quote'], 'intents:status');
    const quote = await deps.repo.getIntentQuote(request.params.quoteId);
    if (!quote) throw new MendError('NOT_FOUND', 'Intent quote not found', { quoteId: request.params.quoteId });
    let adapterStatus: Record<string, unknown>;
    try {
      const status = await deps.intents.status(quote.id);
      adapterStatus = {
        live: true,
        status: status.status,
        ...(status.destinationTxHash ? { destinationTxHash: status.destinationTxHash } : {}),
        ...(status.explorerUrl ? { explorerUrl: status.explorerUrl } : {}),
        raw: status.raw,
      };
      await deps.repo.updateIntentQuote(quote.id, { status: status.status });
    } catch (error) {
      if (!(error instanceof MendError)) throw error;
      adapterStatus = {
        live: false,
        status: quote.status,
        unavailable: true,
        reason: error.message,
      };
    }
    return {
      quote,
      adapter: adapterStatus,
      capabilities: deps.intentsCapabilities(),
      note: 'A stored PENDING quote is not a completed transfer. Mainnet-only provider; no agent may initiate a real transfer.',
    };
  });
}
