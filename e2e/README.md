# E2E Tests

End-to-end tests for Fitness Tracker using Playwright.

## Quick Start

```bash
# Install dependencies from the lockfile
npm ci

# Install browsers
npm run install:browsers

# Run tests (frontend defaults to http://localhost:5173)
npm test

# Run with UI mode
BASE_URL=http://localhost:5173 npm run test:ui
```

`./run-local-ts.sh` runs the frontend and TypeScript backend locally against a
fresh DynamoDB Local database. `./run-sam-ts.sh` runs the same suite against
the production-built Lambda/SPA artifact. Both use the committed deterministic
fixture in `fixtures/backend-seed.json` and require no second backend.

To target an already-running stack, set both `BASE_URL` and `VITE_API_URL`.

## Running Against Different Environments

```bash
# Local dev server (frontend on :5173)
BASE_URL=http://localhost:5173 npm test

# Remote environment
BASE_URL=https://staging.example.com npm test

```

## Project Structure

```
e2e/
├── tests/*.spec.ts     # Test files
├── playwright.config.ts # Playwright configuration
├── package.json        # Dependencies
├── run-local-ts.sh     # Vite + TypeScript backend + DynamoDB Local
├── run-sam-ts.sh       # Production Lambda/SPA artifact + DynamoDB Local
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
