import type {
  ApiUser,
  ApiResponse,
  ExerciseSettingsItem,
  NormalizedRequest,
} from './types.js';
import { HttpError } from './types.js';
import { corsHeaders, emptyResponse, jsonResponse, normalizeRequest } from './http.js';
import { issueTokenPair, verifyAccessToken } from './jwt.js';
import { FitnessRepository, mergeExerciseSetting, settingsResponse } from './repository.js';
import { loadConfig } from './config.js';
import { hashPassword, verifyPassword } from './crypto.js';
import {
  validateExerciseSettings,
  validateLogin,
  validateRegistration,
} from './validation.js';

function publicUser(user: {
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

function matchPath(path: string, pattern: string): boolean {
  const requestSegments = path.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);
  return (
    requestSegments.length === patternSegments.length &&
    requestSegments.every((segment, index) => segment === patternSegments[index])
  );
}

function matchSettingPath(
  path: string,
): { base: 'exercise-settings'; exerciseId: number } | undefined {
  const segments = path.split('/').filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0] !== 'api' ||
    segments[1] !== 'auth' ||
    segments[2] !== 'exercise-settings'
  ) {
    return undefined;
  }

  const value = segments[3];
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const exerciseId = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(exerciseId)) {
    return undefined;
  }
  return { base: 'exercise-settings', exerciseId };
}

function methodNotAllowed(method: string): HttpError {
  return new HttpError(405, { detail: `Method "${method}" not allowed.` });
}

async function requireUser(
  request: NormalizedRequest,
  repository: FitnessRepository,
  jwtSecret: string,
) {
  const authorization = request.headers.authorization ?? '';
  const [scheme, token] = authorization.split(' ');
  if (scheme.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, {
      detail: 'Authentication credentials were not provided.',
      code: 'token_not_valid',
    });
  }

  const claims = verifyAccessToken(token, jwtSecret);
  const user = claims ? await repository.getUserByKey(`USER#${claims.user_id}`) : undefined;
  if (!claims || !user || !user.is_active) {
    throw new HttpError(401, {
      detail: 'Token is invalid or expired',
      code: 'token_not_valid',
    });
  }
  return user;
}

async function handleApi(
  request: NormalizedRequest,
  repository: FitnessRepository,
  config: ReturnType<typeof loadConfig>,
): Promise<ApiResponse> {
  const cors = corsHeaders(request, config.allowedOrigins);

  if (request.method === 'OPTIONS') {
    return emptyResponse(204, cors);
  }

  if (matchPath(request.path, '/api/health')) {
    if (request.method !== 'GET') {
      throw methodNotAllowed(request.method);
    }
    const ready = await repository.tableExists();
    return jsonResponse(
      ready ? 200 : 503,
      {
        status: ready ? 'healthy' : 'unhealthy',
        version: '1.0.0',
        framework: 'Django REST Framework',
      },
      cors,
    );
  }

  if (matchPath(request.path, '/api/auth/login')) {
    if (request.method !== 'POST') {
      throw methodNotAllowed(request.method);
    }
    const input = validateLogin(request.body);
    const user = await repository.getUserByUsername(input.username);
    const valid = user && user.is_active && await verifyPassword(input.password, user.password);
    if (!valid) {
      throw new HttpError(400, {
        detail: 'No active account found with the given credentials',
        code: 'no_active_account',
      });
    }
    return jsonResponse(200, { ...issueTokenPair(user.id, config.jwtSecret), user: publicUser(user) }, cors);
  }

  if (matchPath(request.path, '/api/auth/register')) {
    if (request.method !== 'POST') {
      throw methodNotAllowed(request.method);
    }
    const input = validateRegistration(request.body);
    if (await repository.getUserByUsername(input.username)) {
      throw new HttpError(400, { error: 'Username already exists' });
    }
    if (await repository.getUserByEmail(input.email)) {
      throw new HttpError(400, { error: 'Account already exists' });
    }

    const userId = await repository.nextId('user');
    await repository.createUser({
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
      cors,
    );
  }

  if (
    matchPath(request.path, '/api/auth/me') ||
    matchPath(request.path, '/api/auth/me/update') ||
    matchPath(request.path, '/api/auth/exercise-settings')
  ) {
    const user = await requireUser(request, repository, config.jwtSecret);

    if (matchPath(request.path, '/api/auth/me')) {
      if (request.method !== 'GET') {
        throw methodNotAllowed(request.method);
      }
      return jsonResponse(200, publicUser(user), cors);
    }

    if (matchPath(request.path, '/api/auth/me/update')) {
      if (request.method !== 'PATCH') {
        throw methodNotAllowed(request.method);
      }
      const body = request.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body) || typeof (body as Record<string, unknown>).dark_mode !== 'boolean') {
        throw new HttpError(400, { dark_mode: ['This field is required.'] });
      }
      const darkMode = (body as { dark_mode: boolean }).dark_mode;
      const updated = await repository.updateUserDarkMode(user, darkMode);
      return jsonResponse(200, publicUser(updated), cors);
    }

    if (request.method !== 'GET') {
      throw methodNotAllowed(request.method);
    }
    return jsonResponse(200, await repository.listExerciseSettings(user.id), cors);
  }

  const settingMatch = matchSettingPath(request.path);
  if (settingMatch) {
    if (request.method !== 'POST' && request.method !== 'PATCH') {
      throw methodNotAllowed(request.method);
    }
    const user = await requireUser(request, repository, config.jwtSecret);
    const exercise = await repository.getExercise(settingMatch.exerciseId);
    if (!exercise || (exercise.user_id !== null && exercise.user_id !== user.id)) {
      throw new HttpError(404, { error: 'Exercise not found' });
    }

    const input = validateExerciseSettings(request.body);
    const existing = await repository.getExerciseSetting(user.id, settingMatch.exerciseId);
    const item = mergeExerciseSetting(existing, user.id, settingMatch.exerciseId, input);
    await repository.saveExerciseSetting(item satisfies ExerciseSettingsItem);
    return jsonResponse(200, settingsResponse(item), cors);
  }

  throw new HttpError(404, { detail: 'Not found.' });
}

export async function handler(rawEvent: unknown): Promise<ApiResponse> {
  try {
    const config = loadConfig();
    const repository = new FitnessRepository(config.tableName, config.dynamodbEndpoint);
    return await handleApi(normalizeRequest(rawEvent), repository, config);
  } catch (error) {
    if (error instanceof HttpError) {
      let cors: Record<string, string> = {};
      try {
        const request = normalizeRequest(rawEvent);
        cors = corsHeaders(request, loadConfig().allowedOrigins);
      } catch {
        cors = {};
      }
      return jsonResponse(error.status, error.payload, cors);
    }
    console.error('Unhandled Lambda error', error);
    return jsonResponse(500, { detail: 'Internal Server Error' });
  }
}
