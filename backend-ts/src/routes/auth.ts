import type { ApiUser, UserItem } from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import { issueTokenPair } from '../jwt.js';
import { mergeExerciseSetting, settingsResponse } from '../repository.js';
import { hashPassword, verifyPassword } from '../crypto.js';
import { exchangeCognitoCode, findOrCreateCognitoUser, sharedAuthPublicConfig } from '../cognito.js';
import {
  validateExerciseSettings,
  validateLogin,
  validateRegistration,
} from '../validation.js';
import type {
  ExerciseSettingsItem,
  NormalizedRequest,
  ProfileGoal,
} from '../types.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';

export function publicUser(user: UserItem): ApiUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    dark_mode: user.dark_mode,
    display_name: user.display_name?.trim() || user.username,
    weight_kg: user.weight_kg ?? null,
    height_cm: user.height_cm ?? null,
    age: user.age ?? null,
    goal: user.goal ?? null,
    weekly_workouts: user.weekly_workouts ?? null,
  };
}

interface ProfileUpdates {
  dark_mode?: boolean;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  goal?: ProfileGoal | null;
  weekly_workouts?: number | null;
}

function profileUpdates(body: unknown): ProfileUpdates {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, { detail: 'Expected a profile object.' });
  }
  const input = body as Record<string, unknown>;
  const allowed = ['dark_mode', 'weight_kg', 'height_cm', 'age', 'goal', 'weekly_workouts'] as const;
  const updates: ProfileUpdates = {};
  const errors: Record<string, string[]> = {};
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key as typeof allowed[number])) errors[key] = ['Unknown field.'];
  }
  if ('dark_mode' in input) {
    if (typeof input.dark_mode === 'boolean') updates.dark_mode = input.dark_mode;
    else errors.dark_mode = ['Must be a boolean.'];
  }
  const numberField = (key: 'weight_kg' | 'height_cm' | 'age' | 'weekly_workouts', min: number, max: number, integer = false) => {
    if (!(key in input)) return;
    const value = input[key];
    if (value === null) updates[key] = null;
    else if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors[key] = [`Must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}.`];
    } else updates[key] = value;
  };
  numberField('weight_kg', 20, 500);
  numberField('height_cm', 50, 300);
  numberField('age', 1, 120, true);
  numberField('weekly_workouts', 0, 14, true);
  if ('goal' in input) {
    if (input.goal === null || input.goal === 'lose_weight' || input.goal === 'maintain' || input.goal === 'gain_muscle') updates.goal = input.goal;
    else errors.goal = ['Choose a valid fitness goal.'];
  }
  if (Object.keys(input).length === 0) errors.detail = ['Provide at least one profile field.'];
  if (Object.keys(errors).length > 0) throw new HttpError(400, errors);
  return updates;
}

async function updateProfile(context: RouteContext) {
  const user = await context.requireUser();
  const updated = await context.repository.updateUserProfile(user, profileUpdates(context.request.body));
  return jsonResponse(200, publicUser(updated), context.cors);
}

async function saveExerciseSetting(
  context: RouteContext,
  exerciseId: number,
) {
  const user = await context.requireUser();
  const input = validateExerciseSettings(context.request.body);
  const exercise = await context.repository.getExercise(exerciseId);
  if (!exercise || (exercise.user_id !== null && exercise.user_id !== user.id)) {
    throw new HttpError(404, { error: 'Exercise not found' });
  }

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
  addRoute(profileRoute('GET', '/api/auth/config', async (context) =>
    jsonResponse(200, context.config.auth
      ? { enabled: true, ...sharedAuthPublicConfig(context.config.auth) }
      : { enabled: false }, context.cors)));

  addRoute(profileRoute('POST', '/api/auth/callback', async (context) => {
    if (!context.config.auth) throw new HttpError(404, { detail: 'Shared authentication is not configured.' });
    const body = context.request.body as Record<string, unknown>;
    if (!body || typeof body.code !== 'string' || typeof body.code_verifier !== 'string' || typeof body.nonce !== 'string') {
      throw new HttpError(400, { detail: 'Invalid authentication callback.' });
    }
    const claims = await exchangeCognitoCode(body.code, body.code_verifier, body.nonce, context.config.auth);
    const user = await findOrCreateCognitoUser(context.repository, claims);
    return jsonResponse(200, { ...issueTokenPair(user.id, context.config.jwtSecret), user: publicUser(user) }, context.cors);
  }));

  addRoute(profileRoute('POST', '/api/auth/login', async (context) => {
    if (context.config.auth) throw new HttpError(404, { detail: 'Password login is disabled.' });
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
    if (context.config.auth) throw new HttpError(404, { detail: 'Registration is managed by shared authentication.' });
    const input = validateRegistration(context.request.body);
    if (await context.repository.getUserByUsername(input.username)) {
      throw new HttpError(400, { error: 'Username already exists' });
    }
    if (await context.repository.getUserByEmail(input.email)) {
      throw new HttpError(400, { error: 'Account already exists' });
    }

    const userId = await context.repository.nextId('user');
    const user: UserItem = {
      pk: `USER#${userId}`,
      sk: 'PROFILE',
      id: userId,
      username: input.username,
      email: input.email,
      password: await hashPassword(input.password),
      dark_mode: false,
      is_active: true,
      date_joined: new Date().toISOString(),
    };
    await context.repository.createUser(user);
    return jsonResponse(
      201,
      {
        user: publicUser(user),
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
