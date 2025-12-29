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
  category: 'compound' | 'isolation' | 'cardio';
  muscleGroups: MuscleGroup[];
  equipment: string[];
  instructions: string[];
  bodyweight?: boolean; // True for exercises like pullups, pushups, dips
}
