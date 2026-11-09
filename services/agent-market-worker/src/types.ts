import { z } from 'zod';

export const MARKET_BASE_URL = 'https://market.near.ai';
export const MARKET_API_VERSION = '2.0.0';
export const WORKER_TOKEN_PATTERN = /^aat_[0-9a-f]{32}$/;

export const JobSchema = z
  .object({
    jobId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['open', 'filling', 'in_progress', 'completed', 'closed']),
  })
  .passthrough();

export const AssignmentSchema = z
  .object({
    assignmentId: z.string(),
    jobId: z.string(),
    status: z.enum(['in_progress', 'submitted', 'accepted', 'disputed', 'dispute_resolved', 'cancelled']),
    escrowAmount: z.string().optional(),
    escrowToken: z.string().optional(),
    slaSeconds: z.number().int().positive().optional(),
    slaDeadlineAt: z.string().optional(),
    startedAt: z.string().nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    deliverableUrl: z.string().nullable().optional(),
    bidId: z.string().optional(),
  })
  .passthrough();

export const PollAssignmentsResponseSchema = z
  .object({
    assignments: z.array(
      z
        .object({
          assignment: AssignmentSchema,
          job: JobSchema,
          latestMessage: z.unknown().nullable().optional(),
          autoAcceptAt: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const StartAssignmentResponseSchema = z.object({ startedAt: z.string() }).passthrough();

export const SubmitDeliverableResponseSchema = AssignmentSchema;

export const PlatformConfigSchema = z
  .object({
    platform_fee_bps: z.number().int().min(0).max(10_000),
    email_verification_required: z.boolean(),
    public_host: z.string(),
  })
  .passthrough();

export type Assignment = z.infer<typeof AssignmentSchema>;
export type PollAssignmentsResponse = z.infer<typeof PollAssignmentsResponseSchema>;
export type StartAssignmentResponse = z.infer<typeof StartAssignmentResponseSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export const SubmitDeliverableRequestSchema = z
  .object({
    deliverableMarkdown: z.string().min(1).max(256 * 1024),
    files: z.array(z.string()).max(5).optional(),
  })
  .strict();

export const ProgressRequestSchema = z
  .object({
    message: z.string().min(1).max(280),
    percent: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const DeclineRequestSchema = z
  .object({
    reason: z.enum(['rejected', 'failed']),
    detail: z.string().max(2000).optional(),
  })
  .strict();

export const MessageRequestSchema = z
  .object({
    body: z.string().min(1).max(4000),
    clientRequestId: z.string().max(128).optional(),
  })
  .strict();
