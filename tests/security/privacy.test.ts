import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PublicLocationSchema, WorkOrderSchema } from '@mend/protocol';

import {
  commandAvailable,
  exists,
  fetchWithTimeout,
  gitTrackedFiles,
  readRepoFile,
  repoPath,
  run,
  walkFiles,
} from '../security/support/repo.js';

const SECRET_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'openai-style-key', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  { id: 'near-ai-key-assignment', pattern: /NEAR_AI_API_KEY[ \t]*[=:][ \t]*['"]?[A-Za-z0-9._-]{16,}/ },
  { id: 'outlayer-key-assignment', pattern: /OUTLAYER_API_KEY[ \t]*[=:][ \t]*['"]?[A-Za-z0-9._-]{16,}/ },
  { id: 'agent-market-token-assignment', pattern: /AGENT_MARKET_AGENT_TOKEN[ \t]*[=:][ \t]*['"]?[A-Za-z0-9._-]{16,}/ },
  { id: 'intents-jwt-assignment', pattern: /INTENTS_JWT[ \t]*[=:][ \t]*['"]?eyJ[A-Za-z0-9._-]{20,}/ },
  { id: 'json-private-key', pattern: /"private[_-]?key"\s*:\s*"[0-9a-fA-F]{64}"/ },
  { id: 'mnemonic-like', pattern: /"mnemonic"\s*:\s*"[a-z]+(?:\s+[a-z]+){11,}"/ },
];

const SKIP_FILES = new Set(['package-lock.json', 'tests/package-lock.json']);
const SKIP_PREFIXES = ['tests/fixtures/attacks/'];

function trackedTextFiles(): string[] {
  return gitTrackedFiles().filter(
    (file) =>
      !SKIP_FILES.has(file) &&
      !SKIP_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
      !file.endsWith('.wasm') &&
      !file.endsWith('.png') &&
      !file.endsWith('.jpg') &&
      !file.endsWith('.jpeg') &&
      !file.endsWith('.gif') &&
      !file.endsWith('.pdf'),
  );
}

describe('privacy — no secrets in tracked sources or browser bundles', () => {
  it('finds no credential-shaped strings in tracked text files', () => {
    const hits: Array<{ file: string; line: number; rule: string }> = [];
    for (const file of trackedTextFiles()) {
      let content: string;
      try {
        content = readFileSync(repoPath(file), 'utf8');
      } catch {
        continue;
      }
      for (const [lineNumber, line] of content.split('\n').entries()) {
        // Obvious test placeholders are not secrets. Real-looking values still fail.
        if (/test-key-not-real|not-real|placeholder|dummy|fake|redacted|example/i.test(line)) continue;
        if (/^[A-Z0-9_]+[ \t]*=[ \t]*$/.test(line)) continue;
        for (const rule of SECRET_PATTERNS) {
          if (rule.pattern.test(line)) hits.push({ file, line: lineNumber + 1, rule: rule.id });
        }
      }
    }
    expect(hits, `credential-like strings found: ${JSON.stringify(hits)}`).toEqual([]);
  });

  it('never commits an .env file and keeps the secret scanner passing', () => {
    const tracked = gitTrackedFiles();
    expect(tracked.filter((file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example'))).toEqual(
      [],
    );
    if (!commandAvailable('bash')) return;
    const result = run('bash', ['scripts/secret-scan.sh'], 120_000);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('keeps the browser entry free of server credentials and server modules', () => {
    const browserSource = readRepoFile('packages', 'ai-client', 'src', 'browser.ts');
    expect(browserSource).not.toMatch(/nearAiClient|config\.js|verification\.js|scopeGenerator|evidenceReviewer/);

    const browser = readFileSync(repoPath('packages', 'ai-client', 'src', 'browser.ts'), 'utf8');
    expect(browser).toContain("export * from './promptGuard.js'");
    expect(browser).not.toMatch(/process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|JWT)/);
    expect(browserSource).not.toMatch(/NEAR_AI_API_KEY|OUTLAYER_API_KEY|AGENT_MARKET_AGENT_TOKEN|INTENTS_JWT/);
  });

  it('client components never read server-only secrets or import the server entry', () => {
    const files = walkFiles(repoPath('apps', 'web', 'src'), { extensions: ['.ts', '.tsx'] });
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const isClient = /^['"]use client['"]/m.test(content);
      if (!isClient) continue;
      if (/process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|JWT|PASSWORD)/.test(content)) {
        violations.push(`${file}: client component reads a server secret env var`);
      }
      if (/@mend\/ai-client\/server|nearAiClient|OUTLAYER_API_KEY|AGENT_MARKET_AGENT_TOKEN/.test(content)) {
        violations.push(`${file}: client component imports a server-only module`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('scans built browser chunks for server-only secrets when a web build exists', (ctx) => {
    const candidates = [
      repoPath('apps', 'web', '.next', 'static'),
      repoPath('apps', 'web', 'dist', 'assets'),
      repoPath('apps', 'web', 'out', '_next', 'static'),
    ].filter((directory) => existsSync(directory));
    if (candidates.length === 0) {
      ctx.skip(
        'SKIP: apps/web is not merged and no built .next/dist/out bundle exists in this checkout; browser-bundle scan runs when the frontend track lands',
      );
      return;
    }

    const forbidden = [
      'NEAR_AI_API_KEY',
      'OUTLAYER_API_KEY',
      'AGENT_MARKET_AGENT_TOKEN',
      'INTENTS_JWT',
      'PRIVATE_KEY',
      'mnemonic',
    ];
    const hits: string[] = [];
    for (const directory of candidates) {
      for (const file of walkFiles(directory, { extensions: ['.js', '.mjs', '.css', '.map'] })) {
        const content = readFileSync(file, 'utf8');
        for (const needle of forbidden) {
          if (content.includes(needle)) hits.push(`${file}: ${needle}`);
        }
        for (const rule of SECRET_PATTERNS) {
          if (rule.pattern.test(content)) hits.push(`${file}: ${rule.id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('privacy — public/private data boundaries', () => {
  it('public location schema contains coarse coordinates only', () => {
    // The schema itself is the boundary: precise coordinates are not part of it.
    expect(Object.keys(PublicLocationSchema.shape)).toEqual(['label', 'coarseLat', 'coarseLng', 'area']);
    expect(Object.keys(PublicLocationSchema.shape)).not.toContain('preciseLat');
    expect(Object.keys(PublicLocationSchema.shape)).not.toContain('preciseLng');
    expect(() => PublicLocationSchema.parse({ label: 'x', coarseLat: 1, coarseLng: 2, preciseLat: 1 })).not.toThrow();
    const parsed = PublicLocationSchema.parse({ label: 'x', coarseLat: 1, coarseLng: 2, preciseLat: 1 });
    expect('preciseLat' in parsed).toBe(false);
  });

  it('recorded chain and AI fixtures contain hashes and redacted text, never media URLs or precise coordinates', () => {
    const files = [
      ...walkFiles(repoPath('fixtures', 'recorded-responses', 'bid-rules'), { extensions: ['.json'] }),
      ...walkFiles(repoPath('fixtures', 'recorded-responses', 'near-ai'), { extensions: ['.json'] }),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|webp|mp4|mov)/i);
      expect(content, file).not.toMatch(/preciseLat|preciseLng|rawMedia|evidenceUrl/i);
      expect(content, file).not.toMatch(/(?<![a-f0-9])[a-f0-9]{64}@/i);
    }
  });

  it('the protocol work order carries public hashes, never evidence URLs', () => {
    const parsed = WorkOrderSchema.parse({
      id: 'WO-BENCH-001-0001',
      assetId: 'BENCH-001',
      reportClusterId: 'CL-0001',
      scopeHash: 'c'.repeat(64),
      daoApprovalId: 'dao-42',
      policyHash: '1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d',
      budgetMicro: '100000000',
      status: 'AWARDED',
      mode: 'REPLAY',
      fundingToken: 'mend-usdc.testnet',
      createdAt: '2026-11-10T08:00:00.000Z',
      updatedAt: '2026-11-10T09:25:00.000Z',
    });
    expect(JSON.stringify(parsed)).not.toMatch(/https?:\/\//);
    expect(parsed.mode).toBe('REPLAY');
    expect(() =>
      WorkOrderSchema.parse({ ...parsed, scopeHash: 'https://bucket.example/scope.json' }),
    ).toThrow();
  });

  it('object storage buckets are created private with anonymous access disabled', () => {
    const compose = readRepoFile('infra', 'docker-compose.yml');
    expect(compose).toMatch(/mc\s+anonymous\s+set\s+none/);
    expect(compose).toMatch(/mc\s+version\s+enable/);
    expect(compose).toMatch(/S3_BUCKET_EVIDENCE/);
    expect(compose).toMatch(/S3_BUCKET_ARTIFACTS/);
  });

  it('public serializers exclude precise location and private media fields', () => {
    const serializers = readRepoFile('apps', 'api', 'src', 'serializers.ts');
    const reportView = serializers.slice(
      serializers.indexOf('export function reportView'),
      serializers.indexOf('export function reportPrivateView'),
    );
    expect(reportView.length).toBeGreaterThan(0);
    expect(reportView).not.toMatch(/preciseLocation|privateMediaKey|retentionUntil/);
    expect(serializers).toMatch(/export function reportPrivateView/);
    expect(serializers).toMatch(/privateMediaKey/);

    const evidenceView = serializers.slice(
      serializers.indexOf('export function evidencePackageView'),
      serializers.indexOf('export function', serializers.indexOf('export function evidencePackageView') + 10),
    );
    expect(evidenceView).toMatch(/sha256/);
    expect(evidenceView).not.toMatch(/signedUrl|url:|rawMedia|filePath|privateMediaKey/);
  });

  it('stores precise location and case links in the private table, not the public report row', () => {
    const postgres = readRepoFile('packages', 'db', 'src', 'postgres.ts');
    expect(postgres).toMatch(/INSERT INTO report_private/);
    expect(postgres).toMatch(/precise_location/);
    expect(postgres).toMatch(/reporter_case_link/);
    // The public report row must not persist precise coordinates.
    const publicInsert = postgres.slice(
      postgres.indexOf('INSERT INTO reports'),
      postgres.indexOf('INSERT INTO report_private'),
    );
    expect(publicInsert.length).toBeGreaterThan(0);
    expect(publicInsert).not.toMatch(/precise_location|raw_media|evidence_url/);
  });

  it('the logging contract forbids secrets, precise location and raw evidence', () => {
    const logging = readRepoFile('infra', 'observability', 'logging.md');
    for (const forbidden of [
      'NEAR_AI_API_KEY',
      'OUTLAYER_API_KEY',
      'AGENT_MARKET_AGENT_TOKEN',
      'INTENTS_JWT',
      'Private keys',
      'Raw evidence',
      'Precise latitude/longitude',
      'Full bid plaintext before the reveal phase',
    ]) {
      expect(logging).toContain(forbidden);
    }
  });

  it('checks live API responses for precise location, raw media and private evidence (or skips with reason)', async (ctx) => {
    const apiBase = process.env.MEND_API_URL ?? 'http://localhost:4000';
    const health = await fetchWithTimeout(`${apiBase}/health`, 2_000);
    const runtimePresent = exists('apps', 'api') || exists('packages', 'db');

    if (!health?.ok) {
      ctx.skip(
        runtimePresent
          ? `SKIP: apps/api source exists but ${apiBase}/health is unreachable`
          : `SKIP: apps/api and packages/db are not merged and no API is reachable at ${apiBase}; live response/log/DB privacy checks require the backend track`,
      );
      return;
    }

    const endpoints = [
      '/v1/assets',
      '/v1/work-orders/WO-BENCH-001-0001',
      '/v1/work-orders/WO-BENCH-001-0001/evidence',
      '/v1/work-orders/WO-BENCH-001-0001/payments',
    ];
    const forbiddenKeys = [
      'preciseLat',
      'preciseLng',
      'preciseLocation',
      'rawMedia',
      'rawMediaUrl',
      'evidenceUrl',
      'reporterCaseLink',
      'apiKey',
      'secret',
      'privateKey',
    ];
    for (const endpoint of endpoints) {
      const response = await fetchWithTimeout(`${apiBase}${endpoint}`, 5_000);
      if (!response?.ok) continue;
      const text = await response.text();
      const lower = text.toLowerCase();
      for (const key of forbiddenKeys) {
        expect(lower, `${endpoint} leaked ${key}`).not.toContain(key.toLowerCase());
      }
      expect(text, `${endpoint} leaked a raw media URL`).not.toMatch(
        /https?:\/\/[^\s"']+\.(jpg|jpeg|png|webp|mp4|mov)/i,
      );
    }
  });
});
