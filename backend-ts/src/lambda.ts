import type {
  ApiResponse,
  NormalizedRequest,
} from './types.js';
import { HttpError } from './types.js';
import { corsHeaders, emptyResponse, jsonResponse, normalizeRequest } from './http.js';
import { FitnessRepository } from './repository.js';
import { loadConfig } from './config.js';
import { verifyAccessToken } from './jwt.js';
import { createRouter } from './router.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';

export async function requireUser(
  request: NormalizedRequest,
  repository: FitnessRepository,
  jwtSecret: string,
): Promise<import('./types.js').UserItem> {
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

  const router = createRouter();
  registerHealthRoutes((route) => router.add(route));
  registerAuthRoutes((route) => router.add(route));
  return router.handle({
    request,
    repository,
    config,
    cors,
    requireUser: () => requireUser(request, repository, config.jwtSecret),
  });
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
