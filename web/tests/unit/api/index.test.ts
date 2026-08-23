import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiMealApi,
  dailySummaryApi,
  exercisesApi,
  foodApi,
  mealTemplatesApi,
  mealsApi,
  workoutsApi,
} from '@/api';
import type { AiAnalyzedFood, WorkoutSession } from '@/types';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

const localStorageMock = {
  getItem: vi.fn<() => string | null>(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = '',
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: vi.fn(async () => {
      throw new Error('A 204 response must not read a body');
    }),
  } as unknown as Response;
}

describe('API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('auth-token');

    Reflect.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'http://localhost/workouts' },
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shared response handling', () => {
    it('sends JSON headers, authorization, and parses successful data', async () => {
      const exercise = { id: 3, name: 'Squat' };
      fetchMock.mockResolvedValueOnce(jsonResponse(exercise));

      await expect(exercisesApi.getById(3)).resolves.toEqual(exercise);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/workouts/exercises/3/',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer auth-token',
          },
        },
      );
    });

    it('returns null for a 204 response without reading a body', async () => {
      const response = noContentResponse();
      fetchMock.mockResolvedValueOnce(response);

      await expect(exercisesApi.delete(8)).resolves.toBeNull();
      expect(response.json).not.toHaveBeenCalled();
    });

    it('uses the backend error detail', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ detail: 'Invalid workout' }, 400),
      );

      await expect(workoutsApi.update(4, { name: '' })).rejects.toThrow(
        'Invalid workout',
      );
    });

    it('falls back to status text when an error body cannot be parsed', async () => {
      const failedResponse = jsonResponse({}, 503, 'Service Unavailable');
      failedResponse.json = vi.fn().mockRejectedValue(new SyntaxError('bad json'));
      fetchMock.mockResolvedValueOnce(failedResponse);

      await expect(foodApi.getAll()).rejects.toThrow('Service Unavailable');
    });

    it('clears authentication and redirects after a 401 response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));

      await expect(mealsApi.getAll()).rejects.toThrow('Unauthorized');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(window.location.href).toBe('/login');
    });
  });

  describe('nutrition records', () => {
    it('normalizes backend food IDs to strings', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse([{ id: 17, name: 'Oats' }]),
      );

      await expect(foodApi.getAll()).resolves.toEqual([
        { id: '17', name: 'Oats' },
      ]);
    });

    it('serializes template foods and normalizes the created record', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: 9,
          name: 'Rest day meal',
          category: 'dinner',
          food_items: [
            { foodId: 21, grams: '125.5' },
            { foodId: 4, grams: 40 },
          ],
        }),
      );

      const created = await mealTemplatesApi.create({
        name: 'Rest day meal',
        category: 'dinner',
        foods: [
          { foodId: '21', grams: 125.5 },
          { foodId: '4', grams: 40 },
        ],
      });

      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        name: 'Rest day meal',
        category: 'dinner',
        food_items: [
          { foodId: 21, grams: 125.5, order: 0 },
          { foodId: 4, grams: 40, order: 1 },
        ],
      });
      expect(created).toEqual({
        id: '9',
        name: 'Rest day meal',
        category: 'dinner',
        foods: [
          { foodId: '21', grams: 125.5 },
          { foodId: '4', grams: 40 },
        ],
      });
    });

    it('serializes meal food items with their order and preserves unrelated fields', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: 6,
          name: 'Updated lunch',
          food_items: [{ foodId: '2', grams: '80' }],
        }),
      );

      await mealsApi.update('6', {
        name: 'Updated lunch',
        foods: [{ foodId: '2', grams: 80 }],
      });

      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        name: 'Updated lunch',
        food_items: [{ foodId: 2, grams: 80, order: 0 }],
      });
    });

    it('requests meal dates using the local calendar day', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ total_calories: 120 }));
      const localEvening = new Date(2026, 0, 2, 23, 30);

      await Promise.all([
        mealsApi.getByDate(localEvening),
        mealsApi.getDailyTotals(localEvening),
      ]);

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/food/meals/date/2026-01-02/',
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/food/meals/daily/totals/2026-01-02/',
        expect.anything(),
      );
    });

    it('creates meals using the local calendar day from their logged timestamp', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: 14,
          date: '2026-01-02',
          food_items: [{ foodId: 8, grams: 50 }],
        }),
      );

      await mealsApi.create({
        name: 'Late snack',
        mealType: 'snack',
        foods: [{ foodId: '8', grams: 50 }],
        loggedAt: new Date(2026, 0, 2, 23, 30),
      });

      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        name: 'Late snack',
        mealType: 'snack',
        date: '2026-01-02',
        food_items: [{ foodId: 8, grams: 50, order: 0 }],
      });
    });

    it('normalizes meals returned by a date query', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse([
          {
            id: 12,
            name: 'Late snack',
            food_items: [{ foodId: 31, grams: '15' }],
          },
        ]),
      );

      await expect(mealsApi.getByDate(new Date(2026, 10, 7))).resolves.toEqual([
        {
          id: '12',
          name: 'Late snack',
          foods: [{ foodId: '31', grams: 15 }],
        },
      ]);
    });
  });

  describe('AI meal ingredients', () => {
    it('resolves analyzed foods through the atomic backend endpoint', async () => {
      const ingredient: AiAnalyzedFood = {
        name: 'Roasted Vegetable',
        brand: null,
        category: 'mixed',
        servingSize: 100,
        servingType: 'g',
        grams: 125,
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
      fetchMock.mockResolvedValueOnce(
        jsonResponse([{ id: 24, name: 'Roasted Vegetable' }]),
      );

      await expect(aiMealApi.resolveMealFoods([ingredient])).resolves.toEqual([
        { id: '24', name: 'Roasted Vegetable' },
      ]);

      expect(fetchMock).toHaveBeenCalledWith('/api/ai/meal-foods/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer auth-token',
        },
        body: JSON.stringify({ foods: [ingredient] }),
      });
    });
  });

  describe('daily summary', () => {
    it('aggregates authenticated meals and same-day workout sets', async () => {
      const localEvening = new Date(2026, 0, 2, 23, 30);
      const todaysWorkout: WorkoutSession = {
        id: 31,
        name: 'Push day',
        startedAt: new Date(2026, 0, 2, 8).toISOString(),
        endedAt: new Date(2026, 0, 2, 9).toISOString(),
        sets: [
          {
            id: 1,
            exerciseId: 7,
            setType: 'normal',
            weight: 100,
            reps: 8,
            loggedAt: new Date(2026, 0, 2, 8, 5).toISOString(),
          },
          {
            id: 2,
            exerciseId: 7,
            setType: 'dropdown',
            weight: 60,
            reps: 10,
            dropdownWeights: [
              { weight: 50, reps: 8 },
            ],
            loggedAt: new Date(2026, 0, 2, 8, 10).toISOString(),
          },
          {
            id: 3,
            exerciseId: 7,
            setType: 'bodyweight',
            reps: 12,
            loggedAt: new Date(2026, 0, 2, 8, 15).toISOString(),
          },
          {
            id: 4,
            exerciseId: 7,
            setType: 'normal',
            weight: 90,
            reps: 8,
            loggedAt: null,
          },
          {
            id: 5,
            exerciseId: 7,
            setType: 'warmup',
            reps: 10,
            loggedAt: new Date(2026, 0, 2, 8).toISOString(),
          },
        ],
      };
      const yesterdaysWorkout: WorkoutSession = {
        id: 30,
        name: 'Yesterday',
        startedAt: new Date(2026, 0, 1, 8).toISOString(),
        endedAt: null,
        sets: [],
      };

      fetchMock
        .mockResolvedValueOnce(
          jsonResponse([
            {
              id: 11,
              name: 'Lunch',
              food_items: [{ foodId: 4, grams: 100 }],
            },
          ]),
        )
        .mockResolvedValueOnce(
          jsonResponse({ calories: 720.5, protein_g: 45.25 }),
        )
        .mockResolvedValueOnce(
          jsonResponse([yesterdaysWorkout, todaysWorkout]),
        );

      const summary = await dailySummaryApi.getSummary(localEvening);

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/food/meals/date/2026-01-02/',
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/food/meals/daily/totals/2026-01-02/',
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        '/api/workouts/sessions/',
        expect.anything(),
      );
      expect(summary.meals).toEqual([
        {
          id: '11',
          name: 'Lunch',
          foods: [{ foodId: '4', grams: 100 }],
        },
      ]);
      expect(summary.totalCalories).toBe(720.5);
      expect(summary.totalProtein).toBe(45.25);
      expect(summary.workouts).toEqual([
        {
          ...todaysWorkout,
          totalVolume: 1800,
        },
      ]);
      expect(summary.totalVolume).toBe(1800);
      expect(summary.sleep).toBeUndefined();
      expect(summary.metabolism).toBeNull();
    });
  });
});
