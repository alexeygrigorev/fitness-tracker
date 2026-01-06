import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('new user can register and access exercises', async ({ page }) => {
    // Generate unique credentials for this test run
    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;
    const password = 'testpass123';

    // Navigate to registration page
    await page.goto('/register');

    // Verify we're on the registration page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('Create your account')).toBeVisible();

    // Fill in the registration form
    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByPlaceholder('At least 6 characters', { exact: true }).fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);

    // Submit the form and wait for navigation
    await Promise.all([
      page.waitForURL(/\/$/, { timeout: 15000 }),
      page.getByRole('button', { name: 'Sign up' }).click(),
    ]);

    // Should be on home page now
    await expect(page).toHaveURL(/\/$/);

    // Verify we're logged in - check for navigation elements
    await expect(page.getByRole('button', { name: /workouts/i })).toBeVisible();

    // Navigate to exercises library
    await page.goto('/workouts/library');
    await page.waitForLoadState('networkidle');

    // Verify exercises page is accessible
    await expect(page).toHaveURL(/\/workouts\/library/);
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    // Verify some exercises are visible (exercises should be available to all users)
    // Look for common exercises that should be in the database
    const exerciseElements = page.locator('button').filter({ hasText: /Bench Press|Squat|Deadlift/i });
    const exerciseCount = await exerciseElements.count();

    // At least one common exercise should be visible
    expect(exerciseCount).toBeGreaterThan(0);

    // Also verify the exercises page has content
    const content = page.locator('text=/exercise|muscle|group/i').first();
    await expect(content).toBeVisible();
  });

  test('registration with password mismatch shows error', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;

    await page.goto('/register');

    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByPlaceholder('At least 6 characters', { exact: true }).fill('password123');
    await page.getByPlaceholder('Confirm your password').fill('different123');

    await page.getByRole('button', { name: 'Sign up' }).click();

    // Should show error message
    await expect(page.getByText('Passwords do not match')).toBeVisible();

    // Should not navigate away
    await expect(page).toHaveURL(/\/register/);
  });

  test('registration with short password cannot be submitted due to HTML5 validation', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;

    await page.goto('/register');

    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByPlaceholder('At least 6 characters', { exact: true }).fill('short');
    await page.getByPlaceholder('Confirm your password').fill('short');

    const button = page.getByRole('button', { name: 'Sign up' });

    // HTML5 validation prevents form submission with invalid input
    // Click should not submit the form (URL stays on /register)
    await button.click();
    await expect(page).toHaveURL(/\/register/);
  });
});
