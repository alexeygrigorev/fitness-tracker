import { test, expect } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Helper function to get auth token
async function getAuthToken(request: any) {
  const response = await request.post(`${API_BASE}/api/auth/login/`, {
    form: {
      username: 'admin',
      password: 'admin'
    },
    timeout: 10000
  });

  const data = await response.json();
  return data.access;
}

test.describe('Backend API Connectivity', () => {
  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health/`, {
      timeout: 10000
    });
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toMatchObject({
      status: 'healthy',
      framework: 'Django REST Framework'
    });
  });

  test('OpenAPI schema is available', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/schema/?format=json`, {
      timeout: 10000
    });
    expect(response.ok()).toBeTruthy();

    const schema = await response.json();
    expect(schema.openapi).toMatch(/^3\./);
    expect(schema.info.title).toBe('Fitness Tracker API');
  });
});

test.describe('Auth API', () => {
  test('user can register and login', async ({ request }) => {
    const uniqueId = Date.now();
    const username = `e2euser_${uniqueId}`;
    const password = 'testpass123';

    // Register
    const registerResponse = await request.post(`${API_BASE}/api/auth/register/`, {
      data: {
        username,
        email: `e2e_${uniqueId}@example.com`,
        password,
        password_confirm: password
      },
      timeout: 10000
    });
    expect(registerResponse.ok()).toBeTruthy();

    const registerData = await registerResponse.json();
    expect(registerData).toHaveProperty('user');
    expect(registerData.user.username).toBe(username);

    // Login
    const loginResponse = await request.post(`${API_BASE}/api/auth/login/`, {
      form: {
        username: username,
        password: password
      },
      timeout: 10000
    });
    expect(loginResponse.ok()).toBeTruthy();

    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('access');
    expect(loginData).toHaveProperty('refresh');
  });

  test('login with invalid credentials fails', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login/`, {
      form: {
        username: 'nonexistent',
        password: 'wrongpass'
      },
      timeout: 10000
    });

    expect(response.ok()).toBeFalsy();
    expect([401, 400]).toContain(response.status());
  });
});

test.describe('Exercises API', () => {
  test('can list exercises', async ({ request }) => {
    const authToken = await getAuthToken(request);

    const response = await request.get(`${API_BASE}/api/workouts/exercises/`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const exercises = await response.json();
    expect(Array.isArray(exercises)).toBeTruthy();
    expect(exercises.length).toBeGreaterThan(0);
  });

  test('can create an exercise', async ({ request }) => {
    const authToken = await getAuthToken(request);
    const uniqueId = Date.now();

    const exerciseData = {
      name: `E2E Test Exercise ${uniqueId}`,
      is_bodyweight: false
    };

    const response = await request.post(`${API_BASE}/api/workouts/exercises/`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: exerciseData,
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const exercise = await response.json();
    expect(exercise.name).toBe(exerciseData.name);
  });
});

test.describe('Food API', () => {
  test('can list food items', async ({ request }) => {
    const authToken = await getAuthToken(request);

    const response = await request.get(`${API_BASE}/api/food/foods/`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const foods = await response.json();
    expect(Array.isArray(foods)).toBeTruthy();
  });

  test('can create a food item', async ({ request }) => {
    const authToken = await getAuthToken(request);
    const uniqueId = Date.now();

    const foodData = {
      name: `E2E Test Food ${uniqueId}`,
      serving_size: '100.00',
      serving_unit: 'g',
      calories: '100.00',
      protein: '20.00',
      carbs: '10.00',
      fat: '5.00'
    };

    const response = await request.post(`${API_BASE}/api/food/foods/`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: foodData,
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const food = await response.json();
    expect(food.name).toBe(foodData.name);
  });
});

test.describe('Calculations API', () => {
  test('calculate calories endpoint works', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/food/calculations/calculate-calories/`, {
      data: {
        protein_g: 25,
        carbs_g: 50,
        fat_g: 10
      },
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.calories).toBe(390);
  });

  test('calculate volume endpoint works', async ({ request }) => {
    const authToken = await getAuthToken(request);

    const response = await request.post(`${API_BASE}/api/workouts/calculations/calculate-volume/`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        sets: [
          { weight_lbs: 100, reps: 10 },
          { weight_lbs: 80, reps: 12 }
        ]
      },
      timeout: 10000
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.total_volume).toBe(1960);
  });
});
