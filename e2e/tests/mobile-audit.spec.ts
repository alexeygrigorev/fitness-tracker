import { test, type Page } from '@playwright/test';

/**
 * Mobile Screenshot Script
 *
 * This script captures screenshots of workout pages at mobile viewport sizes.
 * It is NOT part of the test suite - it's a development/audit tool.
 *
 * Run: cd e2e && npx playwright test scripts/mobile-screenshots.ts --reporter=list
 */

// Viewport sizes
const MOBILE = { width: 375, height: 812 };      // iPhone X (primary target)
const MOBILE_SMALL = { width: 320, height: 568 }; // iPhone 5 SE (small target)
const TABLET = { width: 768, height: 1024 };      // iPad (tablet target)

// Helper to login
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
    await page.screenshot({ path: '.tmp/mobile-workouts.png', fullPage: true });

    // Presets tab
    await page.getByRole('button', { name: 'Presets' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/mobile-presets.png', fullPage: true });

    // Library tab
    const tabs = page.locator('nav button');
    await tabs.filter({ hasText: 'Exercises' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/mobile-library.png', fullPage: true });
  });

  test('capture modals', async ({ page }) => {
    await login(page);

    // Preset form modal
    await page.goto('/workouts/presets');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'New Preset' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp/mobile-preset-modal.png', fullPage: true });
  });
});
