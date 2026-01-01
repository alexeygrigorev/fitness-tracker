/**
 * ProtectedRoute component tests
 * Tests for route protection and redirection behavior
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import * as AuthContext from '@/auth/AuthContext';

// Mock the AuthContext
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAuth = vi.spyOn(AuthContext, 'useAuth');

// Test component to render inside ProtectedRoute
const TestComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when loading', () => {
    it('should show loading state', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        loading: true,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    it('should render children when user is logged in', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, username: 'test' },
        token: 'test-token',
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('when not authenticated', () => {
    it('should redirect to login when user is not logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should pass current location to login redirect', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={<div data-testid="login-page">Login Page</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });
});
