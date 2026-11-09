#!/usr/bin/env node
/**
 * MEND REPLAY demo capture harness.
 *
 * This harness records the integrated web app in REPLAY / SIMULATION mode.
 * It is fail-soft by design: if the app or Playwright is unavailable, it prints
 * PENDING with the exact reason and never produces a fake recording.
 *
 * Usage (after integration):
 *   BASE_URL=http://localhost:3000 \
 *   OUT_DIR=fixtures/demo/captures \
 *   node scripts/demo/capture-replay-demo.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = path.resolve(ROOT, process.env.OUT_DIR ?? 'fixtures/demo/captures');
const SCENARIOS = (process.env.SCENARIOS ?? 'successful-repair,failed-durability,prompt-injection,sponsorship-uncertainty,judge-replay')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CAPTURE_SECONDS = Number(process.env.CAPTURE_SECONDS ?? 90);
const HEADLESS = process.env.HEADLESS !== 'false';

function ffmpegStatus() {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

async function playwrightModule() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'follow' });
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function pending(reason, details = []) {
  console.log('MEND REPLAY capture harness');
  console.log('STATUS: PENDING');
  console.log(`Reason: ${reason}`);
  for (const detail of details) console.log(`- ${detail}`);
  console.log(`ffmpeg for MP4 conversion: ${ffmpegStatus() ? 'available' : 'MISSING'}`);
  console.log('No recording was produced. Merge the web app, install Playwright, then rerun.');
}

async function main() {
  const playwright = await playwrightModule();
  const app = await reachable(BASE_URL);

  if (!playwright) {
    return pending('playwright module is not installed in this repository.', [
      `require/import of "playwright" failed from ${ROOT}`,
      'The CLI may be available via npx cache, but the recording harness needs the module.',
    ]);
  }

  if (!app.ok) {
    return pending(`web app is not reachable at ${BASE_URL}.`, [
      `fetch failed: ${app.error}`,
      'Start the integrated REPLAY stack first; apps/web is PENDING INTEGRATION on this branch.',
    ]);
  }

  const { chromium } = playwright;
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  const checks = [];
  const recordedScenarios = [];
  const missingScenarios = [];
  const screenshots = [];

  try {
    await page.goto(`${BASE_URL.replace(/\/+$/, '')}/demo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    const badge = page.locator('[data-testid="mode-badge"]');
    if ((await badge.count()) === 0) {
      throw new Error('mode badge [data-testid="mode-badge"] is missing; refusing to record a potentially live screen');
    }
    const badgeText = (await badge.first().innerText()).trim();
    if (!/REPLAY\s*\/\s*SIMULATION/i.test(badgeText)) {
      throw new Error(`mode badge is "${badgeText}", not "REPLAY / SIMULATION"; refusing to record`);
    }
    checks.push('mode badge visible and reads REPLAY / SIMULATION');

    const perScenarioMs = Math.max(2000, Math.floor((CAPTURE_SECONDS * 1000) / Math.max(SCENARIOS.length, 1)));
    for (const scenario of SCENARIOS) {
      const button = page.locator(`[data-testid="scenario-${scenario}"]`);
      if ((await button.count()) === 0) {
        missingScenarios.push(scenario);
        continue;
      }
      await button.first().click();
      await page.waitForTimeout(perScenarioMs);

      const badgeNow = (await badge.first().innerText()).trim();
      if (/MAINNET\s*—\s*REAL FUNDS/i.test(badgeNow)) {
        throw new Error(`scenario ${scenario} switched the mode badge to MAINNET inside REPLAY; refusing to record`);
      }
      const shot = path.join(OUT_DIR, `scenario-${scenario}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      screenshots.push(path.relative(ROOT, shot).split(path.sep).join('/'));
      recordedScenarios.push(scenario);
    }

    checks.push('no MAINNET — REAL FUNDS label appeared during REPLAY');
    const videoPromise = page.video()?.path();
    await context.close();
    await browser.close();

    const videoPath = videoPromise ? await videoPromise : null;
    const manifest = {
      status: missingScenarios.length ? 'RECORDED_PARTIAL' : 'RECORDED',
      mode: 'REPLAY / SIMULATION',
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      scenariosRequested: SCENARIOS,
      scenariosRecorded: recordedScenarios,
      scenariosMissing: missingScenarios,
      checks,
      screenshots,
      video: videoPath ? path.relative(ROOT, videoPath).split(path.sep).join('/') : null,
      ffmpegAvailable: ffmpegStatus(),
      notes: 'No narration, music, captions or physical media were added by this harness. MP4 conversion is pending the ffmpeg dependency.',
    };
    const manifestPath = path.join(OUT_DIR, 'capture-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log('MEND REPLAY capture harness');
    console.log(`STATUS: ${manifest.status}`);
    console.log(`Scenarios recorded: ${recordedScenarios.join(', ') || 'none'}`);
    if (missingScenarios.length) console.log(`Scenarios missing: ${missingScenarios.join(', ')}`);
    console.log(`Video: ${manifest.video ?? 'not produced'}`);
    console.log(`Manifest: ${path.relative(ROOT, manifestPath)}`);
    console.log(`ffmpeg for MP4 conversion: ${manifest.ffmpegAvailable ? 'available' : 'MISSING — conversion not attempted'}`);
    if (missingScenarios.length) {
      console.log('WARNING: the recording is partial; update the selector contract or implement the missing hooks.');
    }
  } catch (error) {
    try {
      await context.close();
    } catch {
      // ignore close errors
    }
    try {
      await browser.close();
    } catch {
      // ignore close errors
    }
    console.error('MEND REPLAY capture harness');
    console.error('STATUS: FAILED');
    console.error(`Reason: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

await main();
