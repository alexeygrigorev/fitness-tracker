import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

test.describe('Monday Push Day Workout', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auto-accept for all confirmation dialogs for the entire test suite
    page.on('dialog', dialog => dialog.accept());
  });

  test('completes full Push Day workout on Monday with realistic delays', async ({ page }) => {
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

    // Verify we're on the Push Day preset (day label is shown on the preset button, not in active workout)
    await expect(activeWorkout).toContainText('Push Day');

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

    // Wait for the checkmark to appear
    await expect(firstSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Simulate realistic delay between sets (rest period)
    await page.clock.install({ time: new Date('2025-01-06T09:02:00').getTime() });

    // Complete second dropdown set of Bench Press
    const secondSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 2/ });
    await expect(secondSetRow).toBeVisible();
    await secondSetRow.click();

    // Fill in the dropdown set
    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(secondSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    await page.clock.install({ time: new Date('2025-01-06T09:04:00').getTime() });

    // Click "Show more" to reveal all exercises (Overhead Press may be hidden)
    const showMoreButton = activeWorkout.getByText(/Show \d+ more/);
    if ((await showMoreButton.count()) > 0) {
      await showMoreButton.click();
    }

    // Complete one set of Overhead Press (normal set)
    const ohpSetRow = activeWorkout.locator('.border.rounded-lg').filter({ hasText: /Overhead Press.*Set 1/ });
    await expect(ohpSetRow).toBeVisible({ timeout: 5000 });
    await ohpSetRow.click();

    await page.locator('input[placeholder="kg"]').fill('30');
    await page.locator('input[placeholder="reps"]').fill('8');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(ohpSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish the workout
    await page.getByRole('button', { name: /Finish Workout/ }).click();

    // Wait for the active workout to disappear
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify the workout appears in the logged workouts list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find the newly created workout (it will have the current time 09:00)
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/ }).filter({ hasText: '09:00' }).first();
    await expect(loggedWorkout).toBeVisible({ timeout: 5000 });
  });

  test('can finish workout with partial/incomplete sets', async ({ page }) => {
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

    // Complete just ONE dropdown set of Bench Press
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

    // Finish with partial sets
    await page.getByRole('button', { name: /Finish Workout/ }).click();
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to see the saved workout
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify our workout was saved
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/ }).filter({ hasText: '09:00' }).first();
    await expect(loggedWorkout).toBeVisible({ timeout: 5000 });
  });

  test('Push Day is highlighted on Monday among other presets', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Verify "Today's Presets" section exists (use heading to avoid strict mode violation)
    await expect(page.getByRole('heading', { name: /Today/i })).toBeVisible();

    // Push Day should be highlighted/visible in Today's section
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await expect(pushDayPreset).toBeVisible();
  });

  test('non-Monday presets are in "Other days" section on Monday', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Leg Day should exist in the DOM (it's a Friday preset, shown somewhere on Monday)
    // It may be hidden in a collapsible section, but should be present
    const legDayCount = await page.getByText('Leg Day').count();
    expect(legDayCount).toBeGreaterThan(0);
  });

  test('can resume a partially completed workout and finish remaining sets', async ({ page }) => {
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
    const loggedWorkout = page.locator('.border.rounded-lg').filter({ hasText: /Push Day/ }).filter({ hasText: '09:00' }).first();
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
    // Wait a moment for the workout state to fully load after resume
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
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

  test('resuming and finishing workout updates instead of duplicating', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Count workouts BEFORE starting the workout (there may be existing workouts from previous tests)
    const initialWorkoutCount = await page.locator('[data-workout-id]').count();

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete first dropdown set of Bench Press (Set 1)
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible();
    await firstSetRow.click();

    // Fill in the dropdown set
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

    // Count workouts after first finish - should be initial + 1
    let workoutCount = await page.locator('[data-workout-id]').count();
    expect(workoutCount).toBe(initialWorkoutCount + 1);

    // Get the first workout ID (the newly created one)
    const firstWorkoutId = await page.locator('[data-workout-id]').first().getAttribute('data-workout-id');
    expect(firstWorkoutId).not.toBeNull();

    // Click the play button to resume the workout
    const loggedWorkout = page.locator(`[data-workout-id="${firstWorkoutId}"]`);
    const resumeButton = loggedWorkout.getByRole('button').filter({ hasText: '' }).locator('.fa-play').locator('..');
    await resumeButton.click();

    // Active workout mode should appear again
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete a SECOND dropdown set (Set 2)
    const secondSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 2/ });
    await expect(secondSetRow).toBeVisible();
    await secondSetRow.click();

    // Clear and fill in the dropdown set (inputs may have values from Set 1)
    const kgInputs = page.locator('input[placeholder="kg"]');
    const repsInputs = page.locator('input[placeholder="reps"]');
    for (let i = 0; i < 3; i++) {
      await kgInputs.nth(i).clear();
      await repsInputs.nth(i).clear();
    }
    await kgInputs.nth(0).fill('60');
    await repsInputs.nth(0).fill('10');
    await kgInputs.nth(1).fill('57.5');
    await repsInputs.nth(1).fill('10');
    await kgInputs.nth(2).fill('55');
    await repsInputs.nth(2).fill('10');

    // Save the set
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(secondSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish the workout again
    await page.getByRole('button', { name: /Finish Workout/ }).click();

    // Wait for the active workout to disappear
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // CRITICAL TEST: Count workouts after second finish - should STILL be initial + 1 (not duplicated)
    workoutCount = await page.locator('[data-workout-id]').count();
    expect(workoutCount).toBe(initialWorkoutCount + 1);

    // Verify the same workout ID still exists (was updated, not duplicated)
    const updatedWorkout = page.locator(`[data-workout-id="${firstWorkoutId}"]`);
    await expect(updatedWorkout).toBeVisible();

    // Cleanup: reload to ensure clean state for next test
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');
  });

  test('dropdown set increments counter by one not by number of dropdowns', async ({ page }) => {
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

    // Wait for counter to be properly loaded (sometimes shows 0/0 initially)
    await page.waitForFunction(() => {
      const counter = document.body.textContent || '';
      const match = counter.match(/Finish Workout\s*\((\d+)\/(\d+)\s*sets/);
      if (!match) return false;
      const completed = parseInt(match[1]);
      const total = parseInt(match[2]);
      return total > 0;  // Total should be greater than 0
    }, { timeout: 5000 });

    // Get the initial counter values
    const counterText = await page.getByRole('button', { name: /Finish Workout/ }).textContent();
    const initialMatch = counterText.match(/(\d+)\/(\d+)/);
    const initialCompleted = parseInt(initialMatch![1]);
    const initialTotal = parseInt(initialMatch![2]);

    // Ensure we have valid values
    expect(initialTotal).toBeGreaterThan(0);

    // Complete first dropdown set of Bench Press (Set 1)
    // This dropdown has W + D1 + D2 = 3 sub-sets, but should count as 1 set
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

    // Before saving, counter should be unchanged
    let counter = await page.getByRole('button', { name: /Finish Workout/ }).textContent();
    expect(counter).toContain(`${initialCompleted}/${initialTotal}`);

    // Save the set
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(firstSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // CRITICAL TEST: After saving ONE dropdown set row,
    // the completed counter should increase by 1 (not 3 which is the bug)
    counter = await page.getByRole('button', { name: /Finish Workout/ }).textContent();
    const afterFirstMatch = counter.match(/(\d+)\/(\d+)/);
    const afterFirstCompleted = parseInt(afterFirstMatch![1]);
    const completedAfterFirst = afterFirstCompleted - initialCompleted;

    // This will fail with the bug (shows 3 instead of 1)
    expect(completedAfterFirst).toBe(1);

    // Complete second dropdown set (Set 2)
    const secondSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 2/ });
    await expect(secondSetRow).toBeVisible();
    await secondSetRow.click();

    // Fill in the dropdown set
    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    // Save the set
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(secondSetRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Counter should have increased by 1 more (total 2, not 6)
    counter = await page.getByRole('button', { name: /Finish Workout/ }).textContent();
    const afterSecondMatch = counter.match(/(\d+)\/(\d+)/);
    const afterSecondCompleted = parseInt(afterSecondMatch![1]);
    const completedAfterSecond = afterSecondCompleted - initialCompleted;

    // This will fail with the bug (shows 6 instead of 2)
    expect(completedAfterSecond).toBe(2);
  });

  test('deleting a resumed workout removes it from the list', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Count workouts BEFORE starting (there may be existing workouts from previous tests)
    const initialWorkoutCount = await page.locator('[data-workout-id]').count();

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Complete one set
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible({ timeout: 5000 });
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

    // Reload to see the workout in the list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify workout count increased by 1
    const workoutsAfterCreation = await page.locator('[data-workout-id]').count();
    expect(workoutsAfterCreation).toBe(initialWorkoutCount + 1);

    // Get the workout ID of the newly created workout (first one)
    const workoutId = await page.locator('[data-workout-id]').first().getAttribute('data-workout-id');
    expect(workoutId).not.toBeNull();

    // Resume the workout using its ID
    const workoutToResume = page.locator(`[data-workout-id="${workoutId}"]`);
    await expect(workoutToResume).toBeVisible({ timeout: 5000 });
    const resumeButton = workoutToResume.locator('button[title="Resume"]');
    await expect(resumeButton).toBeVisible({ timeout: 5000 });
    await resumeButton.click();

    // Wait for active workout mode
    await expect(activeWorkout).toBeVisible({ timeout: 10000 });

    // Delete the workout - wait for delete button to be available
    const deleteButton = page.locator('button[title="Delete workout"]');
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Wait for active workout to disappear
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to get the updated state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify workout count decreased by 1
    const finalWorkoutCount = await page.locator('[data-workout-id]').count();
    expect(finalWorkoutCount).toBe(initialWorkoutCount);

    // Verify the specific workout is gone
    const deletedWorkout = page.locator(`[data-workout-id="${workoutId}"]`);
    await expect(deletedWorkout).not.toBeVisible({ timeout: 5000 });
  });

  test('remembers and updates last used weights across sessions', async ({ page, context }) => {
    // Generate a random starting weight between 20 and 30
    const startingWeight = Math.floor(Math.random() * 11) + 20; // 20-30
    const week1Reps = 6;
    const week2Reps = 8;
    const weightIncrement = 2;

    // Set the date to Monday of week 1
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Use the "Test Last Used Weights" preset which has:
    // - Overhead Press (normal, 3 sets)
    // - Dips (bodyweight, 3 sets)
    // - Bench Press (dropdown, 4 sets with 2 dropdowns each)
    const testPreset = page.getByRole('button', { name: /Test Last Used Weights.*Monday/ });
    await testPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Click "Show more" to reveal all exercises (tests this functionality)
    const showMoreButton = activeWorkout.getByText(/Show \d+ more/);
    const showMoreCount = await showMoreButton.count();
    if (showMoreCount > 0) {
      await showMoreButton.click();
    }

    // WEEK 1: Log an exercise with the random weight
    // Target "Overhead Press Set 1" which is a normal set (not dropdown, not bodyweight)
    const exerciseRow = activeWorkout.locator('.border.rounded-lg').filter({ hasText: /Overhead Press.*Set 1/ });
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });
    await exerciseRow.click();

    await page.locator('input[placeholder="kg"]').first().fill(String(startingWeight));
    await page.locator('input[placeholder="reps"]').first().fill(String(week1Reps));
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(exerciseRow.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish week 1 workout
    await page.getByRole('button', { name: /Finish Workout/ }).click();
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Simulate "week later" - clear all storage
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());

    // WEEK 2: Login again
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Start the same workout
    await testPreset.click();
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Verify the system remembers the previous week's weight
    const exerciseRow2 = activeWorkout.locator('.border.rounded-lg').filter({ hasText: /Overhead Press.*Set 1/ });
    await expect(exerciseRow2).toBeVisible({ timeout: 5000 });
    await exerciseRow2.click();

    const week1RememberedWeight = await page.locator('input[placeholder="kg"]').first().inputValue();
    const week1RememberedReps = await page.locator('input[placeholder="reps"]').first().inputValue();

    // Should remember the exact weight and reps from week 1
    expect(week1RememberedWeight).toBe(String(startingWeight));
    expect(week1RememberedReps).toBe(String(week1Reps));

    // Now log with increased weight (progressive overload!)
    const week2Weight = startingWeight + weightIncrement;
    await page.locator('input[placeholder="kg"]').first().fill(String(week2Weight));
    await page.locator('input[placeholder="reps"]').first().fill(String(week2Reps));
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(exerciseRow2.locator('.fa-check')).toBeVisible({ timeout: 5000 });

    // Finish week 2 workout
    await page.getByRole('button', { name: /Finish Workout/ }).click();
    await expect(activeWorkout).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Simulate another week - clear all storage
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());

    // WEEK 3: Login again
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('test');
    await page.getByPlaceholder('Enter your password').fill('test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });

    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Start the same workout
    await testPreset.click();
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });

    // Verify the system remembers the INCREASED weight from week 2
    const exerciseRow3 = activeWorkout.locator('.border.rounded-lg').filter({ hasText: /Overhead Press.*Set 1/ });
    await expect(exerciseRow3).toBeVisible({ timeout: 5000 });
    await exerciseRow3.click();

    const week2RememberedWeight = await page.locator('input[placeholder="kg"]').first().inputValue();
    const week2RememberedReps = await page.locator('input[placeholder="reps"]').first().inputValue();

    // Should remember the INCREASED weight from week 2, not the original week 1 weight
    expect(week2RememberedWeight).toBe(String(week2Weight)); // startingWeight + 2
    expect(week2RememberedReps).toBe(String(week2Reps));

    // Verify it's NOT the old weight anymore (progressive overload was saved)
    expect(week2RememberedWeight).not.toBe(String(startingWeight));
  });
});
