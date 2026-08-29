import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Tests Configuration
 *
 * Run tests against any URL by setting BASE_URL:
 *
 *   # Default: local Vite dev server (frontend on :5173)
 *   npm test
 *
 *   # Remote staging/production
 *   BASE_URL=https://staging.example.com npm test
 *
 *   # Run with UI mode
 *   npm run test:ui
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalTimeout: 15 * 60 * 1000,

  // Read BASE_URL from environment, default to frontend dev server
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    headless: true,
    // Ignore browser cache for testing
    ignoreHTTPSErrors: true,
    // Capture console logs
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Force fresh context for each test to avoid caching
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-cache']
        },
        contextOptions: {
          // Bypass browser cache entirely
          storageState: undefined,
        },
      },
    },
  ],
});
