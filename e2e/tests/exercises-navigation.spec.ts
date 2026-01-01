import { test, expect, type Page } from '@playwright/test';

test.describe('Exercises Page Navigation', () => {
  // Helper to login
  async function login(page: Page) {
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Wait for login to complete - URL should change from /login
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
  }

  test('can login and access exercises page', async ({ page }) => {
    await login(page);

    // Navigate to exercises page
    await page.goto('/workouts/library');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on exercises page
    expect(page.url()).toContain('/workouts/library');
  });

  test('navigates between workouts, presets, and exercises tabs', async ({ page }) => {
    await login(page);

    // Navigate to workouts page
    await page.goto('/workouts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/workouts$/);

    // Click on Presets tab
    await page.getByRole('button', { name: 'Presets' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/workouts\/presets/);

    // Click on Exercises (Library) tab - use filter to get the tab button specifically
    const tabs = page.locator('nav button');
    await tabs.filter({ hasText: 'Exercises' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/workouts\/library/);

    // Click back to Workouts tab
    await page.getByRole('button', { name: 'Workouts' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/workouts$/);
  });

  test('exercises page displays content', async ({ page }) => {
    await login(page);

    await page.goto('/workouts/library');
    await page.waitForLoadState('domcontentloaded');

    // Verify page heading is visible
    const heading = page.getByRole('heading', { name: 'Exercises' });
    await expect(heading).toBeVisible();
  });

  test('presets page displays content', async ({ page }) => {
    await login(page);

    await page.goto('/workouts/presets');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on presets page
    await expect(page).toHaveURL(/\/workouts\/presets/);

    // Verify page heading is visible
    const heading = page.getByRole('heading', { name: 'Workout Presets' });
    await expect(heading).toBeVisible();
  });

  test('workouts page displays content', async ({ page }) => {
    await login(page);

    await page.goto('/workouts');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on workouts page
    await expect(page).toHaveURL(/\/workouts$/);

    // Verify some content is visible (either workout list or empty state)
    const content = page.locator('text=/workout|session|start/i').first();
    await expect(content).toBeVisible();
  });
});
