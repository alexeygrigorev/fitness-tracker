import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PASSWORD = 'ai-assisted-meal-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
};

type Session = {
  token: string;
  user: TestUser;
};

type Headers = Record<string, string>;

type BackendMeal = {
  id: number;
  name: string;
  source: 'manual' | 'ai_assisted';
  food_items: Array<{ foodId: number; grams: number }>;
  totalCalories: number;
  totalProtein: number;
};

type BackendFood = {
  id: number;
  name: string;
  source: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function createSession(request: APIRequestContext): Promise<Session> {
  const username = `ai-meal-owner-${uniqueSuffix()}`;
  const registration = await request.post(`${API_BASE}/api/auth/register/`, {
    data: {
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      password_confirm: PASSWORD,
    },
  });
  expect(registration.status()).toBe(201);

  const login = await request.post(`${API_BASE}/api/auth/login/`, {
    form: { username, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const loggedIn = (await login.json()) as {
    access: string;
    user: TestUser;
  };

  return { token: loggedIn.access, user: loggedIn.user };
}

async function authenticatePage(page: Page, session: Session): Promise<void> {
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(user));
  }, session);
}

async function listRecords<T>(
  request: APIRequestContext,
  path: string,
  headers: Headers,
): Promise<T[]> {
  const response = await request.get(`${API_BASE}${path}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()) as T[];
}

test('AI quick add creates a persistent ai-assisted meal', async ({ page, request }) => {
  test.setTimeout(90_000);

  const session = await createSession(request);
  const headers = { Authorization: `Bearer ${session.token}` };
  const description = 'grilled chicken salad for lunch';

  await authenticatePage(page, session);
  await page.goto('/nutrition');
  await expect(page.getByRole('heading', { name: 'Nutrition Tracking' })).toBeVisible();

  await page.getByRole('button', { name: '+ Log Meal' }).click();
  await page.getByRole('button', { name: 'AI Quick Add' }).click();
  await page
    .getByPlaceholder(/chicken breast with rice/)
    .fill(description);
  await page.getByRole('button', { name: 'Analyze & Fill' }).click();

  await expect(page.getByLabel('Meal Type')).toHaveValue('lunch');
  await expect(page.getByLabel('Meal Name *')).toHaveValue(
    description.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  );
  await expect(page.getByText('Selected Food Items')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Portions for Protein Source' })).toHaveValue('1.50');
  await expect(page.getByRole('textbox', { name: 'Portions for Vegetable' })).toHaveValue('1.00');

  const mealName = `AI Salad ${uniqueSuffix()}`;
  await page.getByLabel('Meal Name *').fill(mealName);
  await page.getByRole('button', { name: 'Log Meal', exact: true }).click();

  const mealCard = page.locator('div.rounded-lg.shadow').filter({
    has: page.getByText(mealName, { exact: true }),
  });
  await expect(mealCard).toHaveCount(1);
  await expect(mealCard.getByText('Protein Source (150g)')).toBeVisible();
  await expect(mealCard.getByText('Vegetable (100g)')).toBeVisible();

  await page.reload();
  await expect(
    page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(mealName, { exact: true }),
    }),
  ).toHaveCount(1);

  const meals = await listRecords<BackendMeal>(request, '/api/food/meals/', headers);
  const persistedMeal = meals.find((meal) => meal.name === mealName);
  expect(persistedMeal).toBeDefined();
  expect(persistedMeal?.source).toBe('ai_assisted');
  expect(persistedMeal?.totalCalories).toBe(297.5);
  expect(persistedMeal?.totalProtein).toBe(48.5);
  expect(
    persistedMeal?.food_items.map(({ foodId, grams }) => ({ foodId, grams })),
  ).toEqual([
    { foodId: expect.any(Number), grams: 150 },
    { foodId: expect.any(Number), grams: 100 },
  ]);

  const foods = await listRecords<BackendFood>(request, '/api/food/foods/', headers);
  expect(foods.find((food) => food.name === 'Protein Source')).toMatchObject({
    source: 'user',
  });
  expect(foods.find((food) => food.name === 'Vegetable')).toMatchObject({
    source: 'user',
  });

  const [createdMeals, createdTemplates, createdFoods] = await Promise.all([
    listRecords<{ id: number }>(request, '/api/food/meals/', headers),
    listRecords<{ id: number }>(request, '/api/food/templates/', headers),
    listRecords<{ id: number; source?: string }>(
      request,
      '/api/food/foods/',
      headers,
    ),
  ]);

  for (const meal of [...createdMeals].reverse()) {
    await request.delete(`${API_BASE}/api/food/meals/${meal.id}/`, { headers });
  }
  for (const template of [...createdTemplates].reverse()) {
    await request.delete(`${API_BASE}/api/food/templates/${template.id}/`, {
      headers,
    });
  }
  for (const food of [...createdFoods].reverse()) {
    if (food.source === 'canonical') continue;
    await request.delete(`${API_BASE}/api/food/foods/${food.id}/`, { headers });
  }
});
