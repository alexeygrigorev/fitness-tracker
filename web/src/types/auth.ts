// Authentication-related types

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}
