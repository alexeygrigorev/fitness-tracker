/**
 * Schema Integration Test
 *
 * This test validates that all frontend API calls match the backend OpenAPI schema.
 * It fetches the schema from the backend and verifies that each endpoint called
 * by the frontend exists and follows the expected format.
 */

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

// All API calls made by the frontend
const FRONTEND_API_CALLS = [
  // Auth API
  { method: 'POST', path: '/api/auth/login/', description: 'authApi.login' },
  { method: 'POST', path: '/api/auth/register/', description: 'authApi.register' },
  { method: 'GET', path: '/api/auth/me/', description: 'authApi.getMe' },
  { method: 'PATCH', path: '/api/auth/me/update/', description: 'authApi.updateProfile' },

  // Last-used exercise settings API
  { method: 'GET', path: '/api/auth/exercise-settings/', description: 'lastUsedWeightsApi.getAll' },
  { method: 'POST', path: '/api/auth/exercise-settings/{exercise_id}/', description: 'lastUsedWeightsApi.set' },

  // Exercises API
  { method: 'GET', path: '/api/workouts/exercises/', description: 'exercisesApi.getAll' },
  { method: 'GET', path: '/api/workouts/exercises/{id}/', description: 'exercisesApi.getById' },
  { method: 'POST', path: '/api/workouts/exercises/', description: 'exercisesApi.create' },
  { method: 'PUT', path: '/api/workouts/exercises/{id}/', description: 'exercisesApi.update' },
  { method: 'DELETE', path: '/api/workouts/exercises/{id}/', description: 'exercisesApi.delete' },

  // Workout Sessions API
  { method: 'GET', path: '/api/workouts/sessions/', description: 'workoutsApi.getAll' },
  { method: 'GET', path: '/api/workouts/sessions/{id}/', description: 'workoutsApi.getById' },
  { method: 'POST', path: '/api/workouts/sessions/', description: 'workoutsApi.create' },
  { method: 'DELETE', path: '/api/workouts/sessions/{id}/', description: 'workoutsApi.delete' },
  { method: 'PATCH', path: '/api/workouts/sessions/{id}/', description: 'workoutsApi.update' },
  { method: 'POST', path: '/api/workouts/sessions/{id}/finish/', description: 'workoutsApi.finish' },
  { method: 'PATCH', path: '/api/workouts/sessions/{id}/sets/{set_id}/', description: 'workoutsApi.completeSet' },
  { method: 'DELETE', path: '/api/workouts/sessions/{id}/sets/{set_id}/completion/', description: 'workoutsApi.uncompleteSet' },
  { method: 'POST', path: '/api/workouts/sets/', description: 'workoutsApi.addSet' },
  { method: 'DELETE', path: '/api/workouts/sets/{set_id}/', description: 'workoutsApi.deleteSet' },
  { method: 'GET', path: '/api/workouts/sessions/active/', description: 'workoutsApi.getActive' },

  // Workout Presets API
  { method: 'GET', path: '/api/workouts/presets/', description: 'workoutPresetsApi.getAll' },
  { method: 'GET', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.getById' },
  { method: 'POST', path: '/api/workouts/presets/', description: 'workoutPresetsApi.create' },
  { method: 'PATCH', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.update' },
  { method: 'DELETE', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.delete' },
  { method: 'POST', path: '/api/workouts/presets/{id}/start_workout/', description: 'workoutPresetsApi.startWorkout' },
  { method: 'GET', path: '/api/workouts/presets/templates/', description: 'workoutPresetsApi.getTemplates' },
  { method: 'POST', path: '/api/workouts/presets/create_from_template/', description: 'workoutPresetsApi.createFromTemplate' },

  // Workout Calculations API
  { method: 'POST', path: '/api/workouts/calculations/calculate-volume/', description: 'workoutCalculationsApi.calculateVolume' },

  // Food API
  { method: 'GET', path: '/api/food/foods/', description: 'foodApi.getAll' },
  { method: 'GET', path: '/api/food/foods/{id}/', description: 'foodApi.getById' },
  { method: 'POST', path: '/api/food/foods/', description: 'foodApi.create' },
  { method: 'PATCH', path: '/api/food/foods/{id}/', description: 'foodApi.update' },
  { method: 'DELETE', path: '/api/food/foods/{id}/', description: 'foodApi.delete' },

  // Meal Templates API
  { method: 'GET', path: '/api/food/templates/', description: 'mealTemplatesApi.getAll' },
  { method: 'GET', path: '/api/food/templates/{id}/', description: 'mealTemplatesApi.getById' },
  { method: 'POST', path: '/api/food/templates/', description: 'mealTemplatesApi.create' },
  { method: 'PATCH', path: '/api/food/templates/{id}/', description: 'mealTemplatesApi.update' },
  { method: 'DELETE', path: '/api/food/templates/{id}/', description: 'mealTemplatesApi.delete' },
  { method: 'POST', path: '/api/food/calculations/calculate-nutrition/', description: 'mealTemplatesApi.calculateNutrition' },

  // Meals API
  { method: 'GET', path: '/api/food/meals/', description: 'mealsApi.getAll' },
  { method: 'GET', path: '/api/food/meals/{id}/', description: 'mealsApi.getById' },
  { method: 'GET', path: '/api/food/meals/date/{date_str}/', description: 'mealsApi.getByDate' },
  { method: 'GET', path: '/api/food/meals/daily/totals/{date_str}/', description: 'mealsApi.getDailyTotals' },
  { method: 'POST', path: '/api/food/meals/', description: 'mealsApi.create' },
  { method: 'PATCH', path: '/api/food/meals/{id}/', description: 'mealsApi.update' },
  { method: 'DELETE', path: '/api/food/meals/{id}/', description: 'mealsApi.delete' },

  // Food Calculations API
  { method: 'POST', path: '/api/food/calculations/calculate-calories/', description: 'foodCalculationsApi.calculateCalories' },
  { method: 'POST', path: '/api/food/calculations/detect-category/', description: 'foodCalculationsApi.detectCategory' },
  { method: 'POST', path: '/api/food/calculations/infer-metabolism/', description: 'foodCalculationsApi.inferMetabolism' },

  // AI API (may not be implemented yet, will be marked as allowed to fail)
  { method: 'POST', path: '/api/ai/analyze-exercise/', description: 'exercisesApi.analyzeWithAI' },
  { method: 'POST', path: '/api/ai/analyze-food/', description: 'foodApi.analyzeWithAI' },
  { method: 'POST', path: '/api/ai/analyze-meal/', description: 'analyzeMealWithAI' },
  { method: 'POST', path: '/api/ai/meal-foods/', description: 'aiMealApi.resolveMealFoods' },
];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type OpenApiSchema = {
  $ref?: string;
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  enum?: JsonValue[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  minimum?: number;
  maximum?: number;
};

function resolveSchema(
  schema: OpenApiSchema,
  document: { components?: { schemas?: Record<string, OpenApiSchema> } },
): OpenApiSchema {
  if (!schema.$ref) {
    return schema;
  }

  const referenceParts = schema.$ref.split('/');
  const componentName = decodeURIComponent(referenceParts[referenceParts.length - 1]);
  const resolved = document.components?.schemas?.[componentName];
  expect(resolved, `Missing schema component: ${schema.$ref}`).toBeDefined();
  return resolved!;
}

function validateJsonSchema(
  value: JsonValue,
  schemaInput: OpenApiSchema,
  document: Parameters<typeof resolveSchema>[1],
  path = 'response',
): string[] {
  const schema = resolveSchema(schemaInput, document);

  if (value === null) {
    return schema.nullable ? [] : [`${path} must not be null`];
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return [`${path} must be a string`];
      if (schema.enum && !schema.enum.includes(value)) {
        return [`${path} must be one of: ${schema.enum.join(', ')}`];
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return [`${path} must be a finite number`];
      }
      const numericValue = value as number;
      if (
        (schema.minimum !== undefined && numericValue < schema.minimum) ||
        (schema.maximum !== undefined && numericValue > schema.maximum)
      ) {
        return [
          `${path} must be between ${schema.minimum ?? -Infinity} and ${schema.maximum ?? Infinity}`,
        ];
      }
      break;
    case 'integer':
      if (!Number.isInteger(value)) return [`${path} must be an integer`];
      const integerValue = value as number;
      if (
        (schema.minimum !== undefined && integerValue < schema.minimum) ||
        (schema.maximum !== undefined && integerValue > schema.maximum)
      ) {
        return [`${path} must be between ${schema.minimum ?? -Infinity} and ${schema.maximum ?? Infinity}`];
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return [`${path} must be a boolean`];
      break;
    case 'array':
      if (!Array.isArray(value)) return [`${path} must be an array`];
      return value.flatMap((item, index) =>
        validateJsonSchema(item, schema.items!, document, `${path}[${index}]`),
      );
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        return [`${path} must be an object`];
      }

      const record = value as Record<string, JsonValue>;
      const errors = (schema.required ?? [])
        .filter((field) => !(field in record))
        .map((field) => `${path}.${field} is required`);

      for (const [field, fieldValue] of Object.entries(record)) {
        const fieldSchema = schema.properties?.[field];
        if (fieldSchema) {
          errors.push(
            ...validateJsonSchema(fieldValue, fieldSchema, document, `${path}.${field}`),
          );
        }
      }

      return errors;
    }
    default:
      return [`${path} has an unsupported schema type`];
  }

  return [];
}

test.describe('Schema Validation', () => {
  let schema: any = null;
  const baseURL = process.env.BASE_URL || 'http://localhost:8000';

  let authToken: string;

  test.beforeAll(async () => {
    // Fetch OpenAPI schema from backend
    const response = await fetch(`${baseURL}/api/schema/?format=json`);
    expect(response.ok).toBeTruthy();
    schema = await response.json();
  });

  test.beforeAll(async () => {
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const username = `schema-contract-${suffix}`;
    const password = `${randomUUID()}!x`;

    const registration = await fetch(`${baseURL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: `${username}@example.com`,
        password,
        password_confirm: password,
      }),
    });
    expect(
      registration.status,
      `registration failed: ${await registration.text()}`,
    ).toBe(201);

    const login = await fetch(`${baseURL}/api/auth/login/`, {
      method: 'POST',
      body: new URLSearchParams({ username, password }),
    });
    expect(login.status).toBe(200);

    authToken = ((await login.json()) as { access: string }).access;
  });

  test('schema should be valid OpenAPI 3.x', async () => {
    expect(schema).toBeDefined();
    expect(schema.openapi).toMatch(/^3\./);
    expect(schema.info.title).toBe('Fitness Tracker API');
  });

  test('frontend API calls should exist in backend schema', async () => {
    const schemaPaths = new Set(Object.keys(schema.paths));

    for (const call of FRONTEND_API_CALLS) {
      // Try exact match first
      let matchedPath = call.path;

      // If path has a parameter, try common format variations
      if (!schemaPaths.has(call.path)) {
        const variations = [
          call.path.replace(/\{[^}]+\}/g, ':id'), // DRF format
          call.path.replace(/\{[^}]+\}/g, '{id}'),
        ];
        for (const variation of variations) {
          if (schemaPaths.has(variation)) {
            matchedPath = variation;
            break;
          }
        }
      }

      const pathOperation = schema.paths[matchedPath];
      const existsInSchema = pathOperation && pathOperation[call.method.toLowerCase()];

      expect(existsInSchema, `${call.method} ${call.path} (${call.description})`).toBeTruthy();
    }
  });

  const aiContracts = [
    ['/api/ai/analyze-food/', 'AiFoodAnalysis'],
    ['/api/ai/analyze-meal/', 'AiMealAnalysis'],
    ['/api/ai/analyze-exercise/', 'AiExerciseAnalysis'],
  ] as const;

  for (const [path, componentName] of aiContracts) {
    test(`${path} returns its documented response schema`, async () => {
      const response = await fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: 'Chicken and rice' }),
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as JsonValue;
      const operation = schema.paths[path].post;
      const responseSchemaRef =
        operation.responses[200]?.content?.['application/json']?.schema?.$ref;
      expect(responseSchemaRef).toBe(`#/components/schemas/${componentName}`);

      const errors = validateJsonSchema(data, { $ref: responseSchemaRef }, schema);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  function documentedResponseSchema(
    path: keyof typeof schema.paths,
    method: 'get' | 'post' | 'patch' | 'delete',
    status = 200,
  ): OpenApiSchema {
    const response = schema.paths[path]?.[method]?.responses?.[String(status)];
    const responseSchema = response?.content?.['application/json']?.schema;
    expect(responseSchema, `${method.toUpperCase()} ${String(path)} must document its ${status} response`).toBeDefined();
    return responseSchema!;
  }

  async function authenticatedRequest(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: JsonValue,
  ): Promise<Response> {
    return fetch(`${baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  test('workout lifecycle responses match their documented schemas', async () => {
    const marker = randomUUID();
    const exerciseResponse = await authenticatedRequest('/api/workouts/exercises/', 'POST', {
      name: `Schema lift ${marker}`,
      category: 'isolation',
      bodyweight: false,
      muscleGroups: ['Chest'],
      equipment: null,
      instructions: [],
    } satisfies JsonValue extends never ? never : Record<string, JsonValue>);
    expect(exerciseResponse.status).toBe(201);
    const exercise = (await exerciseResponse.json()) as { id: number };

    const presetResponse = await authenticatedRequest('/api/workouts/presets/', 'POST', {
      name: `Schema preset ${marker}`,
      notes: null,
      dayLabel: null,
      tags: [],
      is_public: false,
      exercises: [{
        exerciseId: exercise.id,
        type: 'normal',
        sets: 1,
        dropdowns: null,
        includeWarmup: false,
        order: 0,
      }],
    } satisfies JsonValue extends never ? never : Record<string, JsonValue>);
    expect(presetResponse.status).toBe(201);
    const preset = (await presetResponse.json()) as { id: number };

    const startResponse = await authenticatedRequest(
      `/api/workouts/presets/${preset.id}/start_workout/`,
      'POST',
      {},
    );
    expect(startResponse.status).toBe(201);
    const started = (await startResponse.json()) as {
      session: { id: number };
      sets: Array<{ id: number }>;
    };
    expect(started.sets).toHaveLength(1);
    let errors = validateJsonSchema(
      started,
      documentedResponseSchema('/api/workouts/presets/{id}/start_workout/', 'post', 201),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    const sessionId = started.session.id;
    const setId = started.sets[0]!.id;
    const activeResponse = await authenticatedRequest('/api/workouts/sessions/active/', 'GET');
    expect(activeResponse.status).toBe(200);
    errors = validateJsonSchema(
      (await activeResponse.json()) as JsonValue,
      documentedResponseSchema('/api/workouts/sessions/active/', 'get'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    const completeResponse = await authenticatedRequest(
      `/api/workouts/sessions/${sessionId}/sets/${setId}/`,
      'PATCH',
      {},
    );
    expect(completeResponse.status).toBe(200);
    errors = validateJsonSchema(
      (await completeResponse.json()) as JsonValue,
      documentedResponseSchema('/api/workouts/sessions/{id}/sets/{set_id}/', 'patch'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    const uncompleteResponse = await authenticatedRequest(
      `/api/workouts/sessions/${sessionId}/sets/${setId}/completion/`,
      'DELETE',
    );
    expect(uncompleteResponse.status).toBe(200);
    errors = validateJsonSchema(
      (await uncompleteResponse.json()) as JsonValue,
      documentedResponseSchema('/api/workouts/sessions/{id}/sets/{set_id}/completion/', 'delete'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    const finishResponse = await authenticatedRequest(
      `/api/workouts/sessions/${sessionId}/finish/`,
      'POST',
    );
    expect(finishResponse.status).toBe(200);
    errors = validateJsonSchema(
      (await finishResponse.json()) as JsonValue,
      documentedResponseSchema('/api/workouts/sessions/{id}/finish/', 'post'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    await authenticatedRequest(`/api/workouts/presets/${preset.id}/`, 'DELETE');
    await authenticatedRequest(`/api/workouts/exercises/${exercise.id}/`, 'DELETE');
  });

  test('nutrition day responses match their documented schemas', async () => {
    const marker = randomUUID();
    const day = '2026-08-23';
    const foodResponse = await authenticatedRequest('/api/food/foods/', 'POST', {
      name: `Schema oats ${marker}`,
      brand: null,
      category: 'carb',
      servingSize: 100,
      servingType: 'g',
      calories: 100,
      protein: 10,
      carbs: 20,
      fat: 5,
      saturatedFat: null,
      sugar: 2,
      fiber: 3,
      sodium: null,
      glycemicIndex: null,
      absorptionSpeed: null,
      insulinResponse: null,
      satietyScore: null,
      proteinQuality: null,
    } satisfies JsonValue extends never ? never : Record<string, JsonValue>);
    expect(foodResponse.status).toBe(201);
    const food = (await foodResponse.json()) as { id: number };

    const mealResponse = await authenticatedRequest('/api/food/meals/', 'POST', {
      name: `Schema meal ${marker}`,
      mealType: 'breakfast',
      date: day,
      food_items: [{ foodId: food.id, grams: 100, order: 0 }],
    } satisfies JsonValue extends never ? never : Record<string, JsonValue>);
    expect(mealResponse.status).toBe(201);

    const mealsResponse = await authenticatedRequest(`/api/food/meals/date/${day}/`, 'GET');
    expect(mealsResponse.status).toBe(200);
    let errors = validateJsonSchema(
      (await mealsResponse.json()) as JsonValue,
      documentedResponseSchema('/api/food/meals/date/{date_str}/', 'get'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    const totalsResponse = await authenticatedRequest(
      `/api/food/meals/daily/totals/${day}/`,
      'GET',
    );
    expect(totalsResponse.status).toBe(200);
    errors = validateJsonSchema(
      (await totalsResponse.json()) as JsonValue,
      documentedResponseSchema('/api/food/meals/daily/totals/{date_str}/', 'get'),
      schema,
    );
    expect(errors, errors.join('\n')).toEqual([]);

    await authenticatedRequest('/api/food/foods/' + food.id + '/', 'DELETE');
  });

  test.describe('Health check', () => {
    test('should have /api/health/ endpoint', async () => {
      const response = await fetch(`${baseURL}/api/health/`);
      expect(response.ok).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });
  });

  test.describe('Documentation endpoints', () => {
    test('should have swagger ui at /api/docs/', async () => {
      const response = await fetch(`${baseURL}/api/docs/`);
      // Swagger UI returns HTML, so just check it's accessible
      expect(response.ok || response.status === 304).toBeTruthy();
    });

    test('should have redoc at /api/redoc/', async () => {
      const response = await fetch(`${baseURL}/api/redoc/`);
      // ReDoc returns HTML, so just check it's accessible
      expect(response.ok || response.status === 304).toBeTruthy();
    });
  });
});
