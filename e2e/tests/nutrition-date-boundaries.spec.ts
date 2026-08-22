import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:18000';
const PASSWORD = 'nutrition-boundary-pass';

type TestUser = {
  id: number;
  username: string;
  email: string;
  dark_mode?: boolean;
};

type Session = {
  token: string;
  user: TestUser;
};

type SelectedFood = {
  foodId: number;
  grams: number;
};

type MacroTotals = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

type MealReadModel = {
  foods: SelectedFood[];
} & MacroTotals;

type SeededFood = {
  id: number;
  name: string;
};

type SeededMeal = {
  id: number;
  dateKey: string;
  name: string;
  food: SeededFood;
  grams: number;
  readModel: MealReadModel;
};

type BackendMeal = Record<string, unknown> & {
  id: number | string;
  date: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function createSession(
  request: APIRequestContext,
): Promise<Session> {
  const username = `nutrition-dates-${uniqueSuffix()}`;

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

/*
 * The deployed nutrition screen still consumes the older `foods`/totals shape and
 * filters client-side by `loggedAt`. There is also no writable nested meal-item
 * endpoint. Keep this compatibility surface limited to meals seeded by this test;
 * every persisted mutation below remains a real owner-API call.
 */
async function installLegacyNutritionReadModel(
  page: Page,
  mealsByDate: Map<string, SeededMeal>,
): Promise<void> {
  await page.route(/\/api\/food\/meals\/$/, async (route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      await route.fulfill({ response });
      return;
    }

    const backendMeals = (await response.json()) as BackendMeal[];
    const frontendMeals = backendMeals.map((backendMeal) => {
      const seededMeal = mealsByDate.get(backendMeal.date);
      if (!seededMeal || seededMeal.id !== Number(backendMeal.id)) {
        return backendMeal;
      }

      return {
        ...backendMeal,
        loggedAt: `${backendMeal.date}T12:00:00`,
        foods: [{ foodId: seededMeal.food.id, grams: seededMeal.grams }],
        ...seededMeal.readModel,
      };
    });

    await route.fulfill({
      status: response.status(),
      contentType: 'application/json',
      body: JSON.stringify(frontendMeals),
    });
  });
}

async function createFood(
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
  category: 'carb' | 'protein',
  macros: { calories: number; protein: number; carbs: number; fat: number },
): Promise<SeededFood> {
  const response = await request.post(`${API_BASE}/api/food/foods/`, {
    headers,
    data: {
      name,
      category,
      servingSize: 100,
      servingType: 'g',
      ...macros,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as SeededFood;
}

async function calculateMacros(
  request: APIRequestContext,
  foodId: number,
  grams: number,
) {
  const response = await request.post(
    `${API_BASE}/api/food/calculations/calculate-nutrition/`,
    {
      data: { food_items: [{ food_id: foodId, grams }] },
    },
  );
  expect(response.status()).toBe(200);
  const totals = (await response.json()) as {
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
  };

  return {
    totalCalories: totals.total_calories,
    totalProtein: totals.total_protein_g,
    totalCarbs: totals.total_carbs_g,
    totalFat: totals.total_fat_g,
  };
}

async function createMeal(
  request: APIRequestContext,
  headers: Record<string, string>,
  input: {
    name: string;
    dateKey: string;
    food: SeededFood;
    grams: number;
    readModel: MealReadModel;
  },
): Promise<SeededMeal> {
  const response = await request.post(`${API_BASE}/api/food/meals/`, {
    headers,
    data: {
      name: input.name,
      mealType: 'lunch',
      date: input.dateKey,
      // Required by the serializer even though auto_now_add owns the stored value.
      loggedAt: new Date().toISOString(),
      eventTime: '12:00',
      source: 'manual',
    },
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()) as { id: number };

  return {
    id: created.id,
    dateKey: input.dateKey,
    name: input.name,
    food: input.food,
    grams: input.grams,
    readModel: input.readModel,
  };
}

async function expectOwnerDayContainsExactly(
  request: APIRequestContext,
  headers: Record<string, string>,
  dateKey: string,
  mealName: string,
): Promise<void> {
  const response = await request.get(
    `${API_BASE}/api/food/meals/date/${dateKey}/`,
    { headers },
  );
  expect(response.status()).toBe(200);
  const meals = (await response.json()) as Array<{ name: string }>;
  expect(meals.map((meal) => meal.name)).toEqual([mealName]);
}

async function cleanupNutritionData(
  request: APIRequestContext,
  headers: Record<string, string>,
  mealIds: number[],
  foodIds: number[],
): Promise<void> {
  for (const mealId of [...mealIds].reverse()) {
    const response = await request.delete(`${API_BASE}/api/food/meals/${mealId}/`, {
      headers,
    });
    expect([200, 202, 204, 404]).toContain(response.status());
  }

  for (const foodId of [...foodIds].reverse()) {
    const response = await request.delete(`${API_BASE}/api/food/foods/${foodId}/`, {
      headers,
    });
    expect([200, 202, 204, 404]).toContain(response.status());
  }
}

test('nutrition date boundaries isolate meals and reset to today after reload', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const session = await createSession(request);
  const ownerHeaders = { Authorization: `Bearer ${session.token}` };
  const stamp = uniqueSuffix();

  const baseDate = startOfToday();
  const yesterday = addDays(baseDate, -1);
  const tomorrow = addDays(baseDate, 1);
  const dates = {
    yesterday: isoDate(yesterday),
    today: isoDate(baseDate),
    tomorrow: isoDate(tomorrow),
  };

  const mealIds: number[] = [];
  const foodIds: number[] = [];
  const mealsByDate = new Map<string, SeededMeal>();

  try {
    const oats = await createFood(
      request,
      ownerHeaders,
      `Boundary Oats ${stamp}`,
      'carb',
      { calories: 320, protein: 24, carbs: 40, fat: 8 },
    );
    const chicken = await createFood(
      request,
      ownerHeaders,
      `Boundary Chicken ${stamp}`,
      'protein',
      { calories: 180, protein: 32, carbs: 0, fat: 6 },
    );
    const rice = await createFood(
      request,
      ownerHeaders,
      `Boundary Rice ${stamp}`,
      'carb',
      { calories: 350, protein: 8, carbs: 78, fat: 2 },
    );
    foodIds.push(oats.id, chicken.id, rice.id);

    const seeds = [
      { dateKey: dates.yesterday, date: yesterday, food: oats, grams: 150 },
      { dateKey: dates.today, date: baseDate, food: chicken, grams: 200 },
      { dateKey: dates.tomorrow, date: tomorrow, food: rice, grams: 50 },
    ];

    for (const seed of seeds) {
      const mealName = `${seed.food.name} meal`;
      const readModel = await calculateMacros(
        request,
        seed.food.id,
        seed.grams,
      );
      const meal = await createMeal(request, ownerHeaders, {
        name: mealName,
        dateKey: seed.dateKey,
        food: seed.food,
        grams: seed.grams,
        readModel,
      });
      mealIds.push(meal.id);
      mealsByDate.set(meal.dateKey, meal);

      await expectOwnerDayContainsExactly(
        request,
        ownerHeaders,
        meal.dateKey,
        mealName,
      );
    }

    await installLegacyNutritionReadModel(page, mealsByDate);
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('token', token);
        window.localStorage.setItem('user', JSON.stringify(user));
      },
      session,
    );
    await page.clock.install({ time: baseDate.getTime() });
    await page.goto('/nutrition');
    await expect(page.getByRole('heading', { name: 'Nutrition Tracking' })).toBeVisible();

    const dateNav = page.locator('div.flex.items-center.justify-center.gap-4').first();
    const selectedLabel = dateNav.locator('button').nth(1);
    const fullDateLabel = dateNav.locator('.text-xs');
    const previousButton = dateNav.locator('button').nth(0);
    const nextButton = dateNav.locator('button').nth(2);
    const totalsGrid = page.locator('div.grid.grid-cols-2.md\\:grid-cols-4');

    async function assertVisibleDay(input: {
      label: string;
      fullDate: string;
      meal: SeededMeal | null;
      otherMeals: SeededMeal[];
    }): Promise<void> {
      await expect(selectedLabel).toHaveText(input.label);
      await expect(fullDateLabel).toHaveText(input.fullDate);

      for (const otherMeal of input.otherMeals) {
        await expect(page.getByText(otherMeal.name, { exact: true })).toHaveCount(0);
      }

      if (!input.meal) {
        await expect(page.getByText(/^No meals logged for /)).toBeVisible();
        const zeroValues = ['0', '0g', '0g', '0g'];
        const labels = ['Calories', 'Protein', 'Carbs', 'Fat'];
        for (const [index, label] of labels.entries()) {
          const totalCard = totalsGrid.locator('> div').filter({
            has: page.getByText(label, { exact: true }),
          });
          await expect(totalCard).toHaveCount(1);
          await expect(totalCard.locator('.text-xl')).toHaveText(zeroValues[index]);
        }
        return;
      }

      const mealCard = page.locator('div.rounded-lg.shadow.p-4').filter({
        has: page.getByText(input.meal.name, { exact: true }),
      });
      await expect(mealCard).toHaveCount(1);
      await expect(
        mealCard.getByText(`${input.meal.food.name} (${input.meal.grams}g)`),
      ).toBeVisible();
      const mealMacros = [
        `${input.meal.readModel.totalCalories} kcal`,
        `${input.meal.readModel.totalProtein}g`,
        `${input.meal.readModel.totalCarbs}g`,
        `${input.meal.readModel.totalFat}g`,
      ];
      for (const mealMacro of mealMacros) {
        await expect(mealCard.getByText(mealMacro, { exact: true })).toBeVisible();
      }

      const expectedTotals = [
        `${input.meal.readModel.totalCalories}`,
        `${input.meal.readModel.totalProtein}g`,
        `${input.meal.readModel.totalCarbs}g`,
        `${input.meal.readModel.totalFat}g`,
      ];
      const labels = ['Calories', 'Protein', 'Carbs', 'Fat'];
      for (const [index, label] of labels.entries()) {
        const card = totalsGrid.locator('> div').filter({
          has: page.getByText(label, { exact: true }),
        });
        await expect(card).toHaveCount(1);
        await expect(card).toContainText(expectedTotals[index]);
      }
    }

    await assertVisibleDay({
      label: 'Today',
      fullDate: baseDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: mealsByDate.get(dates.today) ?? null,
      otherMeals: [
        mealsByDate.get(dates.yesterday)!,
        mealsByDate.get(dates.tomorrow)!,
      ],
    });

    await previousButton.click();
    await assertVisibleDay({
      label: 'Yesterday',
      fullDate: yesterday.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: mealsByDate.get(dates.yesterday) ?? null,
      otherMeals: [
        mealsByDate.get(dates.today)!,
        mealsByDate.get(dates.tomorrow)!,
      ],
    });

    await previousButton.click();
    const dayBefore = addDays(baseDate, -2);
    await assertVisibleDay({
      label: dayBefore.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      fullDate: dayBefore.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: null,
      otherMeals: Object.values(mealsByDate),
    });

    await nextButton.click();
    await assertVisibleDay({
      label: 'Yesterday',
      fullDate: yesterday.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: mealsByDate.get(dates.yesterday) ?? null,
      otherMeals: [
        mealsByDate.get(dates.today)!,
        mealsByDate.get(dates.tomorrow)!,
      ],
    });

    await nextButton.click();
    await assertVisibleDay({
      label: 'Today',
      fullDate: baseDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: mealsByDate.get(dates.today) ?? null,
      otherMeals: [
        mealsByDate.get(dates.yesterday)!,
        mealsByDate.get(dates.tomorrow)!,
      ],
    });
    await expect(nextButton).toBeDisabled();

    await previousButton.click();
    await assertVisibleDay({
      label: 'Yesterday',
      fullDate: yesterday.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      meal: mealsByDate.get(dates.yesterday) ?? null,
      otherMeals: [
        mealsByDate.get(dates.today)!,
        mealsByDate.get(dates.tomorrow)!,
      ],
    });

    await page.reload();
    await expect(selectedLabel).toHaveText('Today');
    await expect(fullDateLabel).toHaveText(
      baseDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    );
    await expect(page.getByText(mealsByDate.get(dates.yesterday)!.name, { exact: true })).toHaveCount(0);
    await expect(page.getByText(mealsByDate.get(dates.today)!.name, { exact: true })).toBeVisible();
    await expect(nextButton).toBeDisabled();
  } finally {
    await cleanupNutritionData(request, ownerHeaders, mealIds, foodIds);
  }
});
