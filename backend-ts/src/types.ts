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
