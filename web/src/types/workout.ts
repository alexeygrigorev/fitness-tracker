// Workout-related types

export type SetType = 'warmup' | 'normal' | 'bodyweight' | 'dropdown' | 'superset';

export type PresetExerciseType = 'warmup' | 'normal' | 'bodyweight' | 'dropdown' | 'superset';

export interface WorkoutSet {
  id: number;
  exerciseId: number;
  exerciseName?: string;
  session?: number;
  set_order?: number;
  setType: SetType;
  weight?: number | null;
  reps: number;
  dropdownWeights?: Array<{ weight: number; reps: number }> | null;
  loggedAt: string | null; // ISO timestamp or null
}

export interface WorkoutSession {
  id: number;
  name: string;
  notes?: string;
  bodyweight?: number | null;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  user?: number;
  preset?: number;
  sets: WorkoutSet[];
  totalVolume?: number;
  estimatedRecovery?: number;
}

export interface SupersetExerciseItem {
  id: number;
  exerciseId: number;
  type: SetType;
  dropdowns?: number;
  includeWarmup: boolean;
  order: number;
}

export interface WorkoutPresetExercise {
  id: number;
  exerciseId: number;
  type: PresetExerciseType;
  sets: number;
  dropdowns?: number;
  includeWarmup: boolean;
  order: number;
  supersetExercises?: SupersetExerciseItem[];
}

// Frontend-only preset type that allows string IDs for special cases like "freestyle"
export interface WorkoutPreset {
  id: number;
  user_id?: number;
  user?: number;
  name: string;
  notes?: string;
  status: 'active' | 'archived';
  dayLabel?: string;
  tags?: string[];
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  exercises: WorkoutPresetExercise[];
  lastUsedWeights?: Record<number, { weight?: number; reps: number; subSets?: Array<{ weight: number; reps: number }> }>;
}

export interface WorkoutPlan {
  id: number;
  name: string;
  description?: string;
}
