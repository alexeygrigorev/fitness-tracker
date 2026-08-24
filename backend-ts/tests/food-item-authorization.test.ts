import assert from 'node:assert/strict';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { after, before, describe, it } from 'node:test';
import {
  registerAndLogin,
  startTestApi,
  type TestApi,
} from './helpers.js';

let api!: TestApi;

describe('FoodItemAuthorizationTests', () => {
  let accessToken: string;
  let otherToken: string;

  before(async () => {
    api = await startTestApi();
    const owner = await registerAndLogin(api, 'food-owner');
    const other = await registerAndLogin(api, 'other-food-user');
    accessToken = owner.accessToken;
    otherToken = other.accessToken;

    const food = {
      pk: 'FOOD#4001',
      sk: 'METADATA',
      id: 4001,
      user_id: owner.userId,
      name: 'Owner Food',
      brand: null,
      barcode: null,
      source: 'user',
      serving_size: 100,
      serving_unit: 'g',
      calories: 100,
      protein: 0,
      carbs: 0,
      fat: 0,
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
    };
    await Promise.all([
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: food,
      })),
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: {
          pk: `USER#${owner.userId}`,
          sk: 'FOOD#4001',
          id: 4001,
        },
      })),
    ]);
  });

  it('test_anonymous_users_can_read_but_not_write', async () => {
    const response = await api.call('PATCH', '/api/food/foods/4001/', {
      body: { calories: 999 },
    });

    assert.equal(response.status, 401);
    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'FOOD#4001', sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.calories, 100);
  });

  it('test_owner_cannot_promote_private_food_to_canonical', async () => {
    const response = await api.call('PATCH', '/api/food/foods/4001/', {
      body: { source: 'canonical' },
      token: accessToken,
    });

    assert.equal(response.status, 200);
    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'FOOD#4001', sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.source, 'user');

    const hidden = await api.call('GET', '/api/food/foods/4001/', {
      token: otherToken,
    });
    assert.equal(hidden.status, 404);
  });

  after(() => {
    api?.stop();
  });
});
