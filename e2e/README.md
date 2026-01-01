# E2E Tests

End-to-end tests for Fitness Tracker using Playwright.

## Quick Start

```bash
# Install dependencies
npm install

# Install browsers
npm run install:browsers

# Run tests (defaults to http://localhost:8000)
npm test

# Run with UI mode
BASE_URL=http://localhost:8000 npm run test:ui
```

## Running Against Different Environments

```bash
# Docker instance (port 8000)
BASE_URL=http://localhost:8000 npm test

# Local dev server (frontend on :5173)
BASE_URL=http://localhost:5173 npm test

# Remote environment
BASE_URL=https://staging.example.com npm test

# Using the run script
./run.sh http://localhost:8000
./run.sh https://staging.example.com
```

## Project Structure

```
e2e/
├── *.spec.ts           # Test files
├── playwright.config.ts # Playwright configuration
├── package.json        # Dependencies
├── run.sh              # Convenience script
└── README.md           # This file
```

## Writing Tests

Tests use Playwright's API. See [Playwright Docs](https://playwright.dev/docs/intro).

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Fitness Tracker/);
});
```
