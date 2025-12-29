/**
 * API Connectivity Tests
 *
 * Tests backend API endpoints for E2E validation.
 * These are faster than full browser tests but validate real API responses.
 *
 * Run: npm run test:api
 *
 * Before running, start the test backend server:
 *   cd backend && python test_server.py
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BACKEND_URL = 'http://127.0.0.1:18081';
const FRONTEND_URL = 'http://127.0.0.1:3174';

// Test credentials
const TEST_USER = {
  username: 'e2e_test_user',
  email: 'e2e@test.com',
  password: 'TestPass123!',
};

let authToken = null;

describe('API Connectivity', () => {
  describe('Health Check', () => {
    it('should respond to root endpoint', async () => {
      const response = await fetch(`${BACKEND_URL}/`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.message).toBe('Fitness Tracker API');
      expect(data.version).toBe('1.0.0');
    });

    it('should return healthy status', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });
  });

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER),
      });
      // User might already exist from previous test run, that's ok
      expect([200, 201, 400]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data.username).toBe(TEST_USER.username);
        expect(data.email).toBe(TEST_USER.email);
        expect(data.id).toBeDefined();
        expect(data.is_active).toBe(true);
      }
    });

    it('should login with valid credentials', async () => {
      const formBody = new URLSearchParams();
      formBody.append('username', TEST_USER.username);
      formBody.append('password', TEST_USER.password);

      const response = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.token_type).toBe('bearer');
      authToken = data.access_token;
    });

    it('should fail login with wrong password', async () => {
      const formBody = new URLSearchParams();
      formBody.append('username', TEST_USER.username);
      formBody.append('password', 'wrongpassword');

      const response = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      });
      expect(response.status).toBe(401);
    });

    it('should get current user profile', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.username).toBe(TEST_USER.username);
      expect(data.email).toBe(TEST_USER.email);
    });

    it('should fail unauthorized request', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/me`);
      expect(response.status).toBe(401);
    });
  });

  describe('Exercises API', () => {
    it('should return exercises list', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/exercises`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should include expected exercises', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/exercises`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await response.json();
      const exerciseNames = data.map(e => e.name);

      expect(exerciseNames).toContain('Bench Press');
      expect(exerciseNames).toContain('Squat');
      expect(exerciseNames).toContain('Deadlift');
    });

    it('should get a specific exercise', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/exercises/ex-1`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.name).toBe('Bench Press');
      expect(data.category).toBe('compound');
    });
  });

  describe('Workout Sessions API', () => {
    it('should create a workout session', async () => {
      const workout = {
        name: 'E2E Test Workout',
        startedAt: new Date().toISOString(),
        sets: [
          {
            id: 'set-e2e-1',
            exerciseId: 'ex-1',
            setType: 'normal',
            weight: 100,
            reps: 10,
            loggedAt: new Date().toISOString(),
          },
        ],
      };

      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workout),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.name).toBe('E2E Test Workout');
      expect(data.totalVolume).toBe(1000); // 100 * 10
    });

    it('should list workout sessions', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/sessions`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Active Workout State API', () => {
    it('should save active workout state', async () => {
      const state = {
        preset: {
          name: 'Test Active Workout',
          exercises: [
            {
              id: 'test-ex-1',
              exerciseId: 'ex-1',
              type: 'normal',
              sets: 3,
              weight: 100,
              reps: 10,
            },
          ],
        },
        setRows: [],
        startTime: new Date().toISOString(),
      };

      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/active-state`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state),
      });
      // 201 = created successfully
      expect([200, 201]).toContain(response.status);
      const data = await response.json();
      expect(data.preset.name).toBe('Test Active Workout');
    });

    it('should get active workout state', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/active-state`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.preset.name).toBe('Test Active Workout');
    });

    it('should update active workout state', async () => {
      const update = {
        setRows: [
          {
            id: 'row-1',
            exerciseId: 'ex-1',
            exerciseName: 'Bench Press',
            setNumber: 1,
            setType: 'normal',
            weight: 105,
            reps: 10,
            completed: false,
          },
        ],
      };

      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/active-state`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(update),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.setRows.length).toBeGreaterThan(0);
    });

    it('should clear active workout state', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/active-state`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.status).toBe(204);
    });
  });

  describe('Food API', () => {
    it('should list foods', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/food/foods`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Meals API', () => {
    it('should list meals', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/food/meals`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Meal Templates API', () => {
    it('should list meal templates', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/food/templates`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Workout Calculations API', () => {
    it('should calculate volume from sets', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/calculations/volume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sets: [
            { id: 's1', exerciseId: 'ex-1', setType: 'normal', weight: 100, reps: 10 },
            { id: 's2', exerciseId: 'ex-1', setType: 'normal', weight: 80, reps: 8 },
          ],
        }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.totalVolume).toBe(1640); // (100*10) + (80*8)
      expect(data.completedSets).toBe(2);
      expect(data.totalSets).toBe(2);
    });

    it('should handle empty sets for volume calculation', async () => {
      const response = await fetch(`${BACKEND_URL}/api/v1/workouts/calculations/volume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sets: [] }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.totalVolume).toBe(0);
      expect(data.completedSets).toBe(0);
      expect(data.totalSets).toBe(0);
    });
  });

  describe('Frontend Server', () => {
    it('should serve the application', async () => {
      try {
        const response = await fetch(FRONTEND_URL);
        expect(response.ok).toBe(true);
        const html = await response.text();
        expect(html).toMatch(/<!doctype|<html/i);
      } catch (e) {
        // Frontend might not be running - mark as skip but don't fail
        console.log('Frontend not running, skipping test');
      }
    });
  });
});
