import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,  // 30 second timeout per test
  expect: {
    timeout: 10 * 1000,  // 10 second timeout per assertion
  },
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalTimeout: 3 * 60 * 1000,  // 3 minute total timeout
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
  ],
});
