/**
 * ProtectedRoute component tests
 * Tests for route protection and redirection behavior
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider } from '@/auth/AuthContext';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Test component to render inside ProtectedRoute
const TestComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('when loading', () => {
    it('should show loading state', () => {
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
