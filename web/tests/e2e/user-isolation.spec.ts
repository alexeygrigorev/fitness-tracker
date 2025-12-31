import { test, expect, type Page } from '@playwright/test';

/**
 * User Isolation Test
 *
 * Verifies that users can only see their own workouts:
 * 1. User 1 creates and finishes a workout
 * 2. User 1 logs out
 * 3. User 2 logs in
 * 4. User 2 should NOT see User 1's workout
 */

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

async function logout(page: Page) {
  await page.getByTitle('Logout').click();
  await page.waitForURL('/login', { timeout: 5000 });
}

test.describe('User Isolation', () => {
  test('users cannot see each other workouts', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    // User 1 (test) logs in and creates a workout
    await login(page, 'test', 'test');
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete one set
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible();
    await firstSetRow.click();

    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(firstSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish the workout
    await page.getByRole('button', { name: /Finish Workout/ }).click();
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Get the workout ID for verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/ }).filter({ hasText: '09:00 AM' }).first();
    await expect(loggedWorkout).toBeVisible({ timeout: 5000 });
    const workoutId = await loggedWorkout.getAttribute('data-workout-id');
    expect(workoutId).not.toBeNull();

    // Count workouts before logout
    const workoutsCountUser1 = await page.locator('[data-workout-id]').count();
    expect(workoutsCountUser1).toBeGreaterThan(0);

    // User 1 logs out
    await logout(page);

    // User 2 (test2) logs in
    await login(page, 'test2', 'test2');
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // User 2 should NOT see User 1's workout (by data-workout-id)
    const user1Workout = page.locator(`[data-workout-id="${workoutId}"]`);
    await expect(user1Workout).not.toBeVisible({ timeout: 5000 });

    // User 2's workout list should be empty or different (no workout with User 1's ID)
    const allWorkoutIds = page.locator('[data-workout-id]');
    const count = await allWorkoutIds.count();

    // Verify none of User 2's workouts have the same ID as User 1's workout
    for (let i = 0; i < count; i++) {
      const id = await allWorkoutIds.nth(i).getAttribute('data-workout-id');
      expect(id).not.toBe(workoutId);
    }
  });
});
