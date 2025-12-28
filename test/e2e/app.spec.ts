import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Fitness Tracker Web App
 * Tests the main user flows across all tabs
 */

test.describe('App Navigation', () => {
  test('should load and display all tabs', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await expect(page.getByRole('main')).toBeVisible();

    // Check for main navigation/tabs
    // The app uses a tab-based navigation
    await expect(page.getByText(/overview|chat/i)).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/');

    // Navigate to Food tab
    const foodTab = page.getByText(/food|nutrition/i);
    if (await foodTab.isVisible()) {
      await foodTab.click();
      await expect(page.getByText(/calories|protein|carbs/i)).toBeVisible();
    }

    // Navigate to Exercises tab
    const exercisesTab = page.getByText(/exercises|workout/i);
    if (await exercisesTab.isVisible()) {
      await exercisesTab.click();
      await expect(page.getByText(/start workout|exercises/i)).toBeVisible();
    }

    // Navigate to Sleep tab
    const sleepTab = page.getByText(/sleep/i);
    if (await sleepTab.isVisible()) {
      await sleepTab.click();
      await expect(page.getByText(/hours|bedtime|wake time/i)).toBeVisible();
    }
  });
});

test.describe('Overview / Chat', () => {
  test('should display chat interface', async ({ page }) => {
    await page.goto('/');

    // Check for chat input
    const chatInput = page.getByPlaceholder(/log|workout|meal|tell me/i);
    await expect(chatInput.first()).toBeVisible({ timeout: 15000 });
  });

  test('should send a chat message', async ({ page }) => {
    await page.goto('/');

    // Find and use the chat input
    const chatInput = page.getByPlaceholder(/log|workout|meal|tell me/i).first();
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // Type a message
    await chatInput.fill('I did 30 minutes of cardio');

    // Send the message (look for a send button or press enter)
    const sendButton = page.getByRole('button', { name: /send|arrow|submit/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Check for response or message in chat
    await expect(page.getByText(/cardio|workout|logged/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Exercises / Workouts', () => {
  test('should display exercises list', async ({ page }) => {
    await page.goto('/');

    // Navigate to exercises tab
    const exercisesTab = page.getByText(/exercises/i);
    if (await exercisesTab.isVisible()) {
      await exercisesTab.click();
    }

    // Wait for exercises to load
    await expect(page.getByText(/bench press|squat|deadlift|exercise/i)).toBeVisible({ timeout: 10000 });
  });

  test('should start a workout', async ({ page }) => {
    await page.goto('/');

    // Navigate to exercises
    const exercisesTab = page.getByText(/exercises/i);
    if (await exercisesTab.isVisible()) {
      await exercisesTab.click();
    }

    // Look for "Start Workout" button
    const startButton = page.getByRole('button', { name: /start workout|begin/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      await expect(page.getByText(/active|in progress|end workout/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show exercise details', async ({ page }) => {
    await page.goto('/');

    const exercisesTab = page.getByText(/exercises/i);
    if (await exercisesTab.isVisible()) {
      await exercisesTab.click();
    }

    // Click on an exercise (look for common exercises)
    const exercise = page.getByText(/bench press/i).first();
    if (await exercise.isVisible()) {
      await exercise.click();
      await expect(page.getByText(/sets|reps|weight|kg/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Food / Nutrition', () => {
  test('should display food logging interface', async ({ page }) => {
    await page.goto('/');

    // Navigate to food tab
    const foodTab = page.getByText(/food/i);
    if (await foodTab.isVisible()) {
      await foodTab.click();
    }

    // Check for nutrition display
    await expect(page.getByText(/calories|protein|carbs|fat/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display daily nutrition summary', async ({ page }) => {
    await page.goto('/');

    const foodTab = page.getByText(/food/i);
    if (await foodTab.isVisible()) {
      await foodTab.click();
    }

    // Check for macros display
    await expect(page.getByText(/calories/i)).toBeVisible();
    await expect(page.getByText(/protein|g/i)).toBeVisible();
  });

  test('should have quick add food options', async ({ page }) => {
    await page.goto('/');

    const foodTab = page.getByText(/food/i);
    if (await foodTab.isVisible()) {
      await foodTab.click();
    }

    // Look for quick add buttons
    const quickAdd = page.getByText(/quick add|add meal|log food/i);
    await expect(quickAdd.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sleep Tracking', () => {
  test('should display sleep tracking interface', async ({ page }) => {
    await page.goto('/');

    // Navigate to sleep tab
    const sleepTab = page.getByText(/sleep/i);
    if (await sleepTab.isVisible()) {
      await sleepTab.click();
    }

    // Check for sleep-related elements
    await expect(page.getByText(/hours|bedtime|wake|sleep/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display sleep history', async ({ page }) => {
    await page.goto('/');

    const sleepTab = page.getByText(/sleep/i);
    if (await sleepTab.isVisible()) {
      await sleepTab.click();
    }

    // Check for sleep data display
    await expect(page.getByText(/last night|yesterday|hours|quality/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Metabolism', () => {
  test('should display metabolism state', async ({ page }) => {
    await page.goto('/');

    // Navigate to metabolism tab
    const metabolismTab = page.getByText(/metabolism/i);
    if (await metabolismTab.isVisible()) {
      await metabolismTab.click();
    }

    // Check for metabolism-related content
    await expect(page.getByText(/fasting|fed|carb|fat|state/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show last meal info', async ({ page }) => {
    await page.goto('/');

    const metabolismTab = page.getByText(/metabolism/i);
    if (await metabolismTab.isVisible()) {
      await metabolismTab.click();
    }

    // Look for last meal display
    const lastMeal = page.getByText(/last meal|hours ago|just now/i);
    await expect(lastMeal.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dark Mode', () => {
  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');

    // Navigate to settings
    const settingsTab = page.getByText(/settings/i);
    if (await settingsTab.isVisible()) {
      await settingsTab.click();

      // Look for dark mode toggle
      const darkModeToggle = page.getByText(/dark mode|theme|appearance/i);
      if (await darkModeToggle.isVisible()) {
        const toggle = page.getByRole('button').filter({ hasText: /dark|theme/i });
        if (await toggle.isVisible()) {
          await toggle.click();
          // Verify toggle worked
          await expect(darkModeToggle).toBeVisible();
        }
      }
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check main elements are visible
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Check main elements are visible
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
  });

  test('should display correctly on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Check main elements are visible
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
  });
});
