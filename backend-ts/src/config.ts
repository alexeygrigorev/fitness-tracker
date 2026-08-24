export interface RuntimeConfig {
  tableName: string;
  jwtSecret: string;
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
  return {
    tableName,
    jwtSecret,
    ...(frontendBuild ? { frontendBuild } : {}),
    ...(dynamodbEndpoint ? { dynamodbEndpoint } : {}),
    timezone,
    allowedOrigins,
  };
}
