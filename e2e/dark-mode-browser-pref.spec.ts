import { test, expect } from '@playwright/test';

/**
 * Tests for dark/light mode when browser's appearance setting is set to dark.
 *
 * This tests the scenario where a user has their browser/OS appearance set to dark mode,
 * but the app should still respect the user's in-app dark mode preference.
 */
test.describe('Dark Mode with Browser Dark Appearance', () => {
  test('light mode has light background even when browser colorScheme is dark', async ({ page }) => {
    // Simulate browser having dark appearance (like Chrome's Appearance: Dark setting)
    await page.emulateMedia({ colorScheme: 'dark' });

    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Get the dark mode toggle button
    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Helper to check if dark mode is active (via the 'dark' class on html)
    const isDarkMode = async () => {
      const htmlClass = await page.locator('html').getAttribute('class');
      return htmlClass?.includes('dark') ?? false;
    };

    // Helper to get the background color of the main container
    const getBackgroundColor = async () => {
      const mainDiv = page.locator('.min-h-screen').first();
      return await mainDiv.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
    };

    // Helper to check if background is dark (rgb values are low)
    const isBackgroundDark = (rgbString: string) => {
      const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return false;
      const [, r, g, b] = match.map(Number);
      // Dark background has low RGB values (typically < 128 for all channels)
      return r < 128 && g < 128 && b < 128;
    };

    // Get initial state (test user might have dark mode enabled)
    const initialDark = await isDarkMode();
    console.log('Initial dark mode (browser is dark):', initialDark);

    // If we're in dark mode, toggle to light mode first
    if (initialDark) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify we're now in light mode
    const isLight = await isDarkMode();
    console.log('After ensuring light mode, dark mode:', isLight);
    expect(isLight).toBe(false);

    // Light mode should have light background even though browser is dark
    const lightBg = await getBackgroundColor();
    console.log('Light mode background color (browser is dark):', lightBg);
    expect(isBackgroundDark(lightBg)).toBe(false);
    console.log('✓ Verified: Light mode shows light background (even with browser dark)');

    // Take screenshot of light mode
    await page.screenshot({ path: 'test-results/dark-mode-browser-light.png' });
    console.log('Screenshot saved: dark-mode-browser-light.png');

    // Now toggle to dark mode and verify it's dark
    await toggleButton.click();
    await page.waitForTimeout(1000);

    const afterToggle = await isDarkMode();
    console.log('After toggle, dark mode:', afterToggle);
    expect(afterToggle).toBe(true);

    const darkBg = await getBackgroundColor();
    console.log('Dark mode background color:', darkBg);
    expect(isBackgroundDark(darkBg)).toBe(true);
    console.log('✓ Verified: Dark mode shows dark background');

    // Take screenshot of dark mode
    await page.screenshot({ path: 'test-results/dark-mode-browser-dark.png' });
    console.log('Screenshot saved: dark-mode-browser-dark.png');

    // Toggle back to light mode and verify it's light again
    await toggleButton.click();
    await page.waitForTimeout(1000);

    const backToLight = await isDarkMode();
    console.log('After toggle back, dark mode:', backToLight);
    expect(backToLight).toBe(false);

    const lightBgAgain = await getBackgroundColor();
    console.log('Light mode background color (after toggle back):', lightBgAgain);
    expect(isBackgroundDark(lightBgAgain)).toBe(false);
    console.log('✓ Verified: Light mode shows light background after toggling');

    // Reset browser colorScheme to default (important for other tests)
    await page.emulateMedia({ colorScheme: 'light' });
    console.log('Reset browser colorScheme to light');
  });

  test('dark mode has dark background and light mode has light background', async ({ page }) => {
    // Test with browser dark preference
    await page.emulateMedia({ colorScheme: 'dark' });

    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    const htmlElement = page.locator('html');
    const isDarkMode = async () => {
      const htmlClass = await page.locator('html').getAttribute('class');
      return htmlClass?.includes('dark') ?? false;
    };

    // Get initial state (test user might have dark mode enabled)
    const initialDark = await isDarkMode();

    // If we're in dark mode, toggle to light mode first
    if (initialDark) {
      await toggleButton.click();
      await page.waitForTimeout(500);
    }

    // Verify light mode is active
    await expect(htmlElement).not.toHaveClass(/dark/);

    // Toggle to dark mode
    await toggleButton.click();
    await page.waitForTimeout(500);

    // Check that dark class is present
    await expect(htmlElement).toHaveClass(/dark/);

    // Check specific dark mode styles are applied
    const body = page.locator('body');
    const bodyBg = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    console.log('Dark mode body background:', bodyBg);

    // Dark mode body should have dark background (#1a1a1a = rgb(26, 26, 26))
    const isBodyDark = bodyBg.includes('26') || bodyBg.includes('rgb(26, 26, 26)');
    expect(isBodyDark).toBe(true);
    console.log('✓ Verified: Dark mode has dark background');

    // Toggle back to light mode
    await toggleButton.click();
    await page.waitForTimeout(500);

    // Verify light mode
    await expect(htmlElement).not.toHaveClass(/dark/);

    const bodyBgLight = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    console.log('Light mode body background:', bodyBgLight);

    // Light mode body should NOT have the dark background
    const isBodyDarkInLightMode = bodyBgLight.includes('26') || bodyBgLight.includes('rgb(26, 26, 26)');
    expect(isBodyDarkInLightMode).toBe(false);
    console.log('✓ Verified: Light mode has light background (even with browser dark)');

    // Reset for other tests
    await page.emulateMedia({ colorScheme: 'light' });
  });

  // Cleanup: Reset to default after all tests in this suite
  test.afterEach(async ({ page }) => {
    // Ensure browser colorScheme is reset after each test
    await page.emulateMedia({ colorScheme: 'light' });
  });
});
