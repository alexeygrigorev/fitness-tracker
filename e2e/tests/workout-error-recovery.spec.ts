import { test, expect } from '@playwright/test';
import {
  clearAllWorkoutState,
  ensureTestPresets,
  findAndClickPreset,
  login,
} from './helpers';

test.describe('Active Workout Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
  });

  test.afterEach(async ({ page }) => {
    if (!page.isClosed()) {
      await page.goto('/workouts');
      await clearAllWorkoutState(page);
    }
  });

  test('a failed set save remains recoverable and retries without losing data', async ({ page }) => {
    test.setTimeout(60_000);

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    await clearAllWorkoutState(page);
    await ensureTestPresets(page);
    await findAndClickPreset(page, /Push Day/i);

    const activeWorkout = page.locator(
      '.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400',
    );
    await expect(activeWorkout).toBeVisible();
    await expect(activeWorkout).toContainText('Push Day');

    await expect.poll(async () =>
      Number(await activeWorkout.getAttribute('data-workout-id')),
    ).toBeGreaterThan(0);

    const benchPressSet = activeWorkout
      .locator('.border.rounded-lg')
      .filter({ hasText: /Bench Press.*Drop/ })
      .first();
    await expect(benchPressSet).toBeVisible();
    await benchPressSet.click();
    await expect(page.locator('input[placeholder="kg"]').first()).toBeVisible();

    const expectedDropdowns = [
      { weight: 60, reps: 10 },
      { weight: 57.5, reps: 10 },
      { weight: 55, reps: 10 },
    ];

    for (const [index, dropdown] of expectedDropdowns.entries()) {
      await page
        .locator('input[placeholder="kg"]')
        .nth(index)
        .fill(String(dropdown.weight));
      await page
        .locator('input[placeholder="reps"]')
        .nth(index)
        .fill(String(dropdown.reps));
    }

    const frontendOrigin = new URL(page.url()).origin;
    const setSavePattern = new RegExp(
      `^${frontendOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/workouts/sessions/\\d+/sets/\\d+/$`,
    );
    const requestBody = {
      reps: expectedDropdowns[0].reps,
      weight: expectedDropdowns[0].weight,
      dropdownWeights: expectedDropdowns,
    };
    let completionAttempts = 0;
    const receivedBodies: unknown[] = [];

    await page.route(setSavePattern, async route => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      completionAttempts += 1;
      receivedBodies.push(route.request().postDataJSON());

      if (completionAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Unable to save the set. Please try again.',
          }),
        });
        return;
      }

      await route.continue();
    });

    const saveButton = page.getByRole('button', { name: 'Save' });
    const errorAlert = activeWorkout.getByRole('alert');
    await saveButton.click();

    await expect(errorAlert).toHaveText(
      'Unable to save the set. Please try again.',
    );
    await expect(saveButton).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uncomplete' })).toHaveCount(0);

    for (const [index, dropdown] of expectedDropdowns.entries()) {
      await expect(
        page.locator('input[placeholder="kg"]').nth(index),
      ).toHaveValue(String(dropdown.weight));
      await expect(
        page.locator('input[placeholder="reps"]').nth(index),
      ).toHaveValue(String(dropdown.reps));
    }

    await saveButton.click();

    await expect(errorAlert).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Uncomplete' })).toBeVisible();
    expect(completionAttempts).toBe(2);
    expect(receivedBodies).toEqual([requestBody, requestBody]);
    await page.unroute(setSavePattern);

    await page.reload({ waitUntil: 'networkidle' });
    const restoredBenchPressSet = page
      .locator('.border.rounded-lg')
      .filter({ hasText: /Bench Press.*Drop/ })
      .first();
    await expect(restoredBenchPressSet).toBeVisible();
    await expect(
      restoredBenchPressSet.getByRole('button', { name: 'Uncomplete' }),
    ).toBeVisible();
  });
});
