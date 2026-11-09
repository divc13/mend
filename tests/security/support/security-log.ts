import { scanPromptInjection, type InjectionScan } from '@mend/ai-client';

import { sha256Hex } from './repo.js';

export const SECURITY_LOG_SCHEMA = 'mend.security-log.v1' as const;
export const PROMPT_INJECTION_EVENT = 'PROMPT_INJECTION_DETECTED' as const;

export type AttackSurface = 'report' | 'evidence' | 'bid-explanation' | 'agent-market-brief';

export interface SecurityLogEntry {
  schema: typeof SECURITY_LOG_SCHEMA;
  event: typeof PROMPT_INJECTION_EVENT;
  surface: AttackSurface;
  categories: string[];
  /** Hash of the untrusted text. The raw attack text must never be logged. */
  textHash: string;
  textLength: number;
  actionTaken: 'NONE';
  authorityChanged: false;
}

/**
 * Contract for the application security log. This is the shape the API and
 * worker services must emit for untrusted input. The tests use it with the
 * product `scanPromptInjection` guard so the detection -> log -> no-action
 * chain is exercised even when the service runtime is not present.
 */
export function recordInjectionAttempt(surface: AttackSurface, text: string): SecurityLogEntry {
  const scan = scanPromptInjection(text);
  if (!scan.detected) {
    throw new Error(`attack fixture for surface "${surface}" was not detected by scanPromptInjection`);
  }
  return {
    schema: SECURITY_LOG_SCHEMA,
    event: PROMPT_INJECTION_EVENT,
    surface,
    categories: [...scan.categories],
    textHash: sha256Hex(text),
    textLength: text.length,
    actionTaken: 'NONE',
    authorityChanged: false,
  };
}

/** Minimal runtime validation so a malformed log entry fails the suite. */
export function assertValidSecurityLogEntry(entry: unknown): asserts entry is SecurityLogEntry {
  if (!entry || typeof entry !== 'object') throw new Error('security log entry is not an object');
  const record = entry as Record<string, unknown>;
  if (record.schema !== SECURITY_LOG_SCHEMA) throw new Error('wrong security log schema');
  if (record.event !== PROMPT_INJECTION_EVENT) throw new Error('wrong security log event');
  if (!['report', 'evidence', 'bid-explanation', 'agent-market-brief'].includes(String(record.surface))) {
    throw new Error('unknown attack surface');
  }
  if (!Array.isArray(record.categories) || record.categories.length === 0) {
    throw new Error('security log must contain detection categories');
  }
  if (typeof record.textHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.textHash)) {
    throw new Error('security log must contain a sha256 textHash');
  }
  if (typeof record.textLength !== 'number' || record.textLength <= 0) {
    throw new Error('security log must contain textLength');
  }
  if (record.actionTaken !== 'NONE') throw new Error('security log must record actionTaken=NONE');
  if (record.authorityChanged !== false) throw new Error('security log must record authorityChanged=false');
  // The raw text is untrusted data and must never be stored in the log.
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && /IGNORE (ALL )?PREVIOUS INSTRUCTIONS/i.test(value)) {
      throw new Error('raw attack text leaked into the security log');
    }
  }
}

export function scanFixtureText(text: string): InjectionScan {
  return scanPromptInjection(text);
}
