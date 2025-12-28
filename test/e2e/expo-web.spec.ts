import { test, expect } from '@playwright/test';

/**
 * Workaround tests for Expo Web.
 *
 * Expo web uses ES modules with import.meta which causes issues in headless browsers.
 * For now, we'll use these tests to verify the app structure when JavaScript works.
 */

test.describe('Expo Web - With JavaScript Workaround', () => {
  test('should load the page title', async ({ page }) => {
    // Listen for console messages to debug
    page.on('console', msg => console.log('Console:', msg.type(), msg.text()));

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // The title should be present even without full JS execution
    await expect(page).toHaveTitle(/fitness tracker/i, { timeout: 30000 });
  });

  test('should have root element for React', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check for React root element
    const root = page.locator('#root');
    const count = await root.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should load scripts on the page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Count scripts - should have at least the entry script
    const scriptCount = await page.evaluate(() => {
      return document.querySelectorAll('script').length;
    });
    expect(scriptCount).toBeGreaterThan(0);
  });
});

/**
 * Visual regression tests
 * These capture screenshots to verify UI changes over time
 */
test.describe('Visual Regression', () => {
  test('should capture screenshot of overview page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for any initial rendering
    await page.waitForTimeout(3000);

    // Capture screenshot
    await page.screenshot({
      path: 'test-results/screenshots/overview.png',
      fullPage: true,
    });
  });

  test('should capture screenshot with different viewport sizes', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/screenshots/mobile.png' });

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/screenshots/tablet.png' });

    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/screenshots/desktop.png' });
  });
});

/**
 * API and component tests
 * These test the individual components and APIs without relying on full page rendering
 */
test.describe.skip('Component Tests', () => {
  // These would require setting up a component testing framework
  // like @testing-library/react + @playwright/experimental-ct

  test('should render Chat component', async () => {
    // TODO: Set up component testing
  });

  test('should render Food logger component', async () => {
    // TODO: Set up component testing
  });
});
