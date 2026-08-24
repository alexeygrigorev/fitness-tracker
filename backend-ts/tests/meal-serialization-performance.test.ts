import assert from 'node:assert/strict';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { after, before, describe, it } from 'node:test';
import { FitnessRepository } from '../src/repository.js';
import {
  registerAndLogin,
  startTestApi,
  type TestApi,
} from './helpers.js';

let api!: TestApi;

describe('MealSerializationPerformanceTests', () => {
  let accessToken: string;

  before(async () => {
    api = await startTestApi();
    const account = await registerAndLogin(api, 'meal-user');
    accessToken = account.accessToken;

    const foodId = 4101;
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `USER#${account.userId}`,
        sk: `FOOD#${foodId}`,
        entity_type: 'food_item',
        id: foodId,
        user_id: account.userId,
        name: 'Chicken',
        brand: null,
        barcode: null,
        source: 'user',
        serving_size: 100,
        serving_unit: 'g',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        saturated_fat: null,
        fiber: 0,
        sugar: 0,
        sodium: null,
        glycemic_index: null,
        absorption_speed: null,
        insulin_response: null,
        satiety_score: null,
        protein_quality: null,
        category: null,
      },
    }));

    for (let mealIndex = 0; mealIndex < 8; mealIndex += 1) {
      const created = await api.call('POST', '/api/food/meals/', {
        body: {
          name: `Meal ${mealIndex}`,
          mealType: 'lunch',
          date: '2026-08-23',
          food_items: [{ foodId, grams: 150 }],
        },
        token: accessToken,
      });
      assert.equal(created.status, 201);
    }
  });

  it('test_meal_list_loads_and_calculates_nested_foods_in_batches', async () => {
    const originalListMeals = FitnessRepository.prototype.listMeals;
    const originalBatchGet = FitnessRepository.prototype.batchGet;
    let listCalls = 0;
    let batchCalls = 0;

    FitnessRepository.prototype.listMeals = async function listMeals(
      this: FitnessRepository,
      userId: number,
    ) {
      listCalls += 1;
      return originalListMeals.call(this, userId);
    };
    (FitnessRepository.prototype as unknown as Record<string, unknown>).batchGet =
      async function batchGet(this: FitnessRepository, ...args: unknown[]) {
        batchCalls += 1;
        return (originalBatchGet as (...batchArgs: unknown[]) => Promise<unknown>)
          .apply(this, args);
      };

    let response;
    try {
      response = await api.call('GET', '/api/food/meals/', {
        token: accessToken,
      });
    } finally {
      FitnessRepository.prototype.listMeals = originalListMeals;
      (FitnessRepository.prototype as unknown as Record<string, unknown>).batchGet =
        originalBatchGet;
    }

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 8);
    assert.equal(listCalls, 1);
    assert.equal(batchCalls, 2);
    assert.ok(listCalls + batchCalls <= 4);
    assert.equal(response.body[0].totalCalories, 247.5);
    assert.equal(response.body[0].totalProtein, 46.5);
  });

  after(() => {
    api?.stop();
  });
});
