import type { FastifyInstance } from 'fastify';
import { REPLAY_LABEL, MAINNET_LABEL, TESTNET_LABEL, WORK_ORDER_MODES } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { escrowView, scoreView } from '../serializers.js';

const MODE_LABELS: Record<(typeof WORK_ORDER_MODES)[number], { label: string; realFunds: boolean; description: string }> = {
  LIVE_TESTNET: {
    label: TESTNET_LABEL,
    realFunds: false,
    description: 'Real testnet transactions with test value only. Never mainnet money.',
  },
  MAINNET: {
    label: MAINNET_LABEL,
    realFunds: true,
    description: 'Mainnet mode. A human must approve any real transfer; agents cannot initiate one.',
  },
  REPLAY: {
    label: REPLAY_LABEL,
    realFunds: false,
    description: 'Recorded or generated replay. Every chain action is labelled replay and is not a live transaction.',
  },
};

export async function registerPublicRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const startedAt = Date.now();

  app.get('/health', async () => {
    const dbOk = await deps.repo.ping();
    return {
      status: dbOk ? 'ok' : 'degraded',
      service: deps.config.serviceName,
      mode: deps.config.mode,
      modeLabel: MODE_LABELS[deps.config.mode].label,
      repository: deps.repo.kind,
      database: dbOk ? 'reachable' : 'unreachable',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      time: deps.clock.now().toISOString(),
      chainAdapter: deps.commands.adapterInfo,
      intents: deps.intentsCapabilities(),
      triage: deps.triageInfo(),
      evidenceAdapter: {
        kind: deps.evidenceStore.kind,
        available: deps.evidenceStore.available,
        ...(deps.evidenceStore.unavailableReason ? { reason: deps.evidenceStore.unavailableReason } : {}),
      },
      demoResetEnabled: deps.config.demo.resetEnabled && deps.config.nodeEnv !== 'production',
      durabilityIntervalMinutes: deps.config.durabilityMinutes,
      killSwitch: {
        enabled: deps.killSwitch.enabled,
        reason: deps.killSwitch.status.reason,
        updatedAt: deps.killSwitch.status.updatedAt,
        updatedBy: deps.killSwitch.status.updatedBy,
      },
    };
  });

  app.get('/v1/modes', async () => ({
    current: deps.config.mode,
    modes: WORK_ORDER_MODES.map((mode) => ({
      mode,
      ...MODE_LABELS[mode],
      active: mode === deps.config.mode,
    })),
    disclaimer:
      'REPLAY data is visibly distinguished from LIVE_TESTNET and MAINNET. No replay action is shown as a live transaction.',
  }));

  app.get('/v1/metrics', async () => {
    const [assets, reports, clusters, workOrders] = await Promise.all([
      deps.repo.listAssets(),
      deps.repo.listReports(),
      deps.repo.listClusters(),
      deps.repo.listWorkOrders(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const workOrder of workOrders) byStatus[workOrder.status] = (byStatus[workOrder.status] ?? 0) + 1;
    let funded = 0n;
    let completion = 0n;
    let holdbackReleased = 0n;
    let holdbackHeld = 0n;
    let refunded = 0n;
    let closed = 0;
    let reopened = 0;
    let verifiedScores = 0;
    let localScores = 0;
    for (const workOrder of workOrders) {
      const escrow = await deps.repo.getEscrow(workOrder.id);
      if (escrow) {
        funded += BigInt(escrow.fundedMicro);
        completion += BigInt(escrow.completionPaidMicro);
        holdbackReleased += BigInt(escrow.holdbackReleasedMicro);
        holdbackHeld += BigInt(escrow.holdbackHeldMicro);
        refunded += BigInt(escrow.refundedMicro);
      }
      if (workOrder.status === 'CLOSED') closed += 1;
      if (workOrder.reopenCount > 0) reopened += 1;
      const scores = await deps.repo.listScoreExecutions(workOrder.id);
      for (const score of scores) {
        if (score.verified) verifiedScores += 1;
        else localScores += 1;
      }
    }
    const accepted = workOrders.filter((w) =>
      ['COMPLETION_ACCEPTED', 'DURABILITY_PENDING', 'CLOSED', 'WARRANTY_REOPENED'].includes(w.status),
    ).length;
    const attempted = workOrders.filter((w) =>
      ['COMPLETION_SUBMITTED', 'COMPLETION_ACCEPTED', 'DURABILITY_PENDING', 'CLOSED', 'WARRANTY_REOPENED', 'DISPUTED'].includes(w.status),
    ).length;

    return {
      mode: deps.config.mode,
      generatedAt: deps.clock.now().toISOString(),
      assets: assets.length,
      reports: reports.length,
      duplicateCandidates: reports.filter((r) => r.status === 'DUPLICATE').length,
      confirmedClusters: clusters.filter((c) => c.status === 'CONFIRMED').length,
      workOrders: workOrders.length,
      workOrdersByStatus: byStatus,
      money: {
        fundedMicro: funded.toString(),
        completionPaidMicro: completion.toString(),
        holdbackReleasedMicro: holdbackReleased.toString(),
        holdbackHeldMicro: holdbackHeld.toString(),
        refundedMicro: refunded.toString(),
        note: 'Amounts are integer micro-units. REPLAY mode amounts are not real funds.',
      },
      repairs: {
        closed,
        repeatFailures: reopened,
        completionAcceptanceRateBps: attempted === 0 ? null : Math.round((accepted * 10_000) / attempted),
      },
      verification: {
        verifiedScoreExecutions: verifiedScores,
        labelledLocalScoreExecutions: localScores,
        outlayerExecutionAvailable: false,
        note: 'Local deterministic scoring is labelled and is not an OutLayer attestation.',
      },
      adapters: {
        chain: deps.commands.adapterInfo,
        triage: deps.triageInfo(),
        intents: deps.intentsCapabilities(),
        evidence: {
          kind: deps.evidenceStore.kind,
          available: deps.evidenceStore.available,
          ...(deps.evidenceStore.unavailableReason ? { reason: deps.evidenceStore.unavailableReason } : {}),
        },
      },
    };
  });

  // Small convenience endpoint used by the frontend case timeline.
  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/escrow', async (request) => {
    const escrow = await deps.repo.getEscrow(request.params.workOrderId);
    if (!escrow) {
      return { workOrderId: request.params.workOrderId, escrow: null };
    }
    return { workOrderId: escrow.workOrderId, escrow: escrowView(escrow) };
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/verification', async (request) => {
    const scores = await deps.repo.listScoreExecutions(request.params.workOrderId);
    return {
      workOrderId: request.params.workOrderId,
      scores: scores.map(scoreView),
      outlayerAvailable: false,
      note: 'Score executions with verified=false are labelled local deterministic replays, never OutLayer attestations.',
    };
  });
}
