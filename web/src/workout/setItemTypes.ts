export interface SetFormData {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number }>;
}

export interface LastUsedData {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number }>;
}

export interface SetData {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exercise: import('../types').Exercise;
  setNumber: number;
  completed: boolean;
  completedAt?: Date;
  isBodyweight: boolean;
  suggestedWeight?: number;
  isExtra?: boolean;
  isSuperset?: boolean;
  originalIndex?: number;
  workoutSetId?: string;  // Database ID of this set (for individual API calls)
  originalWorkoutSetId?: string;  // Kept for backward compatibility
  alreadySaved?: boolean;
  bodyweight?: number;  // User's bodyweight during bodyweight exercises
}
