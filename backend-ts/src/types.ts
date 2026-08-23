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
  name?: string;
  is_bodyweight?: boolean;
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
