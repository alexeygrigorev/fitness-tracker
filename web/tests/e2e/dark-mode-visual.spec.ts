import { test, expect } from '@playwright/test';

test.describe('Dark Mode Visual Test - All Pages', () => {
  const pages = [
    { path: '/', name: 'dashboard' },
    { path: '/workouts', name: 'workouts' },
    { path: '/workouts/presets', name: 'presets' },
    { path: '/workouts/library', name: 'exercises' },
    { path: '/nutrition', name: 'nutrition' },
    { path: '/weight', name: 'weight' },
    { path: '/sleep', name: 'sleep' },
    { path: '/metabolism', name: 'metabolism' },
    { path: '/profile', name: 'profile' },
  ];

  test('visual comparison of dark mode on all pages', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
    await page.waitForTimeout(500);
    // Helper to check current mode
    const isDarkMode = async () => {
      const htmlClass = await page.locator('html').getAttribute('class');
      return htmlClass?.includes('dark') ?? false;
    };

    // Helper to get main background color
    const getMainBgColor = async () => {
      const body = page.locator('body');
      return await body.evaluate(el => getComputedStyle(el).backgroundColor);
    };

    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();

    for (const pageData of pages) {
      console.log(`\n=== Testing page: ${pageData.name} ===`);

      // Navigate to page
      await page.goto(pageData.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const initialDark = await isDarkMode();
      const initialBg = await getMainBgColor();
      console.log(`  Initial: dark=${initialDark}, bg=${initialBg}`);

      // Screenshot in initial state
      await page.screenshot({ path: `test-results/visual-${pageData.name}-initial.png`, fullPage: true });

      // Toggle to dark mode
      await toggleButton.click();
      await page.waitForTimeout(1000);

      const afterToggleDark = await isDarkMode();
      const afterToggleBg = await getMainBgColor();
      console.log(`  After toggle: dark=${afterToggleDark}, bg=${afterToggleBg}`);

      // Screenshot after toggle
      await page.screenshot({ path: `test-results/visual-${pageData.name}-after-toggle.png`, fullPage: true });

      // Verify dark mode changed
      expect(afterToggleDark).toBe(!initialDark);

      // Toggle back
      await toggleButton.click();
      await page.waitForTimeout(1000);

      const backToOriginalDark = await isDarkMode();
      const backToOriginalBg = await getMainBgColor();
      console.log(`  After toggle back: dark=${backToOriginalDark}, bg=${backToOriginalBg}`);

      // Screenshot after toggle back
      await page.screenshot({ path: `test-results/visual-${pageData.name}-after-toggle-back.png`, fullPage: true });

      // Verify we're back
      expect(backToOriginalDark).toBe(initialDark);
    }
  });

  test('check specific elements for dark mode styling', async ({ page }) => {
    await page.goto('/workouts/library');
    await page.waitForLoadState('domcontentloaded');

    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();

    // Check initial state
    const header = page.locator('header');
    const initialHeaderBg = await header.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('Initial header bg:', initialHeaderBg);

    await page.screenshot({ path: 'test-results/visual-detail-initial.png' });

    // Toggle dark mode
    await toggleButton.click();
    await page.waitForTimeout(1000);

    const darkHeaderBg = await header.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('Dark header bg:', darkHeaderBg);

    await page.screenshot({ path: 'test-results/visual-detail-dark.png' });

    // Check specific cards
    const cards = page.locator('[class*="rounded"]').first();
    const cardBg = await cards.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('Dark card bg:', cardBg);

    // Check text color
    const heading = page.locator('h2, h3').first();
    const headingColor = await heading.evaluate(el => getComputedStyle(el).color);
    console.log('Dark heading color:', headingColor);
  });
});
