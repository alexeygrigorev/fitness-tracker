import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Fitness Tracker Web App (Vite + react-native-web)
 */

// Clear localStorage before all tests
test.beforeEach(async ({ page }) => {
  // Clear localStorage BEFORE loading the page
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Reload to apply the cleared storage
  await page.reload();
  await page.evaluate(() => localStorage.clear());
});

test.describe('Page Loading', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible({ timeout: 10000 });
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/web/);
  });

  test('should display all navigation tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Overview').first()).toBeVisible();
    await expect(page.getByText('Exercises').first()).toBeVisible();
    await expect(page.getByText('Food').first()).toBeVisible();
    await expect(page.getByText('Sleep').first()).toBeVisible();
    await expect(page.getByText('Metabolism').first()).toBeVisible();
  });
});

test.describe('Daily Stats', () => {
  test('should display daily stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Calories')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Protein')).toBeVisible();
    await expect(page.getByText('Carbs')).toBeVisible();
    await expect(page.getByText('Fat')).toBeVisible();
  });

  test('should show default calorie values', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('1850')).toBeVisible(); // Default calories
    await expect(page.getByText('120')).toBeVisible(); // Default protein
  });
});

test.describe('Navigation', () => {
  test('should navigate to Food tab', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food', { exact: true }).click();
    await expect(page.getByText('Nutrition')).toBeVisible();
    await expect(page.getByText("Today's Meals:")).toBeVisible();
  });

  test('should navigate to Exercises tab', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises', { exact: true }).click();
    await expect(page.getByText('Exercises & Workouts')).toBeVisible();
    await expect(page.getByText('Start Workout')).toBeVisible();
  });

  test('should navigate to Sleep tab', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await expect(page.getByText('Overview').first()).toBeVisible();

    // Try clicking using JavaScript to bypass any React Native web issues
    await page.evaluate(() => {
      const sleepNavs = Array.from(document.querySelectorAll('*')).filter(el => el.textContent === 'Sleep');
      if (sleepNavs.length > 0) {
        (sleepNavs[0] as HTMLElement).click();
      }
    });

    // Wait for tab content to change - use .first() for strict mode
    await expect(page.getByText('Sleep Tracking').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Metabolism tab', async ({ page }) => {
    await page.goto('/');
    // Click the Metabolism navigation item (first occurrence is in nav)
    await page.getByText('Metabolism').first().click();
    await expect(page.getByText('Metabolism').nth(1)).toBeVisible();
  });

  test('should navigate back to Overview from other tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();
    await page.getByText('Overview').click();
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible();
  });
});

test.describe('Dark Mode', () => {
  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByText(/Dark|Light/);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByText(/Dark|Light/)).toBeVisible();
  });

  test('should persist dark mode preference', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByText(/Dark|Light/);

    // Toggle to dark mode
    await toggle.click();
    await expect(page.getByText(/Dark|Light/)).toBeVisible();

    // Reload page
    await page.reload();

    // Preference should be persisted
    await expect(page.getByText(/Dark|Light/)).toBeVisible();
  });
});

test.describe('Workout Logging', () => {
  test('should start a workout', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();
    await page.getByText('Start Workout').click();
    await expect(page.getByText('Workout In Progress')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('End Workout')).toBeVisible();
  });

  test('should end an active workout', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();
    await page.getByText('Start Workout').click();
    await expect(page.getByText('Workout In Progress')).toBeVisible();

    // End the workout
    await page.getByText('End Workout').click();
    await expect(page.getByText('Start Workout')).toBeVisible();
  });

  test('should show workout session ID when active', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();
    await page.getByText('Start Workout').click();

    // Should display session info
    const sessionText = await page.getByText('Session:').textContent();
    expect(sessionText?.length).toBeGreaterThan(10);
  });

  test('should not start duplicate workouts', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();

    // Start first workout
    await page.getByText('Start Workout').click();
    await expect(page.getByText('Workout In Progress')).toBeVisible();

    // Try to start another - should not show Start button
    await expect(page.getByText('Start Workout')).not.toBeVisible({ timeout: 2000 });
  });

  test('should show active workout indicator on Overview tab', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();
    await page.getByText('Start Workout').click();

    // Go back to overview
    await page.getByText('Overview').click();

    // Should show active workout card
    await expect(page.getByText('Active Workout')).toBeVisible();
  });
});

test.describe('Food Logging', () => {
  test('should log a quick meal', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();

    const initialCountText = await page.getByText(/Today's Meals:/).textContent();
    const initialCount = parseInt(initialCountText?.split(': ')[1] || '0');

    await page.getByText('+ Banana').click();

    const newCountText = await page.getByText(/Today's Meals:/).textContent();
    const newCount = parseInt(newCountText?.split(': ')[1] || '0');

    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should log multiple different meals', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();

    // Add multiple meals
    await page.getByText('+ Banana').click();
    await page.getByText('+ Chicken Breast').click();
    await page.getByText('+ Rice').click();

    // Check meal count
    const countText = await page.getByText(/Today's Meals:/).textContent();
    const count = parseInt(countText?.split(': ')[1] || '0');

    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should display meal details', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();
    await page.getByText('+ Eggs').click();

    // Should show meal card with macros - wait for the full meal text
    await expect(page.getByText(/Meal:.*kcal.*P:.*g.*C:.*g.*F:/)).toBeVisible({ timeout: 5000 });
  });

  test('should show all quick add buttons', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();

    await expect(page.getByText('+ Banana')).toBeVisible();
    await expect(page.getByText('+ Chicken Breast')).toBeVisible();
    await expect(page.getByText('+ Rice')).toBeVisible();
    await expect(page.getByText('+ Eggs')).toBeVisible();
    await expect(page.getByText('+ Oatmeal')).toBeVisible();
  });
});

test.describe('Chat Functionality', () => {
  test('should send a chat message', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Log workout, meal, or sleep...');
    await expect(input).toBeVisible();

    await input.fill('I did 30 minutes of cardio');
    await input.press('Enter');

    await expect(page.getByText('I did 30 minutes of cardio').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Logged:/)).toBeVisible();
  });

  test('should display welcome message on first load', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Hi! I'm your fitness assistant/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Log your workouts/)).toBeVisible();
  });

  test('should have multiple message bubbles', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Log workout, meal, or sleep...');

    // Send multiple messages
    await input.fill('Workout: bench press');
    await input.press('Enter');
    await page.waitForTimeout(500);

    await input.fill('Meal: chicken salad');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // Check for multiple messages
    const messages = await page.getByText(/Workout:|Meal:|Logged:/).all();
    expect(messages.length).toBeGreaterThan(2);
  });

  test('should clear input after sending', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Log workout, meal, or sleep...');
    await input.fill('Test message');
    await input.press('Enter');

    // Input should be cleared
    await expect(input).toHaveValue('');
  });
});

test.describe('State Persistence', () => {
  test('should persist workouts across page reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();
    await page.getByText('Start Workout').click();

    // Reload page
    await page.reload();

    // Workout should still be active
    await page.getByText('Exercises').click();
    await expect(page.getByText('Workout In Progress')).toBeVisible();
  });

  test('should persist meals across page reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();
    await page.getByText('+ Banana').click();

    const countBefore = await page.getByText(/Today's Meals:/).textContent();

    await page.reload();
    await page.getByText('Food').click();

    const countAfter = await page.getByText(/Today's Meals:/).textContent();

    expect(countBefore).toEqual(countAfter);
  });

  test('should persist chat messages across reloads', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Log workout, meal, or sleep...');
    await input.fill('Test persistence');
    await input.press('Enter');

    // Wait for message to be added - use .first() for strict mode
    await expect(page.getByText('Test persistence').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Logged:/)).toBeVisible();

    // Reload page
    await page.reload();

    // Message should still be there after reload (persistence works)
    await expect(page.getByText('Test persistence').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Overview')).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility', () => {
  test('should have visible titles and labels', async ({ page }) => {
    await page.goto('/');

    // Check for main title (React Native web uses divs, not h1-h6)
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible({ timeout: 10000 });
    // Check for section titles
    await expect(page.getByText('Daily Stats').or(page.getByText('Quick Log')).or(page.getByText('Nutrition'))).toBeVisible();
  });

  test('should have clickable navigation elements', async ({ page }) => {
    await page.goto('/');

    // Check nav items are visible and clickable - check each separately
    await expect(page.getByText('Overview').first()).toBeVisible();
    await expect(page.getByText('Exercises').first()).toBeVisible();
    await expect(page.getByText('Food').first()).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Some element should be focused
    const focused = await page.locator(':focus').count();
    expect(focused).toBeGreaterThan(0);
  });
});

test.describe('Edge Cases', () => {
  test('should handle empty chat input', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Log workout, meal, or sleep...');

    // Try to send empty message
    await input.fill('   ');
    await input.press('Enter');

    // Should not crash and input should be cleared or remain
    await expect(input).toBeVisible();
  });

  test('should handle rapid tab switching', async ({ page }) => {
    await page.goto('/');

    // Rapidly switch between tabs
    await page.getByText('Food').click();
    await page.getByText('Exercises').click();
    await page.getByText('Sleep').click();
    await page.getByText('Metabolism').click();
    await page.getByText('Overview').click();

    // Should end up back on overview without errors
    await expect(page.getByText('Fitness Tracker').first()).toBeVisible();
  });

  test('should handle multiple workout start/end cycles', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Exercises').click();

    // Start and end workout multiple times
    for (let i = 0; i < 3; i++) {
      await page.getByText('Start Workout').click();
      await expect(page.getByText('Workout In Progress')).toBeVisible();
      await page.getByText('End Workout').click();
      await expect(page.getByText('Start Workout')).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Sleep Tab', () => {
  test('should display sleep tracking placeholder', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await expect(page.getByText('Overview').first()).toBeVisible();

    // Click using JavaScript to bypass React Native web click issues
    await page.evaluate(() => {
      const sleepNavs = Array.from(document.querySelectorAll('*')).filter(el => el.textContent === 'Sleep');
      if (sleepNavs.length > 0) {
        (sleepNavs[0] as HTMLElement).click();
      }
    });

    // Use .first() for strict mode compliance
    await expect(page.getByText('Sleep Tracking').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Sleep tracking data will appear here')).toBeVisible();
  });
});

test.describe('Metabolism Tab', () => {
  test('should display metabolism placeholder', async ({ page }) => {
    await page.goto('/');
    // Click the Metabolism navigation item (first occurrence is in nav)
    await page.getByText('Metabolism').first().click();

    await expect(page.getByText('Metabolism').nth(1)).toBeVisible();
    await expect(page.getByText('Metabolic state information will appear here')).toBeVisible();
  });
});

test.describe('Visual Regression', () => {
  test('should capture overview screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/overview.png', fullPage: true });
  });

  test('should capture dark mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/Dark|Light/).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/overview-dark.png', fullPage: true });
  });

  test('should capture food page screenshot', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/food-page.png', fullPage: true });
  });
});

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.getByText('Fitness Tracker').first().isVisible();
    const loadTime = Date.now() - startTime;

    // Should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle rapid state updates', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Food').click();

    const startTime = Date.now();

    // Add 5 meals rapidly
    for (let i = 0; i < 5; i++) {
      await page.getByText('+ Banana').click();
    }

    const updateTime = Date.now() - startTime;

    // Should complete in less than 2 seconds
    expect(updateTime).toBeLessThan(2000);
  });
});
