import { test, expect } from '@playwright/test';

test('debug dark mode', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/debug-login-page.png' });
  
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  
  const hasInput = await page.locator('input').count();
  console.log('Input count:', hasInput);
});
