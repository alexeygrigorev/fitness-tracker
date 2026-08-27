import type { DocumentItem } from './repository.js';
import { HttpError } from './types.js';
import type {
  ExerciseItem,
  JsonObject,
} from './types.js';
import {
  isPresetExercise,
  isSupersetItem,
  isWorkoutPreset,
  nowIso,
  type PresetExerciseRow,
  type PresetSupersetItem,
  type WorkoutPresetItem,
} from './workout-store.js';

export interface WorkoutPlanItem extends DocumentItem {
  entity_type: 'workout_plan';
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface PreparedSupersetChild {
  exercise: ExerciseItem;
  type: 'normal' | 'dropdown';
  dropdowns: number | null;
  includeWarmup: boolean;
  order: number;
}

interface PreparedPresetRow {
  id?: number;
  exercise?: ExerciseItem;
  exerciseId?: number | null;
  exerciseName?: string | null;
  type: 'normal' | 'dropdown' | 'superset';
  sets: number;
  dropdowns: number | null;
  includeWarmup: boolean;
  order: number;
  children: PreparedSupersetChild[];
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1
    ? value
    : null;
}

function invalidExercises(message: string): never {
  throw new HttpError(400, { exercises: [message] });
}

/**
 * Mirrors WorkoutPresetSerializer.validate()'s `_references_private_exercise`
 * check: a public preset must not reference any exercise owned by a user
 * (i.e. `user_id` set), since that would leak private exercise data to
 * other users through the public preset.
 */
export function assertNoPrivateExerciseInPublicPreset(
  isPublic: boolean,
  rows: readonly PreparedPresetRow[],
): void {
  if (!isPublic) return;
  const referencesPrivate = rows.some((row) =>
    (row.exercise !== undefined && row.exercise.user_id !== null && row.exercise.user_id !== undefined) ||
    row.children.some((child) =>
      child.exercise.user_id !== null && child.exercise.user_id !== undefined));
  if (referencesPrivate) {
    invalidExercises('Public presets cannot contain private exercises');
  }
}

function optionalDropdownCount(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const parsed = nonNegativeInteger(value);
  if (parsed === null) invalidExercises('Invalid dropdown count');
  return parsed;
}

export function visibleExercise(
  exercise: ExerciseItem | undefined,
  userId: number,
): exercise is ExerciseItem {
  return exercise !== undefined && (
    exercise.user_id === null ||
    exercise.user_id === undefined ||
    exercise.user_id === userId
  );
}

export async function resolveVisibleExercise(
  repository: { getExercise(id: number): Promise<ExerciseItem | undefined> },
  userId: number,
  exerciseId: unknown,
): Promise<ExerciseItem> {
  const normalizedId = typeof exerciseId === 'string' && /^[-+]?\d+$/.test(exerciseId)
    ? Number(exerciseId)
    : exerciseId;
  const exercise = typeof normalizedId === 'number' &&
      Number.isSafeInteger(normalizedId) &&
      normalizedId >= 1
    ? await repository.getExercise(normalizedId)
    : undefined;
  if (!visibleExercise(exercise, userId)) {
    invalidExercises('References an invalid or unavailable exercise');
  }
  return exercise;
}

export interface LoadedPreset {
  preset: WorkoutPresetItem;
  rows: PresetExerciseRow[];
  items: PresetSupersetItem[];
  partition: DocumentItem[];
}

export async function loadPresetPartition(
  repository: {
    get<T>(key: Record<string, unknown>): Promise<T | undefined>;
    queryPartition<T>(input: {
      partitionKey: string;
      sortPrefix?: string;
    }): Promise<T[]>;
    getExercise(id: number): Promise<ExerciseItem | undefined>;
  },
  userId: number,
  presetId: number,
): Promise<LoadedPreset> {
  const preset = await repository.get<WorkoutPresetItem>({
    pk: `PRESET#${presetId}`,
    sk: 'METADATA',
  });
  if (!preset || !isWorkoutPreset(preset)) {
    throw new HttpError(404, { detail: 'Not found.' });
  }

  const partition = await repository.queryPartition<DocumentItem>({
    partitionKey: `PRESET#${presetId}`,
  });
  const rows = partition.filter(isPresetExercise);
  const items = partition.filter(isSupersetItem);
  for (const row of rows) {
    if (row.type === 'superset') {
      for (const item of items.filter((child) => child.parent_row_id === row.id)) {
        if (!visibleExercise(await repository.getExercise(item.exercise_id), userId)) {
          throw new HttpError(403, { error: 'Preset contains an unavailable exercise' });
        }
      }
    } else if (!visibleExercise(
      await repository.getExercise(row.exercise_id ?? -1),
      userId,
    )) {
      throw new HttpError(403, { error: 'Preset contains an unavailable exercise' });
    }
  }
  return {
    preset,
    rows: rows.sort((left, right) => left.order - right.order || left.id - right.id),
    items: items.sort((left, right) => left.order - right.order || left.id - right.id),
    partition,
  };
}

function validateChild(
  resolveExercise: (value: unknown) => Promise<ExerciseItem>,
  value: JsonObject,
  location: string,
): Promise<PreparedSupersetChild> {
  const type = value.type ?? 'normal';
  if (type !== 'normal' && type !== 'dropdown') {
    invalidExercises(`${location} has an invalid type`);
  }
  const dropdowns = optionalDropdownCount(value.dropdowns);
  if (dropdowns === null && type === 'dropdown') {
    invalidExercises(`${location} must have a non-negative dropdown count`);
  }
  const includeWarmup = value.includeWarmup ?? false;
  if (typeof includeWarmup !== 'boolean') {
    invalidExercises(`${location} has an invalid warmup flag`);
  }
  const order = nonNegativeInteger(value.order);
  if (order === null) {
    invalidExercises(`${location} has an invalid order`);
  }
  return resolveExercise(value.exerciseId).then((exercise) => ({
    exercise,
    type,
    dropdowns,
    includeWarmup,
    order,
  }));
}

export async function validatePresetExercises(
  repository: { getExercise(id: number): Promise<ExerciseItem | undefined> },
  userId: number,
  value: unknown,
  existingRows: readonly PresetExerciseRow[],
): Promise<PreparedPresetRow[]> {
  if (value === undefined) invalidExercises('Must be a list of exercise objects');
  if (!Array.isArray(value)) invalidExercises('Must be a list of exercise objects');

  const existingIds = new Set(existingRows.map((row) => row.id));
  const seenIds = new Set<number>();
  const rows: PreparedPresetRow[] = [];
  for (const [index, raw] of value.entries()) {
    const location = `exercises[${index}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      invalidExercises(`${location} must be an object`);
    }
    const input = raw as JsonObject;
    const type = input.type ?? 'normal';
    if (type !== 'normal' && type !== 'dropdown' && type !== 'superset') {
      invalidExercises(`${location} has an invalid type`);
    }
    const sets = positiveInteger(input.sets ?? 3);
    if (sets === null) {
      invalidExercises(`${location} must have a positive number of sets`);
    }
    const dropdowns = optionalDropdownCount(input.dropdowns);
    if (dropdowns === null && type === 'dropdown') {
      invalidExercises(`${location} must have a non-negative dropdown count`);
    }
    const includeWarmup = input.includeWarmup ?? false;
    if (typeof includeWarmup !== 'boolean') {
      invalidExercises(`${location} has an invalid warmup flag`);
    }
    const order = input.order === undefined ? index : nonNegativeInteger(input.order);
    if (order === null) {
      invalidExercises(`${location} has an invalid order`);
    }

    let rowId: number | undefined;
    const rawId = input.id;
    const candidateId = typeof rawId === 'number' && Number.isSafeInteger(rawId)
      ? rawId
      : typeof rawId === 'string' && /^[-+]?\d+$/.test(rawId)
        ? Number(rawId)
        : null;
    if (candidateId !== null && existingIds.has(candidateId)) {
      if (seenIds.has(candidateId)) {
        invalidExercises(`${location} contains a duplicate exercise row ID`);
      }
      seenIds.add(candidateId);
      rowId = candidateId;
    }

    const resolveExercise = (exerciseId: unknown) =>
      resolveVisibleExercise(repository, userId, exerciseId);
    const children = type === 'superset'
      ? await Promise.all(
        (Array.isArray(input.supersetExercises) ? input.supersetExercises : []).map(
          (child, childIndex) => {
            if (typeof child !== 'object' || child === null || Array.isArray(child)) {
              invalidExercises(`${location}.supersetExercises[${childIndex}] must be an object`);
            }
            return validateChild(
              resolveExercise,
              child as JsonObject,
              `${location}.supersetExercises[${childIndex}]`,
            );
          },
        ),
      )
      : [];
    if (type === 'superset' && children.length === 0) {
      invalidExercises(`${location} must contain at least one superset exercise`);
    }
    const exercise = type === 'superset'
      ? undefined
      : await resolveExercise(input.exerciseId);
    rows.push({
      ...(rowId === undefined ? {} : { id: rowId }),
      ...(exercise === undefined ? {} : { exercise }),
      type,
      sets,
      dropdowns,
      includeWarmup,
      order,
      children,
    });
  }
  return rows;
}

export function presetMetadataInput(value: JsonObject, isPublicDefault = false): {
  name: string;
  notes: string | null;
  dayLabel: string | null;
  tags: unknown[];
  isPublic: boolean;
} {
  const name = value.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new HttpError(400, { name: ['This field may not be blank.'] });
  }
  const notes = value.notes ?? null;
  const dayLabel = value.dayLabel ?? null;
  const tags = value.tags ?? [];
  const isPublic = value.is_public ?? isPublicDefault;
  if ((notes !== null && typeof notes !== 'string') ||
      (dayLabel !== null && typeof dayLabel !== 'string') ||
      !Array.isArray(tags) ||
      typeof isPublic !== 'boolean') {
    throw new HttpError(400, { detail: 'Invalid preset' });
  }
  return {
    name,
    notes,
    dayLabel,
    tags,
    isPublic,
  };
}

export interface MaterializedPreset {
  metadata: WorkoutPresetItem;
  rows: PresetExerciseRow[];
  children: PresetSupersetItem[];
}

export async function materializePreset(
  repository: { nextId(entity: string): Promise<number> },
  input: {
    userId: number;
    name: string;
    notes: string | null;
    dayLabel: string | null;
    tags: unknown[];
    isPublic: boolean;
    rows: readonly PreparedPresetRow[];
  },
): Promise<MaterializedPreset> {
  const timestamp = nowIso();
  const presetId = await repository.nextId('preset');
  const metadata: WorkoutPresetItem = {
    pk: `PRESET#${presetId}`,
    sk: 'METADATA',
    entity_type: 'workout_preset',
    id: presetId,
    user_id: input.userId,
    name: input.name,
    notes: input.notes,
    status: 'active',
    day_label: input.dayLabel,
    tags: input.tags,
    is_public: input.isPublic,
    created_at: timestamp,
    updated_at: timestamp,
  };
  return appendPresetRows(repository, metadata, input.rows);
}

export async function appendPresetRows(
  repository: { nextId(entity: string): Promise<number> },
  metadata: WorkoutPresetItem,
  rows: readonly PreparedPresetRow[],
): Promise<MaterializedPreset> {
  const output: MaterializedPreset = { metadata, rows: [], children: [] };
  for (const row of rows) {
    const rowId = row.id ?? await repository.nextId('preset_exercise');
    output.rows.push({
      pk: `PRESET#${metadata.id}`,
      sk: `PRESET_EXERCISE#${rowId}`,
      entity_type: 'preset_exercise',
      id: rowId,
      parent_preset_id: metadata.id,
      exercise_id: row.exercise?.id ?? row.exerciseId ?? null,
      exercise_name: row.exercise?.name ?? row.exerciseName ?? null,
      type: row.type,
      sets: row.sets,
      dropdowns: row.dropdowns,
      include_warmup: row.includeWarmup,
      order: row.order,
    });
    for (const child of row.children) {
      const childId = await repository.nextId('superset_item');
      output.children.push({
        pk: `PRESET#${metadata.id}`,
        sk: `SUPERSET_ITEM#${rowId}#${childId}`,
        entity_type: 'superset_item',
        id: childId,
        parent_row_id: rowId,
        parent_preset_id: metadata.id,
        exercise_id: child.exercise.id,
        type: child.type,
        dropdowns: child.dropdowns,
        include_warmup: child.includeWarmup,
        order: child.order,
      });
    }
  }
  return output;
}

export function serializePreset(
  loaded: {
    preset: WorkoutPresetItem;
    rows: readonly PresetExerciseRow[];
    items?: readonly PresetSupersetItem[];
    children?: readonly PresetSupersetItem[];
  },
  options: {
    lastUsedWeights?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  const supersetItems = [...(loaded.items ?? []), ...(loaded.children ?? [])];
  return {
    id: loaded.preset.id,
    user_id: loaded.preset.user_id ?? null,
    user: loaded.preset.user_id ?? null,
    name: loaded.preset.name,
    notes: loaded.preset.notes ?? null,
    status: loaded.preset.status ?? 'active',
    dayLabel: loaded.preset.day_label ?? null,
    tags: loaded.preset.tags ?? [],
    is_public: loaded.preset.is_public === true,
    created_at: loaded.preset.created_at ?? null,
    updated_at: loaded.preset.updated_at ?? null,
    exercises: loaded.rows.map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id ?? null,
      exerciseName: row.type === 'superset' ? null : row.exercise_name,
      type: row.type,
      sets: row.sets,
      dropdowns: row.dropdowns ?? null,
      includeWarmup: row.include_warmup === true,
      order: row.order,
      supersetExercises: supersetItems
        .filter((item) => item.parent_row_id === row.id)
        .map((item) => ({
          id: item.id,
          exerciseId: item.exercise_id,
          type: item.type,
          dropdowns: item.dropdowns ?? null,
          includeWarmup: item.include_warmup === true,
          order: item.order,
        })),
    })),
    lastUsedWeights: options.lastUsedWeights ?? {},
  };
}

export function lastUsedWeightsFor(
  loaded: {
    rows: readonly PresetExerciseRow[];
    items?: readonly PresetSupersetItem[];
    children?: readonly PresetSupersetItem[];
  },
  settings: Record<string, object>,
): Record<string, object> {
  const exerciseIds = new Set<number>();
  for (const row of loaded.rows) {
    if (row.exercise_id !== null && row.exercise_id !== undefined) {
      exerciseIds.add(row.exercise_id);
    }
  }
  for (const item of [...(loaded.items ?? []), ...(loaded.children ?? [])]) {
    exerciseIds.add(item.exercise_id);
  }
  return Object.fromEntries(
    Object.entries(settings).filter(([exerciseId]) =>
      exerciseIds.has(Number(exerciseId))),
  );
}

export async function copyPresetItems(
  repository: {
    nextId(entity: string): Promise<number>;
    getExercise(id: number): Promise<ExerciseItem | undefined>;
  },
  source: LoadedPreset,
  userId: number,
): Promise<MaterializedPreset> {
  const timestamp = nowIso();
  const presetId = await repository.nextId('preset');
  const metadata: WorkoutPresetItem = {
    pk: `PRESET#${presetId}`,
    sk: 'METADATA',
    entity_type: 'workout_preset',
    id: presetId,
    user_id: userId,
    name: source.preset.name,
    notes: source.preset.notes ?? null,
    status: 'active',
    day_label: source.preset.day_label ?? null,
    tags: source.preset.tags ?? [],
    is_public: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const prepared: PreparedPresetRow[] = [];
  for (const row of source.rows) {
    const exercise = row.exercise_id === null || row.exercise_id === undefined
      ? undefined
      : await repository.getExercise(row.exercise_id);
    prepared.push({
      ...(exercise === undefined ? {} : { exercise }),
      type: row.type,
      sets: row.sets,
      dropdowns: row.dropdowns ?? null,
      includeWarmup: row.include_warmup === true,
      order: row.order,
      children: source.items
        .filter((item) => item.parent_row_id === row.id)
        .map((item) => ({
          exercise: { id: item.exercise_id } as ExerciseItem,
          type: item.type,
          dropdowns: item.dropdowns ?? null,
          includeWarmup: item.include_warmup === true,
          order: item.order,
        })),
    });
  }
  return appendPresetRows(repository, metadata, prepared);
}
