import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api';

interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  dark_mode?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  darkMode: boolean;
  toggleDarkMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    // Check for stored token on mount
    const storedToken = authApi.getToken();
    const storedUser = authApi.getStoredUser();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      // Default to light mode, will update after API confirms
      setDarkMode(false);
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
    } else {
      setLoading(false);
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
    const from = (location.state as any)?.from?.pathname || '/';
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
