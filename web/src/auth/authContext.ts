import { createContext } from 'react';
import type { User } from '@/types';
import type { ProfileUpdates } from '@/types';

export type AuthUser = User;

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  completeSharedLogin: (code: string, state: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  darkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<AuthUser>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
