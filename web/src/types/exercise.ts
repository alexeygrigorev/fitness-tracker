// Exercise-related types

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'traps'
  | 'lats';

export interface Exercise {
  id: string;
  name: string;
  category?: 'compound' | 'isolation' | 'cardio'; // Optional - not always set from backend
  muscleGroups?: string[]; // Optional - array of muscle group names
  equipment?: string | null; // Single equipment name or null
  instructions?: string[]; // Optional - not stored in backend yet
  bodyweight?: boolean; // True for exercises like pullups, pushups, dips
}
