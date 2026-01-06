import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for screenshot/audit scripts (not actual tests)
 * These are development tools, not part of the test suite.
 */
export default defineConfig({
  testDir: './scripts',
  timeout: 30 * 1000,
  reporter: 'list',
  globalTimeout: 5 * 60 * 1000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    headless: true,
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
