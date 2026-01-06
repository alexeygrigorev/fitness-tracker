import { test, type Page } from '@playwright/test';

/**
 * Mobile Screenshot Script
 *
 * Captures both viewport (what's visible on screen) and full page screenshots.
 * - viewport-*.png: Only what fits on screen (no scrolling)
 * - full-*.png: Entire page including scrolled content
 *
 * Run: cd e2e && npx playwright test --config=playwright.scripts.config.ts
 */

const MOBILE = { width: 375, height: 812 };
const MOBILE_SMALL = { width: 320, height: 568 };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('username').fill('test');
  await page.getByPlaceholder('password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

test.describe('Mobile Screenshots', () => {
  test.use({ viewport: MOBILE });

  test('capture workout pages', async ({ page }) => {
    await login(page);

    // Workouts page
    await page.goto('/workouts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/viewport-workouts.png' }); // Viewport only
    await page.screenshot({ path: '.tmp/full-workouts.png', fullPage: true }); // Full page

    // Presets tab
    await page.getByRole('button', { name: 'Presets' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/viewport-presets.png' });
    await page.screenshot({ path: '.tmp/full-presets.png', fullPage: true });

    // Library tab
    const tabs = page.locator('nav button, nav a');
    await tabs.filter({ hasText: 'Exercises' }).first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/viewport-library.png' });
    await page.screenshot({ path: '.tmp/full-library.png', fullPage: true });
  });

  test('capture preset modal', async ({ page }) => {
    await login(page);
    await page.goto('/workouts/presets');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'New Preset' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/viewport-preset-modal.png' });
    await page.screenshot({ path: '.tmp/full-preset-modal.png', fullPage: true });
  });
});
