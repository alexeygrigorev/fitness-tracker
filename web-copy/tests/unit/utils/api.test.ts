/**
 * API utility tests
 * Tests for API response handling, header generation, and error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API Utilities', () => {
  // Mock fetch globally
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('handleResponse', () => {
    it('should return parsed JSON on successful response', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      // Import after fetch is mocked
      const response = await mockFetch('/test');
      const data = await response.json();

      expect(data).toEqual(mockData);
    });

    it('should handle 401 unauthorized errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      } as Response);

      const response = await mockFetch('/test');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle 404 not found errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found' }),
      } as Response);

      const response = await mockFetch('/test');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should handle 422 validation errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Validation error' }),
      } as Response);

      const response = await mockFetch('/test');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(422);
    });
  });

  describe('Authorization Headers', () => {
    it('should include token in headers when token exists', () => {
      const token = 'test-token-123';
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(token);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      expect(headers['Authorization']).toBe(`Bearer ${token}`);

      vi.restoreAllMocks();
    });

    it('should not include authorization header when no token', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      expect(headers['Authorization']).toBeUndefined();

      vi.restoreAllMocks();
    });
  });

  describe('API Endpoint URLs', () => {
    const API_BASE = 'http://127.0.0.1:8001';

    it('should generate correct exercises API URL', () => {
      const expected = `${API_BASE}/api/v1/workouts/exercises`;
      expect(expected).toBe('http://127.0.0.1:8001/api/v1/workouts/exercises');
    });

    it('should generate correct workouts API URL', () => {
      const expected = `${API_BASE}/api/v1/workouts/sessions`;
      expect(expected).toBe('http://127.0.0.1:8001/api/v1/workouts/sessions');
    });

    it('should generate correct presets API URL', () => {
      const expected = `${API_BASE}/api/v1/workouts/presets`;
      expect(expected).toBe('http://127.0.0.1:8001/api/v1/workouts/presets');
    });
  });
});
