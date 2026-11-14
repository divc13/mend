import { apiFetch, type ApiResult } from './api';

/**
 * Client helpers for role-gated work-order actions.
 *
 * The proxy forwards the sessionStorage demo identity as `x-mend-role` /
 * `x-mend-account`. These are spoofable demo headers, not wallet signatures.
 * Every helper reports only what the API actually returned: a command with
 * `applied: true` is still not shown as a live chain action without
 * `realTransaction` and a transaction hash.
 */

export interface ChainCommandView {
  id?: string;
  state?: string;
  mode?: string;
  txHash?: string;
  realTransaction?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface WorkOrderActionPayload {
  applied?: boolean;
  workOrder?: {
    id?: string;
    status?: string;
    contractorId?: string;
    inspectorId?: string;
    updatedAt?: string;
  };
  command?: ChainCommandView;
  label?: string | null;
}

export interface WorkOrderActionResultSummary {
  ok: boolean;
  applied: boolean;
  realTransaction: boolean;
  txHash?: string;
  tone: 'positive' | 'warning' | 'danger';
  message: string;
}

function resultFailure(result: Extract<ApiResult<WorkOrderActionPayload>, { ok: false }>, actionLabel: string) {
  return {
    ok: false,
    applied: false,
    realTransaction: false,
    tone: 'danger' as const,
    message: `The API did not accept the ${actionLabel}: ${result.message}`,
  };
}

/**
 * Converts an action response into an honest UI sentence. Fixtures, a
 * repository-only success and a real chain transaction never share a label.
 */
export function summarizeActionResult(
  result: ApiResult<WorkOrderActionPayload>,
  actionLabel: string,
): WorkOrderActionResultSummary {
  if (!result.ok) return resultFailure(result, actionLabel);

  const payload = result.data ?? {};
  const applied = payload.applied === true;
  const realTransaction = payload.command?.realTransaction === true;
  const txHash = payload.command?.txHash;
  const error = payload.command?.errorMessage ?? payload.command?.errorCode;

  if (!applied) {
    return {
      ok: true,
      applied: false,
      realTransaction,
      ...(txHash ? { txHash } : {}),
      tone: 'warning',
      message: `The API accepted the ${actionLabel} request but did not apply it${
        error ? ` (${error})` : ''
      }. No ${actionLabel} is shown as complete.`,
    };
  }

  if (!realTransaction) {
    return {
      ok: true,
      applied: true,
      realTransaction: false,
      ...(txHash ? { txHash } : {}),
      tone: 'warning',
      message: `The API applied the ${actionLabel} to its stored state, but its chain adapter reported no real transaction. Do not treat this as a live chain action.`,
    };
  }

  if (!txHash) {
    return {
      ok: true,
      applied: true,
      realTransaction: true,
      tone: 'warning',
      message: `The API reports a real testnet ${actionLabel} but supplied no transaction hash. No explorer link is shown.`,
    };
  }

  return {
    ok: true,
    applied: true,
    realTransaction: true,
    txHash,
    tone: 'positive',
    message: `The API reports the ${actionLabel} applied with a real testnet transaction. Verify the hash before relying on it.`,
  };
}

export function postWorkOrderAction(
  workOrderId: string,
  action: string,
  body: Record<string, unknown> = {},
) {
  return apiFetch<WorkOrderActionPayload>(
    `/v1/work-orders/${encodeURIComponent(workOrderId)}/actions/${encodeURIComponent(action)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export interface CreateInspectionInput {
  kind: 'COMPLETION' | 'DURABILITY' | 'REMEDIATION';
  decision: 'APPROVED' | 'REJECTED';
  evidencePackageId: string;
  notesHash?: string;
}

export function createInspection(workOrderId: string, input: CreateInspectionInput) {
  return apiFetch<{ id?: string; decision?: string; inspectorId?: string }>(
    `/v1/work-orders/${encodeURIComponent(workOrderId)}/inspections`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

/**
 * Hashes optional inspector notes in the browser. If Web Crypto is unavailable
 * the hash is omitted rather than fabricated; the API field is optional.
 */
export async function sha256Hex(value: string): Promise<string | undefined> {
  const text = value.trim();
  if (!text) return undefined;
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;

  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
}
