import type { ApiUser } from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import { issueTokenPair } from '../jwt.js';
import { mergeExerciseSetting, settingsResponse } from '../repository.js';
import { hashPassword, verifyPassword } from '../crypto.js';
import {
  validateExerciseSettings,
  validateLogin,
  validateRegistration,
} from '../validation.js';
import type {
  ExerciseSettingsItem,
  NormalizedRequest,
} from '../types.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';

export function publicUser(user: {
  id: number;
  username: string;
  email: string;
  dark_mode: boolean;
}): ApiUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    dark_mode: user.dark_mode,
  };
}

async function updateProfile(context: RouteContext) {
  const body = context.request.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).dark_mode !== 'boolean'
  ) {
    throw new HttpError(400, { dark_mode: ['This field is required.'] });
  }

  const user = await context.requireUser();
  const updated = await context.repository.updateUserDarkMode(
    user,
    (body as { dark_mode: boolean }).dark_mode,
  );
  return jsonResponse(200, publicUser(updated), context.cors);
}

async function saveExerciseSetting(
  context: RouteContext,
  exerciseId: number,
) {
  const user = await context.requireUser();
  const exercise = await context.repository.getExercise(exerciseId);
  if (!exercise || (exercise.user_id !== null && exercise.user_id !== user.id)) {
    throw new HttpError(404, { error: 'Exercise not found' });
  }

  const input = validateExerciseSettings(context.request.body);
  const existing = await context.repository.getExerciseSetting(user.id, exerciseId);
  const item = mergeExerciseSetting(existing, user.id, exerciseId, input);
  await context.repository.saveExerciseSetting(item satisfies ExerciseSettingsItem);
  return jsonResponse(200, settingsResponse(item), context.cors);
}

function profileRoute(
  method: string,
  pattern: string,
  handler: (
    context: RouteContext,
  ) => Promise<ReturnType<typeof jsonResponse>>,
  protectedRoute = false,
): RouteDefinition {
  return {
    method,
    pattern,
    authRequired: protectedRoute,
    authBeforeMethod: protectedRoute,
    handle: (context) => handler(context),
  };
}

function profileRequest(request: NormalizedRequest): void {
  if (request.method !== 'PATCH') {
    throw new HttpError(405, { detail: `Method "${request.method}" not allowed.` });
  }
}

export function registerAuthRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute(profileRoute('POST', '/api/auth/login', async (context) => {
    const input = validateLogin(context.request.body);
    const user = await context.repository.getUserByUsername(input.username);
    const valid = user && user.is_active && await verifyPassword(
      input.password,
      user.password,
    );
    if (!valid) {
      throw new HttpError(400, {
        detail: 'No active account found with the given credentials',
        code: 'no_active_account',
      });
    }
    return jsonResponse(
      200,
      {
        ...issueTokenPair(user.id, context.config.jwtSecret),
        user: publicUser(user),
      },
      context.cors,
    );
  }));

  addRoute(profileRoute('POST', '/api/auth/register', async (context) => {
    const input = validateRegistration(context.request.body);
    if (await context.repository.getUserByUsername(input.username)) {
      throw new HttpError(400, { error: 'Username already exists' });
    }
    if (await context.repository.getUserByEmail(input.email)) {
      throw new HttpError(400, { error: 'Account already exists' });
    }

    const userId = await context.repository.nextId('user');
    await context.repository.createUser({
      pk: `USER#${userId}`,
      sk: 'PROFILE',
      id: userId,
      username: input.username,
      email: input.email,
      password: await hashPassword(input.password),
      dark_mode: false,
      is_active: true,
      date_joined: new Date().toISOString(),
    });
    return jsonResponse(
      201,
      {
        user: {
          id: userId,
          username: input.username,
          email: input.email,
          dark_mode: false,
        },
        message: 'User created successfully',
      },
      context.cors,
    );
  }));

  addRoute(profileRoute('GET', '/api/auth/me', async (context) => {
    const user = await context.requireUser();
    return jsonResponse(200, publicUser(user), context.cors);
  }, true));

  addRoute(profileRoute('PATCH', '/api/auth/me/update', async (context) => {
    profileRequest(context.request);
    return updateProfile(context);
  }, true));

  addRoute(profileRoute('GET', '/api/auth/exercise-settings', async (context) => {
    const user = await context.requireUser();
    return jsonResponse(
      200,
      await context.repository.listExerciseSettings(user.id),
      context.cors,
    );
  }, true));

  addRoute({
    method: ['POST', 'PATCH'],
    pattern: '/api/auth/exercise-settings/:exerciseId',
    handle: (context, params) => saveExerciseSetting(
      context,
      params.exerciseId as number,
    ),
  });
}
