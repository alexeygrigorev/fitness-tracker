import assert from 'node:assert/strict';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { after, before, describe, it } from 'node:test';
import type { FoodItemRecord } from '../src/types.js';
import {
  registerAndLogin,
  startTestApi,
  type TestApi,
} from './helpers.js';

let api!: TestApi;

describe('NutritionDecimalParityTests', () => {
  let accessToken: string;
  let ownerId: number;

  before(async () => {
    api = await startTestApi({ exerciseIds: [] });
    const owner = await registerAndLogin(api, 'nutrition-decimal-owner');
    accessToken = owner.accessToken;
    ownerId = owner.userId;
  });

  async function seedFood(id: number): Promise<void> {
    const food: FoodItemRecord = {
      pk: `USER#${ownerId}`,
      sk: `FOOD#${id}`,
      entity_type: 'food_item',
      id,
      user_id: ownerId,
      name: 'Precision Food',
      brand: '',
      barcode: '',
      source: 'user',
      serving_size: 100,
      serving_unit: 'g',
      calories: 5.35,
      protein: 5.35,
      carbs: 5.35,
      fat: 5.35,
      saturated_fat: null,
      fiber: 5.35,
      sugar: 5.35,
      sodium: 5.35,
      glycemic_index: null,
      absorption_speed: null,
      insulin_response: null,
      satiety_score: null,
      protein_quality: null,
      category: null,
    };
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: food,
    }));
  }

  it('test_decimal_calculations_match_django_precision_and_rounding', async () => {
    const macroResponse = await api.call(
      'POST',
      '/api/food/calculations/calculate-calories/',
      { body: { protein_g: 0.1, carbs_g: 0.2, fat_g: 0.3 } },
    );

    assert.equal(macroResponse.status, 200);
    assert.equal(macroResponse.body.calories, 3.9);

    const foodId = 7301;
    await seedFood(foodId);
    const created = await api.call('POST', '/api/food/meals/', {
      body: {
        name: 'Precision Meal',
        mealType: 'lunch',
        date: '2026-08-24',
        food_items: [{ foodId, grams: 50 }],
      },
      token: accessToken,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.totalCalories, 2.68);

    const dailyResponse = await api.call(
      'GET',
      '/api/food/meals/daily/totals/2026-08-24/',
      { token: accessToken },
    );

    assert.equal(dailyResponse.status, 200);
    assert.equal(dailyResponse.body.calories, 2.675);

    const calculatedResponse = await api.call(
      'POST',
      '/api/food/calculations/calculate-nutrition/',
      {
        body: { food_items: [{ food_id: foodId, grams: 50 }] },
        token: accessToken,
      },
    );

    assert.equal(calculatedResponse.status, 200);
    assert.equal(calculatedResponse.body.total_calories, 2.68);
  });

  after(() => {
    api?.stop();
  });
});
