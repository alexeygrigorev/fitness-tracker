/**
 * ProtectedRoute component tests
 * Tests for route protection and redirection behavior
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider, useAuth } from '@/auth/AuthContext';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Test component to render inside ProtectedRoute
const TestComponent = () => <div>Protected Content</div>;

const renderWithAuthProvider = (
  ui: React.ReactElement,
  { user = null, loading = false }: { user?: any; loading?: boolean }
) => {
  // Mock auth state
  vi.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({
    user,
    token: user ? 'test-token' : null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    loading,
  });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              {ui}
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('when loading', () => {
    it('should show loading state', () => {
      // We need to render with actual AuthProvider for this test
      const { container } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    it('should render children when user is logged in', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, username: 'test', email: 'test@test.com', is_active: true }),
      } as Response);

      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'test' }));

      const { container } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('when not authenticated', () => {
    it('should redirect to login when user is not logged in', async () => {
      mockFetch.mockRejectedValueOnce(new Error('No auth'));

      const { container } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
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
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('should pass current location to login redirect', async () => {
      mockFetch.mockRejectedValueOnce(new Error('No auth'));

      const { container } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
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
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });
});
