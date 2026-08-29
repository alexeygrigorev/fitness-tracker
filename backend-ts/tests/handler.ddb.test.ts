import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { handler } from '../src/lambda.js';
import { startTestApi, type TestApi } from './helpers.js';

let api: TestApi;

describe('TypeScript Lambda API foundation', () => {
  let accessToken: string;
  let secondAccessToken: string;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    api?.stop();
  });

  it('reports a healthy DynamoDB-backed API', async () => {
    const result = await api.call('GET', '/api/health/');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      status: 'healthy',
      version: '1.0.0',
      framework: 'TypeScript Lambda',
    });
  });

  it('registers, logs in, reads, and updates the profile', async () => {
    const registered = await api.call('POST', '/api/auth/register/', { body: {
      username: 'foundation-user',
      email: 'foundation@example.com',
      password: 'strong-password-123',
      password_confirm: 'strong-password-123',
    }});
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.id, 1);
    assert.equal(registered.body.message, 'User created successfully');

    const loggedIn = await api.call('POST', '/api/auth/login/', { body: {
      username: 'foundation-user',
      password: 'strong-password-123',
    }});
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.user.email, 'foundation@example.com');
    assert.match(loggedIn.body.access, /^[^.]+\.[^.]+\.[^.]+$/);
    accessToken = loggedIn.body.access;

    const profile = await api.call('GET', '/api/auth/me/', { token: accessToken });
    assert.equal(profile.status, 200);
    assert.deepEqual(profile.body, {
      id: 1,
      username: 'foundation-user',
      email: 'foundation@example.com',
      dark_mode: false,
    });

    const updated = await api.call('PATCH', '/api/auth/me/update/', {
      body: { dark_mode: true },
      token: accessToken,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.dark_mode, true);
  });

  it('rejects anonymous profile access and bad credentials', async () => {
    const anonymous = await api.call('GET', '/api/auth/me/');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.detail, 'Authentication credentials were not provided.');

    const failed = await api.call('POST', '/api/auth/login/', { body: {
      username: 'foundation-user',
      password: 'wrong-password',
    }});
    assert.equal(failed.status, 400);
    assert.equal(failed.body.code, 'no_active_account');
  });

  it('stores user-specific canonical exercise settings', async () => {
    const created = await api.call('POST', '/api/auth/exercise-settings/101/', {
      body: { weight: 80, reps: 10 },
      token: accessToken,
    });
    assert.equal(created.status, 200);
    assert.deepEqual(created.body, { weight: 80, reps: 10 });

    const updated = await api.call('PATCH', '/api/auth/exercise-settings/101/', {
      body: { weight: 82.5, reps: 8, subSets: [{ weight: 70, reps: 6 }] },
      token: accessToken,
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body, {
      weight: 82.5,
      reps: 8,
      subSets: [{ weight: 70, reps: 6 }],
    });

    const listed = await api.call('GET', '/api/auth/exercise-settings/', { token: accessToken });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { 101: updated.body });

    const registered = await api.call('POST', '/api/auth/register/', { body: {
      username: 'isolation-user',
      email: 'isolation@example.com',
      password: 'another-password-123',
      password_confirm: 'another-password-123',
    }});
    assert.equal(registered.status, 201);
    const loggedIn = await api.call('POST', '/api/auth/login/', { body: {
      username: 'isolation-user',
      password: 'another-password-123',
    }});
    secondAccessToken = loggedIn.body.access;
    const isolated = await api.call('GET', '/api/auth/exercise-settings/', {
      token: secondAccessToken,
    });
    assert.deepEqual(isolated.body, {});
  });

  it('applies the default rep count and preserves an omitted weight on update', async () => {
    const first = await api.call('POST', '/api/auth/exercise-settings/102/', {
      body: {},
      token: accessToken,
    });
    assert.deepEqual(first.body, { reps: 10 });

    const second = await api.call('PATCH', '/api/auth/exercise-settings/102/', {
      body: { reps: 5 },
      token: accessToken,
    });
    assert.deepEqual(second.body, { reps: 5 });
  });

  it('returns DRF-compatible validation, ownership, routing, and CORS responses', async () => {
    const invalid = await api.call('POST', '/api/auth/register/', { body: {
      username: 'validator',
      email: 'not-an-email',
      password: 'short',
      password_confirm: 'different',
    }});
    assert.equal(invalid.status, 400);
    assert.ok(Array.isArray(invalid.body.email));
    assert.ok(Array.isArray(invalid.body.password));

    const missingExercise = await api.call('POST', '/api/auth/exercise-settings/999999/', {
      body: { reps: 8 },
      token: accessToken,
    });
    assert.equal(missingExercise.status, 404);

    const missingRoute = await api.call('GET', '/api/does-not-exist/');
    assert.equal(missingRoute.status, 404);

    const response = await handler({
      httpMethod: 'OPTIONS',
      path: '/api/auth/login/',
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  });
});
