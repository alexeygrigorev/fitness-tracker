import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exercisesApi,
  foodApi,
  mealTemplatesApi,
  mealsApi,
  workoutsApi,
} from '@/api';

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
});
