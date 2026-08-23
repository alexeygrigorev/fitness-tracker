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

  // Workout Presets API
  { method: 'GET', path: '/api/workouts/presets/', description: 'workoutPresetsApi.getAll' },
  { method: 'GET', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.getById' },
  { method: 'POST', path: '/api/workouts/presets/', description: 'workoutPresetsApi.create' },
  { method: 'PATCH', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.update' },
  { method: 'DELETE', path: '/api/workouts/presets/{id}/', description: 'workoutPresetsApi.delete' },
  { method: 'POST', path: '/api/workouts/presets/{id}/start_workout/', description: 'workoutPresetsApi.startWorkout' },

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
      if (
        (schema.minimum !== undefined && value < schema.minimum) ||
        (schema.maximum !== undefined && value > schema.maximum)
      ) {
        return [
          `${path} must be between ${schema.minimum ?? -Infinity} and ${schema.maximum ?? Infinity}`,
        ];
      }
      break;
    case 'integer':
      if (!Number.isInteger(value)) return [`${path} must be an integer`];
      if (
        (schema.minimum !== undefined && value < schema.minimum) ||
        (schema.maximum !== undefined && value > schema.maximum)
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
    const password = `Contract-${randomUUID()}!x`;

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
    expect(registration.status).toBe(201);

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
          call.path.replace('{id}', ':id'),     // DRF format
          call.path.replace('{date_str}', ':date'),
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

      expect(existsInSchema).toBeTruthy();
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
