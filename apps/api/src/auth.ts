import { MendError, ROLES, isNearAccount, type Role } from '@mend/protocol';
import type { AppConfig } from './config.js';

/**
 * DEMO AUTHORIZATION ONLY.
 *
 * Wave 1 uses `x-mend-role` and `x-mend-account` headers so the frontend and
 * agents can exercise the role matrix without a wallet. These headers are
 * trivially spoofable. Production replaces this module with a verified
 * JWT/signature/NEP-413 middleware that derives the same AuthContext; no route
 * or role matrix below changes when that swap happens. See apps/api/README.md.
 */
export interface AuthContext {
  role: Role;
  account: string;
  demoHeaderAuth: true;
}

export interface HeaderLike {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function authFromHeaders(headers: HeaderLike, config: AppConfig): AuthContext | null {
  if (!config.auth.demoHeadersEnabled) {
    throw new MendError('UNAUTHORIZED', 'Demo role headers are disabled; a verified signature or JWT is required');
  }
  const roleHeader = first(headers['x-mend-role']);
  if (!roleHeader) return null;
  const role = roleHeader.trim().toUpperCase();
  if (!isRole(role)) {
    throw new MendError('UNAUTHORIZED', 'Unknown role header', {
      role: roleHeader,
      allowedRoles: ROLES,
    });
  }
  const account = (first(headers['x-mend-account']) ?? config.auth.defaultAccount).trim();
  if (!isNearAccount(account)) {
    throw new MendError('UNAUTHORIZED', 'Invalid account header', { account });
  }
  return { role, account, demoHeaderAuth: true };
}

export function requireRole(
  auth: AuthContext | null,
  allowed: readonly Role[],
  action: string,
): AuthContext {
  if (!auth) {
    throw new MendError('UNAUTHORIZED', `Role required for ${action}`, {
      allowedRoles: allowed,
      hint: 'Send x-mend-role and x-mend-account in demo mode.',
    });
  }
  if (!allowed.includes(auth.role)) {
    throw new MendError('FORBIDDEN_ROLE', `Role ${auth.role} may not perform ${action}`, {
      action,
      role: auth.role,
      allowedRoles: allowed,
    });
  }
  return auth;
}

export const WORK_ORDER_ACTION_ROLES = {
  dao_authorize: ['DAO'],
  fund: ['SPONSOR'],
  open_bidding: ['STEWARD'],
  close_bidding: ['STEWARD'],
  award: ['STEWARD'],
  start_work: ['CONTRACTOR'],
  submit_completion: ['CONTRACTOR'],
  accept_completion: ['INSPECTOR'],
  inspect_durability: ['INSPECTOR'],
  open_dispute: ['STEWARD', 'INSPECTOR', 'CONTRACTOR'],
  resolve_dispute: ['DAO'],
  cancel_work_order: ['STEWARD'],
  refund: ['DAO', 'STEWARD'],
  pause: ['ADMIN', 'DAO'],
  unpause: ['ADMIN', 'DAO'],
} as const satisfies Record<string, readonly Role[]>;

export type WorkOrderAction = keyof typeof WORK_ORDER_ACTION_ROLES;

export const ROLE_MATRIX = {
  'asset:create': ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  'asset:update': ['STEWARD', 'ADMIN'],
  'asset:delete': ['STEWARD', 'ADMIN'],
  'asset:passport_mint': ['STEWARD', 'ADMIN'],
  'report:update': ['STEWARD', 'ADMIN'],
  'report:triage': ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  'report:private_location': ['STEWARD', 'DAO', 'ADMIN'],
  'cluster:create': ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  'cluster:update': ['STEWARD', 'ADMIN'],
  'dao_approval:create': ['DAO', 'ADMIN'],
  'work_order:create': ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  'work_order:action': Object.values(WORK_ORDER_ACTION_ROLES).flat() as Role[],
  'bid:commit': ['CONTRACTOR'],
  'bid:reveal': ['CONTRACTOR'],
  'score:record': ['STEWARD', 'ADMIN'],
  'evidence:upload': ['CONTRACTOR', 'INSPECTOR', 'STEWARD'],
  'evidence:access': ['STEWARD', 'DAO', 'ADMIN', 'INSPECTOR', 'REVIEWER_AI', 'CONTRACTOR'],
  'inspection:create': ['INSPECTOR'],
  'payment:create': ['STEWARD', 'ADMIN'],
  'agent:upsert': ['ADMIN'],
  'verification:create': ['STEWARD', 'ADMIN', 'COORDINATOR_AI', 'REVIEWER_AI'],
  'verification:read': ['STEWARD', 'DAO', 'ADMIN', 'INSPECTOR', 'REVIEWER_AI', 'COORDINATOR_AI'],
  'intents:quote': ['SPONSOR', 'ADMIN'],
  'audit:read': ['ADMIN', 'DAO', 'STEWARD'],
  'demo:reset': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export function actionRoles(action: WorkOrderAction): readonly Role[] {
  return WORK_ORDER_ACTION_ROLES[action];
}

export function isWorkOrderAction(value: string): value is WorkOrderAction {
  return Object.prototype.hasOwnProperty.call(WORK_ORDER_ACTION_ROLES, value);
}
