import type { DocumentItem } from './repository.js';
import type {
  ExerciseItem,
  JsonObject,
  WorkoutSessionItem,
  WorkoutSetItem,
} from './types.js';
import { HttpError } from './types.js';

export type SetType = 'normal' | 'bodyweight' | 'dropdown' | 'warmup';

export interface DropdownWeight {
  weight: number | null;
  reps: number;
}

export interface PresetSupersetItem extends DocumentItem {
  entity_type: 'superset_item';
  id: number;
  parent_row_id: number;
  exercise_id: number;
  type: 'normal' | 'dropdown';
  dropdowns?: number | null;
  include_warmup: boolean;
  order: number;
}

export interface PresetExerciseRow extends DocumentItem {
  entity_type: 'preset_exercise';
  id: number;
  exercise_id?: number | null;
  type: 'normal' | 'dropdown' | 'superset';
  sets: number;
  dropdowns?: number | null;
  include_warmup: boolean;
  order: number;
}

export interface WorkoutPresetItem extends DocumentItem {
  entity_type: 'workout_preset';
  id: number;
  user_id?: number | null;
  name: string;
  notes?: string | null;
  status?: 'active' | 'archived';
  day_label?: string | null;
  tags?: unknown;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutPlanItem extends DocumentItem {
  entity_type: 'workout_plan';
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutPlanPresetItem extends DocumentItem {
  entity_type: 'workout_plan_preset';
  id: number;
  plan_id: number;
  preset_id: number;
  order: number;
}

let testClock: (() => number) | undefined;

/** Integration tests need deterministic workout timestamps without breaking AWS signing. */
export function setTestClock(getMilliseconds: () => number): () => void {
  const previousClock = testClock;
  testClock = getMilliseconds;
  return () => {
    testClock = previousClock;
  };
}

export function nowIso(): string {
  return new Date(testClock ? testClock() : Date.now()).toISOString();
}

function invalidRequest(payload: JsonObject): never {
  throw new HttpError(400, payload);
}

export function decimalValue(value: unknown, maxValue = 10_000): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') invalidRequest({ error: 'Invalid date or numeric value' });
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) invalidRequest({ error: 'Invalid date or numeric value' });
  const rounded = Math.round(parsed * 100) / 100;
  if (Math.abs(rounded) >= maxValue) invalidRequest({ error: 'Invalid date or numeric value' });
  return rounded;
}

export function integerValue(
  value: unknown,
  options: { allowNull?: boolean; min?: number; max?: number } = {},
): number | null {
  if (value === undefined || value === null) {
    return options.allowNull ? null : invalidRequest({ error: 'Invalid date or numeric value' });
  }
  if (typeof value === 'boolean') invalidRequest({ error: 'Invalid date or numeric value' });
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[-+]?\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) invalidRequest({ error: 'Invalid date or numeric value' });
  if (options.min !== undefined && parsed < options.min) {
    invalidRequest({ error: 'Invalid date or numeric value' });
  }
  if (options.max !== undefined && parsed > options.max) {
    invalidRequest({ error: 'Invalid date or numeric value' });
  }
  return parsed;
}

export function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    invalidRequest({ error: 'Invalid date' });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalidRequest({ error: 'Invalid date' });
  return parsed;
}

function numericDropdownField(value: unknown, field: 'weight' | 'reps'): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') invalidRequest({ dropdownWeights: ['A valid number is required.'] });
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    invalidRequest({ dropdownWeights: [`A valid ${field === 'weight' ? 'number' : 'integer'} is required.`] });
  }
  return parsed;
}

export function validateDropdownWeights(value: unknown): DropdownWeight[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    invalidRequest({ dropdownWeights: ['Must be a list of drop sets'] });
  }
  if (value.length > 20) {
    invalidRequest({ dropdownWeights: ['Too many drop sets'] });
  }
  return value.map((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      invalidRequest({ dropdownWeights: ['Invalid drop set'] });
    }
    const input = row as JsonObject;
    let weight = numericDropdownField(input.weight, 'weight');
    if (weight !== null && weight < 0) {
      invalidRequest({ dropdownWeights: ['Ensure this value is greater than or equal to 0.'] });
    }
    if (weight !== null && weight >= 10_000) {
      invalidRequest({ dropdownWeights: ['Ensure this value is less than or equal to 9999.99.'] });
    }
    const reps = numericDropdownField(input.reps ?? 0, 'reps');
    if (reps === null || !Number.isSafeInteger(reps) || reps < 0 || reps > 10_000) {
      invalidRequest({ dropdownWeights: ['A valid integer is required.'] });
    }
    return { weight, reps };
  });
}

export function setResponse(item: WorkoutSetItem): Record<string, unknown> {
  return {
    id: item.id,
    exerciseId: item.exercise_id,
    exerciseName: item.exercise_name,
    session: item.session_id,
    set_order: item.set_order,
    setType: item.set_type,
    weight: item.weight ?? null,
    reps: item.reps ?? null,
    dropdownWeights: item.dropdown_weights ?? null,
    loggedAt: item.completed_at ?? null,
  };
}

export function sessionResponse(
  session: WorkoutSessionItem,
  sets: readonly WorkoutSetItem[],
): Record<string, unknown> {
  return {
    id: session.id,
    name: session.name,
    notes: session.notes ?? null,
    bodyweight: session.bodyweight ?? null,
    startedAt: session.created_at,
    endedAt: session.finished_at ?? null,
    user: session.user_id,
    preset: session.preset_id ?? null,
    sets: sets.filter((set) => set.session_id === session.id).map(setResponse),
  };
}

export function setSortKey(set: Pick<WorkoutSetItem, 'set_order' | 'id'>): string {
  return `WORKOUT_SET#${String(set.set_order).padStart(8, '0')}#${set.id}`;
}

export function generatedSet(input: {
  id: number;
  userId: number;
  sessionId: number;
  exercise: ExerciseItem;
  setOrder: number;
  setType: SetType;
  weight?: number | null;
  reps?: number | null;
  dropdownWeights?: DropdownWeight[] | null;
  completedAt?: string | null;
}): WorkoutSetItem {
  return {
    pk: `USER#${input.userId}`,
    sk: setSortKey({ set_order: input.setOrder, id: input.id }),
    entity_type: 'workout_set',
    id: input.id,
    session_id: input.sessionId,
    user_id: input.userId,
    set_order: input.setOrder,
    exercise_id: input.exercise.id,
    exercise_name: input.exercise.name ?? '',
    set_type: input.setType,
    ...(input.weight === undefined ? {} : { weight: input.weight }),
    ...(input.reps === undefined ? {} : { reps: input.reps }),
    ...(input.dropdownWeights === undefined
      ? {}
      : { dropdown_weights: input.dropdownWeights }),
    ...(input.completedAt === undefined ? {} : { completed_at: input.completedAt }),
  };
}

export function isWorkoutPreset(item: DocumentItem): item is WorkoutPresetItem {
  return item.entity_type === 'workout_preset';
}

export function isWorkoutPlan(item: DocumentItem): item is WorkoutPlanItem {
  return item.entity_type === 'workout_plan';
}

export function isWorkoutPlanPreset(item: DocumentItem): item is WorkoutPlanPresetItem {
  return item.entity_type === 'workout_plan_preset';
}

export function isPresetExercise(item: DocumentItem): item is PresetExerciseRow {
  return item.entity_type === 'preset_exercise';
}

export function isSupersetItem(item: DocumentItem): item is PresetSupersetItem {
  return item.entity_type === 'superset_item';
}
