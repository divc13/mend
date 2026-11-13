#!/usr/bin/env node
/**
 * Capture real browser interactions for the v2 MEND film.
 *
 * Usage:
 *   BASE_URL=http://localhost:3100 node scripts/demo/capture-live-ad.mjs
 *
 * The script records six 1920x1080 / 30fps clips with Playwright Chromium,
 * converts each WebM to H.264 MP4 with ffmpeg-static, and writes
 * demo/ad/public/assets/live/actions.json with action timestamps relative to
 * each clip start.
 *
 * Case-dependent clips use the staging script added for the pothole replay:
 *   node scripts/demo/stage-pothole-case.mjs <BIDDING|COMPLETION_SUBMITTED|CLOSED>
 *
 * This script does not edit app code, Remotion source, audio, script or docs.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tests/node_modules/@playwright/test/index.mjs';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const BASE_URL_OBJECT = new URL(BASE);
const PORT = BASE_URL_OBJECT.port || '3100';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const MANAGE_SERVER = process.env.CAPTURE_MANAGE_SERVER !== '0';
const OUT = path.join(ROOT, 'demo/ad/public/assets/live');
const RAW = path.join(OUT, '.raw');
const PHOTO = path.join(ROOT, 'demo/ad/public/assets/photos/pothole.jpg');
const STAGE_SCRIPT = path.join(ROOT, 'scripts/demo/stage-pothole-case.mjs');
const CASE_ID = 'WO-PATH-001-0002';
const PASSPORT_ID = 'PATH-006';
const FPS = 30;

const HIDE_CSS = `
  nextjs-portal,
  [data-nextjs-toast],
  [data-nextjs-dialog],
  [data-nextjs-dev-tools-button],
  [data-nextjs-scroll-focus-boundary] { display: none !important; }
  html { scrollbar-width: none; }
  body::-webkit-scrollbar { display: none; }
`;

const CURSOR_SCRIPT = () => {
  const install = () => {
    if (document.getElementById('__mend-cursor')) return;

    const style = document.createElement('style');
    style.textContent = `
      #__mend-cursor {
        position: fixed; left: 0; top: 0; z-index: 2147483647;
        pointer-events: none; will-change: transform;
        transition: transform 70ms linear;
      }
      #__mend-cursor .dot {
        position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px;
        border-radius: 50%; background: #0e4a39; border: 2px solid #fff;
        box-shadow: 0 1px 5px rgba(0,0,0,.55);
      }
      #__mend-cursor .ring {
        position: absolute; width: 38px; height: 38px; margin: -19px 0 0 -19px;
        border-radius: 50%; border: 2px solid rgba(14,74,57,.55);
        box-shadow: 0 0 0 1px rgba(255,255,255,.65) inset;
        transition: transform 120ms ease, opacity 120ms ease;
      }
      .mend-ripple {
        position: fixed; z-index: 2147483646; pointer-events: none;
        width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%;
        border: 2px solid #0e4a39; background: rgba(14,74,57,.18);
        animation: mend-ripple .55s ease-out forwards;
      }
      @keyframes mend-ripple { to { transform: scale(3.2); opacity: 0; } }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__mend-cursor';
    cursor.innerHTML = '<div class="ring"></div><div class="dot"></div>';
    document.body.appendChild(cursor);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    const move = (nextX, nextY) => {
      x = nextX;
      y = nextY;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    move(x, y);

    window.addEventListener(
      'mousemove',
      (event) => move(event.clientX, event.clientY),
      true,
    );
    window.addEventListener(
      'mousedown',
      (event) => {
        const ripple = document.createElement('div');
        ripple.className = 'mend-ripple';
        ripple.style.left = `${event.clientX}px`;
        ripple.style.top = `${event.clientY}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      },
      true,
    );
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
};

const HIDE_SCRIPT = (css) => {
  const add = () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add, { once: true });
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function warn(clip, action, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`WARN [${clip}] ${action}: ${message}`);
  return message;
}

function stage(state) {
  if (!existsSync(STAGE_SCRIPT)) {
    throw new Error(`staging script not found: ${STAGE_SCRIPT}`);
  }
  execFileSync(process.execPath, [STAGE_SCRIPT, state], {
    cwd: ROOT,
    stdio: 'pipe',
    timeout: 30_000,
  });
}

function pidsOnPort(port) {
  try {
    const output = execFileSync('lsof', ['-ti', `:${port}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function killPort(port, signal = 'SIGTERM') {
  for (const pid of pidsOnPort(port)) {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may already be gone.
    }
  }
}

async function waitForPortFree(port, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pidsOnPort(port).length === 0) return;
    await sleep(250);
  }
  throw new Error(`port ${port} is still in use`);
}

async function waitForHttp(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  throw new Error(`dev server not ready at ${url}`);
}

/**
 * Next 16/Turbopack caches statically generated case routes for the lifetime
 * of the dev process. The staging JSON is read at render time, so a route can
 * keep showing the previous lifecycle state even after the JSON changes.
 * Restarting with a fresh .next/dev cache makes every staged state real.
 *
 * The staging file is written BEFORE this restart so the new process starts
 * with the requested state.
 */
async function restartDevServer(reason) {
  if (!MANAGE_SERVER) {
    console.log(`server restart skipped (CAPTURE_MANAGE_SERVER=0): ${reason}`);
    return;
  }
  if (!LOCAL_HOSTS.has(BASE_URL_OBJECT.hostname)) {
    console.log(`server restart skipped (remote BASE_URL): ${reason}`);
    return;
  }

  console.log(`restarting dev server: ${reason}`);
  killPort(PORT);
  try {
    await waitForPortFree(PORT);
  } catch {
    killPort(PORT, 'SIGKILL');
    await waitForPortFree(PORT);
  }

  await rm(path.join(ROOT, 'apps/web/.next/dev'), { recursive: true, force: true });

  const logPath = path.join(os.tmpdir(), 'mend-capture-dev.log');
  const logFd = openSync(logPath, 'a');
  const child = spawn(
    'npm',
    ['--prefix', 'apps/web', 'run', 'dev', '--', '--port', PORT],
    {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    },
  );
  child.unref();
  await waitForHttp(`${BASE}/api/config`, 90_000);
  await sleep(600);
  console.log(`dev server ready at ${BASE} (log: ${logPath})`);
}

async function waitForApp(page, route, predicate, label, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const separator = route.includes('?') ? '&' : '?';
      await page.goto(`${BASE}${route}${separator}capture=${Date.now()}`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });
      if (await predicate()) return;
      lastError = new Error(`${label} not ready (attempt ${attempt}/${attempts})`);
    } catch (error) {
      lastError = error;
    }
    await sleep(2_000);
  }
  throw lastError ?? new Error(`${label} not ready`);
}

async function locate(page, candidates, label) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const locator = page.locator(candidate);
      if ((await locator.count()) > 0) return locator.first();
    } else {
      const locator = candidate();
      if ((await locator.count()) > 0) return locator.first();
    }
  }
  throw new Error(`selector not found: ${label}`);
}

async function smoothScrollTo(page, locator, { block = 'center', settle = 700 } = {}) {
  const y = await locator.evaluate(
    (element, targetBlock) => {
      const rect = element.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      if (targetBlock === 'start') return Math.max(0, top - 110);
      if (targetBlock === 'end') return Math.max(0, top + rect.height - window.innerHeight + 110);
      return Math.max(0, top - Math.max(80, (window.innerHeight - rect.height) / 2));
    },
    block,
  );
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await sleep(settle);
}

async function glide(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no visible bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 20 });
  await sleep(140);
  return { x, y };
}

async function clickLocator(page, locator, { scroll = true, settle = 500 } = {}) {
  if (scroll) await smoothScrollTo(page, locator, { settle });
  const { x, y } = await glide(page, locator);
  await page.mouse.click(x, y);
}

async function fillByTyping(page, locator, text, { delay = 12, replace = true } = {}) {
  await smoothScrollTo(page, locator, { settle: 450 });
  await glide(page, locator);
  await locator.click();
  if (replace) {
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
  } else {
    await locator.evaluate((element) => {
      if (typeof element.setSelectionRange === 'function') {
        element.setSelectionRange(element.value.length, element.value.length);
      }
    });
  }
  await locator.pressSequentially(text, { delay });
}

async function appendToField(page, locator, text, { delay = 12 } = {}) {
  await fillByTyping(page, locator, text, { delay, replace: false });
}

async function selectOption(page, locator, value, label) {
  await smoothScrollTo(page, locator, { settle: 450 });
  await glide(page, locator);
  await locator.selectOption(value);
  await sleep(250);
  return label;
}

function ffmpegDuration(file) {
  try {
    const output = execFileSync(ffmpegPath, ['-hide_banner', '-i', file], {
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
    });
    return parseDuration(output);
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
    return parseDuration(stderr);
  }
}

function parseDuration(text) {
  const match = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(text ?? '');
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Math.round((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000);
}

function convert(rawFile, outFile) {
  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-i',
      rawFile,
      '-vf',
      'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x101512,fps=30,format=yuv420p',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.0',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      '-an',
      outFile,
    ],
    { stdio: 'pipe', timeout: 10 * 60_000 },
  );
}

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: { width: 1920, height: 1080 },
  fps: FPS,
  stagedCase: CASE_ID,
  clips: {},
  actions: [],
  warnings: [],
};

async function recordClip(browser, name, targetMs, run, { stagedState } = {}) {
  const clipDir = path.join(RAW, name);
  await rm(clipDir, { recursive: true, force: true });
  await mkdir(clipDir, { recursive: true });

  // Playwright starts the video when the context is created. Set the clock
  // first so action timestamps are aligned to the first video frame.
  const startedAt = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: clipDir, size: { width: 1920, height: 1080 } },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });

  context.setDefaultTimeout(8_000);
  const page = await context.newPage();
  const actions = [];
  const missing = [];

  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('mend-mode', 'REPLAY');
    } catch {
      // Ignore locked-down storage.
    }
  });
  await page.addInitScript(CURSOR_SCRIPT);
  await page.addInitScript(HIDE_SCRIPT, HIDE_CSS);

  const act = async (label, fn) => {
    const atMs = Date.now() - startedAt;
    try {
      await fn();
      actions.push({ atMs, action: label, ok: true });
      results.actions.push({ clip: name, atMs, action: label, ok: true });
    } catch (error) {
      const message = warn(name, label, error);
      actions.push({ atMs, action: label, ok: false, warning: message });
      results.actions.push({ clip: name, atMs, action: label, ok: false, warning: message });
      missing.push({ action: label, atMs, warning: message });
      results.warnings.push({ clip: name, action: label, warning: message });
    }
  };

  let fatal = null;
  try {
    await run({ page, act, startedAt, clip: name });
  } catch (error) {
    fatal = warn(name, 'capture sequence', error);
    missing.push({ action: 'capture sequence', warning: fatal });
  }

  const remaining = targetMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);

  const video = page.video();
  await page.close();
  await context.close();

  let rawFile = null;
  try {
    rawFile = await video.path();
  } catch (error) {
    warn(name, 'read video', error);
  }

  const outFile = path.join(OUT, `${name}.mp4`);
  let durationMs = null;
  let converted = false;
  if (rawFile && existsSync(rawFile)) {
    try {
      convert(rawFile, outFile);
      converted = true;
      durationMs = ffmpegDuration(outFile);
    } catch (error) {
      fatal = warn(name, 'ffmpeg convert', error);
    }
  } else {
    fatal = warn(name, 'missing raw video', new Error('Playwright did not produce a video file'));
  }

  const clip = {
    file: path.relative(ROOT, outFile),
    stagedState: stagedState ?? null,
    targetDurationMs: targetMs,
    durationMs,
    converted,
    fatal,
    actions,
    missingActions: missing,
  };
  results.clips[name] = clip;
  console.log(
    `captured ${name}.mp4${durationMs ? ` · ${(durationMs / 1000).toFixed(2)}s` : ''}` +
      (missing.length ? ` · ${missing.length} missing action(s)` : ''),
  );
  return clip;
}

async function captureReport(browser) {
  return recordClip(browser, 'report-live', 35_000, async ({ page, act }) => {
    await act('open /report', async () => {
      await page.goto(`${BASE}/report`, { waitUntil: 'networkidle', timeout: 60_000 });
      await sleep(1_400);
    });

    await act('select category Pothole / path surface', async () => {
      const category = await locate(page, ['#report-category'], 'report category');
      await selectOption(page, category, 'pothole', 'pothole');
    });

    await act('select area Riverside path — north gate', async () => {
      const area = await locate(page, ['#report-area'], 'report area');
      await selectOption(page, area, 'path', 'path');
    });

    await act('type pothole description', async () => {
      const description = await locate(page, ['#report-description'], 'report description');
      await fillByTyping(
        page,
        description,
        'A deep pothole on the riverside path just inside the north gate fills with water after rain and is hard to see. Cyclists swerve onto the grass to avoid it.',
        { delay: 14 },
      );
    });

    await act('click Continue from problem step', async () => {
      const button = await locate(
        page,
        [() => page.getByRole('button', { name: /^Continue\b/ })],
        'Continue button',
      );
      await clickLocator(page, button);
      await page.getByText('2. Protect privacy', { exact: false }).waitFor({ timeout: 10_000 });
      await sleep(600);
    });

    await act('upload pothole.jpg', async () => {
      const photo = await locate(page, ['#report-photo'], 'photo input');
      await smoothScrollTo(page, photo, { settle: 450 });
      const choose = page.getByText('Choose a photo', { exact: false }).first();
      if ((await choose.count()) > 0) await glide(page, choose).catch(() => {});
      await photo.setInputFiles(PHOTO);
      await page.locator('.photo-editor .hash-display').waitFor({ timeout: 20_000 });
      await sleep(1_800);
    });

    await act('click Continue from privacy step', async () => {
      const button = await locate(
        page,
        [() => page.getByRole('button', { name: /^Continue\b/ })],
        'Continue button',
      );
      await clickLocator(page, button);
      await page.getByText('3. Duplicate check', { exact: false }).waitFor({ timeout: 10_000 });
      await sleep(800);
    });

    await act('choose same duplicate', async () => {
      const same = await locate(page, ['input[value="same"]'], 'same duplicate radio');
      await smoothScrollTo(page, same, { settle: 450 });
      const label = page.getByText('Same problem', { exact: false }).first();
      if ((await label.count()) > 0) await glide(page, label).catch(() => {});
      await same.check();
      await sleep(600);
    });

    await act('acknowledge possible merge', async () => {
      const ack = await locate(
        page,
        ['.checkbox-row input[type="checkbox"]'],
        'duplicate acknowledgement',
      );
      await smoothScrollTo(page, ack, { settle: 450 });
      await glide(page, ack);
      await ack.check();
      await sleep(600);
    });

    await act('click Continue from duplicate step', async () => {
      const button = await locate(
        page,
        [() => page.getByRole('button', { name: /^Continue\b/ })],
        'Continue button',
      );
      await clickLocator(page, button);
      await page.getByText('4. Review & send', { exact: false }).waitFor({ timeout: 10_000 });
      await sleep(1_000);
    });

    await act('review the report', async () => {
      const facts = await locate(page, ['.form-card .facts-grid'], 'review facts');
      await smoothScrollTo(page, facts, { settle: 900 });
      await sleep(1_600);
    });

    await act('submit report', async () => {
      const button = await locate(
        page,
        [() => page.getByRole('button', { name: /Submit report/i })],
        'Submit report button',
      );
      await clickLocator(page, button);
      await page.getByText('Report received. Keep the private link.', { exact: false }).waitFor({
        timeout: 20_000,
      });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await sleep(2_000);
    });
  });
}

async function captureSteward(browser) {
  stage('BIDDING');
  await restartDevServer('steward clip starts in BIDDING');
  return recordClip(
    browser,
    'steward-live',
    19_000,
    async ({ page, act }) => {
      await act(`stage ${CASE_ID} BIDDING and open /steward`, async () => {
        await waitForApp(
          page,
          '/steward',
          async () => {
            const option = page.locator(`#steward-case option[value="${CASE_ID}"]`);
            if ((await option.count()) === 0) return false;
            return /sealed/i.test(await option.innerText());
          },
          'staged steward case in BIDDING',
        );
        await sleep(1_000);
      });

      await act(`select ${CASE_ID}`, async () => {
        const caseSelect = await locate(
          page,
          ['#steward-case', '[data-testid="steward-case-select"]'],
          'steward case select',
        );
        await selectOption(page, caseSelect, CASE_ID, CASE_ID);
        await page.getByText('Scope and budget', { exact: false }).waitFor({ timeout: 10_000 });
        const selected = await caseSelect.inputValue();
        if (selected !== CASE_ID) throw new Error(`selected ${selected}, expected ${CASE_ID}`);
        await page.getByText('Sealed bidding', { exact: true }).first().waitFor({ timeout: 5_000 });
        await sleep(600);
      });

      await act('confirm acting as steward', async () => {
        const acting = await locate(
          page,
          [
            '[data-testid="steward-acting"]',
            () => page.getByRole('checkbox', { name: /acting as the steward/i }),
          ],
          'acting as steward checkbox',
        );
        await smoothScrollTo(page, acting, { settle: 500 });
        await glide(page, acting);
        await acting.check();
        await sleep(500);
      });

      await act('edit approved repair scope', async () => {
        const scope = await locate(page, ['#steward-scope'], 'scope textarea');
        await appendToField(
          page,
          scope,
          ' Seal the repaired edges flush with the surrounding path and leave the north gate route clean and passable.',
          { delay: 9 },
        );
        await sleep(400);
      });

      await act('edit maximum budget', async () => {
        const budget = await locate(page, ['#steward-budget'], 'budget input');
        await fillByTyping(page, budget, '96.00', { delay: 80 });
        await sleep(400);
      });

      await act('click Save replay draft', async () => {
        const button = await locate(
          page,
          [
            '[data-testid="steward-save-draft"]',
            () => page.getByRole('button', { name: /Save replay draft/i }),
          ],
          'Save replay draft button',
        );
        await clickLocator(page, button);
        await page.getByText('Replay draft saved locally', { exact: false }).waitFor({
          timeout: 10_000,
        });
        await sleep(700);
      });

      await act('scroll to award confirmation', async () => {
        const heading = await locate(page, ['#award-confirm-title'], 'award confirmation heading');
        await smoothScrollTo(page, heading, { block: 'start', settle: 900 });
        await sleep(700);
      });

      await act('click Confirm award in replay', async () => {
        const button = await locate(
          page,
          [
            '[data-testid="steward-confirm-award"]',
            () => page.getByRole('button', { name: /Confirm award in replay/i }),
          ],
          'Confirm award button',
        );
        await clickLocator(page, button);
        await page.getByText('Replay award confirmation', { exact: false }).waitFor({
          timeout: 10_000,
        });
        await sleep(1_200);
      });
    },
    { stagedState: 'BIDDING' },
  );
}

async function captureBids(browser) {
  stage('BIDDING');
  await restartDevServer('bids clip starts sealed in BIDDING');
  return recordClip(
    browser,
    'bids-live',
    14_000,
    async ({ page, act }) => {
      await act(`stage ${CASE_ID} BIDDING and open /bids/${CASE_ID}`, async () => {
        await waitForApp(
          page,
          `/bids/${CASE_ID}`,
          async () => {
            const reveal = page.getByTestId('bid-reveal');
            if ((await reveal.count()) === 0 || !(await reveal.isEnabled())) return false;
            const sideCard = page.locator('.side-card').first();
            if ((await sideCard.count()) === 0) return false;
            return /sealed bidding/i.test(await sideCard.innerText());
          },
          'sealed bid room in BIDDING with reveal control',
        );
        await sleep(1_400);
      });

      await act('click Reveal comparison', async () => {
        const button = await locate(
          page,
          [
            '[data-testid="bid-reveal"]',
            () => page.getByRole('button', { name: /Reveal comparison/i }),
            '[data-testid="bid-reveal-toggle"]',
          ],
          'Reveal comparison button',
        );
        await smoothScrollTo(page, button, { settle: 900 });
        await clickLocator(page, button, { scroll: false });
        await page.getByText('Revealed offers', { exact: false }).waitFor({ timeout: 10_000 });
        await sleep(900);
      });

      await act('scroll through deterministic score', async () => {
        const heading = await locate(page, ['#score-title'], 'score heading');
        await smoothScrollTo(page, heading, { block: 'start', settle: 1_000 });
        await sleep(1_000);
        const table = await locate(page, ['.score-table'], 'score table');
        await smoothScrollTo(page, table, { block: 'center', settle: 1_000 });
        await sleep(1_200);
      });

      await act('scroll to policy and execution hashes', async () => {
        const hashes = await locate(page, ['.hash-stack'], 'score hash stack');
        await smoothScrollTo(page, hashes, { settle: 1_000 });
        await sleep(1_300);
      });
    },
    { stagedState: 'BIDDING' },
  );
}

async function captureInspector(browser) {
  stage('COMPLETION_SUBMITTED');
  await restartDevServer('inspector clip starts in COMPLETION_SUBMITTED');
  return recordClip(
    browser,
    'inspector-live',
    19_000,
    async ({ page, act }) => {
      await act(`stage ${CASE_ID} COMPLETION_SUBMITTED and open inspector`, async () => {
        await waitForApp(
          page,
          `/inspector/${CASE_ID}`,
          async () => {
            const notes = page.locator('#inspection-notes');
            return (await notes.count()) > 0 && (await notes.isEnabled());
          },
          'completion-submitted inspector console',
        );
        await sleep(1_200);
      });

      await act('review redacted evidence and checklist', async () => {
        const checklist = await locate(
          page,
          ['section[aria-labelledby="evidence-review-title"] .checklist'],
          'evidence checklist',
        );
        await smoothScrollTo(page, checklist, { block: 'center', settle: 900 });
        await sleep(1_000);
      });

      await act('tick the checklist', async () => {
        const boxes = page.locator('[data-testid^="inspector-checklist-"]');
        const count = await boxes.count();
        if (count === 0) throw new Error('no checklist items found');

        // The fixture arrives fully checked. Toggle the first and last items
        // off and on so the clip visibly records a human ticking the list,
        // then leave every item complete for the decision.
        for (const index of [0, count - 1]) {
          const box = boxes.nth(index);
          await smoothScrollTo(page, box, { block: 'center', settle: 300 });
          await glide(page, box);
          await box.uncheck();
          await sleep(350);
          await box.check();
          await sleep(300);
        }
      });

      await act('type inspector notes', async () => {
        const notes = await locate(page, ['#inspection-notes'], 'inspection notes');
        await fillByTyping(
          page,
          notes,
          'Checked the patch against the approved scope: base compacted, edges sealed flush, path swept clean. Evidence hashes match the submitted package.',
          { delay: 5 },
        );
        await sleep(200);
      });

      await act('check the three human confirmations', async () => {
        const confirmations = [
          '[data-testid="inspector-confirm-role"]',
          '[data-testid="inspector-confirm-reviewed"]',
          '[data-testid="inspector-confirm-human"]',
        ];
        for (const selector of confirmations) {
          const box = await locate(page, [selector], selector);
          await smoothScrollTo(page, box, { block: 'center', settle: 120 });
          await glide(page, box);
          await box.check();
          await sleep(200);
        }
      });

      await act('click Accept completion', async () => {
        const button = await locate(
          page,
          [
            '[data-testid="inspector-accept"]',
            () => page.getByRole('button', { name: /Accept completion/i }),
          ],
          'Accept completion button',
        );
        await smoothScrollTo(page, button, { settle: 400 });
        await clickLocator(page, button, { scroll: false });
        await page.getByText('Replay decision recorded', { exact: false }).waitFor({ timeout: 10_000 });
        await sleep(700);
      });
    },
    { stagedState: 'COMPLETION_SUBMITTED' },
  );
}

async function capturePassport(browser) {
  stage('CLOSED');
  await restartDevServer('passport clip starts CLOSED');
  return recordClip(
    browser,
    'passport-live',
    9_000,
    async ({ page, act }) => {
      await act(`stage ${CASE_ID} CLOSED and open /assets/${PASSPORT_ID}`, async () => {
        await waitForApp(
          page,
          `/assets/${PASSPORT_ID}`,
          async () => {
            const card = page.locator('.case-card').filter({ hasText: CASE_ID }).first();
            if ((await card.count()) === 0) return false;
            return /closed/i.test(await card.innerText());
          },
          'closed passport with staged work order',
        );
        await sleep(1_000);
      });

      await act('scroll to maintenance history', async () => {
        const heading = await locate(page, ['#history-title'], 'history heading');
        await smoothScrollTo(page, heading, { block: 'start', settle: 1_000 });
        await sleep(1_200);
      });

      await act('scroll through the history entries', async () => {
        const history = await locate(page, ['.history-list'], 'history list');
        await smoothScrollTo(page, history, { block: 'end', settle: 1_000 });
        await sleep(1_200);
      });
    },
    { stagedState: 'CLOSED' },
  );
}

async function captureTech(browser) {
  return recordClip(browser, 'tech-live', 9_000, async ({ page, act }) => {
    await act('open /how-it-works', async () => {
      await page.goto(`${BASE}/how-it-works`, { waitUntil: 'networkidle', timeout: 60_000 });
      await sleep(700);
    });

    await act('scroll to the stack', async () => {
      const heading = await locate(page, ['#stack-title'], 'stack heading');
      await smoothScrollTo(page, heading, { block: 'start', settle: 700 });
      await sleep(900);
    });

    await act('scroll through stack cards', async () => {
      const grid = await locate(page, ['.hiw-stack-grid'], 'stack grid');
      await smoothScrollTo(page, grid, { block: 'center', settle: 700 });
      await sleep(900);
    });

    await act('scroll to proof cards', async () => {
      const heading = await locate(page, ['#proof-title'], 'proof heading');
      await smoothScrollTo(page, heading, { block: 'start', settle: 700 });
      await sleep(900);
    });
  });
}

async function main() {
  if (!existsSync(PHOTO)) throw new Error(`pothole photo missing: ${PHOTO}`);
  if (!existsSync(ffmpegPath)) throw new Error(`ffmpeg-static binary missing: ${ffmpegPath}`);

  await mkdir(OUT, { recursive: true });
  await mkdir(RAW, { recursive: true });

  if (MANAGE_SERVER && LOCAL_HOSTS.has(BASE_URL_OBJECT.hostname)) {
    // Start (or restart) from a clean Turbopack cache so the report and tech
    // clips do not inherit a stale dev bundle.
    await restartDevServer('capture run starts from a fresh dev cache');
  } else {
    const health = await fetch(`${BASE}/api/config`).catch(() => null);
    if (!health || !health.ok) {
      throw new Error(`app not reachable at ${BASE}. Start it with: npm --prefix apps/web run dev -- --port 3100`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await captureReport(browser);
    await captureSteward(browser);
    await captureBids(browser);
    await captureInspector(browser);
    await capturePassport(browser);
    await captureTech(browser);
  } finally {
    await browser.close();
  }

  // Leave the app in the CLOSED state so /assets/PATH-006 remains the final
  // passport view after a capture run.
  try {
    stage('CLOSED');
  } catch (error) {
    warn('post-capture', 'stage CLOSED', error);
  }

  const actionsPath = path.join(OUT, 'actions.json');
  await writeFile(actionsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

  // Raw WebM files are intermediate only; the public asset directory keeps
  // the MP4s and actions.json. Keep them when a conversion failed so the
  // failure can be inspected.
  const allConverted = Object.values(results.clips).every((clip) => clip.converted);
  if (allConverted) {
    await rm(RAW, { recursive: true, force: true });
  } else {
    console.warn(`kept raw WebM files for inspection: ${path.relative(ROOT, RAW)}`);
  }

  console.log('');
  console.log(`wrote ${path.relative(ROOT, actionsPath)}`);
  for (const [name, clip] of Object.entries(results.clips)) {
    const status = clip.converted
      ? clip.durationMs
        ? `${(clip.durationMs / 1000).toFixed(2)}s`
        : 'converted (duration unknown)'
      : 'NOT CONVERTED';
    const missing = clip.missingActions.length ? ` · missing: ${clip.missingActions.map((item) => item.action).join('; ')}` : '';
    console.log(`  ${name}: ${status}${missing}`);
  }
  if (results.warnings.length > 0) {
    console.log('');
    console.log(`${results.warnings.length} warning(s) — see actions.json and the log above.`);
  }
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
