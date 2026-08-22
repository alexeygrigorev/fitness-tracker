import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PASSWORD = 'e2e-health-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
};

type Session = {
  token: string;
  user: TestUser;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSession(
  request: APIRequestContext,
  label: string,
): Promise<Session> {
  const suffix = uniqueSuffix();
  const username = `${label}-${suffix}`;
  const email = `${username}@example.com`;

  const registerResponse = await request.post(`${API_BASE}/api/auth/register/`, {
    data: {
      username,
      email,
      password: PASSWORD,
      password_confirm: PASSWORD,
    },
  });
  expect(registerResponse.status()).toBe(201);

  const registered = (await registerResponse.json()) as { user: TestUser };
  const loginResponse = await request.post(`${API_BASE}/api/auth/login/`, {
    form: { username, password: PASSWORD },
  });
  expect(loginResponse.status()).toBe(200);

  const loggedIn = (await loginResponse.json()) as { access: string };
  return { token: loggedIn.access, user: registered.user };
}

async function useSession(page: Page, session: Session) {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('user', JSON.stringify(user));
    },
    session,
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Today's Summary" })).toBeVisible();
}

test.describe('Health and dashboard contracts', () => {
  test('health pages expose their intended empty and local-only states', async ({ page, request }) => {
    const session = await createSession(request, 'health-ui');
    await useSession(page, session);

    await page.goto('/weight');
    await expect(page.getByRole('heading', { name: 'Weight Tracking' })).toBeVisible();
    await page.getByRole('button', { name: 'Log Weight' }).click();
    await page.getByPlaceholder('80').fill('77.3');
    await page.getByPlaceholder('Any notes...').fill('E2E temporary entry');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const addedRow = page.getByRole('row').filter({ hasText: 'E2E temporary entry' });
    await expect(addedRow).toContainText('77.3 kg');
    await expect(page.getByText('Total Entries')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(6);

    await addedRow.getByRole('button').click();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await expect(addedRow).not.toBeVisible();

    await page.reload();
    await expect(page.getByRole('cell', { name: 'Starting weight' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(5);

    await page.goto('/sleep');
    await expect(page.getByRole('heading', { name: 'Sleep Tracking' })).toBeVisible();
    await expect(page.getByText('No data')).toBeVisible();
    await expect(page.getByText('0.0/5')).toBeVisible();
    await expect(page.getByText('over 0 nights')).toBeVisible();

    await page.goto('/metabolism');
    await expect(
      page.getByRole('heading', { name: 'Metabolism & Recovery' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Understanding Your Metabolism' }),
    ).toBeVisible();
    await expect(page.getByText('Active Advice')).toHaveCount(0);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('new-user dashboard shows stable empty aggregates', async ({ page, request }) => {
    const session = await createSession(request, 'dashboard-empty');
    await useSession(page, session);

    await expect(page.getByText('No workouts logged today')).toBeVisible();
    await expect(page.getByText('No meals logged today')).toBeVisible();
    await expect(page.getByText('No metabolism data available')).toBeVisible();

    const caloriesCard = page
      .locator('.rounded-lg.shadow')
      .filter({ hasText: 'Calories' })
      .first();
    await expect(caloriesCard).toContainText('0');
    await expect(caloriesCard).toContainText('kcal');

    await expect(page.locator('body')).not.toContainText(/NaN|undefined/);
  });

  test('food items are hidden and protected from another user', async ({ request }) => {
    const owner = await createSession(request, 'food-owner');
    const outsider = await createSession(request, 'food-outsider');
    const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
    const outsiderHeaders = { Authorization: `Bearer ${outsider.token}` };

    const createResponse = await request.post(`${API_BASE}/api/food/foods/`, {
      headers: ownerHeaders,
      data: {
        name: `Private food ${uniqueSuffix()}`,
        category: 'protein',
        servingSize: 100,
        servingType: 'g',
        calories: 111,
        protein: 22,
        carbs: 3,
        fat: 4,
      },
    });
    expect(createResponse.status()).toBe(201);
    const food = (await createResponse.json()) as { id: number; name: string };
    const foodUrl = `${API_BASE}/api/food/foods/${food.id}/`;

    for (const method of ['get', 'patch', 'delete'] as const) {
      const response = await request[method](foodUrl, {
        headers: outsiderHeaders,
        ...(method === 'patch' ? { data: { name: 'Overwritten by outsider' } } : {}),
      });
      expect(response.status()).toBe(404);
    }

    const ownerResponse = await request.get(foodUrl, { headers: ownerHeaders });
    expect(ownerResponse.status()).toBe(200);
    const unchangedFood = (await ownerResponse.json()) as {
      id: number;
      name: string;
      calories: number;
    };
    expect(unchangedFood).toMatchObject({ id: food.id, calories: 111 });
    expect(unchangedFood.name).toBe(food.name);
  });

  test('expired authentication recovers through the login redirect', async ({ page, request }) => {
    const session = await createSession(request, 'expired-token');
    await useSession(page, session);

    await page.route('**/api/auth/me/', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Token is invalid or expired' }),
      });
    });

    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem('token'))).resolves.toBeNull();
    await expect(page.evaluate(() => window.localStorage.getItem('user'))).resolves.toBeNull();
  });
});
