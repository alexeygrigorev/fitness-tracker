import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api';
import { AuthContext } from './authContext';
import type { AuthUser } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authApi.getStoredUser());
  const [token, setToken] = useState<string | null>(() => authApi.getToken());
  const [loading, setLoading] = useState(() => Boolean(authApi.getToken() && authApi.getStoredUser()));
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const storedToken = authApi.getToken();
    const storedUser = authApi.getStoredUser();

    if (storedToken && storedUser) {
      // Verify token is still valid and get fresh user data
      authApi.getMe()
        .then((data) => {
          setUser(data);
          setDarkMode(data.dark_mode || false);
          authApi.setAuth(storedToken, data);
        })
        .catch(() => {
          authApi.clearAuth();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (username: string, password: string) => {
    const accessToken = await authApi.login(username, password);

    // Store token first so getMe() can use it via getHeaders()
    authApi.setToken(accessToken);
    setToken(accessToken);

    const userData = await authApi.getMe();

    setUser(userData);
    setDarkMode(userData.dark_mode || false);
    authApi.setAuth(accessToken, userData);

    // Redirect to the page they were trying to access
    interface LocationState {
      from?: { pathname?: string };
    }
    const state = location.state as LocationState | null;
    const from = state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const register = async (email: string, username: string, password: string) => {
    await authApi.register(email, username, password);
    // Auto-login after registration
    await login(username, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setDarkMode(false);
    authApi.clearAuth();
    navigate('/login', { replace: true });
  };

  const toggleDarkMode = async () => {
    const newDarkMode = !darkMode;
    // Always update local state immediately - don't revert on API error
    setDarkMode(newDarkMode);

    // Update on server if user is logged in (best effort, don't block UI)
    if (user && token) {
      authApi.updateProfile({ dark_mode: newDarkMode })
        .then((updatedUser) => {
          setUser(updatedUser);
          authApi.setAuth(token, updatedUser);
        })
        .catch((error) => {
          console.error('Failed to save dark mode preference to server', error);
        });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, darkMode, toggleDarkMode }}>
      {children}
    </AuthContext.Provider>
  );
}
