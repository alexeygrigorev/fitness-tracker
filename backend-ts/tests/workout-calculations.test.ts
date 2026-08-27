import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';

let api: TestApi;
let token: string;

before(async () => {
  api = await startTestApi({ exerciseIds: [] });
  ({ accessToken: token } = await registerAndLogin(api, 'volume-calc-user'));
});

after(() => {
  api?.stop();
});

describe('POST /api/workouts/calculations/calculate-volume', () => {
  it('requires authentication', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      body: { sets: [] },
    });
    assert.equal(response.status, 401);
  });

  it('computes total volume and per-exercise breakdown', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: {
        sets: [
          { weight_lbs: 100, reps: 10, exercise_id: 'bench' },
          { weight_lbs: 80, reps: 12, exercise_id: 'bench' },
          { weight_lbs: 45, reps: 8, exercise_id: 'rows' },
        ],
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.total_volume, 100 * 10 + 80 * 12 + 45 * 8);
    assert.equal(response.body.volume_by_exercise.bench, 100 * 10 + 80 * 12);
    assert.equal(response.body.volume_by_exercise.rows, 45 * 8);
  });

  it('defaults missing fields (weight_lbs=0, reps=0, exercise_id="unknown")', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: [{}] },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.total_volume, 0);
    assert.equal(response.body.volume_by_exercise.unknown, 0);
  });

  it('treats a missing sets field as an empty list', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: {},
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.total_volume, 0);
    assert.deepEqual(response.body.volume_by_exercise, {});
  });

  it('rejects a non-list sets payload', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: 'not-a-list' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.sets[0], /Expected a list of items/);
  });

  it('rejects a negative weight with a nested per-item error', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: [{ weight_lbs: -5, reps: 1 }] },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.sets['0'].weight_lbs, [
      'Ensure this value is greater than or equal to 0.',
    ]);
  });

  it('rejects reps above the max value', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: [{ reps: 10001 }] },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.sets['0'].reps, [
      'Ensure this value is less than or equal to 10000.',
    ]);
  });

  it('rejects a weight with too many decimal places', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: [{ weight_lbs: '1.234' }] },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.sets['0'].weight_lbs, [
      'Ensure that there are no more than 2 decimal places.',
    ]);
  });

  it('accepts a numeric exercise_id and groups by its string form', async () => {
    const response = await api.call('POST', '/api/workouts/calculations/calculate-volume/', {
      token,
      body: { sets: [{ weight_lbs: 50, reps: 5, exercise_id: 42 }] },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.volume_by_exercise['42'], 250);
  });
});
