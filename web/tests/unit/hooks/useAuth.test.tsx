/**
 * useAuth hook tests
 * Tests for authentication context and hook functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock before imports
vi.mock('@/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    setAuth: vi.fn(),
    setToken: vi.fn(),
    clearAuth: vi.fn(),
    getToken: vi.fn(),
    getStoredUser: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { authApi } from '@/api';

const mockAuthApi = authApi as unknown as {
  login: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  getMe: ReturnType<typeof vi.fn>;
  setAuth: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
  clearAuth: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  getStoredUser: ReturnType<typeof vi.fn>;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
);

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with no user and loading true when no stored auth', async () => {
      mockAuthApi.getToken.mockReturnValue(null);
      mockAuthApi.getStoredUser.mockReturnValue(null);
      mockAuthApi.getMe.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.token).toBeNull();
      });
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser', is_active: true };
      const mockToken = 'test-token-123';

      mockAuthApi.getToken.mockReturnValue(null);
      mockAuthApi.getStoredUser.mockReturnValue(null);
      mockAuthApi.login.mockResolvedValue(mockToken);
      mockAuthApi.getMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(mockAuthApi.login).toHaveBeenCalledWith('testuser', 'password123');
      expect(mockAuthApi.setToken).toHaveBeenCalledWith(mockToken);
      expect(mockAuthApi.getMe).toHaveBeenCalled();
      expect(mockAuthApi.setAuth).toHaveBeenCalledWith(mockToken, mockUser);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
    });

    it('should throw error with invalid credentials', async () => {
      mockAuthApi.getToken.mockReturnValue(null);
      mockAuthApi.getStoredUser.mockReturnValue(null);
      mockAuthApi.login.mockRejectedValue(new Error('Incorrect username or password'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('wronguser', 'wrongpass');
        })
      ).rejects.toThrow('Incorrect username or password');
    });
  });

  describe('register', () => {
    it('should successfully register and auto-login', async () => {
      const mockUser = { id: 1, email: 'new@example.com', username: 'newuser', is_active: true };
      const mockToken = 'new-token-456';

      mockAuthApi.getToken.mockReturnValue(null);
      mockAuthApi.getStoredUser.mockReturnValue(null);
      mockAuthApi.register.mockResolvedValue(mockUser);
      mockAuthApi.login.mockResolvedValue(mockToken);
      mockAuthApi.getMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.register('new@example.com', 'newuser', 'password123');
      });

      expect(mockAuthApi.register).toHaveBeenCalledWith('new@example.com', 'newuser', 'password123');
      expect(mockAuthApi.login).toHaveBeenCalledWith('newuser', 'password123');
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should clear user data and token on logout', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser', is_active: true };
      const mockToken = 'test-token';

      mockAuthApi.getToken.mockReturnValue(mockToken);
      mockAuthApi.getStoredUser.mockReturnValue(mockUser);
      mockAuthApi.getMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      act(() => {
        result.current.logout();
      });

      expect(mockAuthApi.clearAuth).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  describe('token validation on mount', () => {
    it('should restore user from localStorage if token is valid', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser', is_active: true };
      const mockToken = 'stored-token';

      mockAuthApi.getToken.mockReturnValue(mockToken);
      mockAuthApi.getStoredUser.mockReturnValue(mockUser);
      mockAuthApi.getMe.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockAuthApi.getMe).toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
    });

    it('should clear invalid token from localStorage', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser', is_active: true };
      const invalidToken = 'invalid-token';

      mockAuthApi.getToken.mockReturnValue(invalidToken);
      mockAuthApi.getStoredUser.mockReturnValue(mockUser);
      mockAuthApi.getMe.mockRejectedValue(new Error('Invalid token'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockAuthApi.clearAuth).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });
});
