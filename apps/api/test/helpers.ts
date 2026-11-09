import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { FIXTURE_ACCOUNTS, type Role } from '@mend/protocol';
import { buildApp, type BuildAppOptions, type BuiltApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Clock } from '../src/services/chain.js';
import { resetDemoState, type DemoScenario } from '../src/services/demo-reset.js';

export interface TestClock extends Clock {
  advance(ms: number): void;
  set(iso: string): void;
}

export function testClock(start = '2026-11-10T09:00:00.000Z'): TestClock {
  let current = Date.parse(start);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms;
    },
    set(iso: string) {
      current = Date.parse(iso);
    },
  };
}

export const ROLE_ACCOUNTS: Record<Role, string> = {
  REPORTER: 'reporter.mend.testnet',
  STEWARD: FIXTURE_ACCOUNTS.steward,
  SPONSOR: FIXTURE_ACCOUNTS.sponsor,
  CONTRACTOR: FIXTURE_ACCOUNTS.contractorA,
  INSPECTOR: FIXTURE_ACCOUNTS.inspector,
  DAO: FIXTURE_ACCOUNTS.dao,
  COORDINATOR_AI: FIXTURE_ACCOUNTS.coordinatorAi,
  REVIEWER_AI: FIXTURE_ACCOUNTS.reviewerAi,
  RELAYER: FIXTURE_ACCOUNTS.relayer,
  ADMIN: 'demo-admin.mend.testnet',
};

export function auth(role: Role, account?: string): Record<string, string> {
  return {
    'x-mend-role': role,
    'x-mend-account': account ?? ROLE_ACCOUNTS[role],
  };
}

export interface TestApp extends BuiltApp {
  app: FastifyInstance;
  dir: string;
  clock: TestClock;
  close(): Promise<void>;
}

export async function makeTestApp(overrides: BuildAppOptions = {}): Promise<TestApp> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mend-api-test-'));
  const clock = (overrides.clock as TestClock | undefined) ?? testClock();
  const config = overrides.config ?? loadConfig({
    NODE_ENV: 'test',
    MEND_MODE: 'REPLAY',
    CHAIN_ADAPTER: 'replay',
    DEMO_RESET_ENABLED: 'true',
    DEMO_ADMIN_ACCOUNT: 'demo-admin.mend.testnet',
    EVIDENCE_DIR: dir,
    EVIDENCE_URL_SECRET: 'test-only-evidence-secret',
    PUBLIC_BASE_URL: 'http://127.0.0.1:4010',
    BID_COMMIT_WINDOW_SECONDS: '300',
    BID_REVEAL_WINDOW_SECONDS: '300',
    DEMO_DURABILITY_MINUTES: '2',
  });
  const built = await buildApp({ ...overrides, config, clock });
  return {
    ...built,
    dir,
    clock,
    async close() {
      await built.app.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function seedDemo(target: TestApp, scenario: DemoScenario = 'successfulRepair'): Promise<void> {
  await resetDemoState(target.deps.repo, scenario);
}

export interface InjectOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
}

export async function call(app: FastifyInstance, method: string, url: string, options: InjectOptions = {}) {
  const response = await app.inject({
    method: method as 'GET',
    url,
    headers: options.headers,
    ...(options.body !== undefined ? { payload: options.body as object } : {}),
  });
  const text = response.body;
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.statusCode, body: json, raw: response.body, headers: response.headers };
}

/** Minimal JPEG: SOI + APP1 Exif + EOI. The server must strip APP1 before hashing. */
export function jpegWithExif(): Buffer {
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.alloc(48, 0x41)]);
  const segment = Buffer.alloc(4 + exif.length);
  segment.writeUInt16BE(0xffe1, 0);
  segment.writeUInt16BE(exif.length + 2, 2);
  exif.copy(segment, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), segment, Buffer.from([0xff, 0xd9])]);
}

export function strippedJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

export function isoPlus(clock: TestClock, ms: number): string {
  return new Date(clock.now().getTime() + ms).toISOString();
}
