// Workout-related types

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setType: 'normal' | 'warmup' | 'bodyweight' | 'dropdown';
  weight?: number;
  reps: number;
  bodyweight?: number;  // User's bodyweight at time of completing exercise
  dropdownWeights?: Array<{ weight: number; reps: number }>;  // For dropdown sets
  loggedAt?: Date;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  sets: WorkoutSet[];
  notes?: string;
  totalVolume?: number;
  estimatedRecovery?: number;
}

export interface WorkoutSessionCreate {
  name: string;
  startedAt: Date;
  endedAt?: Date;
  sets: WorkoutSet[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  exercises: string[]; // Array of exercise IDs
}

// Preset Training Day (template for a workout session)
export type PresetExerciseType = 'normal' | 'dropdown' | 'superset' | 'warmup' | 'bodyweight';

export interface PresetExerciseItem {
  exerciseId: string;
  type: 'normal' | 'dropdown';
  sets: number;
  dropdowns?: number; // Only used for dropdown type - weight drops per set
  warmup?: boolean; // Whether to include warmup sets for this exercise
}

export interface WorkoutPresetExercise {
  id: string; // for grouping (especially superset)
  type: PresetExerciseType;
  exerciseId?: string; // for non-superset exercises
  exercises?: PresetExerciseItem[]; // for superset: list of exercises in the superset
  sets?: number; // for non-superset exercises
  dropdowns?: number; // for dropdown type: weight drops per set
  warmup?: boolean; // Whether to include warmup sets for this exercise
}

export type WorkoutTag = 'strength' | 'cardio' | 'mixed';

// Last used weights for an exercise (from ExerciseSettings)
export interface LastUsedWeights {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number }>;
}

export interface WorkoutPreset {
  id: string;
  name: string; // e.g., "Upper Body Day 1"
  dayLabel?: string; // e.g., "Monday"
  exercises: WorkoutPresetExercise[]; // Ordered list of planned exercises
  tags?: WorkoutTag[];
  status?: 'active' | 'archived';
  lastUsedWeights?: Record<string, LastUsedWeights>; // exercise_id -> last used weights/reps
}
