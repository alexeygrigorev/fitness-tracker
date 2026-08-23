import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('new user can register and access exercises', async ({ page }) => {
    // Generate unique credentials for this test run
    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;
    const password = 'e2e-registration-pass-123';

    // Navigate to registration page
    await page.goto('/register');

    // Verify we're on the registration page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('Create your account')).toBeVisible();

    // Fill in the registration form
    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);

    // Wait a moment for form to stabilize
    await page.waitForTimeout(200);

    // Submit the form and wait for navigation
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Wait for navigation away from register page
    await page.waitForURL(/^(?!.*\/register).*$/, { timeout: 15000 });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we're logged in - check for the Workouts link (it's an <a> not a <button>)
    await expect(page.getByRole('link', { name: /workouts/i })).toBeVisible({ timeout: 5000 });

    // Navigate to exercises library
    await page.goto('/workouts/library');
    await page.waitForLoadState('networkidle');

    // Verify exercises page is accessible
    await expect(page).toHaveURL(/\/workouts\/library/);
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    // Verify the page has loaded - check for either exercises or "no exercises" message
    const pageContent = await page.textContent('body');
    // The exercises library page should be loaded (either shows exercises or a filter)
    expect(pageContent).toMatch(/exercises|muscle|filter|all/i);
  });

  test('registration with password mismatch shows error', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;

    await page.goto('/register');

    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password123');
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
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByPlaceholder('Confirm your password').fill('short');

    const button = page.getByRole('button', { name: 'Sign up' });

    // HTML5 validation prevents form submission with invalid input
    // Click should not submit the form (URL stays on /register)
    await button.click();
    await expect(page).toHaveURL(/\/register/);
  });
});
