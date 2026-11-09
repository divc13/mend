import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as protocol from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'generated');
mkdirSync(outDir, { recursive: true });

const schemas = {
  Asset: protocol.AssetSchema,
  Report: protocol.ReportSchema,
  ReportCluster: protocol.ReportClusterSchema,
  DaoApproval: protocol.DaoApprovalSchema,
  WorkOrder: protocol.WorkOrderSchema,
  BidCommitment: protocol.BidCommitmentSchema,
  BidReveal: protocol.BidRevealSchema,
  ScoreExecution: protocol.ScoreExecutionSchema,
  EvidencePackage: protocol.EvidencePackageSchema,
  Inspection: protocol.InspectionSchema,
  EscrowAccount: protocol.EscrowAccountSchema,
  Payment: protocol.PaymentSchema,
  WarrantyCase: protocol.WarrantyCaseSchema,
  AgentIdentity: protocol.AgentIdentitySchema,
  Attestation: protocol.AttestationSchema,
  IntentQuote: protocol.IntentQuoteSchema,
  IntentExecution: protocol.IntentExecutionSchema,
  AuditEvent: protocol.AuditEventSchema,
  ApiError: protocol.ApiErrorSchema,
} as const;

const components: Record<string, unknown> = {};
for (const [name, schema] of Object.entries(schemas)) {
  components[name] = z.toJSONSchema(schema, { target: 'draft-2020-12' });
}

const bundle = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://mend.local/schemas/protocol.json',
  title: 'MEND Protocol Schemas',
  version: '0.1.0',
  components: { schemas: components },
};

writeFileSync(join(outDir, 'json-schema.json'), `${JSON.stringify(bundle, null, 2)}\n`);

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonContent = (name: string) => ({ 'application/json': { schema: ref(name) } });
const okJson = (name: string) => ({ '200': { description: 'OK', content: jsonContent(name) } });

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'MEND API',
    version: '0.1.0',
    description:
      'MEND protocol API. The hub contract is the financial source of truth; Postgres is a read model. AI output is a proposal, never authority to move money.',
  },
  servers: [{ url: 'http://localhost:4000', description: 'local' }],
  paths: {
    '/health': {
      get: { operationId: 'health', responses: { '200': { description: 'Service is healthy' } } },
    },
    '/v1/modes': {
      get: { operationId: 'getModes', responses: { '200': { description: 'LIVE_TESTNET | MAINNET | REPLAY' } } },
    },
    '/v1/assets': {
      get: { operationId: 'listAssets', responses: okJson('Asset') },
      post: {
        operationId: 'createAsset',
        requestBody: { required: true, content: jsonContent('Asset') },
        responses: { '201': { description: 'Created', content: jsonContent('Asset') } },
      },
    },
    '/v1/assets/{assetId}': {
      get: {
        operationId: 'getAsset',
        parameters: [{ name: 'assetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('Asset'),
      },
    },
    '/v1/reports': {
      post: {
        operationId: 'createReport',
        requestBody: { required: true, content: jsonContent('Report') },
        responses: { '201': { description: 'Created', content: jsonContent('Report') } },
      },
    },
    '/v1/work-orders': {
      get: { operationId: 'listWorkOrders', responses: okJson('WorkOrder') },
      post: {
        operationId: 'createWorkOrder',
        requestBody: { required: true, content: jsonContent('WorkOrder') },
        responses: { '201': { description: 'Created', content: jsonContent('WorkOrder') } },
      },
    },
    '/v1/work-orders/{workOrderId}': {
      get: {
        operationId: 'getWorkOrder',
        parameters: [{ name: 'workOrderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('WorkOrder'),
      },
    },
    '/v1/work-orders/{workOrderId}/bids': {
      get: {
        operationId: 'getBids',
        parameters: [{ name: 'workOrderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Commitments and (after reveal) reveals' } },
      },
    },
    '/v1/work-orders/{workOrderId}/score': {
      get: {
        operationId: 'getScore',
        parameters: [{ name: 'workOrderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('ScoreExecution'),
      },
    },
    '/v1/work-orders/{workOrderId}/evidence': {
      get: {
        operationId: 'getEvidence',
        parameters: [{ name: 'workOrderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('EvidencePackage'),
      },
    },
    '/v1/work-orders/{workOrderId}/payments': {
      get: {
        operationId: 'getPayments',
        parameters: [{ name: 'workOrderId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('Payment'),
      },
    },
    '/v1/intents/quote': {
      post: {
        operationId: 'quoteIntent',
        requestBody: { required: true, content: jsonContent('IntentQuote') },
        responses: { '201': { description: 'Quote (dry quotes are not payments)', content: jsonContent('IntentQuote') } },
      },
    },
    '/v1/intents/status/{quoteId}': {
      get: {
        operationId: 'intentStatus',
        parameters: [{ name: 'quoteId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('IntentExecution'),
      },
    },
    '/v1/verification/{subjectHash}': {
      get: {
        operationId: 'getVerification',
        parameters: [{ name: 'subjectHash', in: 'path', required: true, schema: { type: 'string' } }],
        responses: okJson('Attestation'),
      },
    },
  },
  components: {
    schemas: components,
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer' },
    },
  },
};

writeFileSync(join(outDir, 'openapi.json'), `${JSON.stringify(openapi, null, 2)}\n`);
console.log(`wrote ${Object.keys(components).length} schemas to packages/protocol/generated/`);
