#!/usr/bin/env node
/** Capture the CLOSED case accounting view for the v3 pitch. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tests/node_modules/@playwright/test/index.mjs';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'demo/ad/public/assets/live');
const RAW = path.join(OUT, '.raw-payment');
const FINAL = path.join(OUT, 'payment-live.mp4');
const URL = 'http://localhost:3100/cases/WO-PATH-001-0002';

const cursor = () => {
  const install = () => {
    if (document.getElementById('__mend-cursor')) return;
    const style = document.createElement('style');
    style.textContent = `nextjs-portal,[data-nextjs-toast],[data-nextjs-dialog],[data-nextjs-dev-tools-button],.nextjs-container-build-indicator{display:none!important}#__mend-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform 70ms linear}#__mend-cursor .dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#0e4a39;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.55)}`;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = '__mend-cursor';
    el.innerHTML = '<div class="dot"></div>';
    document.body.appendChild(el);
    const move = (x, y) => { el.style.transform = `translate3d(${x}px,${y}px,0)`; };
    window.addEventListener('mousemove', (event) => move(event.clientX, event.clientY), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
};

await mkdir(OUT, { recursive: true });
await rm(RAW, { recursive: true, force: true });
await mkdir(RAW, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.addInitScript(cursor);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);
await page.mouse.move(1260, 480);
await page.waitForTimeout(300);
await page.waitForSelector('[data-testid="case-accounting"]', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(1200);
for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    await page.evaluate(() => document.querySelector('[data-testid="case-accounting"]')?.scrollIntoView({ block: 'center' }));
    break;
  } catch {
    await page.waitForTimeout(1200);
  }
}
await page.waitForTimeout(900);
await page.mouse.move(1450, 420, { steps: 16 });
await page.waitForTimeout(1200);
await page.mouse.move(1510, 592, { steps: 12 });
await page.waitForTimeout(1600);
await page.mouse.wheel(0, 420);
await page.waitForTimeout(1600);
await page.mouse.move(1510, 720, { steps: 12 });
await page.waitForTimeout(1300);
await context.close();
await browser.close();
const video = await page.video().path();
const converted = spawnSync(ffmpegPath, [
  '-y', '-ss', '0.6', '-i', video, '-t', '8.4',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-r', '30', '-an', '-movflags', '+faststart', FINAL,
], { encoding: 'utf8' });
if (converted.status !== 0) throw new Error(converted.stderr?.slice(-1000));
await rm(RAW, { recursive: true, force: true });
const actionsPath = path.join(OUT, 'actions.json');
const actions = JSON.parse(await readFile(actionsPath, 'utf8'));
actions.clips['payment-live'] = {
  durationMs: 8400,
  stagedState: 'CLOSED',
  source: 'case accounting scroll',
  actions: [
    { atMs: 0, action: 'open closed case' },
    { atMs: 1800, action: 'scroll to accounting' },
    { atMs: 3600, action: 'review exact 100/20/72/8 split' },
    { atMs: 6100, action: 'scroll to payments' },
  ],
};
await writeFile(actionsPath, `${JSON.stringify(actions, null, 2)}\n`);
console.log(`captured ${FINAL}`);
