import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HUB_METHODS, MendError, ROLES } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { authFromHeaders, requireRole, ROLE_MATRIX } from '../auth.js';
import { agentView, chainCommandView } from '../serializers.js';
import { auditEvent } from '../services/audit.js';
import { demoStateFingerprint, isDemoScenario, resetDemoState } from '../services/demo-reset.js';
import { KILL_SWITCH_SCOPE } from '../services/kill-switch.js';

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

const killSwitchInput = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().min(1).max(1000),
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
  /** Explicit human confirmation for a live/mainnet deposit request. */
  confirmLive: z.boolean().optional(),
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

  app.get('/v1/admin/kill-switch', async (request) => {
    requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['kill_switch:read'],
      'kill_switch:read',
    );
    return {
      ...deps.killSwitch.status,
      mutatingRoutesPaused: deps.killSwitch.enabled,
      scope: KILL_SWITCH_SCOPE,
      readsRemainAvailable: true,
    };
  });

  app.post('/v1/admin/kill-switch', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['kill_switch:write'],
      'kill_switch:write',
    );
    const input = killSwitchInput.parse(request.body);
    const previous = deps.killSwitch.status;
    const status = deps.killSwitch.set(input.enabled, input.reason, auth.account);

    // Always persist the explicit chain intent first. The command service only
    // reports SUCCESS when the adapter returns a transaction hash; replay hashes
    // stay labelled and are never presented as a real hub transaction.
    const command = await deps.commands.submit(deps.repo, {
      action: input.enabled ? 'pause' : 'unpause',
      method: input.enabled ? HUB_METHODS.pause : HUB_METHODS.unpause,
      args: {
        scope: 'hub',
        enabled: input.enabled,
        reason: input.reason,
        apiKillSwitch: true,
      },
      isDemo: false,
    });
    const adapterSucceeded = command.state === 'SUCCESS' && Boolean(command.txHash);
    const executed = adapterSucceeded && command.realTransaction;

    await auditEvent(
      deps,
      input.enabled ? 'kill_switch_enabled' : 'kill_switch_disabled',
      auth.account,
      {},
      {
        enabled: input.enabled,
        previousEnabled: previous.enabled,
        reason: input.reason,
        scope: KILL_SWITCH_SCOPE,
        readsRemainAvailable: true,
        chainCommandId: command.id,
        chainAction: command.action,
        chainMethod: command.method,
        chainState: command.state,
        chainTxHash: command.txHash ?? null,
        chainRealTransaction: command.realTransaction,
        adapterSucceeded,
        hubPauseExecuted: executed,
      },
    );

    return reply.status(200).send({
      ...status,
      mutatingRoutesPaused: status.enabled,
      scope: KILL_SWITCH_SCOPE,
      readsRemainAvailable: true,
      chainCommand: chainCommandView(command),
      hubPause: {
        action: command.action,
        method: command.method,
        commandId: command.id,
        state: command.state,
        ...(command.txHash ? { txHash: command.txHash } : {}),
        realTransaction: command.realTransaction,
        adapterSucceeded,
        executed,
        note: executed
          ? 'Hub pause/unpause transaction confirmed by the chain adapter.'
          : adapterSucceeded
            ? 'Adapter returned a labelled replay hash; no real hub transaction was executed.'
            : 'Chain command stored as an intent; the hub pause/unpause is not confirmed.',
      },
    });
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
    if (!deps.config.intents.enabled) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'NEAR Intents 1Click is disabled (INTENTS_ENABLED is not true)', {
        provider: deps.intents.provider,
        available: false,
        mainnetOnly: true,
        dryQuotesEnabled: false,
        liveExecutionEnabled: false,
      });
    }
    if (!input.dry) {
      if (!deps.config.intents.allowLive) {
        throw new MendError('UPSTREAM_UNAVAILABLE', 'Live Intents quotes are disabled; only dry previews may be requested', {
          mainnetOnly: true,
          allowLive: false,
          humanConfirmationRequired: true,
        });
      }
      if (input.confirmLive !== true) {
        throw new MendError('INVALID_STATE', 'Live Intents execution requires explicit human confirmation (confirmLive: true)', {
          mainnetOnly: true,
          humanConfirmationRequired: true,
          allowLive: true,
        });
      }
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
      ...(input.confirmLive !== undefined ? { confirmLive: input.confirmLive } : {}),
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
      quoteKind: result.quoteKind,
      label: result.label,
      signatureVerified: result.signatureVerified,
      mainnetOnly: true,
      mainnetLabel: result.mainnetLabel,
      isPayment: false,
      canBePresentedAsPayment: false,
      preview: result.view,
      note: 'NEAR Intents operates on mainnet only. A dry quote is a preview, not a payment, and no transfer is initiated here.',
    });
  });

  app.get<{ Params: { quoteId: string } }>('/v1/intents/status/:quoteId', async (request) => {
    requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['intents:quote'], 'intents:status');
    const quote = await deps.repo.getIntentQuote(request.params.quoteId);
    if (!quote) throw new MendError('NOT_FOUND', 'Intent quote not found', { quoteId: request.params.quoteId });
    let adapterStatus: Record<string, unknown>;
    try {
      const status = await deps.intents.status({
        quoteId: quote.id,
        ...(quote.depositAddress ? { depositAddress: quote.depositAddress } : {}),
        ...(quote.depositMemo ? { depositMemo: quote.depositMemo } : {}),
        ...(quote.deadline ? { deadline: quote.deadline } : {}),
      });
      adapterStatus = {
        live: true,
        status: status.status,
        flowState: status.flowState,
        rawStatus: status.rawStatus,
        verified: status.verified,
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
