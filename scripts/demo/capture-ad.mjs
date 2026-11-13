#!/usr/bin/env node
/**
 * Capture the real MEND app for the 5-minute ad.
 *
 * Usage:
 *   BASE_URL=http://localhost:3100 node scripts/demo/capture-ad.mjs
 *
 * Outputs 2x screenshots at 1920x1080 viewport into
 * demo/ad/public/assets/app/. The pothole report flow uses the Pexels photo
 * prepared by scripts/demo/fetch-ad-assets.mjs.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tests/node_modules/@playwright/test/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const OUT = path.join(ROOT, 'demo/ad/public/assets/app');
const PHOTO = path.join(ROOT, 'demo/ad/public/assets/photos/pothole.jpg');

const HIDE_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog] { display: none !important; }
  html { scrollbar-width: none; }
  body::-webkit-scrollbar { display: none; }
`;

async function shot(page, name, opts = {}) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: opts.fullPage ?? false,
    animations: 'disabled',
  });
  console.log(`captured ${name}.png`);
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`WARN ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('mend-mode', 'REPLAY');
    } catch {}
  });
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});

  await safe('home', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'home');
  });

  await safe('report', async () => {
    await page.goto(`${BASE}/report`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'report-1');

    await page.selectOption('#report-category', 'other').catch(() => {});
    await page.selectOption('#report-area', 'path').catch(() => {});
    await page.fill(
      '#report-description',
      'The community path has a deep pothole near the north gate. It fills with water, and cyclists swerve into the grass to avoid it. It has been there for months.',
    );
    await shot(page, 'report-1-filled');
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(400);

    if (await page.locator('#report-photo').count()) {
      await page.setInputFiles('#report-photo', PHOTO);
      await page.waitForTimeout(1200);
    }
    await shot(page, 'report-2-photo');
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(400);

    await page.locator('input[value="same"]').check().catch(() => {});
    await page.locator('input[type="checkbox"]').check().catch(() => {});
    await shot(page, 'report-3-duplicate');
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(400);

    await shot(page, 'report-4-review');
    await page.getByRole('button', { name: /Submit report/i }).click();
    await page.waitForTimeout(800);
    await shot(page, 'report-receipt');
  });

  await safe('case', async () => {
    await page.goto(`${BASE}/cases/WO-PATH-001-0001`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'case-hero');
    await page.getByText('Approved scope', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'case-scope');
    await page.locator('.trust-panel').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'case-trust');
    await page.getByText('Money', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'case-money');
  });

  await safe('bids', async () => {
    await page.goto(`${BASE}/bids/WO-PATH-001-0001`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'bids');
    await page.getByText('score', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'bids-score');
  });

  await safe('steward', async () => {
    await page.goto(`${BASE}/steward`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'steward');
  });

  await safe('inspector', async () => {
    await page.goto(`${BASE}/inspector/WO-PATH-001-0001`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'inspector');
  });

  await safe('passport', async () => {
    await page.goto(`${BASE}/assets/PATH-006`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'passport');
    await page.getByText('history', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'passport-history');
  });

  await safe('how-it-works', async () => {
    await page.goto(`${BASE}/how-it-works`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'how-it-works');
    await page.getByText('stack', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'how-it-works-stack');
    await page.getByText('proof', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'how-it-works-proof');
  });

  await safe('trust', async () => {
    await page.goto(`${BASE}/trust`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'trust');
  });

  await safe('demo', async () => {
    await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await shot(page, 'demo');
    await page.getByTestId('scenario-pothole').click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'demo-pothole');
  });

  await browser.close();
  console.log('done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
