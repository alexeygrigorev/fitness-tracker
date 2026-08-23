export interface ApiUser {
  id: number;
  username: string;
  email: string;
  dark_mode: boolean;
}

export interface UserItem {
  pk: string;
  sk: string;
  id: number;
  username: string;
  email: string;
  password: string;
  dark_mode: boolean;
  is_active: boolean;
  date_joined?: string;
}

export interface ExerciseItem {
  pk: string;
  sk: string;
  id: number;
  user_id?: number | null;
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

export type FoodSource =
  | 'canonical'
  | 'user'
  | 'ai_generated';

export type MealSource =
  | 'manual'
  | 'ai_assisted';

export interface FoodItemRecord {
  pk: string;
  sk: string;
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
  glycemic_index: number | null;
  absorption_speed: 'slow' | 'moderate' | 'fast' | null;
  insulin_response: number | null;
  satiety_score: number | null;
  protein_quality: number | null;
  category: FoodCategory | '' | null;
}

export interface AccessIndexRecord {
  pk: string;
  sk: string;
  id: number;
}

export interface NestedFoodItemRecord {
  id: number;
  food_id: number;
  grams: number;
  order: number;
}

export interface MealRecord {
  pk: string;
  sk: string;
  id: number;
  user_id: number;
  name: string;
  meal_type: string;
  date: string;
  logged_at: string;
  event_time: string | null;
  notes: string | null;
  source: MealSource;
  food_items: NestedFoodItemRecord[];
}

export interface MealTemplateRecord {
  pk: string;
  sk: string;
  id: number;
  user_id: number;
  name: string;
  category: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  food_items: NestedFoodItemRecord[];
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
  isBase64Encoded: false;
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
