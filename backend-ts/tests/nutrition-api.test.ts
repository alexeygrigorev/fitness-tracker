import assert from 'node:assert/strict';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { after, before, describe, it } from 'node:test';
import type { FoodItemRecord } from '../src/types.js';
import {
  registerAndLogin,
  startTestApi,
  type TestApi,
} from './helpers.js';

process.env.TIME_ZONE = 'America/New_York';

let api!: TestApi;

describe('NutritionApiTests', () => {
  let ownerToken: string;
  let otherToken: string;
  let ownerId: number;
  let otherId: number;
let nextFoodId = 6000;
  let nextNestedId = 9000;

function foodKey(userId: number): string {
  return `USER#${userId}`;
}

  interface FoodOverrides extends Partial<Omit<
    FoodItemRecord,
    'pk' | 'sk' | 'id' | 'name'
  >> {}

  async function makeFood(
    name = 'Chicken',
    overrides: FoodOverrides = {},
  ): Promise<FoodItemRecord> {
    const id = ++nextFoodId;
    const food: FoodItemRecord = {
      pk: foodKey(ownerId),
      sk: `FOOD#${id}`,
      entity_type: 'food_item',
      id,
      user_id: ownerId,
      name,
      brand: null,
      barcode: null,
      source: 'user',
      serving_size: 100,
      serving_unit: 'g',
      calories: 300,
      protein: 20,
      carbs: 50,
      fat: 10,
      saturated_fat: null,
      fiber: 8,
      sugar: 12,
      sodium: 240,
      glycemic_index: null,
      absorption_speed: null,
      insulin_response: null,
      satiety_score: null,
      protein_quality: null,
      category: null,
      ...overrides,
    };
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: food,
    }));
    return food;
  }

  async function seedMeal(
    id: number,
    userId: number,
    name: string,
    date: string,
    items: Array<{ food_id: number; grams: number }>,
  ): Promise<void> {
    const foodItems = items.map((item, index) => ({
      pk: `MEAL#${id}`,
      sk: `MEAL_FOOD_ITEM#${++nextNestedId}`,
      entity_type: 'meal_food_item' as const,
      id: nextNestedId,
      meal_id: id,
      food_id: item.food_id,
      grams: item.grams,
      order: index,
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `USER#${userId}`,
        sk: `MEAL#${id}`,
        entity_type: 'meal' as const,
        id,
        user_id: userId,
        name,
        meal_type: 'lunch',
        date,
        logged_at: new Date().toISOString(),
        event_time: null,
        notes: null,
        source: 'manual' as const,
        food_item_ids: foodItems.map((item) => item.id),
      },
    }));
    for (const item of foodItems) {
      await api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: item,
      }));
    }
  }

  async function seedTemplate(
    id: number,
    userId: number,
    name: string,
    category: string,
    items: Array<{ food_id: number; grams: number }> = [],
  ): Promise<void> {
    const now = new Date().toISOString();
    const foodItems = items.map((item, index) => ({
      pk: `MEAL_TEMPLATE#${id}`,
      sk: `TEMPLATE_FOOD_ITEM#${++nextNestedId}`,
      entity_type: 'meal_template_food_item' as const,
      id: nextNestedId,
      template_id: id,
      food_id: item.food_id,
      grams: item.grams,
      order: index,
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `USER#${userId}`,
        sk: `MEAL_TEMPLATE#${id}`,
        entity_type: 'meal_template' as const,
        id,
        user_id: userId,
        name,
        category,
        notes: null,
        created_at: now,
        updated_at: now,
        food_item_ids: foodItems.map((item) => item.id),
      },
    }));
    for (const item of foodItems) {
      await api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: item,
      }));
    }
  }

  function mealPayload(foodId: number, overrides: Record<string, unknown> = {}) {
    return {
      name: 'Lunch',
      mealType: 'lunch',
      date: '2026-08-22',
      eventTime: '12:30',
      notes: 'Home cooked',
      source: 'manual',
      food_items: [{ foodId, grams: 150 }],
      ...overrides,
    };
  }

  function assertDailyTotals(data: Record<string, unknown>): void {
    assert.equal(data.calories, 300);
    assert.equal(data.protein_g, 20);
    assert.equal(data.carbs_g, 50);
    assert.equal(data.fat_g, 10);
    assert.equal(data.fiber_g, 8);
    assert.equal(data.sugar_g, 12);
    assert.equal(data.sodium_mg, 240);
  }

  function assertCalculatedTotals(data: Record<string, unknown>): void {
    assert.equal(data.total_calories, 300);
    assert.equal(data.total_protein_g, 20);
    assert.equal(data.total_carbs_g, 50);
    assert.equal(data.total_fat_g, 10);
    assert.equal(data.total_fiber_g, 8);
    assert.equal(data.total_sugar_g, 12);
    assert.equal(data.total_sodium_mg, 240);
  }

  before(async () => {
    api = await startTestApi({ exerciseIds: [] });
    const owner = await registerAndLogin(api, 'nutrition-owner');
    const other = await registerAndLogin(api, 'nutrition-other');
    ownerToken = owner.accessToken;
    otherToken = other.accessToken;
    ownerId = owner.userId;
    otherId = other.userId;
  });

  it('test_calculate_nutrition_only_uses_accessible_valid_foods', async () => {
    const accessible = await makeFood('Accessible Food', {
      user_id: ownerId,
      source: 'user',
    });
    const foreign = await makeFood('Foreign Food', {
      user_id: otherId,
      source: 'user',
      calories: 999,
      protein: 99,
      carbs: 99,
      fat: 99,
    });
    const invalidServing = await makeFood('Invalid Serving', {
      user_id: ownerId,
      source: 'user',
      serving_size: 0,
      calories: 999,
    });

    const response = await api.call(
      'POST',
      '/api/food/calculations/calculate-nutrition/',
      {
        body: {
          food_items: [
            { food_id: accessible.id, grams: 100 },
            { food_id: foreign.id, grams: 100 },
            { food_id: invalidServing.id, grams: 100 },
            { food_id: invalidServing.id + 1000, grams: 100 },
          ],
        },
        token: ownerToken,
      },
    );

    assert.equal(response.status, 200);
    assertCalculatedTotals(response.body);
  });

  it('test_calculate_nutrition_requires_authentication', async () => {
    const response = await api.call(
      'POST',
      '/api/food/calculations/calculate-nutrition/',
      { body: { food_items: [] } },
    );

    assert.equal(response.status, 401);
  });

  it('test_calculation_endpoints_return_expected_values', async () => {
    const caloriesResponse = await api.call(
      'POST',
      '/api/food/calculations/calculate-calories/',
      { body: { protein_g: 10, carbs_g: 20, fat_g: 5 } },
    );
    const categoryResponse = await api.call(
      'POST',
      '/api/food/calculations/detect-category/',
      { body: { protein_g: 10, carbs_g: 10, fat_g: 10 } },
    );
    const metabolismResponse = await api.call(
      'POST',
      '/api/food/calculations/infer-metabolism/',
      {
        body: {
          protein_g: 30,
          carbs_g: 40,
          fat_g: 10,
          fiber_g: 6,
        },
      },
    );

    assert.equal(caloriesResponse.status, 200);
    assert.equal(caloriesResponse.body.calories, 165);
    assert.equal(categoryResponse.body.category, 'balanced');
    assert.deepEqual(metabolismResponse.body, {
      glycemic_index: 'low',
      absorption_speed: 'slow',
      thermic_effect: 'high',
      satiety_level: 'very_high',
    });
  });

  it('test_create_meal_persists_nested_items_and_derived_date', async () => {
    const food = await makeFood();
    const response = await api.call('POST', '/api/food/meals/', {
      body: mealPayload(food.id, {
        date: undefined,
        loggedAt: '2026-08-22T22:30:00-04:00',
      }),
      token: ownerToken,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.date, '2026-08-22');
    assert.equal(response.body.food_items.length, 1);

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: `MEAL#${response.body.id}` },
    }));
    assert.equal(stored.Item?.user_id, ownerId);
    assert.equal(stored.Item?.date, '2026-08-22');
    assert.deepEqual(stored.Item?.food_item_ids, [
      Number(response.body.food_items[0].id),
    ]);

    const ingredient = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: {
        pk: `MEAL#${response.body.id}`,
        sk: `MEAL_FOOD_ITEM#${response.body.food_items[0].id}`,
      },
    }));
    assert.equal(ingredient.Item?.entity_type, 'meal_food_item');
    assert.equal(ingredient.Item?.food_id, food.id);
    assert.equal(ingredient.Item?.grams, 150);
    assert.equal(ingredient.Item?.order, 0);
  });

  it('test_create_template_persists_nested_items', async () => {
    const food = await makeFood();
    const response = await api.call('POST', '/api/food/templates/', {
      body: {
        name: 'Protein Oats',
        category: 'breakfast',
        notes: 'Morning staple',
        food_items: [{ foodId: food.id, grams: 80 }],
      },
      token: ownerToken,
    });

    assert.equal(response.status, 201);
    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: `MEAL_TEMPLATE#${response.body.id}` },
    }));
    assert.equal(stored.Item?.user_id, ownerId);
    assert.equal(stored.Item?.notes, 'Morning staple');
    assert.deepEqual(stored.Item?.food_item_ids, [
      Number(response.body.food_items[0].id),
    ]);

    const ingredient = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: {
        pk: `MEAL_TEMPLATE#${response.body.id}`,
        sk: `TEMPLATE_FOOD_ITEM#${response.body.food_items[0].id}`,
      },
    }));
    assert.equal(ingredient.Item?.entity_type, 'meal_template_food_item');
    assert.equal(ingredient.Item?.food_id, food.id);
    assert.equal(ingredient.Item?.grams, 80);
    assert.equal(ingredient.Item?.order, 0);
  });

  it('test_food_catalog_ownership_and_crud', async () => {
    const canonicalSeed: FoodItemRecord = {
      pk: 'CANONICAL_FOODS',
      sk: 'FOOD#6901',
      id: 6901,
      user_id: null,
      name: 'Canonical Rice',
      brand: null,
      barcode: null,
      source: 'canonical',
      serving_size: 100,
      serving_unit: 'g',
      calories: 300,
      protein: 20,
      carbs: 50,
      fat: 10,
      saturated_fat: null,
      fiber: 8,
      sugar: 12,
      sodium: 240,
      glycemic_index: null,
      absorption_speed: null,
      insulin_response: null,
      satiety_score: null,
      protein_quality: null,
      category: null,
    };
    const privateSeed: FoodItemRecord = {
      ...canonicalSeed,
      id: 6902,
      pk: `USER#${ownerId}`,
      sk: 'FOOD#6902',
      name: 'Owner Secret',
      user_id: ownerId,
      source: 'user',
    };
    await Promise.all([
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: canonicalSeed,
      })),
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: privateSeed,
      })),
    ]);

    const canonical = canonicalSeed;
    const listed = await api.call('GET', '/api/food/foods/', {
      token: otherToken,
    });
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.map((food: { name: string }) => food.name),
      ['Canonical Rice'],
    );

    const hidden = await api.call(
      'GET',
      '/api/food/foods/6902/',
      { token: otherToken },
    );
    assert.equal(hidden.status, 404);

    const created = await api.call('POST', '/api/food/foods/', {
      body: {
        name: 'Bob Yogurt',
        brand: 'Dairy Co',
        category: 'protein',
        servingSize: 150,
        servingType: 'g',
        calories: 180,
        protein: 24,
        carbs: 8,
        fat: 4,
      },
      token: otherToken,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.user, otherId);
    assert.equal(created.body.source, 'user');

    const forbidden = await api.call(
      'PUT',
      `/api/food/foods/${canonical.id}/`,
      {
        body: {
          name: 'Vandalized',
          servingSize: 1,
          servingType: 'g',
          calories: 1,
        },
        token: otherToken,
      },
    );
    assert.equal(forbidden.status, 403);

    const updated = await api.call(
      'PATCH',
      `/api/food/foods/${created.body.id}/`,
      { body: { protein: 26 }, token: otherToken },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.protein, 26);

    const deleted = await api.call(
      'DELETE',
      `/api/food/foods/${created.body.id}/`,
      { token: otherToken },
    );
    assert.equal(deleted.status, 204);
    const removed = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${otherId}`, sk: `FOOD#${created.body.id}` },
    }));
    assert.equal(removed.Item, undefined);
  });

  it('test_meal_date_filtering_and_daily_totals_are_isolated', async () => {
    const ownerFood = await makeFood('Owner Chicken', {
      user_id: ownerId,
      source: 'user',
    });
    const otherFood = await makeFood('Other Food', {
      user_id: otherId,
      source: 'user',
    });
    const badServing = await makeFood('Bad Serving', {
      serving_size: 0,
    });
    await seedMeal(7100, ownerId, 'Owner Lunch', '2031-08-22', [
      { food_id: ownerFood.id, grams: 100 },
      { food_id: badServing.id, grams: 100 },
    ]);
    await seedMeal(7101, otherId, 'Other Lunch', '2031-08-22', [
      { food_id: otherFood.id, grams: 500 },
    ]);

    const byDate = await api.call(
      'GET',
      '/api/food/meals/date/2031-08-22/',
      { token: ownerToken },
    );
    assert.equal(byDate.status, 200);
    assert.deepEqual(
      byDate.body.map((meal: { name: string }) => meal.name),
      ['Owner Lunch'],
    );

    const totals = await api.call(
      'GET',
      '/api/food/meals/daily/totals/2031-08-22/',
      { token: ownerToken },
    );
    assert.equal(totals.status, 200);
    assertDailyTotals(totals.body);

    const empty = await api.call(
      'GET',
      '/api/food/meals/daily/totals/2031-08-23/',
      { token: ownerToken },
    );
    assert.equal(empty.body.calories, 0);

    const invalid = await api.call(
      'GET',
      '/api/food/meals/daily/totals/not-a-date/',
      { token: ownerToken },
    );
    assert.equal(invalid.status, 400);

    await Promise.all([
      api.call('DELETE', '/api/food/meals/7100/', { token: ownerToken }),
      api.call('DELETE', '/api/food/meals/7101/', { token: otherToken }),
    ]);
  });

  it('test_meal_partial_update_replaces_items_only_when_provided', async () => {
    const food = await makeFood('Original Meal Food', {
      user_id: ownerId,
      source: 'user',
    });
    const replacement = await makeFood('Salmon', {
      user_id: ownerId,
      source: 'user',
    });
    await seedMeal(7200, ownerId, 'Original', '2026-08-22', [
      { food_id: food.id, grams: 100 },
    ]);

    const scalarUpdate = await api.call('PATCH', '/api/food/meals/7200/', {
      body: { name: 'Renamed' },
      token: ownerToken,
    });
    assert.equal(scalarUpdate.status, 200);
    assert.equal(scalarUpdate.body.name, 'Renamed');
    assert.equal(scalarUpdate.body.food_items.length, 1);

    const nestedUpdate = await api.call('PATCH', '/api/food/meals/7200/', {
      body: { food_items: [] },
      token: ownerToken,
    });
    assert.equal(nestedUpdate.status, 200);
    assert.deepEqual(nestedUpdate.body.food_items, []);

    const addItem = await api.call('PATCH', '/api/food/meals/7200/', {
      body: {
        food_items: [{ foodId: replacement.id, grams: 200 }],
      },
      token: ownerToken,
    });
    assert.equal(addItem.status, 200);
    assert.deepEqual(
      {
        totalCalories: addItem.body.totalCalories,
        totalProtein: addItem.body.totalProtein,
      },
      { totalCalories: 600, totalProtein: 40 },
    );
  });

  it('test_meals_and_templates_are_owner_scoped', async () => {
    await makeFood();
    await seedMeal(7300, ownerId, 'Private Meal', '2026-08-22', []);
    await seedTemplate(7301, ownerId, 'Private Template', 'snack');

    const meals = await api.call('GET', '/api/food/meals/', {
      token: otherToken,
    });
    assert.deepEqual(meals.body, []);
    const templates = await api.call('GET', '/api/food/templates/', {
      token: otherToken,
    });
    assert.deepEqual(templates.body, []);

    for (const path of ['/api/food/meals/7300/', '/api/food/templates/7301/']) {
      const retrieved = await api.call('GET', path, { token: otherToken });
      assert.equal(retrieved.status, 404);
      const updated = await api.call('PATCH', path, {
        body: { name: 'Stolen' },
        token: otherToken,
      });
      assert.equal(updated.status, 404);
      const deleted = await api.call('DELETE', path, { token: otherToken });
      assert.equal(deleted.status, 404);
    }
  });

  it('test_nested_writes_reject_inaccessible_private_food_atomically', async () => {
    const privateFood = await makeFood('Private Atomic Food', {
      user_id: ownerId,
      source: 'user',
    });
    const mealResponse = await api.call('POST', '/api/food/meals/', {
      body: mealPayload(privateFood.id),
      token: otherToken,
    });
    const templateResponse = await api.call('POST', '/api/food/templates/', {
      body: {
        name: 'Unauthorized Template',
        category: 'snack',
        food_items: [{ foodId: privateFood.id, grams: 100 }],
      },
      token: otherToken,
    });

    assert.equal(mealResponse.status, 400);
    assert.equal(templateResponse.status, 400);
    const meals = await api.call('GET', '/api/food/meals/', {
      token: otherToken,
    });
    const templates = await api.call('GET', '/api/food/templates/', {
      token: otherToken,
    });
    assert.deepEqual(meals.body, []);
    assert.deepEqual(templates.body, []);
  });

  it('test_template_scalar_update_preserves_nested_items', async () => {
    const food = await makeFood('Template Food', {
      user_id: ownerId,
      source: 'user',
    });
    await seedTemplate(7400, ownerId, 'Original Template', 'lunch', [
      { food_id: food.id, grams: 120 },
    ]);

    const response = await api.call('PATCH', '/api/food/templates/7400/', {
      body: { name: 'Updated Template' },
      token: ownerToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Updated Template');
    assert.equal(response.body.food_items[0].foodId, food.id);
    assert.equal(response.body.food_items[0].grams, 120);

    const updatedTemplate = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: 'MEAL_TEMPLATE#7400' },
    }));
    assert.equal(updatedTemplate.Item?.name, 'Updated Template');
    assert.deepEqual(updatedTemplate.Item?.food_item_ids, [
      Number(response.body.food_items[0].id),
    ]);
  });

  it('test_nested_collections_exceed_the_dynamodb_transaction_limit', async () => {
    const food = await makeFood('Bulk Meal Food', {
      user_id: ownerId,
      source: 'user',
    });
    const created = await api.call('POST', '/api/food/meals/', {
      body: {
        name: 'Large Lunch',
        mealType: 'lunch',
        date: '2026-08-24',
        food_items: Array.from({ length: 101 }, () => ({
          foodId: food.id,
          grams: 10,
        })),
      },
      token: ownerToken,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.food_items.length, 101);
    let storedMeal = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: `MEAL#${created.body.id}` },
    }));
    assert.equal(storedMeal.Item?.food_item_ids.length, 101);
    const initialIngredients = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :parent',
      ExpressionAttributeValues: {
        ':parent': `MEAL#${created.body.id}`,
      },
    }));
    assert.equal(initialIngredients.Items?.length, 101);

    const updated = await api.call('PATCH', `/api/food/meals/${created.body.id}/`, {
      body: {
        name: 'Larger Lunch',
        food_items: Array.from({ length: 120 }, (_, index) => ({
          foodId: food.id,
          grams: index === 119 ? 20 : 10,
        })),
      },
      token: ownerToken,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.food_items.length, 120);
    storedMeal = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: `MEAL#${created.body.id}` },
    }));
    assert.equal(storedMeal.Item?.food_item_ids.length, 120);
    const replacedIngredients = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :parent',
      ExpressionAttributeValues: {
        ':parent': `MEAL#${created.body.id}`,
      },
    }));
    assert.equal(replacedIngredients.Items?.length, 120);
    assert.equal(updated.body.food_items[119].grams, 20);

    const deleted = await api.call('DELETE', `/api/food/meals/${created.body.id}/`, {
      token: ownerToken,
    });
    assert.equal(deleted.status, 204);
    const removedMeal = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `USER#${ownerId}`, sk: `MEAL#${created.body.id}` },
    }));
    const remainingIngredients = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :parent',
      ExpressionAttributeValues: {
        ':parent': `MEAL#${created.body.id}`,
      },
    }));
    assert.equal(removedMeal.Item, undefined);
    assert.equal(remainingIngredients.Items?.length, 0);
  });

  after(() => {
    api?.stop();
    delete process.env.TIME_ZONE;
  });
});
