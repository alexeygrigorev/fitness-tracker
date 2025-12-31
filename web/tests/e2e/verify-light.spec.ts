import { test, expect } from '@playwright/test';

test('light mode default', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/', { timeout: 5000 });
  await page.waitForTimeout(1500);

  const htmlClass = await page.locator('html').getAttribute('class');
  const mainBg = await page.locator('.min-h-screen').first().evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('HTML class:', htmlClass, 'Bg:', mainBg);

  expect(htmlClass).toBeNull();
  await page.screenshot({ path: 'test-results/verify-light.png' });
});
