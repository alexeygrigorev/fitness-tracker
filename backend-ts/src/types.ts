export interface ApiUser {
  id: number;
  username: string;
  email: string;
  dark_mode: boolean;
  display_name: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  goal: ProfileGoal | null;
  weekly_workouts: number | null;
}

export type ProfileGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

export interface UserItem {
  pk: string;
  sk: string;
  id: number;
  username: string;
  email: string;
  password: string;
  cognito_sub?: string;
  display_name?: string;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  goal?: ProfileGoal | null;
  weekly_workouts?: number | null;
  dark_mode: boolean;
  is_active: boolean;
  date_joined?: string;
}

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio';

export interface ExerciseItem {
  pk: string;
  sk: string;
  id: number;
  user_id?: number | null;
  name?: string;
  muscle_groups?: string[];
  equipment_name?: string | null;
  category?: ExerciseCategory;
  instructions: unknown;
  is_compound?: boolean;
  is_bodyweight?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExerciseSettingsItem {
  pk: string;
  sk: string;
  exercise_id: number;
  weight?: number | null;
  reps: number;
  sub_sets: Array<{
    weight?: number | null;
    reps: number;
  }>;
}

export type FoodCategory =
  | 'carb'
  | 'protein'
  | 'fat'
  | 'mixed'
  | 'beverage';

export type FoodSource = 'canonical' | 'user' | 'ai_generated';

export type MealSource = 'manual' | 'ai_assisted';

export interface FoodItemRecord {
  pk: string;
  sk: string;
  entity_type?: 'food_item';
  id: number;
  user_id: number | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  category: FoodCategory | '' | null;
  glycemic_index: number | null;
  // This field accepts custom non-empty values, even though seed data normally
  // uses these three labels.
  absorption_speed: string | null;
  insulin_response: number | null;
  satiety_score: number | null;
  protein_quality: number | null;
}

export interface NestedFoodItemRecord {
  pk: string;
  sk: string;
  entity_type: 'meal_food_item' | 'meal_template_food_item';
  id: number;
  meal_id?: number;
  template_id?: number;
  food_id: number;
  grams: number;
  order: number;
}

export interface MealRecord {
  pk: string;
  sk: string;
  entity_type: 'meal';
  id: number;
  user_id: number;
  name: string;
  meal_type: string;
  date: string;
  logged_at: string;
  event_time: string | null;
  notes: string | null;
  source: MealSource;
  food_item_ids: number[];
}

export interface MealTemplateRecord {
  pk: string;
  sk: string;
  entity_type: 'meal_template';
  id: number;
  user_id: number;
  name: string;
  category: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  food_item_ids: number[];
}

export type WorkoutSetType = 'normal' | 'bodyweight' | 'dropdown' | 'warmup';

export interface WorkoutSessionItem {
  pk: string;
  sk: string;
  entity_type: 'workout_session';
  id: number;
  user_id: number;
  preset_id?: number;
  name: string;
  notes?: string | null;
  bodyweight?: number | null;
  created_at: string;
  finished_at?: string | null;
}

export interface WorkoutSetItem {
  pk: string;
  sk: string;
  entity_type: 'workout_set';
  id: number;
  session_id: number;
  user_id: number;
  set_order: number;
  exercise_id: number;
  exercise_name: string;
  set_type: WorkoutSetType;
  weight?: number | null;
  reps?: number | null;
  bodyweight?: number | null;
  dropdown_weights?: Array<{ weight?: number | null; reps: number }> | null;
  completed_at?: string | null;
}

export type JsonObject = Record<string, unknown>;

export interface NormalizedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  origin?: string;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

export class HttpError extends Error {
  readonly status: number;
  readonly payload: JsonObject;

  constructor(status: number, payload: JsonObject) {
    super(JSON.stringify(payload));
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}
