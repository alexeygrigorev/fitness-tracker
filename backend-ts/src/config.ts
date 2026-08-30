export interface RuntimeConfig {
  tableName: string;
  jwtSecret: string;
  auth?: {
    baseUrl: string;
    clientId: string;
    callbackUrl: string;
    logoutUrl: string;
    issuer: string;
    jwksUrl: string;
  };
  frontendBuild?: string;
  dynamodbEndpoint?: string;
  timezone: string;
  allowedOrigins: ReadonlySet<string>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const tableName = env.TABLE_NAME?.trim();
  const jwtSecret = env.JWT_SECRET ?? '';
  if (!tableName) {
    throw new Error('TABLE_NAME is required');
  }
  if (jwtSecret.length < 50) {
    throw new Error('JWT_SECRET must contain at least 50 characters');
  }

  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://localhost:8080');
    allowedOrigins.add('http://127.0.0.1:8080');
  }

  const frontendBuild = env.FRONTEND_BUILD?.trim();
  const dynamodbEndpoint = env.DYNAMODB_ENDPOINT?.trim();
  const timezone = env.TIME_ZONE?.trim() || 'UTC';
  const authValues = {
    baseUrl: env.AUTH_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    clientId: env.AUTH_CLIENT_ID?.trim() ?? '',
    callbackUrl: env.AUTH_CALLBACK_URL?.trim() ?? '',
    logoutUrl: env.AUTH_LOGOUT_URL?.trim() ?? '',
    issuer: env.AUTH_ISSUER?.trim().replace(/\/$/, '') ?? '',
    jwksUrl: env.AUTH_JWKS_URL?.trim() ?? '',
  };
  const configuredAuthValues = Object.values(authValues).filter(Boolean);
  if (configuredAuthValues.length > 0 && configuredAuthValues.length !== Object.keys(authValues).length) {
    throw new Error('Shared auth configuration must be complete');
  }
  return {
    tableName,
    jwtSecret,
    ...(frontendBuild ? { frontendBuild } : {}),
    ...(dynamodbEndpoint ? { dynamodbEndpoint } : {}),
    timezone,
    allowedOrigins,
    ...(configuredAuthValues.length > 0 ? { auth: authValues } : {}),
  };
}
