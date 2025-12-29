// Health-related types (sleep, metabolism, advice, etc.)

export interface SleepEntry {
  id: string;
  bedTime: Date;
  wakeTime: Date;
  quality: 1 | 2 | 3 | 4 | 5;
  deepSleepHours?: number;
  remSleepHours: number;
  lightSleepHours: number;
  awakeHours: number;
  source: 'manual' | 'garmin';
  loggedAt: Date;
}

export interface MetabolismState {
  id: string;
  date: Date;
  energyAvailability: 'very_low' | 'low' | 'optimal' | 'high';
  glycogenStatus: 'depleted' | 'low' | 'moderate' | 'full';
  insulinActivity: 'low' | 'moderate' | 'high';
  recoveryStatus: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface Advice {
  id: string;
  type: 'morning' | 'pre_workout' | 'post_workout' | 'end_of_day';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  reasoning: string;
  createdAt: Date;
  acknowledged: boolean;
}

import type { WorkoutSession } from './workout';
import type { Meal } from './nutrition';

export interface DailySummary {
  date: Date;
  workouts: WorkoutSession[];
  meals: Meal[];
  sleep?: SleepEntry;
  metabolism: MetabolismState | null;
  totalCalories: number;
  totalProtein: number;
  totalVolume: number;
}
