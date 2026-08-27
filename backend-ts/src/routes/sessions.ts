import type { JsonObject } from '../types.js';
import { HttpError } from '../types.js';
import { emptyResponse, jsonResponse } from '../http.js';
import { ValidationFailure } from '../validation.js';
import type {
  ExerciseItem,
  WorkoutSessionItem,
  WorkoutSetItem,
} from '../types.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';
import {
  decimalValue,
  generatedSet,
  integerValue,
  isPresetExercise,
  isSupersetItem,
  isWorkoutPreset,
  nowIso,
  parseDate,
  sessionResponse,
  setResponse,
  setSortKey,
  validateDropdownWeights,
  type DropdownWeight,
  type PresetExerciseRow,
  type SetType,
  type WorkoutPresetItem,
} from '../workout-store.js';

type RequestData = JsonObject;

interface PreparedInputSet {
  exercise: ExerciseItem;
  setOrder: number;
  setType: SetType;
  weight?: number | null;
  reps?: number | null;
  dropdownWeights?: unknown;
  loggedAt?: Date | null;
}

const SET_TYPES: ReadonlySet<string> = new Set([
  'normal',
  'bodyweight',
  'dropdown',
  'warmup',
]);

function body(request: RouteContext['request']): RequestData {
  if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body)) {
    throw new HttpError(400, { error: 'Invalid workout' });
  }
  return request.body as RequestData;
}

/** Preferred contract keys are authoritative even when their value is null. */
function preferredInput(
  data: RequestData,
  preferred: string,
  alias: string,
): unknown {
  return preferred in data ? data[preferred] : data[alias];
}

function sortSets(sets: WorkoutSetItem[]): WorkoutSetItem[] {
  return [...sets].sort((left, right) =>
    left.set_order - right.set_order || left.id - right.id);
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[-+]?\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  return typeof parsed === 'number' &&
    Number.isSafeInteger(parsed) &&
    parsed >= 1
    ? parsed
    : null;
}

async function userWorkouts(
  context: RouteContext,
  userId: number,
): Promise<{ sessions: WorkoutSessionItem[]; sets: WorkoutSetItem[] }> {
  const [sessions, sets] = await Promise.all([
    context.repository.queryPartition<WorkoutSessionItem>({
      partitionKey: `USER#${userId}`,
      sortPrefix: 'SESSION#',
    }),
    context.repository.queryPartition<WorkoutSetItem>({
      partitionKey: `USER#${userId}`,
      sortPrefix: 'WORKOUT_SET#',
    }),
  ]);
  return {
    sessions: sessions.filter((item) => item.entity_type === 'workout_session'),
    sets: sets.filter((item) => item.entity_type === 'workout_set'),
  };
}

async function getSession(
  context: RouteContext,
  sessionId: number,
): Promise<{ session: WorkoutSessionItem; sets: WorkoutSetItem[] }> {
  const user = await context.requireUser();
  const workouts = await userWorkouts(context, user.id);
  const session = workouts.sessions.find((item) => item.id === sessionId);
  if (!session) throw new HttpError(404, { detail: 'Not found.' });
  return {
    session,
    sets: sortSets(workouts.sets.filter((item) => item.session_id === sessionId)),
  };
}

async function getUserSet(
  context: RouteContext,
  setId: number,
): Promise<WorkoutSetItem> {
  const user = await context.requireUser();
  const sets = await context.repository.queryPartition<WorkoutSetItem>({
    partitionKey: `USER#${user.id}`,
    sortPrefix: 'WORKOUT_SET#',
  });
  const found = sets.find((item) => item.entity_type === 'workout_set' && item.id === setId);
  if (!found) throw new HttpError(404, { detail: 'Not found.' });
  return found;
}

async function getSessionSet(
  context: RouteContext,
  sessionId: number,
  setId: number,
): Promise<WorkoutSetItem> {
  const { sets } = await getSession(context, sessionId);
  const found = sets.find((item) => item.id === setId);
  if (!found) {
    throw new HttpError(404, { error: 'Set not found in this session' });
  }
  return found;
}

function visibleExercise(exercise: ExerciseItem | undefined, userId: number): boolean {
  return exercise !== undefined &&
    (exercise.user_id === null || exercise.user_id === undefined || exercise.user_id === userId);
}

async function accessibleExercise(
  context: RouteContext,
  userId: number,
  exerciseId: unknown,
): Promise<ExerciseItem> {
  const normalizedId = integerValue(exerciseId, { min: 1 });
  const exercise = normalizedId === null
    ? undefined
    : await context.repository.getExercise(normalizedId);
  if (!visibleExercise(exercise, userId)) {
    throw new HttpError(400, { sets: ['Invalid or unavailable exercise'] });
  }
  return exercise as ExerciseItem;
}

async function loadPreset(
  context: RouteContext,
  userId: number,
  presetId: number,
): Promise<{ preset: WorkoutPresetItem; rows: PresetExerciseRow[] }> {
  const presetItem = await context.repository.get({
    pk: `PRESET#${presetId}`,
    sk: 'METADATA',
  }) as WorkoutPresetItem | undefined;
  if (!presetItem || !isWorkoutPreset(presetItem)) {
    throw new HttpError(404, { error: 'Preset not found' });
  }
  const accessible = presetItem.user_id === null || presetItem.user_id === undefined ||
    presetItem.user_id === userId || presetItem.is_public === true;
  if (!accessible) throw new HttpError(404, { error: 'Preset not found' });

  const partitionItems = await context.repository.queryPartition({
    partitionKey: `PRESET#${presetId}`,
  });
  const rows = partitionItems
    .filter(isPresetExercise)
    .sort((left, right) => left.order - right.order || left.id - right.id);
  for (const row of rows) {
    if (row.type === 'superset') {
      const items = partitionItems.filter(isSupersetItem)
        .filter((item) => item.parent_row_id === row.id)
        .sort((left, right) => left.order - right.order || left.id - right.id);
      for (const item of items) {
        const exercise = await context.repository.getExercise(item.exercise_id);
        if (!visibleExercise(exercise, userId)) {
          throw new HttpError(403, { error: 'Preset contains an unavailable exercise' });
        }
      }
    } else {
      const exercise = row.exercise_id === null || row.exercise_id === undefined
        ? undefined
        : await context.repository.getExercise(row.exercise_id);
      if (!visibleExercise(exercise, userId)) {
        throw new HttpError(403, { error: 'Preset contains an unavailable exercise' });
      }
    }
  }
  return { preset: presetItem, rows };
}

function preparedSetFromRequest(
  exercise: ExerciseItem,
  input: RequestData,
  fallbackOrder: number,
): PreparedInputSet {
  const setOrder = integerValue(input.set_order ?? fallbackOrder, { min: 0 }) as number;
  const requestedType = 'setType' in input
    ? input.setType
    : input.set_type ?? 'normal';
  if (typeof requestedType !== 'string' || !SET_TYPES.has(requestedType)) {
    throw new HttpError(400, { error: 'Invalid date or numeric value' });
  }
  return {
    exercise,
    setOrder,
    setType: requestedType as SetType,
    weight: decimalValue(input.weight),
    reps: integerValue(input.reps, { allowNull: true }),
    dropdownWeights: preferredInput(input, 'dropdownWeights', 'dropdown_weights') ?? null,
    loggedAt: parseDate(input.loggedAt),
  };
}

async function prepareInputSets(
  context: RouteContext,
  userId: number,
  inputData: readonly unknown[],
): Promise<PreparedInputSet[]> {
  const prepared: PreparedInputSet[] = [];
  for (const [index, rawSet] of inputData.entries()) {
    if (typeof rawSet !== 'object' || rawSet === null || Array.isArray(rawSet)) {
      throw new HttpError(400, { error: 'Invalid sets' });
    }
    const input = rawSet as RequestData;
    const exercise = await accessibleExercise(
      context,
      userId,
      preferredInput(input, 'exerciseId', 'exercise_id'),
    );
    prepared.push(preparedSetFromRequest(exercise, input, index));
  }
  return prepared;
}

async function createWorkout(
  context: RouteContext,
  session: Omit<WorkoutSessionItem, 'pk' | 'sk'>,
  inputs: readonly PreparedInputSet[],
): Promise<{ item: WorkoutSessionItem; sets: WorkoutSetItem[] }> {
  const sessionId = await context.repository.nextId('workout_session');
  const item: WorkoutSessionItem = {
    pk: `USER#${session.user_id}`,
    sk: `SESSION#${String(sessionId).padStart(8, '0')}`,
    ...session,
    id: sessionId,
  };
  const sets: WorkoutSetItem[] = [];
  for (const input of inputs) {
    const setId = await context.repository.nextId('workout_set');
    sets.push(generatedSet({
      id: setId,
      userId: session.user_id,
      sessionId,
      exercise: input.exercise,
      setOrder: input.setOrder,
      setType: input.setType,
      ...(input.weight === undefined ? {} : { weight: input.weight }),
      ...(input.reps === undefined ? {} : { reps: input.reps }),
      dropdownWeights: (input.dropdownWeights ?? null) as DropdownWeight[] | null,
      ...(input.loggedAt ? { completedAt: input.loggedAt.toISOString() } : {}),
    }));
  }
  await context.repository.putAllTransactionally([item, ...sets]);
  return { item, sets: sortSets(sets) };
}

function startedWorkoutResponse(
  session: WorkoutSessionItem,
  sets: readonly WorkoutSetItem[],
): Record<string, unknown> {
  const serialized = sessionResponse(session, sets);
  return {
    session: {
      id: serialized.id,
      name: serialized.name,
      notes: serialized.notes,
      bodyweight: serialized.bodyweight,
      startedAt: serialized.startedAt,
      endedAt: serialized.endedAt,
      user_id: serialized.user,
      preset_id: serialized.preset,
    },
    sets: serialized.sets,
  };
}

function addValidationError(errors: JsonObject, field: string, message: string): void {
  const existing = errors[field];
  if (Array.isArray(existing)) existing.push(message);
  else errors[field] = [message];
}

function dateTimeUpdate(
  errors: JsonObject,
  field: string,
  value: unknown,
  allowNull = false,
): Date | null | undefined {
  if (value === null) {
    if (allowNull) return null;
    addValidationError(errors, field, 'This field may not be null.');
    return undefined;
  }
  try {
    return parseDate(value);
  } catch {
    addValidationError(
      errors,
      field,
      'Datetime has wrong format. Use one of these formats instead: %Y-%m-%dT%H:%M:%S%z.',
    );
    return undefined;
  }
}

interface SetScalarUpdates {
  weight?: number | null;
  reps?: number | null;
  dropdownWeights?: Array<{ weight?: number | null; reps: number }> | null;
}

interface SessionWriteUpdates {
  name?: string;
  notes?: string | null;
  bodyweight?: number | null;
  startedAt?: Date;
  endedAt?: Date | null;
}

function validateSessionUpdates(
  data: RequestData,
  partial: boolean,
): SessionWriteUpdates {
  const errors: JsonObject = {};
  const updates: SessionWriteUpdates = {};

  if (!partial || 'name' in data) {
    const value = data.name;
    if (value === undefined) {
      addValidationError(errors, 'name', 'This field is required.');
    } else if (typeof value !== 'string') {
      addValidationError(errors, 'name', 'A valid string is required.');
    } else if (value.trim().length === 0) {
      addValidationError(errors, 'name', 'This field may not be blank.');
    } else if (value.length > 255) {
      addValidationError(
        errors,
        'name',
        'Ensure this field has no more than 255 characters.',
      );
    } else {
      updates.name = value.trim();
    }
  }

  if ('notes' in data) {
    const value = data.notes;
    if (value !== null && typeof value !== 'string') {
      addValidationError(errors, 'notes', 'A valid string is required.');
    } else {
      updates.notes = typeof value === 'string' ? value.trim() : value;
    }
  }

  if ('bodyweight' in data) {
    try {
      updates.bodyweight = decimalValue(data.bodyweight);
    } catch {
      addValidationError(errors, 'bodyweight', 'A valid number is required.');
    }
  }

  if (!partial || 'startedAt' in data) {
    if (!('startedAt' in data)) {
      addValidationError(errors, 'startedAt', 'This field is required.');
    } else {
      const startedAt = dateTimeUpdate(errors, 'startedAt', data.startedAt);
      if (startedAt instanceof Date) updates.startedAt = startedAt;
    }
  }

  if (!partial || 'endedAt' in data) {
    if (!('endedAt' in data)) {
      addValidationError(errors, 'endedAt', 'This field is required.');
    } else {
      const endedAt = dateTimeUpdate(errors, 'endedAt', data.endedAt, true);
      if (endedAt !== undefined) updates.endedAt = endedAt;
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationFailure(errors);
  return updates;
}

function validateSetScalarUpdates(data: RequestData): SetScalarUpdates {
  const errors: JsonObject = {};

  let weight: number | null | undefined;
  if ('weight' in data) {
    const parsed = decimalValue(data.weight);
    if (parsed !== null && parsed < 0) {
      addValidationError(
        errors,
        'weight',
        'Ensure this value is greater than or equal to 0.',
      );
    } else if (parsed !== null && parsed > 9_999.99) {
      addValidationError(
        errors,
        'weight',
        'Ensure this value is less than or equal to 9999.99.',
      );
    } else {
      weight = parsed;
    }
  }

  let reps: number | null | undefined;
  if ('reps' in data) {
    try {
      const parsed = integerValue(data.reps, {
        allowNull: true,
        min: 0,
        max: 10_000,
      });
      reps = parsed;
    } catch {
      addValidationError(errors, 'reps', 'A valid integer is required.');
    }
  }

  let dropdownWeights: Array<{ weight?: number | null; reps: number }> | null | undefined;
  if ('dropdownWeights' in data) {
    try {
      dropdownWeights = validateDropdownWeights(data.dropdownWeights);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      const payloadField = error.payload.dropdownWeights;
      const messages = Array.isArray(payloadField)
        ? payloadField.map(String)
        : ['Must be a list of drop sets'];
      for (const message of messages) {
        addValidationError(errors, 'dropdownWeights', message);
      }
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationFailure(errors);
  return {
    ...(weight === undefined ? {} : { weight }),
    ...(reps === undefined ? {} : { reps }),
    ...(dropdownWeights === undefined ? {} : { dropdownWeights }),
  };
}

function validateSetOrder(data: RequestData): number | undefined {
  if (!('set_order' in data)) return undefined;

  let value: unknown = data.set_order;
  if (value === null) {
    throw new ValidationFailure({
      set_order: ['This field may not be null.'],
    });
  }

  try {
    value = integerValue(value);
  } catch {
    throw new ValidationFailure({
      set_order: ['A valid integer is required.'],
    });
  }
  if (typeof value !== 'number') {
    throw new ValidationFailure({
      set_order: ['A valid integer is required.'],
    });
  }
  if (value < 0) {
    throw new ValidationFailure({
      set_order: ['Ensure this value is greater than or equal to 0.'],
    });
  }
  if (value > 10_000) {
    throw new ValidationFailure({
      set_order: ['Ensure this value is less than or equal to 10000.'],
    });
  }
  return value;
}

interface SetRelationshipUpdates {
  exercise?: ExerciseItem;
  sessionId?: number;
  setType?: SetType;
}

async function resolveSetRelationshipUpdates(
  context: RouteContext,
  userId: number,
  data: RequestData,
  partial: boolean,
): Promise<SetRelationshipUpdates> {
  const errors: JsonObject = {};
  const updates: SetRelationshipUpdates = {};
  const hasExercise = 'exerciseId' in data || 'exercise_id' in data;
  const hasSession = 'session' in data || 'sessionId' in data;
  const hasType = 'setType' in data || 'set_type' in data;

  if (!partial && !hasExercise) {
    addValidationError(errors, 'exerciseId', 'This field is required.');
  }
  if (!partial && !hasSession) {
    addValidationError(errors, 'session', 'This field is required.');
  }
  if (!partial && !hasType) {
    addValidationError(errors, 'setType', 'This field is required.');
  }

  try {
    if (hasExercise) {
      updates.exercise = await accessibleExercise(
        context,
        userId,
        preferredInput(data, 'exerciseId', 'exercise_id'),
      );
    }
  } catch {
    addValidationError(
      errors,
      'exerciseId',
      'Invalid or unavailable exercise',
    );
  }

  if (hasSession) {
    const rawId = preferredInput(data, 'session', 'sessionId');
    const normalizedId = rawId === null ? null : normalizePositiveInteger(rawId);
    if (normalizedId === null) {
      addValidationError(errors, 'session', 'Invalid session');
    } else {
      const { sessions } = await userWorkouts(context, userId);
      if (!sessions.some((session) => session.id === normalizedId)) {
        addValidationError(errors, 'session', 'Invalid session');
      } else {
        updates.sessionId = normalizedId;
      }
    }
  }

  if (hasType) {
    const requestedType = preferredInput(data, 'setType', 'set_type');
    if (
      typeof requestedType !== 'string' ||
      !SET_TYPES.has(requestedType)
    ) {
      addValidationError(
        errors,
        'setType',
        `"${String(requestedType)}" is not a valid choice.`,
      );
    } else {
      updates.setType = requestedType as SetType;
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationFailure(errors);
  return updates;
}

function mergeSetUpdate(
  current: WorkoutSetItem,
  relationships: SetRelationshipUpdates,
  scalars: SetScalarUpdates,
): WorkoutSetItem {
  return {
    ...current,
    ...(relationships.exercise === undefined ? {} : {
      exercise_id: relationships.exercise.id,
      exercise_name: relationships.exercise.name ?? '',
    }),
    ...(relationships.sessionId === undefined ? {} : {
      session_id: relationships.sessionId,
    }),
    ...(relationships.setType === undefined ? {} : {
      set_type: relationships.setType,
    }),
    ...(scalars.weight === undefined ? {} : { weight: scalars.weight }),
    ...(scalars.reps === undefined ? {} : { reps: scalars.reps }),
    ...(scalars.dropdownWeights === undefined ? {} : {
      dropdown_weights: scalars.dropdownWeights,
    }),
  };
}

export function registerSessionRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/workouts/sessions',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      if (context.request.method === 'GET') {
        const workouts = await userWorkouts(context, user.id);
        return jsonResponse(
          200,
          workouts.sessions
            .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
            .map((session) => sessionResponse(
              session,
              sortSets(workouts.sets.filter((set) => set.session_id === session.id)),
            )),
          context.cors,
        );
      }

      const data = body(context.request);
      const rawSets = data.sets;
      if (rawSets !== undefined && rawSets !== null && !Array.isArray(rawSets)) {
        return jsonResponse(400, { error: 'Invalid sets' }, context.cors);
      }
      if (Array.isArray(rawSets) && rawSets.some((set) =>
        typeof set !== 'object' || set === null || Array.isArray(set))) {
        return jsonResponse(400, { error: 'Invalid sets' }, context.cors);
      }

      try {
        const createdAt = 'startedAt' in data
          ? parseDate(data.startedAt) ?? new Date()
          : new Date();
        const finishedAt = 'endedAt' in data ? parseDate(data.endedAt) : null;
        const name = data.name === undefined || data.name === null ? '' : data.name;
        const notes = data.notes === undefined ? null : data.notes;
        if ((typeof name !== 'string') || (notes !== null && typeof notes !== 'string')) {
          throw new Error('invalid text');
        }
        const bodyweight = decimalValue(data.bodyweight);
        const presetIdRaw = preferredInput(data, 'preset_id', 'preset');
        let preset: WorkoutPresetItem | undefined;
        if (presetIdRaw !== undefined && presetIdRaw !== null) {
          const presetId = integerValue(presetIdRaw, { min: 1 }) as number;
          ({ preset } = await loadPreset(context, user.id, presetId));
        }

        const inputs = await prepareInputSets(
          context,
          user.id,
          rawSets ?? [],
        );
        const result = await createWorkout(context, {
          entity_type: 'workout_session',
          id: 0,
          user_id: user.id,
          ...(preset ? { preset_id: preset.id } : {}),
          name: name === '' ? 'Workout' : name,
          notes,
          bodyweight,
          created_at: createdAt.toISOString(),
          ...(finishedAt ? { finished_at: finishedAt.toISOString() } : {}),
        }, inputs);
        return jsonResponse(
          201,
          sessionResponse(result.item, result.sets),
          context.cors,
        );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        return jsonResponse(400, { error: 'Invalid date' }, context.cors);
      }
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/workouts/sessions/active',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      const workouts = await userWorkouts(context, user.id);
      return jsonResponse(
        200,
        workouts.sessions
          .filter((session) => session.finished_at === null || session.finished_at === undefined)
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
          .map((session) => sessionResponse(
            session,
            sortSets(workouts.sets.filter((set) => set.session_id === session.id)),
          )),
        context.cors,
      );
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/sessions/:sessionId/finish',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const { session, sets } = await getSession(
        context,
        params.sessionId as number,
      );
      const updated: WorkoutSessionItem = { ...session, finished_at: nowIso() };
      await context.repository.put(updated);
      return jsonResponse(200, sessionResponse(updated, sets), context.cors);
    },
  });

  addRoute({
    method: 'DELETE',
    pattern: '/api/workouts/sessions/:sessionId/sets/:setId/completion',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const current = await getSessionSet(
        context,
        params.sessionId as number,
        params.setId as number,
      );
      const updated: WorkoutSetItem = { ...current };
      delete updated.completed_at;
      await context.repository.put(updated);
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: 'PATCH',
    pattern: '/api/workouts/sessions/:sessionId/sets/:setId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const current = await getSessionSet(
        context,
        params.sessionId as number,
        params.setId as number,
      );
      const data = typeof context.request.body === 'object' &&
        context.request.body !== null && !Array.isArray(context.request.body)
        ? context.request.body as RequestData
        : {};
      const updated: WorkoutSetItem = {
        ...mergeSetUpdate(current, {}, validateSetScalarUpdates(data)),
        completed_at: nowIso(),
      };
      await context.repository.put(updated);
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PATCH', 'PUT', 'DELETE'],
    pattern: '/api/workouts/sessions/:sessionId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const sessionId = params.sessionId as number;
      if (context.request.method === 'GET') {
        const { session, sets } = await getSession(context, sessionId);
        return jsonResponse(200, sessionResponse(session, sets), context.cors);
      }
      if (
        context.request.method === 'PATCH' ||
        context.request.method === 'PUT'
      ) {
        const { session, sets } = await getSession(context, sessionId);
        const updates = validateSessionUpdates(
          body(context.request),
          context.request.method === 'PATCH',
        );
        const updated: WorkoutSessionItem = {
          ...session,
          ...(updates.name === undefined ? {} : { name: updates.name }),
          ...(updates.notes === undefined ? {} : { notes: updates.notes }),
          ...(updates.bodyweight === undefined ? {} : {
            bodyweight: updates.bodyweight,
          }),
          ...(updates.startedAt === undefined ? {} : {
            created_at: updates.startedAt.toISOString(),
          }),
          ...(updates.endedAt === undefined ? {}
            : updates.endedAt === null
              ? { finished_at: null }
              : { finished_at: updates.endedAt.toISOString() }),
        };
        await context.repository.put(updated);
        return jsonResponse(200, sessionResponse(updated, sets), context.cors);
      }
      const { session, sets } = await getSession(context, sessionId);
      await context.repository.deleteAllTransactionally([
        { pk: session.pk, sk: session.sk },
        ...sets.map((set) => ({ pk: set.pk, sk: set.sk })),
      ]);
      return emptyResponse(204, context.cors);
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/workouts/sets',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const { sets } = await userWorkouts(
        context,
        (await context.requireUser()).id,
      );
      return jsonResponse(200, sortSets(sets).map(setResponse), context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/sets',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      const input = typeof context.request.body === 'object' &&
        context.request.body !== null && !Array.isArray(context.request.body)
        ? context.request.body as RequestData
        : {};
      const sessionId = integerValue(
        preferredInput(input, 'session', 'sessionId'),
        { min: 1 },
      );
      if (sessionId === null) {
        throw new HttpError(400, { session: ['This field is required.'] });
      }
      const { session, sets } = await getSession(context, sessionId);
      const exercise = await accessibleExercise(
        context,
        user.id,
        preferredInput(input, 'exerciseId', 'exercise_id'),
      );
      const fallbackOrder = sets.length === 0
        ? 0
        : sets[sets.length - 1].set_order + 1;
      const prepared = preparedSetFromRequest(exercise, input, fallbackOrder);
      const weight = prepared.weight;
      if (weight !== null && weight !== undefined && weight < 0) {
        throw new HttpError(400, { weight: ['Ensure this value is greater than or equal to 0.'] });
      }
      const setId = await context.repository.nextId('workout_set');
      const item = generatedSet({
        id: setId,
        userId: session.user_id,
        sessionId: session.id,
        exercise,
        setOrder: prepared.setOrder,
        setType: prepared.setType,
        ...(prepared.weight === undefined ? {} : { weight }),
        reps: prepared.reps === undefined ? null : prepared.reps,
        dropdownWeights: validateDropdownWeights(prepared.dropdownWeights),
        ...(prepared.loggedAt ? { completedAt: prepared.loggedAt.toISOString() } : {}),
      });
      await context.repository.putNewItemsTransactionally([item]);
      return jsonResponse(201, setResponse(item), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PATCH', 'PUT', 'DELETE'],
    pattern: '/api/workouts/sets/:setId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const current = await getUserSet(context, params.setId as number);
      if (context.request.method === 'GET') {
        return jsonResponse(200, setResponse(current), context.cors);
      }
      if (context.request.method === 'DELETE') {
        await context.repository.delete({ pk: current.pk, sk: current.sk });
        return emptyResponse(204, context.cors);
      }
      const data = body(context.request);
      const relationships = await resolveSetRelationshipUpdates(
        context,
        current.user_id,
        data,
        context.request.method === 'PATCH',
      );
      let updated = mergeSetUpdate(
        current,
        relationships,
        validateSetScalarUpdates(data),
      );

      const nextOrder = validateSetOrder(data);
      if (nextOrder !== undefined) {
        const nextSortKey = setSortKey({ ...updated, set_order: nextOrder });
        updated = { ...updated, set_order: nextOrder, sk: nextSortKey };
      }

      if (updated.sk !== current.sk) {
        await context.repository.transact([
          {
            Delete: {
              TableName: context.config.tableName,
              Key: { pk: current.pk, sk: current.sk },
            },
          },
          {
            Put: {
              TableName: context.config.tableName,
              Item: updated,
              ConditionExpression:
                'attribute_not_exists(pk) AND attribute_not_exists(sk)',
            },
          },
        ]);
      } else {
        await context.repository.put(updated);
      }
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/sets/:setId/uncomplete',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const current = await getUserSet(context, params.setId as number);
      const updated: WorkoutSetItem = { ...current };
      delete updated.completed_at;
      await context.repository.put(updated);
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/sets/:setId/complete',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const current = await getUserSet(context, params.setId as number);
      const data = typeof context.request.body === 'object' &&
        context.request.body !== null && !Array.isArray(context.request.body)
        ? context.request.body as RequestData
        : {};
      const updated: WorkoutSetItem = {
        ...mergeSetUpdate(current, {}, validateSetScalarUpdates(data)),
        completed_at: nowIso(),
      };
      await context.repository.put(updated);
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/presets/:presetId/start_workout',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const user = await context.requireUser();
      const { preset, rows } = await loadPreset(
        context,
        user.id,
        params.presetId as number,
      );
      const data = typeof context.request.body === 'object' &&
        context.request.body !== null && !Array.isArray(context.request.body)
        ? context.request.body as RequestData
        : {};
      try {
        const createdAt = (data.startedAt === undefined || data.startedAt === null
          ? new Date()
          : parseDate(data.startedAt)) as Date;
        const bodyweight = decimalValue(data.bodyweight);
        const partitionItems = await context.repository.queryPartition({
          partitionKey: `PRESET#${preset.id}`,
        });
        const exercises = new Map<number, ExerciseItem>();
        const exerciseFor = async (exerciseId: number): Promise<ExerciseItem> => {
          const cached = exercises.get(exerciseId);
          if (cached) return cached;
          const loaded = await context.repository.getExercise(exerciseId);
          if (!loaded) throw new HttpError(400, { error: 'Unable to create workout from preset' });
          exercises.set(exerciseId, loaded);
          return loaded;
        };

        interface GeneratedInput {
          exercise: ExerciseItem;
          setType: SetType;
          weight?: number | null;
          reps?: number | null;
          dropdownWeights?: DropdownWeight[] | null;
        }
        const generated: GeneratedInput[] = [];
        for (const row of rows) {
          if (row.type === 'superset') {
            const items = partitionItems.filter(isSupersetItem)
              .filter((item) => item.parent_row_id === row.id)
              .sort((left, right) => left.order - right.order || left.id - right.id);
            for (const item of items) {
              if (item.include_warmup) {
                generated.push({
                  exercise: await exerciseFor(item.exercise_id),
                  setType: 'warmup',
                  weight: null,
                  reps: 10,
                });
              }
            }
            for (let round = 0; round < row.sets; round += 1) {
              for (const item of items) {
                const exercise = await exerciseFor(item.exercise_id);
                const isBodyweight = exercise.is_bodyweight === true;
                generated.push({
                  exercise,
                  setType: isBodyweight ? 'bodyweight' : 'normal',
                  weight: isBodyweight ? null : 60,
                  reps: 10,
                });
              }
            }
          } else if (row.exercise_id !== null && row.exercise_id !== undefined) {
            const exercise = await exerciseFor(row.exercise_id);
            if (row.include_warmup) {
              generated.push({ exercise, setType: 'warmup', weight: null, reps: 10 });
            }
            if (row.type === 'dropdown') {
              const dropdowns = row.dropdowns ?? 0;
              for (let index = 0; index < row.sets; index += 1) {
                const dropdownWeights: DropdownWeight[] = [{ weight: 60, reps: 10 }];
                for (let drop = 1; drop <= dropdowns; drop += 1) {
                  dropdownWeights.push({
                    weight: Math.max(0, Math.round((60 - drop * 2.5) * 100) / 100),
                    reps: 10,
                  });
                }
                generated.push({
                  exercise,
                  setType: 'dropdown',
                  weight: 60,
                  reps: 10,
                  dropdownWeights,
                });
              }
            } else {
              const isBodyweight = exercise.is_bodyweight === true;
              for (let index = 0; index < row.sets; index += 1) {
                generated.push({
                  exercise,
                  setType: isBodyweight ? 'bodyweight' : 'normal',
                  weight: isBodyweight ? null : 60,
                  reps: 10,
                });
              }
            }
          }
        }

        const result = await createWorkout(context, {
          entity_type: 'workout_session',
          id: 0,
          user_id: user.id,
          preset_id: preset.id,
          name: preset.name,
          ...(preset.notes === undefined ? {} : { notes: preset.notes }),
          bodyweight,
          created_at: createdAt.toISOString(),
        }, generated.map((input) => ({
          exercise: input.exercise,
          setOrder: 0,
          setType: input.setType,
          ...(input.weight === undefined ? {} : { weight: input.weight }),
          ...(input.reps === undefined ? {} : { reps: input.reps }),
          ...(input.dropdownWeights === undefined
            ? {}
            : { dropdownWeights: input.dropdownWeights }),
        })).map((input, index) => ({ ...input, setOrder: index })));
        return jsonResponse(
          201,
          startedWorkoutResponse(result.item, result.sets),
          context.cors,
        );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        return jsonResponse(400, { error: 'Invalid date' }, context.cors);
      }
    },
  });
}
