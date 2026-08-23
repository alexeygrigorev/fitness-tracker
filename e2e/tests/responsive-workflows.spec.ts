import { test, expect, type Page } from '@playwright/test';

const MOBILE = { width: 375, height: 812 };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const fitsViewport = await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ));
  expect(fitsViewport).toBe(true);
}

test.describe('Mobile workout workflows', () => {
  test.use({ viewport: MOBILE });

  test('workout sections and preset modal remain usable on a phone', async ({ page }) => {
    await login(page);
    await page.goto('/workouts');

    const bottomNavigation = page.getByRole('navigation', { name: 'Mobile' });
    const desktopNavigation = page.locator('header nav');
    await expect(bottomNavigation).toBeVisible();
    await expect(desktopNavigation).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Workouts & Programs' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Presets' }).click();
    await expect(page.getByRole('heading', { name: 'Workout Presets' })).toBeVisible();

    await page.getByRole('button', { name: '+ New Preset' }).click();
    await expect(page.getByRole('heading', { name: 'New Preset' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'New Preset' })).toBeHidden();

    await page.getByRole('button', { name: 'Exercises' }).click();
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('protected pages render without horizontal scrolling at small width', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();

    await login(page);
    await page.goto('/weight');
    await expect(page).toHaveURL(/\/weight$/);
    await expect(page.getByRole('heading', { name: 'Weight Tracking' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await context.close();
  });
});
