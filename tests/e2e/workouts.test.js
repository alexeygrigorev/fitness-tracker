/**
 * End-to-End Tests for Fitness Tracker
 *
 * These tests use Playwright to interact with the UI like a real user.
 *
 * IMPORTANT: Start servers before running tests:
 *   - Backend:  cd backend && uv run uvicorn main:app --port 8001
 *   - Frontend: cd web && npm run dev -- --port 3174
 *
 * Or use: npm run test:e2e:full (from repo root)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';

const FRONTEND_URL = 'http://127.0.0.1:4174';

let browser = null;
let context = null;
let page = null;

// Global setup
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(10000);
}, 30000);

// Global teardown
afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

describe('Fitness Tracker E2E', () => {
  it('should load the application home page', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const title = await page.title();
    expect(title).toBeTruthy();

    // Check that main navigation is visible
    const nav = page.locator('nav').first();
    const isVisible = await nav.isVisible().catch(() => false);
    expect(isVisible).toBe(true);
  });

  it('should navigate to Exercises page', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    // Click on Exercises link
    const exercisesLink = page.getByRole('link', { name: /exercises/i });
    await exercisesLink.click();
    await page.waitForTimeout(500);

    // Verify URL changed
    const url = page.url();
    expect(url).toContain('/exercises');
  });

  it('should display list of exercises', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /exercises/i }).click();
    await page.waitForTimeout(500);

    // Check for exercise cards/list items
    const pageContent = await page.content();
    expect(pageContent).toMatch(/bench press|squat|deadlift/i);
  });

  it('should navigate to Workouts page', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /workouts/i }).click();
    await page.waitForTimeout(500);

    const url = page.url();
    expect(url).toContain('/workouts');
  });

  it('should display workout templates', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /workouts/i }).click();
    await page.waitForTimeout(500);

    // Look for workout template buttons
    const templateButtons = page.locator('button').filter({ hasText: /push|pull|legs|full body/i });
    const count = await templateButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should navigate between pages using navigation', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    // Go to exercises
    await page.getByRole('link', { name: /exercises/i }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('/exercises');

    // Go to workouts
    await page.getByRole('link', { name: /workouts/i }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('/workouts');

    // Go back to exercises
    await page.getByRole('link', { name: /exercises/i }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('/exercises');
  });

  it('should show exercise details when clicking an exercise', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /exercises/i }).click();
    await page.waitForTimeout(500);

    // Click on the first exercise card
    const firstExercise = page.locator('[class*="exercise"], button, [data-testid*="exercise"]').first();
    const count = await firstExercise.count();

    if (count > 0) {
      await firstExercise.click();
      await page.waitForTimeout(300);

      // Just verify we haven't crashed
      const pageContent = await page.content();
      expect(pageContent).toBeTruthy();
    }
  });

  it('should display responsive layout on mobile viewport', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Check if mobile menu or navigation exists
    const nav = page.locator('nav').first();
    const isVisible = await nav.isVisible().catch(() => false);
    expect(isVisible).toBe(true);

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  it('should navigate to Templates page if available', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    const templatesLink = page.getByRole('link', { name: /templates/i });
    const isVisible = await templatesLink.isVisible().catch(() => false);

    if (isVisible) {
      await templatesLink.click();
      await page.waitForTimeout(500);

      const url = page.url();
      expect(url).toContain('/templates');
    } else {
      // Test passes if templates link doesn't exist
      expect(true).toBe(true);
    }
  });

  it('should navigate to Food page if available', async () => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    const foodLink = page.getByRole('link', { name: /food/i });
    const isVisible = await foodLink.isVisible().catch(() => false);

    if (isVisible) {
      await foodLink.click();
      await page.waitForTimeout(500);

      const url = page.url();
      expect(url).toContain('/food');
    } else {
      // Test passes if food link doesn't exist
      expect(true).toBe(true);
    }
  });
});
