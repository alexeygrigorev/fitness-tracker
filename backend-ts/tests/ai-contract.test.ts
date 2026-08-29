import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { startTestApi, type TestApi } from './helpers.js';

let api: TestApi;
let accessToken: string;
let userId: number;

function analyzedIngredient(name: string): Record<string, unknown> {
  return {
    name,
    brand: null,
    category: 'mixed',
    servingSize: 100,
    servingType: 'g',
    grams: 100,
    calories: 50,
    protein: 2,
    carbs: 10,
    fat: 0,
    saturatedFat: 0,
    sugar: 4,
    fiber: 3,
    sodium: 30,
    glycemicIndex: 35,
    absorptionSpeed: 'moderate',
    insulinResponse: 25,
    satietyScore: 5,
    proteinQuality: 1,
  };
}

async function ownedFoodCount(): Promise<number> {
  const result = await api.documentClient.send(new QueryCommand({
    TableName: api.tableName,
    KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':user': `USER#${userId}`,
      ':prefix': 'FOOD#',
    },
  }));
  return result.Items?.length ?? 0;
}

describe('AiContractTests', () => {
  before(async () => {
    api = await startTestApi();
    const registered = await api.call('POST', '/api/auth/register/', { body: {
      username: 'owner',
      email: 'owner@example.com',
      password: 'strong-password-123',
      password_confirm: 'strong-password-123',
    }});
    assert.equal(registered.status, 201);
    userId = registered.body.user.id;
    const loggedIn = await api.call('POST', '/api/auth/login/', { body: {
      username: 'owner',
      password: 'strong-password-123',
    }});
    accessToken = loggedIn.body.access;
  });

  after(async () => {
    api?.stop();
  });

  it('test_anonymous_requests_are_unauthorized', async () => {
    const endpoints = [
      '/api/ai/analyze-food/',
      '/api/ai/analyze-meal/',
      '/api/ai/meal-foods/',
      '/api/ai/analyze-exercise/',
    ];
    for (const endpoint of endpoints) {
      const response = await api.call('POST', endpoint, {
        body: { description: 'grilled chicken salad' },
      });
      assert.equal(response.status, 401);
    }
  });

  it('test_food_response_matches_response_contract', async () => {
    const response = await api.call('POST', '/api/ai/analyze-food/', {
      token: accessToken,
      body: { description: 'grilled chicken salad' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Grilled Chicken Salad');
    for (const field of [
      'brand', 'category', 'servingSize', 'servingType', 'calories', 'protein',
      'carbs', 'fat', 'saturatedFat', 'sugar', 'fiber', 'sodium',
      'glycemicIndex', 'absorptionSpeed', 'insulinResponse', 'satietyScore',
      'proteinQuality',
    ]) {
      assert.ok(field in response.body, field);
    }
  });

  it('test_meal_response_matches_nested_response_contract', async () => {
    const response = await api.call('POST', '/api/ai/analyze-meal/', {
      token: accessToken,
      body: { description: 'grilled chicken salad' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ['foods', 'mealType', 'name']);
    assert.equal(response.body.mealType, 'lunch');
    assert.equal(response.body.foods.length, 2);
    for (const food of response.body.foods) {
      assert.ok('grams' in food);
    }
  });

  it('test_exercise_response_matches_response_contract', async () => {
    const response = await api.call('POST', '/api/ai/analyze-exercise/', {
      token: accessToken,
      body: { description: 'grilled chicken salad' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), [
      'bodyweight', 'category', 'equipment', 'instructions', 'muscleGroups', 'name',
    ]);
  });

  it('test_created_food_preserves_ai_nutrition_fields', async () => {
    const payload = {
      name: 'AI Chicken',
      brand: null,
      category: 'protein',
      servingSize: 100,
      servingType: 'g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 4,
      saturatedFat: 1.25,
      sugar: 0,
      fiber: 0,
      sodium: 300.5,
      glycemicIndex: 0,
      absorptionSpeed: 'slow',
      insulinResponse: 20,
      satietyScore: 8,
      proteinQuality: 3,
      source: 'ai_generated',
    };
    const response = await api.call('POST', '/api/food/foods/', {
      token: accessToken,
      body: payload,
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.source, 'user');
    assert.equal(response.body.saturatedFat, 1.25);
    assert.equal(response.body.sodium, 300.5);
    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: {
        pk: `USER#${userId}`,
        sk: `FOOD#${response.body.id}`,
      },
    }));
    assert.equal(stored.Item?.saturated_fat, 1.25);
    assert.equal(stored.Item?.sodium, 300.5);
  });

  it('test_meal_ingredients_are_reused_and_created_atomically', async () => {
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: { pk: 'COUNTER#food', sk: 'NEXT_ID', nextId: 100 },
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: 'CANONICAL_FOODS',
        sk: 'FOOD#1',
        id: 1,
        user_id: null,
        source: 'canonical',
        name: 'protein source',
        serving_size: 100,
        serving_unit: 'g',
        calories: 100,
      },
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `USER#${userId}`,
        sk: 'FOOD#2',
        id: 2,
        user_id: userId,
        source: 'user',
        name: 'PROTEIN SOURCE',
        serving_size: 100,
        serving_unit: 'g',
        calories: 165,
      },
    }));

    const response = await api.call('POST', '/api/ai/meal-foods/', {
      token: accessToken,
      body: {
        foods: [
          analyzedIngredient('Protein Source'),
          analyzedIngredient('Roasted Vegetable'),
          analyzedIngredient('Roasted Vegetable'),
        ],
      },
    });
    assert.equal(response.status, 200);
    const [ownedDuplicate, vegetable] = response.body;
    assert.equal(ownedDuplicate.id, 2);
    assert.ok(Number.isSafeInteger(vegetable.id));
    assert.equal(response.body[2].id, vegetable.id);
    assert.equal(await ownedFoodCount(), 3);
    assert.equal(vegetable.user, userId);
    assert.equal(vegetable.source, 'user');
    assert.equal(vegetable.saturatedFat, 0);
    assert.equal(vegetable.sodium, 30);
  });

  it('test_failed_ingredient_creation_rolls_back_the_entire_batch', async () => {
    // Reserve a food ID before the request so the second transactional write
    // hits a real conditional-check failure after the first write is prepared.
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: { pk: 'COUNTER#food', sk: 'NEXT_ID', nextId: 100 },
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `USER#${userId}`,
        sk: 'FOOD#101',
        id: 101,
        name: 'Reserved Food',
      },
    }));

    const response = await api.call('POST', '/api/ai/meal-foods/', {
      token: accessToken,
      body: {
        foods: [
          analyzedIngredient('First Ingredient'),
          analyzedIngredient('Second Ingredient'),
        ],
      },
    });
    assert.equal(response.status, 500);

    assert.equal(await ownedFoodCount(), 3);
  });

  it('test_openapi_documents_authenticated_camel_case_contracts', async () => {
    const schema = (await import('../openapi.json', { with: { type: 'json' } })).default;
    const operations = [
      ['/api/ai/analyze-food/', 'ai_analyze_food', 'AiFoodAnalysis'],
      ['/api/ai/analyze-meal/', 'ai_analyze_meal', 'AiMealAnalysis'],
      ['/api/ai/analyze-exercise/', 'ai_analyze_exercise', 'AiExerciseAnalysis'],
    ] as const;
    for (const [path, operationId, responseSchema] of operations) {
      const operation = schema.paths[path].post;
      assert.equal(operation.operationId, operationId);
      assert.equal(
        operation.requestBody.content['application/json'].schema.$ref,
        '#/components/schemas/AiAnalysisRequestRequest',
      );
      assert.equal(
        operation.responses[200].content['application/json'].schema.$ref,
        `#/components/schemas/${responseSchema}`,
      );
      assert.deepEqual(operation.security, [{ jwtAuth: [] }]);
    }

    const schemas = schema.components.schemas;
    assert.deepEqual(Object.keys(schemas.AiAnalysisRequestRequest.properties), ['description']);
    assert.ok('grams' in schemas.AiMealFood.properties);
    assert.ok('grams' in schemas.AiMealIngredientRequest.properties);
    assert.deepEqual(
      Object.keys(schemas.AiMealAnalysis.properties).sort(),
      ['foods', 'mealType', 'name'],
    );
    assert.deepEqual(Object.keys(schemas.AiExerciseAnalysis.properties).sort(), [
      'bodyweight', 'category', 'equipment', 'instructions', 'muscleGroups', 'name',
    ]);
    const mealFoods = schema.paths['/api/ai/meal-foods/'].post;
    assert.equal(mealFoods.operationId, 'ai_resolve_meal_foods');
    assert.equal(
      mealFoods.requestBody.content['application/json'].schema.$ref,
      '#/components/schemas/AiMealIngredientResolutionRequestRequest',
    );
    assert.deepEqual(mealFoods.responses[200].content['application/json'].schema, {
      type: 'array',
      items: { $ref: '#/components/schemas/FoodItem' },
    });
    assert.deepEqual(mealFoods.security, [{ jwtAuth: [] }]);
  });
});
