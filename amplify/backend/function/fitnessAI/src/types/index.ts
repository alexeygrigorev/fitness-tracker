// ============================================
// Type Definitions for Fitness AI Lambda
// ============================================

/** Supported AI actions */
export type Action = 'parseWorkout' | 'parseFood' | 'generateAdvice' | 'transcribeVoice' | 'analyzeFoodPhoto';

/** Lambda event structure from AppSync */
export interface Event {
  arguments: {
    input: {
      action: Action;
      userId: string;
      [key: string]: any;
    };
  };
}

/** Standard Lambda response structure */
export interface LambdaResponse {
  success: boolean;
  data?: any;
  error?: string;
  confidence: number;
}

// ============================================
// Workout Types
// ============================================

export interface WorkoutSet {
  weight?: number;
  reps?: number;
  setType: string;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
  primaryMuscles: string[];
  secondaryMuscles?: string[];
}

export interface ParsedWorkout {
  exercises: Exercise[];
  duration?: number;
  notes?: string;
}

// ============================================
// Food Types
// ============================================

export interface ParsedFood {
  foodName: string;
  portionSize: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  category: string;
  confidence: number;
}

// ============================================
// Food Photo Analysis Types
// ============================================

export interface FoodItem {
  name: string;
  portionSize: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: string;
}

export interface FoodAnalysis {
  foods: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  confidence: number;
}

// ============================================
// Advice Types
// ============================================

export interface Advice {
  title: string;
  message: string;
  reasoning: string;
  priority?: 'high' | 'medium' | 'low';
  actionable?: boolean;
}

export interface UserData {
  recentWorkouts?: any[];
  recentMeals?: any[];
  sleepSessions?: any[];
  currentGoals?: any[];
  userProfile?: any;
}

// ============================================
// Voice Transcription Types
// ============================================

export interface TranscriptionResult {
  text: string;
  language: string;
}
