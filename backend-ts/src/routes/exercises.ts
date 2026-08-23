import { emptyResponse, jsonResponse } from '../http.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';
import type { ExerciseItem } from '../types.js';
import { HttpError } from '../types.js';
import { validateExercise } from '../validation.js';

function exerciseResponse(item: ExerciseItem): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    muscleGroups: structuredClone(item.muscle_groups ?? []),
    equipment: item.equipment_name ?? null,
    bodyweight: item.is_bodyweight ?? false,
    category: item.category ?? 'isolation',
    instructions: structuredClone(item.instructions ?? []),
  };
}

function authorizeWrite(
  exercise: ExerciseItem,
  userId: number,
  deleting = false,
): void {
  const verb = deleting ? 'delete' : 'modify';
  if (exercise.user_id === null) {
    throw new HttpError(403, { error: `Cannot ${verb} common exercises` });
  }
  if (exercise.user_id !== userId) {
    throw new HttpError(
      403,
      { error: `Cannot ${verb} exercises created by another user` },
    );
  }
}

async function loadWritableExercise(
  context: RouteContext,
  id: number,
): Promise<ExerciseItem> {
  const exercise = await context.repository.getExercise(id);
  if (!exercise) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return exercise;
}

async function visibleExercise(
  context: RouteContext,
  id: number,
): Promise<ExerciseItem | undefined> {
  const authorization = context.request.headers.authorization;
  const user = authorization ? await context.requireUser() : undefined;
  const exercise = await context.repository.getExercise(id);
  if (!exercise || (exercise.user_id !== null && exercise.user_id !== user?.id)) {
    return undefined;
  }
  return exercise;
}

function timestamp(): string {
  return new Date().toISOString();
}

async function createExercise(context: RouteContext) {
  const user = await context.requireUser();
  const input = validateExercise(context.request.body);
  const id = await context.repository.nextId('exercise');
  const category = input.category ?? 'isolation';
  const now = timestamp();
  const exercise: ExerciseItem = {
    pk: `EXERCISE#${id}`,
    sk: 'METADATA',
    id,
    user_id: user.id,
    name: input.name ?? '',
    muscle_groups: input.muscleGroups ?? [],
    equipment_name: input.equipment === undefined || input.equipment === ''
      ? null
      : input.equipment,
    category,
    instructions: input.instructions ?? [],
    is_compound: category === 'compound',
    is_bodyweight: input.bodyweight ?? false,
    created_at: now,
    updated_at: now,
  };
  await context.repository.putExercise(exercise);
  return jsonResponse(201, exerciseResponse(exercise), context.cors);
}

async function updateExercise(context: RouteContext, id: number, partial: boolean) {
  const user = await context.requireUser();
  const existing = await loadWritableExercise(context, id);
  authorizeWrite(existing, user.id);
  const input = validateExercise(context.request.body, partial);
  const category = input.category ?? existing.category ?? 'isolation';
  const equipment = input.equipment === undefined
    ? existing.equipment_name
    : (input.equipment === '' ? null : input.equipment);
  const muscleGroups = input.muscleGroups === undefined
    ? existing.muscle_groups ?? []
    : input.muscleGroups;
  const instructions = input.instructions === undefined
    ? existing.instructions ?? []
    : input.instructions;

  const updated: ExerciseItem = {
    ...existing,
    name: input.name ?? existing.name,
    muscle_groups: muscleGroups,
    equipment_name: equipment,
    category,
    instructions,
    is_compound: category === 'compound',
    is_bodyweight: input.bodyweight ?? existing.is_bodyweight ?? false,
    updated_at: timestamp(),
  };
  await context.repository.putExercise(updated);
  return jsonResponse(200, exerciseResponse(updated), context.cors);
}

async function destroyExercise(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await loadWritableExercise(context, id);
  authorizeWrite(existing, user.id, true);
  await context.repository.delete({ pk: `EXERCISE#${id}`, sk: 'METADATA' });
  return emptyResponse(204, context.cors);
}

export function registerExerciseRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/workouts/exercises',
    handle: async (context) => {
      if (context.request.method === 'POST') {
        return createExercise(context);
      }

      const authorization = context.request.headers.authorization;
      const user = authorization ? await context.requireUser() : undefined;
      const exercises = await context.repository.listExercises(user?.id);
      return jsonResponse(
        200,
        exercises.map(exerciseResponse),
        context.cors,
      );
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/workouts/exercises/:id',
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        const exercise = await visibleExercise(context, id);
        if (!exercise) {
          throw new HttpError(404, { detail: 'Not found.' });
        }
        return jsonResponse(200, exerciseResponse(exercise), context.cors);
      }
      if (context.request.method === 'DELETE') {
        return destroyExercise(context, id);
      }
      return updateExercise(
        context,
        id,
        context.request.method === 'PATCH',
      );
    },
  });
}
