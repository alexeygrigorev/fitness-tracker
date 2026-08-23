import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

interface JwtClaims {
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  jti: string;
  user_id: number;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const value = JSON.parse(json) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function issueToken(
  userId: number,
  type: JwtClaims['token_type'],
  lifetimeSeconds: number,
  secret: string,
): { token: string; claims: JwtClaims } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    token_type: type,
    exp: issuedAt + lifetimeSeconds,
    iat: issuedAt,
    jti: randomUUID(),
    user_id: userId,
  };
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  return { token: `${signingInput}.${sign(signingInput, secret)}`, claims };
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export function issueTokenPair(userId: number, secret: string): TokenPair {
  return {
    access: issueToken(userId, 'access', 30 * 24 * 60 * 60, secret).token,
    refresh: issueToken(userId, 'refresh', 60 * 24 * 60 * 60, secret).token,
  };
}

export function verifyAccessToken(token: string, secret: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const header = decodeSegment(parts[0]);
  if (header?.alg !== 'HS256') {
    return null;
  }

  const expectedSignature = Buffer.from(
    sign(`${parts[0]}.${parts[1]}`, secret),
    'base64url',
  );
  const actualSignature = Buffer.from(parts[2], 'base64url');
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  const claims = decodeSegment(parts[1]);
  if (
    !claims ||
    claims.token_type !== 'access' ||
    typeof claims.exp !== 'number' ||
    typeof claims.iat !== 'number' ||
    typeof claims.user_id !== 'number' ||
    typeof claims.jti !== 'string' ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return {
    token_type: 'access',
    exp: claims.exp,
    iat: claims.iat,
    jti: claims.jti,
    user_id: claims.user_id,
  };
}
