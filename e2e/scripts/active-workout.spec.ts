import { test, type Page } from '@playwright/test';

/**
 * Active Workout Mobile Screenshots
 */

const MOBILE = { width: 375, height: 812 };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('username').fill('test');
  await page.getByPlaceholder('password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

test.describe('Active Workout Mobile', () => {
  test.use({ viewport: MOBILE });

  test('capture active workout screenshots', async ({ page }) => {
    await login(page);

    // Navigate to workouts
    await page.goto('/workouts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Viewport screenshot - what fits on screen
    await page.screenshot({ path: '.tmp/viewport-active-workout.png' });

    // Full page screenshot
    await page.screenshot({ path: '.tmp/full-active-workout.png', fullPage: true });

    // If there's an active workout, click on a completed set to see the details
    const completedSet = page.locator('.border.rounded-lg').filter({ hasText: '✓' }).first();
    if (await completedSet.count() > 0) {
      await completedSet.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: '.tmp/viewport-set-expanded.png' });
    }
  });
});
