import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:18000';
const PASSWORD = 'nutrition-lifecycle-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
};

type Session = {
  token: string;
  user: TestUser;
};

type SeededFood = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
};

type NestedFoodItem = {
  foodId: number;
  grams: number;
};

type BackendMeal = {
  id: number | string;
  name: string;
  mealType: string;
  food_items: NestedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

type Headers = Record<string, string>;

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function authHeaders(token: string): Headers {
  return { Authorization: `Bearer ${token}` };
}

async function createSession(
  request: APIRequestContext,
  prefix: string,
): Promise<Session> {
  const username = `${prefix}-${uniqueSuffix()}`;
  const registerResponse = await request.post(`${API_BASE}/api/auth/register/`, {
    data: {
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      password_confirm: PASSWORD,
    },
  });
  expect(registerResponse.status()).toBe(201);

  const loginResponse = await request.post(`${API_BASE}/api/auth/login/`, {
    form: { username, password: PASSWORD },
  });
  expect(loginResponse.status()).toBe(200);
  const loggedIn = (await loginResponse.json()) as {
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

async function seedFood(
  request: APIRequestContext,
  headers: Headers,
  name: string,
): Promise<SeededFood> {
  const response = await request.post(`${API_BASE}/api/food/foods/`, {
    headers,
    data: {
      name,
      category: 'protein',
      servingSize: 100,
      servingType: 'g',
      calories: 400,
      protein: 40,
      carbs: 40,
      fat: 10,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as SeededFood;
}

async function listOwnedRecords<T extends { id: number | string }>(
  request: APIRequestContext,
  path: string,
  headers: Headers,
): Promise<T[]> {
  const response = await request.get(`${API_BASE}${path}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()) as T[];
}

async function cleanupNutritionData(
  request: APIRequestContext,
  headers: Headers,
): Promise<void> {
  const meals = await listOwnedRecords<{ id: number }>(
    request,
    '/api/food/meals/',
    headers,
  );
  const templates = await listOwnedRecords<{ id: number }>(
    request,
    '/api/food/templates/',
    headers,
  );
  const foods = await listOwnedRecords<{ id: number; source?: string }>(
    request,
    '/api/food/foods/',
    headers,
  );

  for (const meal of [...meals].reverse()) {
    await request.delete(`${API_BASE}/api/food/meals/${meal.id}/`, { headers });
  }
  for (const template of [...templates].reverse()) {
    await request.delete(`${API_BASE}/api/food/templates/${template.id}/`, {
      headers,
    });
  }
  for (const food of [...foods].reverse()) {
    if (food.source === 'canonical') continue;
    await request.delete(`${API_BASE}/api/food/foods/${food.id}/`, { headers });
  }
}

test('nutrition meals and templates persist nested foods through edit and reload', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const stamp = uniqueSuffix();
  let ownerHeaders: Headers | undefined;
  const initialFoodName = `Lifecycle Chicken ${stamp}`;
  const initialTemplateName = `Lifecycle Template ${stamp}`;
  const editedTemplateName = `Persisted Lunch ${stamp}`;
  const editedMealName = `Persisted Meal ${stamp}`;

  try {
    const session = await createSession(request, 'nutrition-owner');
    ownerHeaders = authHeaders(session.token);
    const food = await seedFood(request, ownerHeaders, initialFoodName);
    await authenticatePage(page, session);

    await page.goto('/nutrition/templates');
    await expect(page.getByRole('heading', { name: 'Nutrition Tracking' })).toBeVisible();

    await page.getByRole('button', { name: '+ Create Template' }).click();
    await page.getByLabel('Template Name *').fill(initialTemplateName);
    await page.getByLabel('Category').selectOption('dinner');
    await page.getByLabel('Add Food').fill(initialFoodName);
    await page.getByRole('button', { name: new RegExp(initialFoodName) }).click();
    await expect(page.getByText('Selected Food Items')).toBeVisible();
    await expect(page.getByRole('textbox', { name: `Portions for ${initialFoodName}` })).toHaveValue('1.00');
    await page.getByRole('button', { name: 'Create Template', exact: true }).click();

    const templateCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(initialTemplateName, { exact: true }),
    });
    await expect(templateCard).toHaveCount(1);
    await expect(templateCard.getByText(`${initialFoodName} (100g)`)).toBeVisible();

    await page.reload();
    const persistedTemplateCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(initialTemplateName, { exact: true }),
    });
    await expect(persistedTemplateCard).toHaveCount(1);
    await expect(persistedTemplateCard.getByText(`${initialFoodName} (100g)`)).toBeVisible();

    await persistedTemplateCard.getByTitle('Edit template').click();
    await expect(page.getByLabel('Template Name *')).toHaveValue(initialTemplateName);
    await page.getByLabel('Template Name *').fill(editedTemplateName);
    await page.getByLabel('Category').selectOption('lunch');
    await page.getByRole('textbox', { name: `Portions for ${initialFoodName}` }).fill('2');
    await page.getByRole('button', { name: 'Update Template', exact: true }).click();

    const editedTemplateCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(editedTemplateName, { exact: true }),
    });
    await expect(editedTemplateCard).toHaveCount(1);
    await expect(editedTemplateCard.getByText(`${initialFoodName} (200g)`)).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(editedTemplateName, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(`${initialFoodName} (200g)`)).toBeVisible();

    await page.getByRole('button', { name: 'Meals' }).click();
    await page.getByRole('button', { name: '+ Log Meal' }).click();
    await page.getByRole('button', { name: new RegExp(editedTemplateName) }).click();
    await expect(page.getByLabel('Meal Name *')).toHaveValue(editedTemplateName);
    await expect(page.getByLabel('Meal Type')).toHaveValue('lunch');
    await expect(page.getByRole('textbox', { name: `Portions for ${initialFoodName}` })).toHaveValue('2.00');

    await page.getByLabel('Meal Name *').fill(editedMealName);
    await page.getByLabel('Notes (optional)').fill('Created from the persisted template');
    await page.getByRole('button', { name: 'Log Meal', exact: true }).click();

    const mealCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(editedMealName, { exact: true }),
    });
    await expect(mealCard).toHaveCount(1);
    await expect(mealCard.getByText(`${initialFoodName} (200g)`)).toBeVisible();
    await expect(mealCard.getByText('800 kcal')).toBeVisible();
    await expect(mealCard.getByText('80g', { exact: true }).first()).toBeVisible();

    await page.reload();
    const persistedMealCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(editedMealName, { exact: true }),
    });
    await expect(persistedMealCard).toHaveCount(1);
    await expect(persistedMealCard.getByText(`${initialFoodName} (200g)`)).toBeVisible();

    await persistedMealCard.getByTitle('Edit meal').click();
    await expect(page.getByLabel('Meal Name *')).toHaveValue(editedMealName);
    await page.getByLabel('Meal Name *').fill(`${editedMealName} larger`);
    await page.getByRole('textbox', { name: `Portions for ${initialFoodName}` }).fill('3');
    await page.getByRole('button', { name: 'Update Meal', exact: true }).click();

    const updatedMealCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(`${editedMealName} larger`, { exact: true }),
    });
    await expect(updatedMealCard).toHaveCount(1);
    await expect(updatedMealCard.getByText(`${initialFoodName} (300g)`)).toBeVisible();
    await expect(updatedMealCard.getByText('1200 kcal')).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(`${editedMealName} larger`, { exact: true }),
    ).toBeVisible();

    const mealsResponse = await request.get(`${API_BASE}/api/food/meals/`, {
      headers: ownerHeaders,
    });
    expect(mealsResponse.status()).toBe(200);
    const meals = (await mealsResponse.json()) as BackendMeal[];
    const persistedMeal = meals.find((meal) => meal.name === `${editedMealName} larger`);
    expect(persistedMeal).toBeDefined();
    expect(
      persistedMeal?.food_items.map(({ foodId, grams }) => ({ foodId, grams })),
    ).toEqual([
      { foodId: food.id, grams: 300 },
    ]);
    expect(persistedMeal?.totalCalories).toBe(1200);

    const templatesResponse = await request.get(`${API_BASE}/api/food/templates/`, {
      headers: ownerHeaders,
    });
    expect(templatesResponse.status()).toBe(200);
    const templates = (await templatesResponse.json()) as Array<{
      name: string;
      food_items: NestedFoodItem[];
    }>;
    const persistedTemplate = templates.find(
      (template) => template.name === editedTemplateName,
    );
    expect(
      persistedTemplate?.food_items.map(({ foodId, grams }) => ({ foodId, grams })),
    ).toEqual([
      { foodId: food.id, grams: 200 },
    ]);

    const rider = await createSession(request, 'nutrition-rider');
    const riderHeaders = authHeaders(rider.token);
    const forbiddenStatuses = [403, 404];

    const riderRead = await request.get(
      `${API_BASE}/api/food/foods/${food.id}/`,
      { headers: riderHeaders },
    );
    expect(forbiddenStatuses).toContain(riderRead.status());

    const riderUpdate = await request.patch(
      `${API_BASE}/api/food/foods/${food.id}/`,
      {
        headers: riderHeaders,
        data: { name: 'Unauthorized rename' },
      },
    );
    expect(forbiddenStatuses).toContain(riderUpdate.status());

    const riderNestedMeal = await request.post(`${API_BASE}/api/food/meals/`, {
      headers: riderHeaders,
      data: {
        name: 'Unauthorized nested meal',
        mealType: 'snack',
        food_items: [{ foodId: food.id, grams: 100 }],
      },
    });
    expect(riderNestedMeal.status()).toBe(400);

    const riderCalculation = await request.post(
      `${API_BASE}/api/food/calculations/calculate-nutrition/`,
      {
        headers: riderHeaders,
        data: { food_items: [{ food_id: food.id, grams: 100 }] },
      },
    );
    expect(riderCalculation.status()).toBe(200);
    expect(await riderCalculation.json()).toMatchObject({
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
    });

    await updatedMealCard.getByTitle('Delete meal').click();
    await expect(page.getByText(/^No meals logged for today$/)).toBeVisible();

    await page.getByRole('button', { name: 'Templates' }).click();
    await editedTemplateCard.getByTitle('Delete template').click();
    await expect(
      page.getByText(
        'No meal templates yet. Create your first template for quick meal logging.',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Items' }).click();
    const ownedFoodCard = page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(initialFoodName, { exact: true }),
    });
    await expect(ownedFoodCard).toHaveCount(1);
    await ownedFoodCard.getByTitle('Delete food').click();
    await expect(page.locator('div.rounded-lg.shadow').filter({
      has: page.getByText(initialFoodName, { exact: true }),
    })).toHaveCount(0);

    const foodsAfterDelete = await listOwnedRecords<{ name: string }>(
      request,
      '/api/food/foods/',
      ownerHeaders,
    );
    expect(
      foodsAfterDelete.some((candidate) => candidate.name === initialFoodName),
    ).toBe(false);
  } finally {
    if (ownerHeaders) {
      await cleanupNutritionData(request, ownerHeaders);
    }
  }
});
