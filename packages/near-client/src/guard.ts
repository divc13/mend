import { makeEvent } from '@mend/protocol';
import type { MendEvent } from '@mend/protocol';
import { NearClientError } from './errors.js';

export interface InjectionScan {
  detected: boolean;
  categories: string[];
  matches: string[];
}

const INJECTION_PATTERNS: ReadonlyArray<{ category: string; pattern: RegExp }> = [
  { category: 'ignore-instructions', pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i },
  { category: 'system-prompt', pattern: /(system prompt|developer message|you are now|jailbreak)/i },
  {
    category: 'recipient-change',
    pattern: /(change|set|replace|redirect).{0,40}(recipient|payout|account|wallet|address)/i,
  },
  {
    category: 'acceptance-change',
    pattern: /(mark|consider|treat|declare).{0,40}(accepted|approved|certified|complete)/i,
  },
  { category: 'fund-movement', pattern: /(release|transfer|pay|send).{0,40}(funds|escrow|usdc|money)/i },
  { category: 'role-change', pattern: /(grant|change|elevate).{0,40}(role|admin|permission)/i },
];

/** Detect (but never obey) prompt-injection attempts in untrusted text. */
export function scanPromptInjection(text: string): InjectionScan {
  const categories = new Set<string>();
  const matches: string[] = [];
  for (const { category, pattern } of INJECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      categories.add(category);
      matches.push(match[0].slice(0, 120));
    }
  }
  return { detected: categories.size > 0, categories: [...categories].sort(), matches };
}

export function sanitizeUntrustedText(text: string, maxLength = 12_000): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/<<<MEND_UNTRUSTED_[^>]*>>>/g, '[stripped-delimiter]')
    .slice(0, maxLength);
}

/** Returns sanitised text plus a block event which the caller MUST append to its audit log. */
export function guardUntrustedText(
  text: string,
  meta: { source: string; actor: string; workOrderId?: string; assetId?: string; timestamp?: string },
): { text: string; scan: InjectionScan; blockedEvent?: MendEvent } {
  const scan = scanPromptInjection(text);
  const blockedEvent = scan.detected
    ? makeEvent(
        'prompt_injection_blocked',
        {
          source: meta.source,
          categories: scan.categories,
          matches: scan.matches,
          action: 'treated-as-untrusted-data',
          blocked: true,
        },
        {
          actor: meta.actor,
          ...(meta.workOrderId ? { workOrderId: meta.workOrderId } : {}),
          ...(meta.assetId ? { assetId: meta.assetId } : {}),
          ...(meta.timestamp ? { timestamp: meta.timestamp } : {}),
        },
      )
    : undefined;
  return { text: sanitizeUntrustedText(text), scan, ...(blockedEvent ? { blockedEvent } : {}) };
}

const CERTIFICATION_PATTERNS: ReadonlyArray<RegExp> = [
  /physically\s+safe/i,
  /structurally\s+sound/i,
  /structurally\s+safe/i,
  /certif(y|ied|ication)/i,
  /\b(?:is|has been|was)\s+approved\b/i,
  /\bapproved\s+(?:for\s+occupancy|repair|work)\b/i,
  /\bpassed\s+(?:the\s+)?inspection\b/i,
  /\bsafe\s+to\s+use\b/i,
  /\bmeets?\s+(?:building\s+)?code\b/i,
  /\bguarantee[sd]?\s+safety\b/i,
];

export function findCertificationLanguage(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of CERTIFICATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) hits.push(match[0]);
  }
  return hits;
}

export function assertNoCertificationLanguage(text: string): void {
  const hits = findCertificationLanguage(text);
  if (hits.length > 0) {
    throw new NearClientError(
      'CERTIFICATION_LANGUAGE',
      'output contained physical-safety or acceptance certification language; a human inspector must decide',
      { hits },
    );
  }
}

/** Fields that untrusted input/output must never change. */
const PROTECTED_KEYS = new Set([
  'recipient',
  'recipientaccount',
  'recipient_account',
  'payout',
  'payoutrule',
  'payout_rule',
  'role',
  'actorrole',
  'actor_role',
  'scopehash',
  'scope_hash',
  'accepted',
  'acceptance',
  'approved',
  'approval',
  'certified',
  'certification',
  'winner',
  'winnerbidid',
  'winner_bid_id',
  'award',
  'awarded',
  'releasemicro',
  'release_micro',
  'paymentrule',
  'payment_rule',
]);

export interface TrustedActionContext {
  recipient?: string;
  role?: string;
  scopeHash?: string;
  payoutRule?: string;
  budgetMicro?: string;
  accepted?: 'HUMAN_ONLY';
}

function normalizeKey(key: string): string {
  return key.replace(/[-\s]/g, '_').toLowerCase();
}

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

function walkProtected(
  value: unknown,
  trusted: Record<string, unknown>,
  path: string,
  violations: string[],
  strings: string[],
): void {
  if (typeof value === 'string') {
    strings.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkProtected(item, trusted, `${path}[${index}]`, violations, strings));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeKey(key);
    if (PROTECTED_KEYS.has(normalized)) {
      const trustedKey = Object.keys(trusted).find((candidate) => normalizeKey(candidate) === normalized);
      if (trustedKey === undefined) {
        violations.push(`${path}${path ? '.' : ''}${key}: protected field is not allowed here`);
      } else if (!sameValue(child, trusted[trustedKey])) {
        violations.push(`${path}${path ? '.' : ''}${key}: value changed from trusted context`);
      }
    }
    walkProtected(child, trusted, `${path}${path ? '.' : ''}${key}`, violations, strings);
  }
}

/**
 * Defence in depth after schema validation. Rejects any attempt by untrusted
 * text or model output to introduce/change recipient, role, scope hash,
 * payment rule or acceptance. Callers keep using the trusted context.
 */
export function assertTrustedFieldsUnchanged(output: unknown, context: TrustedActionContext): void {
  const violations: string[] = [];
  const strings: string[] = [];
  walkProtected(output, context as Record<string, unknown>, '', violations, strings);
  assertNoCertificationLanguage(strings.join('\n'));
  if (violations.length > 0) {
    throw new NearClientError(
      'PROMPT_INJECTION_BLOCKED',
      'output attempted to change a protected action field',
      { violations },
    );
  }
}

export function blockedEventFromError(
  error: unknown,
  meta: { source: string; actor: string; workOrderId?: string; timestamp?: string },
): MendEvent {
  const details = error instanceof NearClientError ? (error.details ?? {}) : {};
  return makeEvent(
    'prompt_injection_blocked',
    {
      source: meta.source,
      action: 'rejected-protected-field-change',
      blocked: true,
      ...details,
    },
    {
      actor: meta.actor,
      ...(meta.workOrderId ? { workOrderId: meta.workOrderId } : {}),
      ...(meta.timestamp ? { timestamp: meta.timestamp } : {}),
    },
  );
}
