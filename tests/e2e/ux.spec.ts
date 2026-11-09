import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { webReachable } from './support/env.js';

/**
 * T07.7 — UX quality: accessibility, keyboard-only, mobile viewport and an
 * unmistakable mode banner.
 *
 * Every test skips with an explicit reason until apps/web is merged and served.
 */
test.describe('UX quality', () => {
  test.beforeEach(async ({ page }) => {
    const reachable = await webReachable(page);
    test.skip(!reachable, 'SKIP: apps/web is not merged or the web URL is unreachable');
  });

  test('has no serious or critical axe violations on the public landing/case view', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    await testInfo.attach('axe-results.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      blocking.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })),
    ).toEqual([]);
  });

  test('is fully keyboard navigable with a visible focus indicator', async ({ page }) => {
    await page.goto('/');
    const focusables = page.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    expect(await focusables.count()).toBeGreaterThan(0);

    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          signature: `${element.tagName}:${element.id}:${element.getAttribute('data-testid') ?? ''}:${element.textContent?.trim().slice(0, 20) ?? ''}`,
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth || '0'),
          boxShadow: style.boxShadow,
          visible: rect.width > 0 && rect.height > 0,
        };
      });
      if (!active) continue;
      seen.add(active.signature);
      expect(active.visible, 'focused element must be visible').toBe(true);
      const hasIndicator =
        (active.outlineStyle !== 'none' && active.outlineWidth > 0) || active.boxShadow !== 'none';
      expect(hasIndicator, `no visible focus indicator on ${active.signature}`).toBe(true);
    }
    expect(seen.size, 'Tab must move focus between elements (no keyboard trap)').toBeGreaterThan(1);
  });

  test('works at a 390x844 mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    await expect(page.getByText(/REPLAY\s*\/\s*SIMULATION/i).first()).toBeVisible();
  });

  test('the mode banner is unmistakable and impossible to miss', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('[role="region"][aria-label*="mode" i]').first();
    const fallback = page.getByText(/REPLAY\s*\/\s*SIMULATION/i).first();
    const region = (await banner.count()) > 0 ? banner : fallback;
    await expect(region).toBeVisible();
    await expect(page.getByText(/REPLAY\s*\/\s*SIMULATION/i).first()).toBeVisible();

    const info = await region.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        fontSize: Number.parseFloat(style.fontSize || '0'),
        position: style.position,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        background: style.backgroundColor,
        color: style.color,
        text: element.textContent ?? '',
        viewportWidth: window.innerWidth,
      };
    });

    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThanOrEqual(28);
    expect(info.width).toBeGreaterThan(info.viewportWidth * 0.6);
    expect(info.text).toMatch(/REPLAY\s*\/\s*SIMULATION/i);
    const prominent = info.position === 'fixed' || info.position === 'sticky' || info.top < 220;
    expect(prominent, 'mode banner must be fixed/sticky or within the top of the page').toBe(true);
    expect(info.background).not.toBe(info.color);
  });
});
