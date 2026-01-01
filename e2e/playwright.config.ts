import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Tests Configuration
 *
 * Run tests against any URL by setting BASE_URL:
 *
 *   # Local Docker instance
 *   BASE_URL=http://localhost:8000 npm test
 *
 *   # Dev server (frontend on :5173, backend on :8000)
 *   BASE_URL=http://localhost:5173 npm test
 *
 *   # Remote staging/production
 *   BASE_URL=https://staging.example.com npm test
 *
 *   # Run with UI mode
 *   BASE_URL=http://localhost:8000 npm run test:ui
 */
export default defineConfig({
  testDir: './',
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalTimeout: 5 * 60 * 1000,

  // Read BASE_URL from environment, default to localhost:8000 (Docker)
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
