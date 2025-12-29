import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api';

interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = authApi.getToken();
    const storedUser = authApi.getStoredUser();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      // Verify token is still valid
      authApi.getMe()
        .then((data) => {
          setUser(data);
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
    authApi.clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
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
