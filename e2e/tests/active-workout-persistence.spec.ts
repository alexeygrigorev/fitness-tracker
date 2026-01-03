import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  // Debug: check if page loaded
  console.log('Page URL:', page.url());
  console.log('Page title:', await page.title());

  // Wait for React to mount
  const hasUsernameInput = await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 10000 })
    .then(() => true)
    .catch(async () => {
      console.error('Username input not found!');
      return false;
    });

  if (!hasUsernameInput) {
    throw new Error('Login page did not load - username input not found');
  }

  await page.getByPlaceholder('Enter your username').fill('test');
  await page.getByPlaceholder('Enter your password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

test.describe('Active Workout Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Auto-accept all confirmation dialogs
    page.on('dialog', dialog => dialog.accept());

    // Log browser console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      } else {
        console.log('Browser console:', msg.type(), msg.text());
      }
    });
  });

  test('active workout persists across page refresh', async ({ page }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');
    await page.clock.install({ time: mondayDate.getTime() });

    await login(page);
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    // Clear any existing active workout from previous tests
    const existingActiveWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    const hasExistingWorkout = await existingActiveWorkout.isVisible().catch(() => false);
    if (hasExistingWorkout) {
      // Delete the active workout if it exists
      const deleteButton = page.locator('button[title="Delete workout"]');
      await deleteButton.click();
      await page.waitForTimeout(500);
      await page.goto('/workouts');
      await page.waitForLoadState('networkidle');
    }

    // Start Push Day workout
    const pushDayPreset = page.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    // Wait for active workout mode
    const activeWorkout = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout).toBeVisible({ timeout: 5000 });
    await expect(activeWorkout).toContainText('Push Day');

    // Complete one set to ensure the workout session is created on the server
    const firstSetRow = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRow).toBeVisible();
    await firstSetRow.click();

    // Fill in and save the set
    await page.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page.locator('input[placeholder="reps"]').nth(2).fill('10');

    await page.getByRole('button', { name: 'Save' }).click();
    // Verify set is completed by checking for the Uncomplete button
    await expect(firstSetRow.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 });

    // Wait for auto-save to complete (debounce is 500ms)
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Get the workout ID to verify persistence
    const workoutIdAttr = await activeWorkout.getAttribute('data-workout-id');
    console.log('Workout ID after starting:', workoutIdAttr);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the active workout is still visible after refresh
    // The active workout should be restored from the server
    const activeWorkoutAfterRefresh = page.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkoutAfterRefresh).toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Active workout should be visible after page refresh - it should be persisted on the server');
      });

    await expect(activeWorkoutAfterRefresh).toContainText('Push Day');

    // Verify the completed set is still marked as completed
    const firstSetRowAfterRefresh = page.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await expect(firstSetRowAfterRefresh.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Completed set should still be marked as completed after refresh');
      });
  });

  test('active workout persists across different devices/sessions', async ({ browser }) => {
    // Set the date to Monday
    const mondayDate = new Date('2025-01-06T09:00:00');

    // Context 1: Start a workout on device 1
    const context1 = await browser.newContext({
      timezoneId: 'America/New_York'
    });
    const page1 = await context1.newPage();
    await page1.clock.install({ time: mondayDate.getTime() });

    // Auto-accept dialogs for page1
    page1.on('dialog', dialog => dialog.accept());

    await login(page1);
    await page1.goto('/workouts');
    await page1.waitForLoadState('networkidle');

    // Clear any existing active workout from previous tests
    const existingActiveWorkout = page1.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    const hasExistingWorkout = await existingActiveWorkout.isVisible().catch(() => false);
    if (hasExistingWorkout) {
      const deleteButton = page1.locator('button[title="Delete workout"]');
      await deleteButton.click();
      await page1.waitForTimeout(500);
      await page1.goto('/workouts');
      await page1.waitForLoadState('networkidle');
    }

    // Step 1: Start Push Day workout and complete TWO sets from different exercises
    const pushDayPreset = page1.locator('.border-2.border-green-400').filter({ hasText: /Push Day/i });
    await pushDayPreset.click();

    const activeWorkout1 = page1.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout1).toBeVisible({ timeout: 5000 });

    // Complete Bench Press Set 1
    const benchPressSet1 = page1.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ });
    await benchPressSet1.click();
    await page1.locator('input[placeholder="kg"]').nth(0).fill('60');
    await page1.locator('input[placeholder="reps"]').nth(0).fill('10');
    await page1.locator('input[placeholder="kg"]').nth(1).fill('57.5');
    await page1.locator('input[placeholder="reps"]').nth(1).fill('10');
    await page1.locator('input[placeholder="kg"]').nth(2).fill('55');
    await page1.locator('input[placeholder="reps"]').nth(2).fill('10');
    await page1.getByRole('button', { name: 'Save' }).click();
    await expect(benchPressSet1.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 });

    // Complete Incline Dumbbell Press Set 1 (different exercise)
    // First, click "Show more" to reveal other exercises
    const showMoreButton = page1.getByRole('button', { name: /Show \d+ more/ });
    if (await showMoreButton.isVisible().catch(() => false)) {
      await showMoreButton.click();
    }

    // Incline DB Press is "normal" type so sets are individual rows
    const inclineSet1 = page1.locator('.border.rounded-lg').filter({ hasText: /Incline Dumbbell Press.*Set 1/ });
    await inclineSet1.click();
    await page1.locator('input[placeholder="kg"]').nth(0).fill('20');
    await page1.locator('input[placeholder="reps"]').nth(0).fill('12');
    await page1.getByRole('button', { name: 'Save' }).click();
    await expect(inclineSet1.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 });

    // Wait for server sync
    await page1.waitForTimeout(2000);

    // Step 2: Load on another device - verify workout is active with TWO completed sets
    const context2 = await browser.newContext({
      timezoneId: 'America/New_York'
    });
    const page2 = await context2.newPage();
    await page2.clock.install({ time: mondayDate.getTime() });
    page2.on('dialog', dialog => dialog.accept());

    await login(page2);
    await page2.goto('/workouts');
    await page2.waitForLoadState('networkidle');

    const activeWorkoutContainer2 = page2.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkoutContainer2).toBeVisible({ timeout: 5000 });

    // Click "Show more" on page2 to reveal other exercises
    const showMoreButton2 = page2.getByRole('button', { name: /Show \d+ more/ });
    if (await showMoreButton2.isVisible().catch(() => false)) {
      await showMoreButton2.click();
    }

    // Verify both sets are marked as completed on page2
    const benchPressSet1_2 = page2.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ }).first();
    const inclineSet1_2 = page2.locator('.border.rounded-lg').filter({ hasText: /Incline Dumbbell Press.*Set 1/ }).first();

    // Use getByRole directly on the page to find the Uncomplete buttons
    const uncompleteButtons = page2.getByRole('button', { name: 'Uncomplete' });
    await expect(uncompleteButtons).toHaveCount(2, { timeout: 5000 });

    // Step 3: Uncomplete the Bench Press set on page2
    // Click directly on the Uncomplete button (no need to click the set first)
    const uncompleteButton = benchPressSet1_2.getByRole('button', { name: 'Uncomplete' });
    await uncompleteButton.click();

    // Verify the Uncomplete button is no longer visible after clicking
    await expect(uncompleteButton).not.toBeVisible({ timeout: 3000 });

    await page2.waitForTimeout(1000);

    // Verify Bench Press set is no longer completed, but Incline set still is
    // Check by looking for "Click to fill" text for uncompleted and Uncomplete button for completed
    await expect(benchPressSet1_2.getByText('Click to fill')).toBeVisible({ timeout: 5000 });
    await expect(inclineSet1_2.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 });

    // Wait for server sync
    await page2.waitForTimeout(2000);

    // Step 4: Refresh page1 - verify only Incline set is completed (Bench Press was uncompleted)
    await page1.reload({ waitUntil: 'networkidle' });
    await page1.waitForTimeout(1000);

    // Click "Show more" on page1 to reveal other exercises after refresh
    const showMoreButton1Refresh = page1.getByRole('button', { name: /Show \d+ more/ });
    if (await showMoreButton1Refresh.isVisible().catch(() => false)) {
      await showMoreButton1Refresh.click();
    }

    const benchPressSet1_1 = page1.locator('.border.rounded-lg').filter({ hasText: /Bench Press.*Set 1/ }).first();
    const inclineSet1_1 = page1.locator('.border.rounded-lg').filter({ hasText: /Incline Dumbbell Press.*Set 1/ }).first();

    await expect(benchPressSet1_1.getByText('Click to fill')).toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Bench Press set should NOT be completed on page1 after refresh (was uncompleted on page2)');
      });
    await expect(inclineSet1_1.getByRole('button', { name: 'Uncomplete' })).toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Incline set should still be completed on page1 after refresh');
      });

    // Step 5: Finish the workout on page1
    await page1.getByRole('button', { name: /Finish Workout/ }).click();
    await page1.waitForTimeout(2000);

    // Verify workout is no longer active on page1
    const activeWorkout1AfterFinish = page1.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout1AfterFinish).not.toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Workout should no longer be active after finishing');
      });

    // Step 6: Refresh page2 - verify workout is also finished there
    await page2.reload({ waitUntil: 'networkidle' });
    await page2.waitForTimeout(1000);

    const activeWorkout2AfterFinish = page2.locator('.bg-blue-50.dark\\:bg-blue-900\\/20.border-2.border-blue-400');
    await expect(activeWorkout2AfterFinish).not.toBeVisible({ timeout: 5000 })
      .catch(() => {
        throw new Error('Workout should also be finished on page2 after refreshing');
      });

    await context1.close();
    await context2.close();
  });
});
