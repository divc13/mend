import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MendError, WorkOrderStateSchema } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { assetView } from '../serializers.js';
import { buildCaseBundle, buildCaseSummaries } from '../services/case-read-model.js';

const listQuery = z.object({
  status: WorkOrderStateSchema.optional(),
  assetId: z.string().min(1).max(64).optional(),
  contractorId: z.string().min(2).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Public, read-only views used by the web app without the demo runner.
 * These routes never require demo auth and never return private report data.
 */
export async function registerCaseRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/v1/cases', async (request) => {
    const query = listQuery.parse(request.query);
    const workOrders = await deps.repo.listWorkOrders({
      ...(query.status ? { status: query.status } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.contractorId ? { contractorId: query.contractorId } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.offset !== undefined ? { offset: query.offset } : {}),
    });
    return buildCaseSummaries(deps, workOrders);
  });

  app.get<{ Params: { assetId: string } }>('/v1/cases/by-asset/:assetId', async (request) => {
    const asset = await deps.repo.getAsset(request.params.assetId);
    if (!asset) {
      throw new MendError('NOT_FOUND', 'Asset not found', { assetId: request.params.assetId });
    }
    const workOrders = await deps.repo.listWorkOrders({ assetId: asset.id });
    return {
      asset: assetView(asset),
      cases: await buildCaseSummaries(deps, workOrders),
    };
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/cases/:workOrderId', async (request) => {
    const workOrder = await deps.repo.getWorkOrder(request.params.workOrderId);
    if (!workOrder) {
      throw new MendError('NOT_FOUND', 'Case not found', {
        workOrderId: request.params.workOrderId,
      });
    }
    return buildCaseBundle(deps, workOrder);
  });
}
