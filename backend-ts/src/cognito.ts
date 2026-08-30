import { createPublicKey, verify } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import type { RuntimeConfig } from './config.js';
import type { FitnessRepository } from './repository.js';
import type { UserItem } from './types.js';
import { HttpError } from './types.js';

interface CognitoClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  iss: string;
  aud: string;
  exp: number;
  nonce: string;
  token_use: string;
}

interface JsonWebKeySet { keys?: JsonWebKey[] }
let cachedKeys: { url: string; keys: JsonWebKey[]; expiresAt: number } | undefined;

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function decode(segment: string): Record<string, unknown> | undefined {
  try { return object(JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))); }
  catch { return undefined; }
}

async function jwks(url: string, refresh = false): Promise<JsonWebKey[]> {
  if (!refresh && cachedKeys?.url === url && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('Shared auth keys are unavailable');
  const payload = await response.json() as JsonWebKeySet;
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) throw new Error('Shared auth keys are invalid');
  cachedKeys = { url, keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return payload.keys;
}

async function verifyIdToken(token: string, nonce: string, auth: NonNullable<RuntimeConfig['auth']>): Promise<CognitoClaims> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('Malformed ID token');
  const header = decode(parts[0]);
  const claims = decode(parts[1]);
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || !claims) throw new Error('Invalid ID token');
  let keys = await jwks(auth.jwksUrl);
  let key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    keys = await jwks(auth.jwksUrl, true);
    key = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Invalid ID token signature');
  }
  const valid = typeof claims.sub === 'string' && typeof claims.email === 'string'
    && claims.email_verified === true && claims.iss === auth.issuer && claims.aud === auth.clientId
    && claims.token_use === 'id' && claims.nonce === nonce && typeof claims.exp === 'number'
    && claims.exp > Math.floor(Date.now() / 1000);
  if (!valid) throw new Error('Invalid ID token claims');
  return claims as unknown as CognitoClaims;
}

export async function exchangeCognitoCode(
  code: string,
  verifier: string,
  nonce: string,
  auth: NonNullable<RuntimeConfig['auth']>,
): Promise<CognitoClaims> {
  const response = await fetch(`${auth.baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: auth.clientId,
      redirect_uri: auth.callbackUrl, code, code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = object(await response.json().catch(() => undefined));
  if (!response.ok || typeof payload?.id_token !== 'string') throw new HttpError(400, { detail: 'Shared sign-in could not be completed.' });
  try { return await verifyIdToken(payload.id_token, nonce, auth); }
  catch { throw new HttpError(401, { detail: 'Shared sign-in response was invalid.' }); }
}

export async function findOrCreateCognitoUser(repository: FitnessRepository, claims: CognitoClaims): Promise<UserItem> {
  const bySubject = await repository.getUserByCognitoSub(claims.sub);
  if (bySubject) return bySubject;
  const email = claims.email.trim().toLowerCase();
  const byEmail = await repository.getUserByEmail(email);
  if (byEmail) return repository.linkCognitoIdentity(byEmail, claims.sub);
  const id = await repository.nextId('user');
  const user: UserItem = {
    pk: `USER#${id}`, sk: 'PROFILE', id,
    username: email, email, password: '', cognito_sub: claims.sub,
    dark_mode: false, is_active: true, date_joined: new Date().toISOString(),
  };
  try {
    await repository.createUser(user);
    return await repository.linkCognitoIdentity(user, claims.sub);
  } catch (error) {
    const raced = await repository.getUserByEmail(email);
    if (raced) return repository.linkCognitoIdentity(raced, claims.sub);
    throw error;
  }
}

export function sharedAuthPublicConfig(auth: NonNullable<RuntimeConfig['auth']>) {
  return { base_url: auth.baseUrl, client_id: auth.clientId, callback_url: auth.callbackUrl, logout_url: auth.logoutUrl };
}

export function resetCognitoKeyCacheForTests(): void { cachedKeys = undefined; }
