// Authentication-related types

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  dark_mode?: boolean;
  display_name: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  goal: ProfileGoal | null;
  weekly_workouts: number | null;
}

export type ProfileGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

export interface ProfileUpdates {
  dark_mode?: boolean;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  goal?: ProfileGoal | null;
  weekly_workouts?: number | null;
}
