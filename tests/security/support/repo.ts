import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/** Absolute repository root (this file lives at tests/security/support/). */
export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/$/, '');

export function repoPath(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}

export function readRepoFile(...parts: string[]): string {
  return readFileSync(repoPath(...parts), 'utf8');
}

export function exists(...parts: string[]): boolean {
  return existsSync(repoPath(...parts));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Tracked files under a repository-relative directory. Empty if git is unavailable. */
export function gitTrackedFiles(scope = '.'): string[] {
  const result = spawnSync('git', ['ls-files', '-z', '--', scope], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.split('\0').filter(Boolean);
}

export interface WalkOptions {
  extensions?: readonly string[];
  skipDirectories?: readonly string[];
}

/** Recursively list files. Returns absolute paths. */
export function walkFiles(directory: string, options: WalkOptions = {}): string[] {
  const skip = new Set(options.skipDirectories ?? ['node_modules', '.git', 'test-results', 'playwright-report']);
  const out: string[] = [];
  if (!existsSync(directory)) return out;

  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        visit(join(current, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      if (options.extensions && !options.extensions.some((ext) => entry.name.endsWith(ext))) continue;
      out.push(join(current, entry.name));
    }
  };
  visit(directory);
  return out;
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function relativeToRoot(path: string): string {
  return relative(REPO_ROOT, path);
}

export type CommandResult = {
  command: string;
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

/** Run a command from the repository root without a shell. */
export function run(command: string, args: string[], timeoutMs = 600_000, cwd = REPO_ROOT): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI ?? '1', NO_COLOR: '1' },
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: result.error?.name === 'ETIMEDOUT' || result.signal === 'SIGTERM',
  };
}

export function commandAvailable(command: string): boolean {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 15_000 });
  return !result.error;
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 2_000,
  init: RequestInit = {},
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
