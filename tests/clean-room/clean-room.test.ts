import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { commandAvailable, exists, readRepoFile, repoPath, run } from '../security/support/repo.js';

const README_PATH = repoPath('README.md');

function readReadme(): string | null {
  try {
    return readFileSync(README_PATH, 'utf8');
  } catch {
    return null;
  }
}

function referencedLocalPaths(readme: string): string[] {
  const paths = new Set<string>();
  for (const match of readme.matchAll(/`((?:\.\/)?(?:apps|packages|services|scripts|infra|tests|contracts)\/[A-Za-z0-9_./-]+)`/g)) {
    if (match[1]) paths.add(match[1].replace(/^\.\//, ''));
  }
  return [...paths];
}

describe('clean-room — README is the only path to the REPLAY demo', () => {
  it('ships a root README with exact start and REPLAY instructions', (ctx) => {
    const readme = readReadme();
    if (readme === null) {
      ctx.skip(
        'SKIP: root README.md is not merged in this worktree (docs-demo track). The clean-room requirement cannot be executed until it exists; the static checks below still verify its prerequisites.',
      );
      return;
    }
    expect(readme).toMatch(/REPLAY/i);
    expect(readme).toMatch(/git clone|worktree/);
    expect(readme).toMatch(/npm (ci|install)/);
    expect(readme).toMatch(/scripts\/dev\.sh|docker compose/);
    expect(readme).not.toMatch(/<your[-_ ]|TODO|TBD|FIXME/i);
    expect(readme).toMatch(/Docker/i);
    const pkg = JSON.parse(readFileSync(repoPath('package.json'), 'utf8')) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toMatch(/22|>=/);

    const missing = referencedLocalPaths(readme).filter((path) => !exists(path));
    expect(missing, `README references missing paths: ${missing.join(', ')}`).toEqual([]);
  });

  it('documents a REPLAY path that actually exists in this checkout', (ctx) => {
    const readme = readReadme();
    if (readme === null) {
      ctx.skip('SKIP: root README.md is not merged; nothing to verify');
      return;
    }
    const start = readme.indexOf('### REPLAY with no credentials');
    expect(start, 'README must contain a "REPLAY with no credentials" section').toBeGreaterThan(-1);
    const replaySection = readme.slice(start, start + 900);
    const pending = /Status:\s*`PENDING INTEGRATION`/i.test(replaySection);
    expect(
      pending,
      'BLOCKER: README marks the REPLAY quick start as PENDING INTEGRATION. A judge cannot reach the REPLAY demo from a fresh clone, so T07.8 is not met.',
    ).toBe(false);
  });

  it('keeps npm ci reproducible for a fresh clone (package-lock in sync)', () => {
    if (!exists('package-lock.json')) {
      expect.fail('BLOCKER: package-lock.json is missing, so a clean clone cannot install deterministically');
    }
    const result = run('npm', ['ci', '--dry-run', '--ignore-scripts'], 300_000);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, `BLOCKER: npm ci fails on a clean checkout; update package-lock.json.\n${output.slice(-4_000)}`).toBe(
      0,
    );
  });

  it('creates every required directory from the clean-clone file set', () => {
    // Only tracked files count: a fresh clone has no node_modules, .env or
    // generated build output. These paths must exist in git.
    const required = [
      'package.json',
      'package-lock.json',
      'tsconfig.base.json',
      'scripts/dev.sh',
      'scripts/verify.sh',
      'infra/docker-compose.yml',
      'infra/env.example',
      'packages/protocol/package.json',
      'contracts/Cargo.toml',
    ];
    const missing = required.filter((path) => !exists(path));
    expect(missing).toEqual([]);
  });

  it('has no developer-machine dependency in the documented quick start', () => {
    const dev = readRepoFile('scripts', 'dev.sh');
    expect(dev).not.toMatch(/\/Users\/[A-Za-z0-9._-]+/);
    expect(dev).not.toMatch(/\/home\/[A-Za-z0-9._-]+/);
    expect(dev).not.toMatch(/source\s+~\/\./);

    const compose = readRepoFile('infra', 'docker-compose.yml');
    expect(compose).not.toMatch(/\/Users\/[A-Za-z0-9._-]+/);
    expect(compose).not.toMatch(/\/home\/[A-Za-z0-9._-]+/);

    const envExample = readRepoFile('infra', 'env.example');
    expect(envExample).not.toMatch(/\/Users\/[A-Za-z0-9._-]+/);
    expect(envExample).toMatch(/MEND_MODE=REPLAY/);
  });

  it('documents every port and service that the local stack publishes', () => {
    const infraReadme = readRepoFile('infra', 'README.md');
    for (const expected of [
      'postgres',
      'minio',
      'api',
      'indexer',
      'web',
      '5432',
      '9000',
      '4000',
      '4100',
      '3000',
    ]) {
      expect(infraReadme.toLowerCase()).toContain(expected);
    }
    expect(infraReadme).toMatch(/REPLAY/i);
  });

  it('can execute the static clean-room runner from a temporary worktree', (ctx) => {
    if (!commandAvailable('git')) {
      ctx.skip('SKIP: git is not installed');
      return;
    }
    const runner = repoPath('tests', 'clean-room', 'run.sh');
    if (!exists('tests', 'clean-room', 'run.sh')) {
      ctx.skip('SKIP: tests/clean-room/run.sh is missing');
      return;
    }

    const temp = mkdtempSync(join(tmpdir(), 'mend-cleanroom-'));
    try {
      const result = run('bash', [runner, '--static', '--worktree-root', temp], 300_000);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(`${result.stdout}`).toMatch(/CLEAN-ROOM PASS|CLEAN-ROOM SKIP/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe('clean-room — no hidden generated files are required', () => {
  it('does not depend on gitignored local state for the demo path', () => {
    const gitignore = readRepoFile('.gitignore');
    for (const ignored of ['node_modules/', '.env', 'target/', '.next/']) {
      expect(gitignore).toContain(ignored);
    }
    // A local .env is allowed only when it is gitignored. It must never be tracked.
    const topLevel = readdirSync(repoPath());
    if (topLevel.includes('.env')) {
      const ignored = run('git', ['check-ignore', '-q', '.env'], 30_000);
      expect(ignored.status, '.env exists but is not gitignored').toBe(0);
    }
    const tracked = run('git', ['ls-files', '--error-unmatch', '.env'], 30_000);
    expect(tracked.status, '.env must not be tracked by git').not.toBe(0);
  });
});
