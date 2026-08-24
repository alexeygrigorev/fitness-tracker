// Authentication-related types

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  dark_mode?: boolean;
}
