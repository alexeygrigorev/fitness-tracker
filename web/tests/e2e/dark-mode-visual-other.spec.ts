import { test, expect } from '@playwright/test';

test.describe('Dark Mode Visual - Other Pages', () => {
  test.beforeEach(async ({ page }) => {
    console.log('[beforeEach] Starting login...');
    await page.goto('/login', { timeout: 15000 });
    console.log('[beforeEach] Navigated to login, page URL:', page.url());

    console.log('[beforeEach] Waiting for username input...');
    const usernameInput = page.getByPlaceholder('Enter your username');
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    console.log('[beforeEach] Username input found');

    await usernameInput.fill('test');
    console.log('[beforeEach] Filled username');

    await page.getByPlaceholder('Enter your password').fill('test');
    console.log('[beforeEach] Filled password');

    await page.getByRole('button', { name: 'Sign in' }).click();
    console.log('[beforeEach] Clicked sign in button');

    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    console.log('[beforeEach] Logged in, URL:', page.url());

    await page.waitForTimeout(500);
    console.log('[beforeEach] Login complete');
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
