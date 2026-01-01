/**
 * Auth API tests
 * Tests for authentication API functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authApi } from '@/api';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('login', () => {
    it('should send login request with FormData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access: 'test-token', refresh: 'refresh-token' }),
      } as Response);

      const token = await authApi.login('testuser', 'password123');

      expect(token).toBe('test-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('should throw error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Incorrect credentials' }),
      } as Response);

      await expect(authApi.login('user', 'pass')).rejects.toThrow('Incorrect credentials');
    });
  });

  describe('register', () => {
    it('should send registration request', async () => {
      const mockUser = { id: 1, email: 'test@test.com', username: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await authApi.register('test@test.com', 'testuser', 'pass123');

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ email: 'test@test.com', username: 'testuser', password: 'pass123' }),
        })
      );
    });
  });

  describe('getMe', () => {
    it('should fetch current user info with auth header', async () => {
      const mockUser = { id: 1, email: 'test@test.com', username: 'test', is_active: true };
      localStorageMock.getItem.mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await authApi.getMe();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(authApi.getMe()).rejects.toThrow();
    });
  });

  describe('localStorage helpers', () => {
    it('setAuth should store token and user', () => {
      const mockUser = { id: 1, username: 'test' };

      authApi.setAuth('token123', mockUser);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'token123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
    });

    it('clearAuth should remove token and user', () => {
      authApi.clearAuth();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });

    it('getToken should return stored token', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');

      const token = authApi.getToken();

      expect(token).toBe('stored-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('token');
    });

    it('setToken should store token', () => {
      authApi.setToken('token123');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'token123');
    });

    it('getStoredUser should parse and return stored user', () => {
      const mockUser = { id: 1, username: 'test' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

      const user = authApi.getStoredUser();

      expect(user).toEqual(mockUser);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('user');
    });

    it('getStoredUser should return null when no user stored', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const user = authApi.getStoredUser();

      expect(user).toBeNull();
    });
  });
});
