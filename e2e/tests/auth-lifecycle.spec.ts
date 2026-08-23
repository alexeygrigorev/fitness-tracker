import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-auth-lifecycle-pass';

async function registerFreshUser(page: Page) {
  const username = `auth-${Date.now()}-${randomUUID().slice(0, 8)}`;

  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: "Today's Summary" })).toBeVisible();
  await expect(page.locator('header').getByText(username)).toBeVisible();

  const auth = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') ?? 'null') as {
      username?: string;
    } | null,
  }));
  expect(auth.token, 'registration should store a JWT').toBeTruthy();
  expect(auth.user?.username).toBe(username);

  return { email: `${username}@example.com`, username };
}

test.describe('Authentication lifecycle', () => {
  test('registers, restores, logs out, rejects duplicates, and signs back in', async ({
    page,
  }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/register$/);
    const user = await registerFreshUser(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: "Today's Summary" })).toBeVisible();
    await expect(page.locator('header').getByText(user.username)).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.evaluate(() => [localStorage.getItem('token'), localStorage.getItem('user')]),
    ).resolves.toEqual([null, null]);

    await page.goto('/register');
    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByRole('alert')).toContainText('Username already exists');
    await expect(page).toHaveURL(/\/register$/);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Username').fill(user.username);
    await page.getByLabel('Password').fill(`${PASSWORD}-wrong`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.locator('header').getByText(user.username)).toBeVisible();
  });

  test('clears a stored session rejected by the API', async ({ page }) => {
    await registerFreshUser(page);

    await page.evaluate(() => {
      localStorage.setItem('token', 'not-a-valid-jwt');
    });
    await page.reload();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.evaluate(() => [localStorage.getItem('token'), localStorage.getItem('user')]),
    ).resolves.toEqual([null, null]);
  });
});
