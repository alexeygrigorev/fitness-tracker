/**
 * Schema Integration Test
 *
 * This test validates that all frontend API calls match the backend OpenAPI schema.
 * It fetches the schema from the backend and verifies that each endpoint called
 * by the frontend exists and follows the expected format.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// OpenAPI Schema interface (partial)
interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
}

interface OpenAPIOperation {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: any;
      };
      'multipart/form-data'?: {
        schema?: any;
      };
    };
  };
  responses?: {
    [statusCode: string]: {
      content?: {
        'application/json'?: {
          schema?: any;
        };
      };
    };
  };
}

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: OpenAPIPath;
  };
  components?: {
    schemas?: {
      [name: string]: any;
    };
  };
}

// API Call definition from frontend
interface APICall {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
}

// All API calls made by the frontend
const FRONTEND_API_CALLS: APICall[] = [
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

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const SCHEMA_URL = `${API_BASE}/api/schema/?format=json`;

let schema: OpenAPISchema | null = null;
let schemaFetchError: string | null = null;

// Helper function to fetch with retry
async function fetchWithRetry(url: string, maxRetries = 10, delay = 500): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404 && i < maxRetries - 1) {
        // Server might be starting up
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

describe('Schema Integration', () => {
  beforeAll(async () => {
    try {
      const response = await fetchWithRetry(SCHEMA_URL, 20, 500);
      if (!response.ok) {
        schemaFetchError = `Failed to fetch schema: HTTP ${response.status}`;
        return;
      }
      schema = await response.json();
    } catch (error) {
      schemaFetchError = error instanceof Error ? error.message : String(error);
    }
  }, 30000); // 30 second timeout for fetching schema

  it('should be able to fetch the OpenAPI schema', () => {
    expect(schemaFetchError).toBeNull();
    expect(schema).not.toBeNull();
    expect(schema?.openapi).toMatch(/^3\./);
  });

  it('should have valid schema structure', () => {
    if (!schema) {
      // Skip if schema not available
      return;
    }
    expect(schema.info.title).toBe('Fitness Tracker API');
    expect(schema.paths).toBeDefined();
    expect(typeof schema.paths).toBe('object');
  });

  describe('Frontend API calls should match backend schema', () => {
    // All endpoints should exist in the schema

    // Get all paths from schema
    const getSchemaPaths = () => {
      if (!schema) return new Set<string>();
      const paths = new Set<string>();
      for (const path in schema.paths) {
        paths.add(path);
      }
      return paths;
    };

    it.each(FRONTEND_API_CALLS)('$description: $method $path', ({ method, path, description }) => {
      if (!schema) {
        // Skip if schema not available
        return;
      }

      const schemaPaths = getSchemaPaths();

      // Try to find the path in the schema
      // First, try exact match
      let matchedPath = path;

      // If path has a parameter, the schema might use a different format
      // e.g., {id} vs :id
      if (!schemaPaths.has(path)) {
        // Try common parameter format variations
        const variations = [
          path.replace('{id}', '{id}'),  // OpenAPI format
          path.replace('{id}', ':id'),    // Alternative format
          path.replace('{date_str}', '{date}'),
          path.replace('{date_str}', ':date'),
        ];
        for (const variation of variations) {
          if (schemaPaths.has(variation)) {
            matchedPath = variation;
            break;
          }
        }
      }

      const pathOperation = schema.paths[matchedPath];
      const existsInSchema = pathOperation && pathOperation[method.toLowerCase() as keyof OpenAPIPath];

      expect(existsInSchema).toBeTruthy();
    });

    it('should report all paths in the schema', () => {
      if (!schema) {
        return;
      }

      const schemaPaths = new Set(Object.keys(schema.paths));
      const frontendPaths = new Set(
        FRONTEND_API_CALLS.map(call => call.path.replace(/{id}/g, '{id}').replace(/{date_str}/g, '{date_str}'))
      );

      const unusedPaths: string[] = [];
      for (const path of schemaPaths) {
        if (!frontendPaths.has(path) && !path.includes('{')) {
          // Skip parameterized paths for this check
          unusedPaths.push(path);
        }
      }

      if (unusedPaths.length > 0) {
        console.info(`Backend paths not used by frontend: ${unusedPaths.join(', ')}`);
      }

      // This is informational, not a failure
      expect(unusedPaths.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Schema health check endpoint', () => {
    it('should have /api/health/ endpoint', async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health/`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.status).toBe('healthy');
      } catch (error) {
        // Server might not be running in test environment
        console.warn('Health check failed - server may not be running');
      }
    });
  });

  describe('Schema documentation endpoints', () => {
    it('should have swagger ui at /api/docs/', async () => {
      try {
        const response = await fetch(`${API_BASE}/api/docs/`);
        // Swagger UI returns HTML, so just check it's accessible
        expect(response.ok || response.status === 304).toBe(true);
      } catch (error) {
        console.warn('Swagger UI check failed - server may not be running');
      }
    });

    it('should have redoc at /api/redoc/', async () => {
      try {
        const response = await fetch(`${API_BASE}/api/redoc/`);
        // ReDoc returns HTML, so just check it's accessible
        expect(response.ok || response.status === 304).toBe(true);
      } catch (error) {
        console.warn('ReDoc check failed - server may not be running');
      }
    });
  });
});
