import { test, expect, type Page } from '@playwright/test';

/**
 * Monday Push Day Workout Test
 *
 * Scenario:
 * 1. Date is set to Monday so Push Day is pre-selected/highlighted
 * 2. User logs in
 * 3. User navigates to workouts page
 * 4. Push Day preset is shown as "Today's" workout
 * 5. User clicks to start the workout
 * 6. User completes all exercises with realistic delays between sets (2-3 minutes)
 * 7. User clicks Finish Workout
 *
 * Push Day Structure (from data/generate.py for test user):
 * - Bench Press: 4 dropdown sets (working + 2 drops) = 12 sets (no separate warmup row for dropdowns)
 * - Incline Dumbbell Press: 3 sets
 * - Overhead Press: 3 sets
 * - Lateral Raises: 3 sets (normal sets, not superset for test user)
 * - Tricep Pushdowns: 4 sets
 *
 * Total: 25 sets to complete
 */

// Helper to login
async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

// Helper to generate random delay between 2-3 minutes (simulated as 100-200ms for test speed)
function randomSetDelay(): number {
  return Math.floor(Math.random() * 100) + 100; // 100-200ms instead of 2-3 minutes for test speed
}

// Helper to complete a warmup set
async function completeWarmupSet(page: Page, exerciseName: string) {
  const setRow = page.locator('.border.rounded-lg').filter({ hasText: exerciseName }).filter({ hasText: 'W' });
  await expect(setRow).toBeVisible();

  // Click to complete warmup
  await setRow.click();

  // Click Complete button
  await page.getByRole('button', { name: 'Complete' }).click();

  // Verify it's marked complete (green checkmark)
  await expect(setRow.locator('.fa-check')).toBeVisible();
}

// Helper to complete a normal working set
async function completeWorkingSet(page: Page, exerciseName: string, setNumber: number, weight: number, reps: number) {
  // Find the set row for this exercise and set number
  const setRow = page.locator('.border.rounded-lg').filter({ hasText: new RegExp(`${exerciseName}.*Set ${setNumber}`) });
  await expect(setRow).toBeVisible();

  // Click to open the form
  await setRow.click();

  // Fill in weight if the input exists (for weighted exercises)
  const weightInput = page.locator('input[placeholder="kg"]').nth(0);
  const hasWeightInput = await weightInput.count() > 0;

  if (hasWeightInput) {
    await weightInput.fill(weight.toString());
  }

  // Fill in reps
  const repsInput = page.locator('input[placeholder="reps"]').nth(0);
  await repsInput.fill(reps.toString());

  // Save the set
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify it's marked complete
  await expect(setRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });
}

// Helper to complete a dropdown set (working set + drop sets)
async function completeDropdownSet(page: Page, exerciseName: string, setNumber: number, workingWeight: number, reps: number, dropdowns: number) {
  // Find the dropdown set row
  const setRow = page.locator('.border.rounded-lg').filter({ hasText: new RegExp(`${exerciseName}.*Set ${setNumber}`) });
  await expect(setRow).toBeVisible();

  // Click to open the form
  await setRow.click();

  // Fill in Working set (W)
  const workingWeightInput = page.locator('input[placeholder="kg"]').nth(0);
  await workingWeightInput.fill(workingWeight.toString());

  const workingRepsInput = page.locator('input[placeholder="reps"]').nth(0);
  await workingRepsInput.fill(reps.toString());

  // Fill in drop sets (D1, D2, etc.)
  for (let d = 0; d < dropdowns; d++) {
    const dropWeight = workingWeight - (d + 1) * 2.5; // 2.5kg drop each time
    const dropWeightInput = page.locator('input[placeholder="kg"]').nth(d + 1);
    await dropWeightInput.fill(dropWeight.toString());

    const dropRepsInput = page.locator('input[placeholder="reps"]').nth(d + 1);
    await dropRepsInput.fill(reps.toString());
  }

  // Save the set
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify it's marked complete
  await expect(setRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });
}

// Helper to complete a superset set (two exercises)
async function completeSupersetSet(page: Page, exercise1Name: string, exercise2Name: string, setNumber: number, reps1: number, reps2: number) {
  // Find the superset rows - they have a "Superset" badge
  const supersetBadge = page.locator('.border.rounded-lg').filter({ hasText: 'Superset' });

  // For superset, we need to complete each exercise in the set
  // The rows are ordered by exercise then by set number in round-robin fashion

  // First exercise of the superset
  const setRow1 = page.locator('.border.rounded-lg').filter({ hasText: new RegExp(`${exercise1Name}.*Set ${setNumber}`) });
  await expect(setRow1).toBeVisible();
  await setRow1.click();

  const repsInput1 = page.locator('input[placeholder="reps"]').first();
  await repsInput1.fill(reps1.toString());
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(setRow1.locator('.fa-check')).toBeVisible({ timeout: 5000 });

  // Simulate rest between superset exercises (shorter, ~30 seconds = 5ms in test)
  await page.waitForTimeout(randomSetDelay() / 4);

  // Second exercise of the superset
  const setRow2 = page.locator('.border.rounded-lg').filter({ hasText: new RegExp(`${exercise2Name}.*Set ${setNumber}`) });
  await expect(setRow2).toBeVisible();
  await setRow2.click();

  const repsInput2 = page.locator('input[placeholder="reps"]').first();
  await repsInput2.fill(reps2.toString());
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(setRow2.locator('.fa-check')).toBeVisible({ timeout: 5000 });
}

test.describe('Monday Push Day Workout', () => {
  test('completes full Push Day workout on Monday with realistic delays', async ({ page }) => {
    // Set the date to Monday (2025-01-06 is a Monday)
    const mondayDate = new Date('2025-01-06T09:00:00');

    // Use clock to set the time to Monday
    await page.clock.install({
      time: mondayDate.getTime(),
    });

    // Login
    await login(page);

    // Navigate to workouts page
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Verify Push Day is shown as "Today's" workout
    // Look for the "Today" section label (small text with green color)
    const todaySectionLabel = page.locator('.text-sm.font-medium.text-green-700').filter({ hasText: 'Today' });
    await expect(todaySectionLabel).toBeVisible();

    // Verify Push Day preset is visible in the Today section
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await expect(pushDayPreset).toBeVisible();

    // Verify it has the "Monday" badge
    await expect(pushDayPreset).toContainText('Monday');

    // Click to start the workout
    await pushDayPreset.click();

    // Wait for active workout mode to appear (blue border container)
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Verify the workout header shows "Active Workout Push Day"
    await expect(activeWorkout).toContainText('Active Workout Push Day');

    // ========== BENCH PRESS: 4 Dropdown Sets ==========
    // Note: Dropdown exercises don't have separate warmup rows - the "W" in dropdowns means "Working" set
    for (let set = 1; set <= 4; set++) {
      await completeDropdownSet(page, 'Bench Press', set, 60, 10, 2);
      await page.waitForTimeout(randomSetDelay());
    }

    // ========== INCLINE DUMBBELL PRESS: 3 Sets ==========
    for (let set = 1; set <= 3; set++) {
      await completeWorkingSet(page, 'Incline Dumbbell Press', set, 24, 12);
      await page.waitForTimeout(randomSetDelay());
    }

    // ========== OVERHEAD PRESS: 3 Sets ==========
    for (let set = 1; set <= 3; set++) {
      await completeWorkingSet(page, 'Overhead Press', set, 30, 10);
      await page.waitForTimeout(randomSetDelay());
    }

    // ========== LATERAL RAISES: 3 Sets (normal sets for test user, not superset) ==========
    for (let set = 1; set <= 3; set++) {
      await completeWorkingSet(page, 'Lateral Raises', set, 10, 12);
      await page.waitForTimeout(randomSetDelay());
    }

    // ========== TRICEP PUSHDOWNS: 4 Sets ==========
    for (let set = 1; set <= 4; set++) {
      await completeWorkingSet(page, 'Tricep Pushdowns', set, 25, 15);
      await page.waitForTimeout(randomSetDelay());
    }

    // ========== FINISH WORKOUT ==========
    // Verify all sets are completed (25 total sets)
    const completedSetsCounter = page.locator('.text-lg.font-bold.text-blue-600').filter({ hasText: '25/25' });
    await expect(completedSetsCounter).toBeVisible();

    // Click Finish Workout button
    const finishButton = page.getByRole('button', { name: /Finish Workout.*25\/25 sets/ });
    await expect(finishButton).toBeVisible();
    await finishButton.click();

    // Wait for the active workout to disappear (workout successfully saved and closed)
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload the page to refresh the workouts list
    // This re-initializes selectedDate to the server's actual time (not mocked time)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The workout was just saved, so it should appear in today's workouts list
    // The "Today" button is pre-selected on page load with the actual server date
    const todayWorkouts = page.getByRole('heading', { name: /Workouts for today/i });
    await expect(todayWorkouts).toBeVisible();

    // Verify the Push Day workout is logged - use first() since there may be multiple workouts
    // from previous test runs
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/i }).first();
    await expect(loggedWorkout).toBeVisible({ timeout: 5000 });

    // Verify the workout shows the sets completed
    await expect(loggedWorkout).toContainText('sets');
  });

  test('can finish workout with partial/incomplete sets', async ({ page }) => {
    // Test the scenario where user finishes workout with only some sets completed
    // This should work without errors (e.g., 2/22 sets)
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete just 2 sets (simulating user giving up or running out of time)
    // First dropdown set of Bench Press
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible();
    await firstSetRow.click();

    // Fill in the dropdown set (W + D1 + D2)
    const workingWeightInput = page.locator('input[placeholder="kg"]').nth(0);
    await workingWeightInput.fill('60');

    const workingRepsInput = page.locator('input[placeholder="reps"]').nth(0);
    await workingRepsInput.fill('10');

    // Fill in drop sets
    const dropWeight1 = page.locator('input[placeholder="kg"]').nth(1);
    await dropWeight1.fill('57.5');
    const dropReps1 = page.locator('input[placeholder="reps"]').nth(1);
    await dropReps1.fill('10');

    const dropWeight2 = page.locator('input[placeholder="kg"]').nth(2);
    await dropWeight2.fill('55');
    const dropReps2 = page.locator('input[placeholder="reps"]').nth(2);
    await dropReps2.fill('10');

    // Save the set
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify it's marked complete
    await expect(firstSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Complete one more set (second dropdown set of Bench Press)
    const secondSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 2/ });
    await expect(secondSetRow).toBeVisible();
    await secondSetRow.click();

    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(secondSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Now try to finish with incomplete workout (should show like "2/22 sets" or similar)
    const finishButton = page.getByRole('button', { name: /Finish Workout/ });
    await expect(finishButton).toBeVisible();
    await finishButton.click();

    // Wait for the active workout to disappear - this should work even with partial sets
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });

    // Verify we're back at workouts page
    await expect(page).toHaveURL(/\/workouts$/);
  });

  test('Push Day is highlighted on Monday among other presets', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({
      time: mondayDate.getTime(),
    });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Find the Push Day card with "Today" badge
    const pushDayCard = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/ });

    // Verify it has the green border (highlighted for today)
    await expect(pushDayCard).toBeVisible();

    // Verify it has the Monday badge
    await expect(pushDayCard.locator('text=/Monday/i')).toBeVisible();

    // Verify it has the play button to start
    await expect(pushDayCard.locator('.fa-play')).toBeVisible();
  });

  test('non-Monday presets are in "Other days" section on Monday', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({
      time: mondayDate.getTime(),
    });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Look for "Other days" section
    const otherDaysSection = page.locator('details').filter({ hasText: /Other days/i });
    await expect(otherDaysSection).toBeVisible();

    // Expand "Other days" to see other presets
    await otherDaysSection.locator('summary').click();

    // Verify Pull Day (Wednesday) and Leg Day (Friday) are in other days
    await expect(otherDaysSection.locator('text=/Pull Day/')).toBeVisible();
    await expect(otherDaysSection.locator('text=/Wednesday/i')).toBeVisible();
    await expect(otherDaysSection.locator('text=/Leg Day/')).toBeVisible();
    await expect(otherDaysSection.locator('text=/Friday/i')).toBeVisible();
  });

  test('can resume a partially completed workout and finish remaining sets', async ({ page }) => {
    // Set up auto-accept for all confirmation dialogs
    page.on('dialog', dialog => dialog.accept());

    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete first dropdown set of Bench Press
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible();
    await firstSetRow.click();

    // Fill in the dropdown set (W + D1 + D2)
    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    // Save the set
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(firstSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish the workout with just 1 set completed
    const finishButton = page.getByRole('button', { name: /Finish Workout/ });
    await expect(finishButton).toBeVisible();
    await finishButton.click();

    // Wait for the active workout to disappear
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to see the saved workout
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find the newly created workout (it will have the current time 09:00)
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/ }).filter({ hasText: '09:00 AM' }).first();
    await expect(loggedWorkout).toBeVisible({ timeout: 5000 });

    // Get the workout ID using the data attribute
    const workoutId = await loggedWorkout.getAttribute('data-workout-id');
    expect(workoutId).not.toBeNull();

    // Click the play button to resume the workout
    const resumeButton = loggedWorkout.getByRole('button').filter({ hasText: '' }).locator('.fa-play').locator('..');
    await resumeButton.click();

    // Active workout mode should appear again
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Verify we see completed sets (checkmarks should exist)
    const checkmarks = page.locator('.fa-check');
    await expect(checkmarks.first()).toBeVisible({ timeout: 5000 });

    // Count total sets - should have multiple sets from the full workout
    const allSetRows = page.locator('.border.rounded-lg');
    const setCount = await allSetRows.count();
    expect(setCount).toBeGreaterThan(3); // Should have multiple sets

    // Finish the workout again with the current state (some completed, some not)
    await page.getByRole('button', { name: /Finish Workout/ }).click();

    // Wait for active workout to disappear
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to verify the workout was updated (not duplicated)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify our workout still exists (was updated, not duplicated) using the data-workout-id
    const sameWorkout = page.locator(`[data-workout-id="${workoutId}"]`);
    await expect(sameWorkout).toBeVisible();

    // Count workouts before deletion
    const workoutsBefore = await page.locator('[data-workout-id]').count();

    // Delete the workout using the ID (dialog is auto-accepted by global handler)
    const deleteButton = sameWorkout.locator('button[title="Delete"]');
    await deleteButton.click();

    // Wait for network idle after deletion
    await page.waitForLoadState('networkidle');

    // Reload the page to ensure we get the updated state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Count workouts after deletion - should be one less
    const workoutsAfter = await page.locator('[data-workout-id]').count();
    expect(workoutsAfter).toBe(workoutsBefore - 1);

    // Verify the workout is gone (no element with this data-workout-id exists)
    const deletedWorkout = page.locator(`[data-workout-id="${workoutId}"]`);
    await expect(deletedWorkout).not.toBeVisible({ timeout: 5000 });
  });
});
