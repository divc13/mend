import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { APIRequestContext, Page } from '@playwright/test';

import { repoPath } from '../../security/support/repo.js';

export const WEB_URL = process.env.MEND_WEB_URL ?? 'http://localhost:3000';
export const API_URL = process.env.MEND_API_URL ?? 'http://localhost:4000';

export async function apiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get(`${API_URL}/health`, { timeout: 2_000, failOnStatusCode: false });
    return response.ok();
  } catch {
    return false;
  }
}

export async function webReachable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(WEB_URL, { timeout: 2_000, failOnStatusCode: false });
    return response.ok();
  } catch {
    return false;
  }
}

export function cargoAvailable(): boolean {
  const result = spawnSync('cargo', ['--version'], { encoding: 'utf8', timeout: 15_000 });
  return !result.error;
}

export function runCargoTest(manifest: string, filter: string): { ok: boolean; output: string } {
  const result = spawnSync('cargo', ['test', '--manifest-path', manifest, filter], {
    cwd: repoPath(),
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return { ok: result.status === 0 && /test result: ok/.test(output), output };
}

export function readJsonFixture<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(repoPath(...parts), 'utf8')) as T;
}

export interface WorkOrderLike {
  id?: string;
  status?: string;
  mode?: string;
  budgetMicro?: string;
  budget?: string;
  escrow?: Record<string, string | number>;
  payments?: Array<Record<string, unknown>>;
}

export function collectNumericStrings(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^\d+$/.test(value)) into.add(value);
  else if (typeof value === 'number' && Number.isInteger(value)) into.add(String(value));
  else if (Array.isArray(value)) for (const item of value) collectNumericStrings(item, into);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectNumericStrings(item, into);
  }
  return into;
}
