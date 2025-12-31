import { test, expect } from '@playwright/test';

test.describe('Dark Mode Toggle', () => {
  test('can toggle dark mode on and off with screenshots', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Get the dark mode toggle button (sun/moon icon)
    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Helper to check if dark mode is active
    const isDarkMode = async () => {
      const htmlClass = await page.locator('html').getAttribute('class');
      return htmlClass?.includes('dark') ?? false;
    };

    // Initial state
    const initialDark = await isDarkMode();
    console.log('Initial dark mode:', initialDark);

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/dark-mode-0-initial.png' });
    console.log('Screenshot saved: dark-mode-0-initial.png');

    // Wait a moment for everything to settle
    await page.waitForTimeout(500);

    // First toggle - switch to opposite mode
    await toggleButton.click();
    await page.waitForTimeout(1000); // Wait for UI update

    const afterFirstToggle = await isDarkMode();
    console.log('After first toggle, dark mode:', afterFirstToggle);

    // Verify dark mode changed
    expect(afterFirstToggle).toBe(!initialDark);

    // Take screenshot after first toggle
    await page.screenshot({ path: 'test-results/dark-mode-1-after-first-toggle.png' });
    console.log('Screenshot saved: dark-mode-1-after-first-toggle.png');

    // Second toggle - switch back
    await toggleButton.click();
    await page.waitForTimeout(1000);

    const afterSecondToggle = await isDarkMode();
    console.log('After second toggle, dark mode:', afterSecondToggle);

    // Verify we're back to original mode
    expect(afterSecondToggle).toBe(initialDark);

    // Take screenshot after second toggle
    await page.screenshot({ path: 'test-results/dark-mode-2-after-second-toggle.png' });
    console.log('Screenshot saved: dark-mode-2-after-second-toggle.png');

    // Third toggle - verify it works again
    await toggleButton.click();
    await page.waitForTimeout(1000);

    const afterThirdToggle = await isDarkMode();
    console.log('After third toggle, dark mode:', afterThirdToggle);

    expect(afterThirdToggle).toBe(!initialDark);

    // Take screenshot after third toggle
    await page.screenshot({ path: 'test-results/dark-mode-3-after-third-toggle.png' });
    console.log('Screenshot saved: dark-mode-3-after-third-toggle.png');
  });

  test('dark mode affects page styling', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    // Get toggle button
    const toggleButton = page.locator('button[title*="Mode"], button[title*="mode"]').first();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Helper to check dark class on html element
    const hasDarkClass = async () => {
      const html = page.locator('html');
      const className = await html.getAttribute('class');
      return className?.includes('dark') ?? false;
    };

    // Check initial state
    const initialDark = await hasDarkClass();
    console.log('Initial - dark mode:', initialDark);

    // Toggle to dark mode
    await toggleButton.click();
    await page.waitForTimeout(500);

    // Verify dark mode is active
    const isDark = await hasDarkClass();
    console.log('After toggle - dark mode:', isDark);
    expect(isDark).toBe(true);

    // Verify the dark class is on the html element
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Toggle back to light mode
    await toggleButton.click();
    await page.waitForTimeout(500);

    // Verify we're back to light
    const isLight = await hasDarkClass();
    console.log('After toggle back - dark mode:', isLight);
    expect(isLight).toBe(false);
    await expect(htmlElement).not.toHaveClass(/dark/);
  });
});
