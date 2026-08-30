import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { exchangeCognitoCode, resetCognitoKeyCacheForTests } from '../src/cognito.js';

const auth = {
  baseUrl: 'https://auth.example.test',
  clientId: 'fitness-client',
  callbackUrl: 'https://gym.example.test/auth/callback',
  logoutUrl: 'https://gym.example.test/',
  issuer: 'https://issuer.example.test/pool',
  jwksUrl: 'https://issuer.example.test/pool/.well-known/jwks.json',
};

const originalFetch = globalThis.fetch;

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signedToken(nonce: string): { token: string; jwk: JsonWebKey } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = encoded({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const payload = encoded({
    sub: 'cognito-subject', email: 'person@datatalks.club', email_verified: true,
    iss: auth.issuer, aud: auth.clientId, token_use: 'id', nonce,
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const input = `${header}.${payload}`;
  return {
    token: `${input}.${cryptoSign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`,
    jwk: { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCognitoKeyCacheForTests();
});

describe('shared Cognito authentication', () => {
  it('exchanges a PKCE code and verifies issuer, client, signature, email, and nonce', async () => {
    const { token, jwk } = signedToken('expected-nonce');
    globalThis.fetch = async (input, init) => {
      if (String(input) === `${auth.baseUrl}/oauth2/token`) {
        assert.equal(init?.method, 'POST');
        assert.match(String(init?.body), /code_verifier=pkce-verifier/);
        return Response.json({ id_token: token });
      }
      if (String(input) === auth.jwksUrl) return Response.json({ keys: [jwk] });
      throw new Error(`Unexpected URL ${String(input)}`);
    };

    const claims = await exchangeCognitoCode('auth-code', 'pkce-verifier', 'expected-nonce', auth);
    assert.equal(claims.sub, 'cognito-subject');
    assert.equal(claims.email, 'person@datatalks.club');
  });

  it('rejects an ID token issued for a different browser nonce', async () => {
    const { token, jwk } = signedToken('attacker-nonce');
    globalThis.fetch = async (input) => String(input) === auth.jwksUrl
      ? Response.json({ keys: [jwk] })
      : Response.json({ id_token: token });
    await assert.rejects(
      exchangeCognitoCode('auth-code', 'pkce-verifier', 'expected-nonce', auth),
      (error: unknown) => (error as { status?: number }).status === 401,
    );
  });
});
