import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.describe('Network Failure', () => {
  test('login reports a dropped connection and recovers when retried', async ({
    page,
    request,
  }) => {
    const apiOrigin = (process.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const username = `network-recovery-${suffix}`;
    const password = `Recovery-${randomUUID()}!a`;

    const registration = await request.post(`${apiOrigin}/api/auth/register/`, {
      data: {
        username,
        email: `${username}@example.com`,
        password,
        password_confirm: password,
      },
    });
    expect(registration.status()).toBe(201);

    let attempts = 0;
    // The browser calls the frontend origin; Vite proxies that request to
    // the configured backend. Match any host so both direct and proxied
    // development setups are covered.
    await page.route('**/api/auth/login/', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      attempts += 1;
      if (attempts === 1) {
        await route.abort('connectionrefused');
        return;
      }

      await route.fallback();
    });

    await page.goto('/login');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);

    const signInButton = page.getByRole('button', { name: 'Sign in' });
    const errorAlert = page.getByRole('alert');
    await signInButton.click();

    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).not.toBeEmpty();
    await expect(page).toHaveURL(/\/login/);
    await expect(signInButton).toBeEnabled();
    await expect.poll(async () =>
      page.evaluate(() => localStorage.getItem('token')),
    ).toBeNull();

    await signInButton.click();

    await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/);
    await expect.poll(async () =>
      page.evaluate(() => localStorage.getItem('token')),
    ).not.toBeNull();
    expect(attempts).toBe(2);
  });
});
