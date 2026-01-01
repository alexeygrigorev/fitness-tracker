/**
 * Schema Integration Test
 *
 * This test validates that all frontend API calls match the backend OpenAPI schema.
 * It fetches the schema from the backend and verifies that each endpoint called
 * by the frontend exists and follows the expected format.
 */

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

test.describe('Schema Validation', () => {
  let schema: any = null;
  const baseURL = process.env.BASE_URL || 'http://localhost:8000';

  test.beforeAll(async () => {
    // Fetch OpenAPI schema from backend
    const response = await fetch(`${baseURL}/api/schema/?format=json`);
    expect(response.ok).toBeTruthy();
    schema = await response.json();
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
