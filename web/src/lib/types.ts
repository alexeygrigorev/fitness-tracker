// Core domain types for the fitness tracker

export interface Exercise {
  id: string;
  name: string;
  category: 'compound' | 'isolation' | 'cardio';
  muscleGroups: MuscleGroup[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
}

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

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setType: 'normal' | 'warmup' | 'drop' | 'failure';
  weight?: number;
  reps: number;
  distance?: number;
  duration?: number;
  rpe?: number;
  notes?: string;
  loggedAt: Date;
  eventTime?: Date;
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

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  exercises: Exercise[];
}

// Food and Nutrition Types
export type FoodCategory = 'carb' | 'protein' | 'fat' | 'mixed';

export type FoodSource = 'canonical' | 'user' | 'ai_generated';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'post_workout' | 'beverage';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  brand?: string;
  barcode?: string;
  source?: FoodSource;
  servingSize: number;
  servingType: string;
  calories: number;
  fat: number;
  saturatedFat?: number;
  carbs: number;
  sugar?: number;
  fiber?: number;
  protein: number;
  sodium?: number;
  glycemicIndex?: number;
  absorptionSpeed?: 'slow' | 'moderate' | 'fast';
  insulinResponse?: number;
  satietyScore?: number;
}

export interface MealFoodItem {
  foodId: string;
  servings: number;
}

export interface Meal {
  id: string;
  name: string;
  mealType: MealCategory;
  foods: MealFoodItem[];
  loggedAt: Date;
  eventTime?: Date;
  notes?: string;
  source?: 'manual' | 'ai_assisted';
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  category: MealCategory;
  foods: MealFoodItem[];
  tags?: string[];
}

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

export interface DailySummary {
  date: Date;
  workouts: WorkoutSession[];
  meals: Meal[];
  sleep?: SleepEntry;
  metabolism: MetabolismState;
  totalCalories: number;
  totalProtein: number;
  totalVolume: number;
}
