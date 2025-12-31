import { test, expect } from '@playwright/test';

test.describe('Dark Mode Visual - Other Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  const toggleDarkMode = async (page: any) => {
    await page.locator('button[title*="Mode"], button[title*="mode"]').first().click();
    await page.waitForTimeout(500);
  };

  const checkPageDarkMode = async (page: any, path: string, name: string) => {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const htmlClass = await page.locator('html').getAttribute('class');
    const initialDark = htmlClass?.includes('dark') ?? false;

    await page.screenshot({ path: `test-results/dark-${name}-light.png` });

    await toggleDarkMode(page);

    const darkHtmlClass = await page.locator('html').getAttribute('class');
    const afterDark = darkHtmlClass?.includes('dark') ?? false;

    await page.screenshot({ path: `test-results/dark-${name}-dark.png` });

    expect(afterDark).toBe(!initialDark);
  };

  test('sleep page dark mode', async ({ page }) => {
    await checkPageDarkMode(page, '/sleep', 'sleep');
  });

  test('metabolism page dark mode', async ({ page }) => {
    await checkPageDarkMode(page, '/metabolism', 'metabolism');
  });

  test('profile page dark mode', async ({ page }) => {
    await checkPageDarkMode(page, '/profile', 'profile');
  });
});
