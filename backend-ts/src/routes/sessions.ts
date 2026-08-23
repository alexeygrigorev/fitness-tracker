import type { JsonObject } from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
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

function sortSets(sets: WorkoutSetItem[]): WorkoutSetItem[] {
  return [...sets].sort((left, right) =>
    left.set_order - right.set_order || left.id - right.id);
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
  const requestedType = input.setType ?? input.set_type ?? 'normal';
  if (typeof requestedType !== 'string' || !SET_TYPES.has(requestedType)) {
    throw new HttpError(400, { error: 'Invalid date or numeric value' });
  }
  return {
    exercise,
    setOrder,
    setType: requestedType as SetType,
    weight: decimalValue(input.weight),
    reps: integerValue(input.reps, { allowNull: true }),
    dropdownWeights: input.dropdownWeights ?? input.dropdown_weights ?? null,
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
      input.exerciseId ?? input.exercise_id,
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

function applyValidatedUpdates(
  current: WorkoutSetItem,
  data: RequestData,
): WorkoutSetItem {
  let weight = current.weight ?? null;
  let reps = current.reps ?? null;
  let dropdownWeights = current.dropdown_weights ?? null;

  if ('weight' in data) weight = decimalValue(data.weight);
  if ('reps' in data) reps = integerValue(data.reps, { allowNull: true, min: 0, max: 10_000 });
  if ('dropdownWeights' in data) dropdownWeights = validateDropdownWeights(data.dropdownWeights);

  return {
    ...current,
    weight,
    reps,
    dropdown_weights: dropdownWeights,
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
        const presetIdRaw = data.preset_id ?? data.preset;
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
        ...applyValidatedUpdates(current, data),
        completed_at: nowIso(),
      };
      await context.repository.put(updated);
      return jsonResponse(200, setResponse(updated), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'DELETE'],
    pattern: '/api/workouts/sessions/:sessionId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const sessionId = params.sessionId as number;
      if (context.request.method === 'GET') {
        const { session, sets } = await getSession(context, sessionId);
        return jsonResponse(200, sessionResponse(session, sets), context.cors);
      }
      const { session, sets } = await getSession(context, sessionId);
      await context.repository.deleteAllTransactionally([
        { pk: session.pk, sk: session.sk },
        ...sets.map((set) => ({ pk: set.pk, sk: set.sk })),
      ]);
      return jsonResponse(204, {}, context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PATCH', 'DELETE'],
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
        return jsonResponse(204, {}, context.cors);
      }
      const data = typeof context.request.body === 'object' &&
        context.request.body !== null && !Array.isArray(context.request.body)
        ? context.request.body as RequestData
        : {};
      const updated = applyValidatedUpdates(current, data);
      await context.repository.put(updated);
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
        ...applyValidatedUpdates(current, data),
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
