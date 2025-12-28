import { test } from '@playwright/test';

/**
 * Debug test to inspect the page structure
 */
test('debug - inspect page with JS enabled', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    console.log('Browser console:', msg.type(), msg.text());
  });

  // Listen for errors
  page.on('pageerror', err => {
    console.log('Browser error:', err.message);
  });

  // Navigate and wait for network to be mostly idle
  await page.goto('/', { waitUntil: 'networkidle', timeout: 120000 });

  // Wait additional time for React to render
  await page.waitForTimeout(10000);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });

  // Check if JavaScript is enabled
  const jsEnabled = await page.evaluate(() => {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  });
  console.log('JavaScript enabled:', jsEnabled);

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Get page HTML
  const html = await page.content();
  console.log('Page HTML length:', html.length);

  // Log all text content
  const bodyText = await page.textContent('body');
  console.log('Body text (first 1000 chars):', bodyText?.substring(0, 1000));

  // Check for React root
  const hasReactRoot = await page.evaluate(() => {
    return !!document.querySelector('#root') || !!document.querySelector('[data-reactroot]');
  });
  console.log('Has React root:', hasReactRoot);

  // Check for canvas elements
  const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
  console.log('Canvas elements:', canvasCount);

  // Check for any elements with role or text
  const allElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .filter(el => el.textContent && el.textContent.trim().length > 0)
      .slice(0, 20)
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
      }));
  });
  console.log('Elements with text:', allElements);

  // Check if scripts loaded
  const scripts = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return scripts.map(s => s.src || s.textContent?.substring(0, 50));
  });
  console.log('Scripts:', scripts.length);

  // Check window object for React
  const hasReact = await page.evaluate(() => {
    return !!(window as any).React || !!(window as any).__REACT__;
  });
  console.log('Has React:', hasReact);
});
