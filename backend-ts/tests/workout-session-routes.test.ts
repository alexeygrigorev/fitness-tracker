import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  createWorkoutPreset,
  seedWorkoutExercise,
} from './workout-fixtures.js';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';
import { setTestClock } from '../src/workout-store.js';

let api: TestApi;

const BASE_MS = Date.UTC(2024, 0, 15, 10, 0, 0);
const BENCH = 201;
const ROWS = 202;
const DIPS = 203;
const CURLS = 204;
const SQUATS = 205;
const INCLINE = 206;
const OHP = 207;
const LATERAL = 208;
const TRICEPS = 209;

let nextUserId = 1;
let nextPresetId = 1000;
const tokenOwners = new Map<string, number>();

before(async () => {
  api = await startTestApi({ exerciseIds: [] });
  await Promise.all([
    seedWorkoutExercise(api, BENCH, 'Bench Press', { compound: true }),
    seedWorkoutExercise(api, ROWS, 'Barbell Rows', { compound: true }),
    seedWorkoutExercise(api, DIPS, 'Dips', { bodyweight: true }),
    seedWorkoutExercise(api, CURLS, 'Bicep Curls'),
    seedWorkoutExercise(api, SQUATS, 'Squats', { compound: true }),
    seedWorkoutExercise(api, INCLINE, 'Incline Dumbbell Press', { compound: true }),
    seedWorkoutExercise(api, OHP, 'Overhead Press', { compound: true }),
    seedWorkoutExercise(api, LATERAL, 'Lateral Raises'),
    seedWorkoutExercise(api, TRICEPS, 'Tricep Pushdowns'),
  ]);
});

after(() => {
  api?.stop();
});

function requiredSet<T>(value: T | undefined): T {
  assert.ok(value, 'Expected workout set to exist');
  return value;
}

function normalRow(
  id: number,
  exerciseId: number,
  order: number,
  options: {
    sets?: number;
    type?: 'normal' | 'dropdown' | 'bodyweight';
    dropdowns?: number;
    includeWarmup?: boolean;
  } = {},
) {
  return {
    kind: 'normal' as const,
    id,
    exerciseId,
    order,
    sets: options.sets ?? 3,
    ...(options.type === undefined ? {} : { type: options.type }),
    ...(options.dropdowns === undefined ? {} : { dropdowns: options.dropdowns }),
    ...(options.includeWarmup === undefined ? {} : { includeWarmup: options.includeWarmup }),
  };
}

async function login(usernamePrefix: string): Promise<string> {
  const suffix = nextUserId++;
  const session = await registerAndLogin(
    api,
    `${usernamePrefix}-${suffix}`,
    `${usernamePrefix}-${suffix}@example.com`,
  );
  tokenOwners.set(session.accessToken, session.userId);
  return session.accessToken;
}

async function createPreset(
  name: string,
  rows: Parameters<typeof createWorkoutPreset>[3],
): Promise<number> {
  const presetId = nextPresetId++;
  await createWorkoutPreset(api, presetId, name, rows);
  return presetId;
}

async function startWorkout(
  token: string,
  presetId: number,
  input: Record<string, unknown> = {},
) {
  const response = await api.call(
    'POST',
    `/api/workouts/presets/${presetId}/start_workout/`,
    { body: input, token },
  );
  assert.equal(response.status, 201);
  return response.body as {
    session: { id: number; bodyweight: number | null };
    sets: Array<Record<string, any>>;
  };
}

async function atTime(offsetSeconds: number, operation: () => Promise<void>) {
  const restoreNow = setTestClock(() => BASE_MS + offsetSeconds * 1000);
  try {
    await operation();
  } finally {
    restoreNow();
  }
}

async function fetchedSession(
  token: string,
  sessionId: number,
): Promise<Record<string, any>> {
  const response = await api.call('GET', `/api/workouts/sessions/${sessionId}/`, {
    token,
  });
  assert.equal(response.status, 200);
  return response.body;
}

async function activeSessions(token: string): Promise<Array<Record<string, any>>> {
  const response = await api.call('GET', '/api/workouts/sessions/active/', { token });
  assert.equal(response.status, 200);
  return response.body;
}

async function storedSet(ownerToken: string, setId: number): Promise<Record<string, any>> {
  const ownerId = tokenOwners.get(ownerToken);
  assert.ok(ownerId, 'Test token was not issued by the local auth helper');
  const result = await api.documentClient.send(new QueryCommand({
    TableName: api.tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${ownerId}`,
      ':prefix': 'WORKOUT_SET#',
    },
  }));
  const found = (result.Items ?? []).find((item) => item.id === setId);
  assert.ok(found);
  return found;
}

describe('TestWorkoutFlow', () => {
  let flowPreset: number;

  before(async () => {
    flowPreset = await createPreset('Push Pull Day', [
      normalRow(11, BENCH, 0, { includeWarmup: true }),
      {
        kind: 'superset',
        id: 12,
        sets: 2,
        order: 1,
        children: [
          { id: 121, exerciseId: ROWS, order: 0 },
          { id: 122, exerciseId: DIPS, order: 1 },
        ],
      },
      normalRow(13, CURLS, 2, { sets: 2 }),
    ]);
  });

  it('test_workout_flow_complete_sets_one_by_one', async () => {
    const token = await login('flow-complete');
    const started = await startWorkout(token, flowPreset);
    const sessionId = started.session.id;
    assert.equal(started.sets.length, 10);
    assert.equal(started.session.bodyweight, null);
    assert.ok(started.sets.every((set) => set.loggedAt === null));

    const delays = Array.from({ length: started.sets.length }, () => 31);
    let offset = 0;
    for (const [index, set] of started.sets.entries()) {
      offset += delays[index];
      await atTime(offset, async () => {
        const response = await api.call(
          'POST',
          `/api/workouts/sets/${set.id}/complete/`,
          { token },
        );
        assert.equal(response.status, 200);
        assert.notEqual(response.body.loggedAt, null);
      });
    }

    const session = await fetchedSession(token, sessionId);
    const completedTimes = session.sets
      .map((set: { loggedAt: string | null }): string | null => set.loggedAt)
      .filter((value: string | null): value is string => value !== null)
      .sort();
    assert.equal(completedTimes.length, 10);
    for (let index = 1; index < completedTimes.length; index += 1) {
      assert.ok(completedTimes[index] > completedTimes[index - 1]);
    }
    const firstCompletedAt = completedTimes.at(0);
    const lastCompletedAt = completedTimes.at(-1);
    assert.ok(firstCompletedAt && lastCompletedAt);
    const duration = (Date.parse(lastCompletedAt) -
      Date.parse(completedTimes[0])) / 1000;
    assert.ok(duration > 270 && duration < 1200);

    let endedAt = '';
    await atTime(offset + 60, async () => {
      const finished = await api.call(
        'POST',
        `/api/workouts/sessions/${sessionId}/finish/`,
        { token },
      );
      assert.equal(finished.status, 200);
      endedAt = finished.body.endedAt;
    });
    assert.ok(lastCompletedAt);
    assert.match(endedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(Date.parse(endedAt) > Date.parse(lastCompletedAt), true);
  });

  it('test_workout_flow_update_set_values_before_completing', async () => {
    const token = await login('flow-update');
    const started = await startWorkout(token, flowPreset);
    const benchSet = requiredSet(started.sets.find((set) => set.exerciseId === BENCH));
    const updated = await api.call('PATCH', `/api/workouts/sets/${benchSet.id}/`, {
      body: { weight: '135.00', reps: 10 },
      token,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.weight, 135);
    assert.equal(updated.body.reps, 10);
    assert.equal(updated.body.loggedAt, null);

    const completed = await api.call(
      'POST',
      `/api/workouts/sets/${benchSet.id}/complete/`,
      { token },
    );
    assert.equal(completed.status, 200);
    assert.equal(completed.body.weight, 135);
    assert.equal(completed.body.reps, 10);
  });

  it('test_workout_flow_partial_completion', async () => {
    const token = await login('flow-partial');
    const started = await startWorkout(token, flowPreset);
    for (const set of started.sets.slice(0, 5)) {
      const response = await api.call(
        'POST',
        `/api/workouts/sets/${set.id}/complete/`,
        { token },
      );
      assert.equal(response.status, 200);
    }

    const finished = await api.call(
      'POST',
      `/api/workouts/sessions/${started.session.id}/finish/`,
      { token },
    );
    assert.equal(finished.status, 200);
    const session = await fetchedSession(token, started.session.id);
    assert.notEqual(session.endedAt, null);
    assert.equal(session.sets.filter((set: any) => set.loggedAt).length, 5);
  });

  it('test_workout_flow_user_can_only_see_own_sets', async () => {
    const token = await login('flow-owner');
    const otherToken = await login('flow-other');
    const otherCreated = await api.call('POST', '/api/workouts/sessions/', {
      body: {
        name: "Other's Workout",
        sets: [{ exerciseId: BENCH, reps: 1 }],
      },
      token: otherToken,
    });
    assert.equal(otherCreated.status, 201);
    const foreignSetId = otherCreated.body.sets[0].id;

    assert.equal(
      (await api.call('GET', `/api/workouts/sets/${foreignSetId}/`, { token })).status,
      404,
    );
    assert.equal(
      (await api.call('POST', `/api/workouts/sets/${foreignSetId}/complete/`, { token })).status,
      404,
    );
  });

  it('test_workout_flow_realistic_timing', async () => {
    const token = await login('flow-timing');
    const started = await startWorkout(token, flowPreset);
    const restByExercise = new Map([
      [BENCH, 150],
      [ROWS, 150],
      [DIPS, 60],
      [CURLS, 75],
    ]);
    let offset = 0;
    for (const set of started.sets) {
      offset += set.weight === null ? 60 : restByExercise.get(set.exerciseId) ?? 75;
      await atTime(offset, async () => {
        const response = await api.call(
          'POST',
          `/api/workouts/sets/${set.id}/complete/`,
          { token },
        );
        assert.equal(response.status, 200);
      });
    }

    let finishedAt: string = '';
    await atTime(offset + 120, async () => {
      const finished = await api.call(
        'POST',
        `/api/workouts/sessions/${started.session.id}/finish/`,
        { token },
      );
      assert.equal(finished.status, 200);
      finishedAt = finished.body.endedAt;
    });
    const durationSeconds = (Date.parse(finishedAt) - BASE_MS) / 1000;
    assert.ok(durationSeconds > 600 && durationSeconds < 3600);
  });

  it('test_workout_flow_bodyweight_tracking', async () => {
    const token = await login('flow-bodyweight');
    const started = await startWorkout(token, flowPreset, { bodyweight: '180.5' });
    assert.equal(started.session.bodyweight, 180.5);
    const dipsSet = requiredSet(started.sets.find((set) => set.exerciseId === DIPS));
    const updated = await api.call('PATCH', `/api/workouts/sets/${dipsSet.id}/`, {
      body: { reps: 12 },
      token,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.reps, 12);

    const completed = await api.call(
      'POST',
      `/api/workouts/sets/${dipsSet.id}/complete/`,
      { token },
    );
    assert.equal(completed.body.reps, 12);
    const stored = await storedSet(token, dipsSet.id);
    assert.equal(stored.reps, 12);
    const session = await fetchedSession(token, started.session.id);
    assert.equal(session.bodyweight, 180.5);
  });

  it('test_workout_session_create_with_bodyweight', async () => {
    const token = await login('flow-create-session');
    const created = await api.call('POST', '/api/workouts/sessions/', {
      body: {
        name: 'Test Bodyweight Session',
        startedAt: new Date(BASE_MS).toISOString(),
        bodyweight: 175,
        sets: [{ exerciseId: DIPS, setType: 'normal', reps: 15 }],
      },
      token,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.bodyweight, 175);
    assert.equal(created.body.sets[0].exerciseId, DIPS);
    assert.equal(created.body.sets[0].reps, 15);

    const stored = await storedSet(token, created.body.sets[0].id);
    assert.equal(stored.reps, 15);
  });

  it('test_workout_set_uncomplete', async () => {
    const token = await login('flow-uncomplete');
    const started = await startWorkout(token, flowPreset);
    const benchSet = requiredSet(started.sets.find((set) => set.exerciseId === BENCH));
    const completed = await api.call(
      'POST',
      `/api/workouts/sets/${benchSet.id}/complete/`,
      { token },
    );
    assert.notEqual(completed.body.loggedAt, null);

    const uncompleted = await api.call(
      'POST',
      `/api/workouts/sets/${benchSet.id}/uncomplete/`,
      { token },
    );
    assert.equal(uncompleted.status, 200);
    assert.equal(uncompleted.body.loggedAt, null);
    assert.equal((await storedSet(token, benchSet.id)).completed_at, undefined);
  });
});

describe('TestSimplifiedSetAPI', () => {
  let simplePreset: number;

  before(async () => {
    simplePreset = await createPreset('Test Day', [
      normalRow(21, BENCH, 0),
      normalRow(22, DIPS, 1, { type: 'bodyweight', sets: 2 }),
    ]);
  });

  it('test_complete_set_via_new_api', async () => {
    const token = await login('new-api-complete');
    const started = await startWorkout(token, simplePreset);
    const completed = await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${started.sets[0].id}/`,
      { body: { weight: 100, reps: 8 }, token },
    );
    assert.equal(completed.status, 200);
    assert.equal(completed.body.weight, 100);
    assert.equal(completed.body.reps, 8);
    const stored = await storedSet(token, started.sets[0].id);
    assert.equal(stored.weight, 100);
    assert.notEqual(stored.completed_at, undefined);
  });

  it('test_complete_set_without_data', async () => {
    const token = await login('new-api-empty');
    const started = await startWorkout(token, simplePreset);
    const response = await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${started.sets[0].id}/`,
      { body: {}, token },
    );
    assert.equal(response.status, 200);
    assert.notEqual(response.body.loggedAt, null);
  });

  it('test_uncomplete_set_via_new_api', async () => {
    const token = await login('new-api-uncomplete');
    const started = await startWorkout(token, simplePreset);
    const setId = started.sets[0].id;
    await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${setId}/`,
      { body: {}, token },
    );
    const response = await api.call(
      'DELETE',
      `/api/workouts/sessions/${started.session.id}/sets/${setId}/completion/`,
      { token },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.loggedAt, null);
    assert.equal((await storedSet(token, setId)).completed_at, undefined);
  });

  it('test_cannot_complete_set_from_different_session', async () => {
    const token = await login('new-api-cross');
    const otherToken = await login('new-api-other');
    const otherSession = await api.call('POST', '/api/workouts/sessions/', {
      body: { name: 'Other Workout', sets: [{ exerciseId: BENCH }] },
      token: otherToken,
    });
    const started = await startWorkout(token, simplePreset);
    const response = await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${otherSession.body.sets[0].id}/`,
      { body: {}, token },
    );
    assert.equal(response.status, 404);
  });

  it('test_workout_flow_new_api', async () => {
    const token = await login('new-api-flow');
    const started = await startWorkout(token, simplePreset);
    assert.equal(started.sets.length, 5);
    for (const [index, set] of started.sets.slice(0, 2).entries()) {
      const response = await api.call(
        'PATCH',
        `/api/workouts/sessions/${started.session.id}/sets/${set.id}/`,
        { body: { weight: 80 + index * 5, reps: 10 }, token },
      );
      assert.notEqual(response.body.loggedAt, null);
    }
    const fetched = await fetchedSession(token, started.session.id);
    assert.equal(fetched.sets.filter((set: any) => set.loggedAt).length, 2);
    const finished = await api.call(
      'POST',
      `/api/workouts/sessions/${started.session.id}/finish/`,
      { token },
    );
    assert.notEqual(finished.body.endedAt, null);
  });

  it('test_resume_and_complete_more_sets', async () => {
    const token = await login('new-api-resume');
    const started = await startWorkout(token, simplePreset);
    await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${started.sets[0].id}/`,
      { body: { weight: 100, reps: 8 }, token },
    );
    await api.call('POST', `/api/workouts/sessions/${started.session.id}/finish/`, { token });
    const resumed = await fetchedSession(token, started.session.id);
    assert.equal(resumed.sets.filter((set: any) => set.loggedAt).length, 1);
    await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${started.sets[1].id}/`,
      { body: { weight: 100, reps: 8 }, token },
    );
    assert.equal(
      (await fetchedSession(token, started.session.id)).sets
        .filter((set: any) => set.loggedAt).length,
      2,
    );
  });

  it('test_bodyweight_set_completion', async () => {
    const token = await login('new-api-bodyweight');
    const started = await startWorkout(token, simplePreset);
    const dipsSet = requiredSet(started.sets.find((set) => set.exerciseId === DIPS));
    const response = await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${dipsSet.id}/`,
      { body: { reps: 12 }, token },
    );
    assert.equal(response.body.reps, 12);
  });

  it('test_complete_and_uncomplete_cycle', async () => {
    const token = await login('new-api-cycle');
    const started = await startWorkout(token, simplePreset);
    const sessionId = started.session.id;
    const setId = started.sets[0].id;
    await api.call(`PATCH`, `/api/workouts/sessions/${sessionId}/sets/${setId}/`, {
      body: { weight: 100, reps: 8 },
      token,
    });
    await api.call('DELETE', `/api/workouts/sessions/${sessionId}/sets/${setId}/completion/`, {
      token,
    });
    const again = await api.call(`PATCH`, `/api/workouts/sessions/${sessionId}/sets/${setId}/`, {
      body: { weight: 105, reps: 8 },
      token,
    });
    assert.equal(again.body.weight, 105);
    assert.notEqual(again.body.loggedAt, null);
  });
});

describe('TestDropdownWeights', () => {
  let dropdownPreset: number;

  before(async () => {
    dropdownPreset = await createPreset('Dropdown Test', [
      normalRow(31, BENCH, 0, { type: 'dropdown', dropdowns: 2 }),
    ]);
  });

  it('test_start_workout_creates_dropdown_weights', async () => {
    const token = await login('dropdown-created');
    const started = await startWorkout(token, dropdownPreset);
    assert.equal(started.sets.length, 3);
    for (const set of started.sets) {
      assert.deepEqual(set.dropdownWeights, [
        { weight: 60, reps: 10 },
        { weight: 57.5, reps: 10 },
        { weight: 55, reps: 10 },
      ]);
    }
  });

  it('test_complete_dropdown_set_with_weights', async () => {
    const token = await login('dropdown-custom');
    const started = await startWorkout(token, dropdownPreset);
    const customWeights = [
      { weight: 70, reps: 8 },
      { weight: 65, reps: 8 },
      { weight: 60, reps: 8 },
    ];
    const response = await api.call(
      'PATCH',
      `/api/workouts/sets/${started.sets[0].id}/`,
      { body: { dropdownWeights: customWeights }, token },
    );
    assert.deepEqual(response.body.dropdownWeights, customWeights);
  });

  it('test_active_session_returns_dropdown_weights', async () => {
    const token = await login('dropdown-active');
    await startWorkout(token, dropdownPreset);
    const sessions = await activeSessions(token);
    const dropdownSets = sessions[0].sets.filter((set: any) => set.setType === 'dropdown');
    assert.ok(dropdownSets.every((set: any) => set.dropdownWeights !== null));
  });

  it('test_persist_dropdown_completion_across_pages', async () => {
    const token = await login('dropdown-persist');
    const started = await startWorkout(token, dropdownPreset);
    const customWeights = [
      { weight: 60, reps: 10 },
      { weight: 57.5, reps: 10 },
      { weight: 55, reps: 10 },
    ];
    await api.call('PATCH', `/api/workouts/sets/${started.sets[0].id}/`, {
      body: { dropdownWeights: customWeights },
      token,
    });
    const completed = await api.call(
      'POST',
      `/api/workouts/sets/${started.sets[0].id}/complete/`,
      { token },
    );
    assert.notEqual(completed.body.loggedAt, null);
    const reloaded = (await activeSessions(token))[0];
    const persisted = reloaded.sets.find((set: any) => set.id === started.sets[0].id);
    assert.deepEqual(persisted.dropdownWeights, customWeights);
  });

  it('test_multiple_dropdown_sets_completion', async () => {
    const mixedPreset = await createPreset('Mixed Dropdown Day', [
      normalRow(34, BENCH, 0, { type: 'dropdown', dropdowns: 2 }),
      normalRow(35, INCLINE, 1),
    ]);
    const token = await login('dropdown-multiple');
    const started = await startWorkout(token, mixedPreset);
    const dropdownSet = requiredSet(started.sets.find((set: any) => set.setType === 'dropdown'));
    const normalSet = requiredSet(started.sets.find((set: any) =>
      set.setType === 'normal' && set.exerciseId === INCLINE));
    await api.call('POST', `/api/workouts/sets/${dropdownSet.id}/complete/`, { token });
    await api.call('POST', `/api/workouts/sets/${normalSet.id}/complete/`, { token });
    const active = (await activeSessions(token))[0];
    assert.equal(active.sets.filter((set: any) => set.loggedAt).length, 2);
  });
});

describe('TestMultipleActiveSessions', () => {
  let pushPreset: number;
  let legPreset: number;

  before(async () => {
    pushPreset = await createPreset('Push Day', [normalRow(32, BENCH, 0)]);
    legPreset = await createPreset('Leg Day', [normalRow(33, SQUATS, 0)]);
  });

  it('test_multiple_active_sessions', async () => {
    const token = await login('sessions-multiple');
    const first = await startWorkout(token, pushPreset);
    const second = await startWorkout(token, legPreset);
    const active = await activeSessions(token);
    assert.equal(active.length, 2);
    assert.deepEqual(new Set(active.map((session) => session.id)), new Set([
      first.session.id,
      second.session.id,
    ]));
  });

  it('test_finishing_one_workout_leaves_other_active', async () => {
    const token = await login('sessions-finish-one');
    const first = await startWorkout(token, pushPreset);
    const second = await startWorkout(token, legPreset);
    await api.call('POST', `/api/workouts/sets/${first.sets[0].id}/complete/`, { token });
    await api.call('POST', `/api/workouts/sets/${first.sets[1].id}/complete/`, { token });
    await api.call('POST', `/api/workouts/sessions/${first.session.id}/finish/`, { token });
    const active = await activeSessions(token);
    assert.deepEqual(active.map((session) => session.id), [second.session.id]);
  });

  it('test_finishing_all_workouts_returns_empty_list', async () => {
    const token = await login('sessions-finish-all');
    const first = await startWorkout(token, pushPreset);
    const second = await startWorkout(token, legPreset);
    await api.call('POST', `/api/workouts/sessions/${first.session.id}/finish/`, { token });
    await api.call('POST', `/api/workouts/sessions/${second.session.id}/finish/`, { token });
    assert.deepEqual(await activeSessions(token), []);
  });

  it('test_all_sessions_included_in_list_endpoint', async () => {
    const token = await login('sessions-list-all');
    const first = await startWorkout(token, pushPreset);
    const second = await startWorkout(token, legPreset);
    await api.call('POST', `/api/workouts/sessions/${first.session.id}/finish/`, { token });
    const listed = await api.call('GET', '/api/workouts/sessions/', { token });
    assert.equal(listed.status, 200);
    assert.deepEqual(new Set(listed.body.map((session: any) => session.id)), new Set([
      first.session.id,
      second.session.id,
    ]));
  });
});

describe('TestWeightSerialization', () => {
  let normalPreset: number;
  let warmupPreset: number;
  let serializedDropdownPreset: number;

  before(async () => {
    normalPreset = await createPreset('Numeric Test', [normalRow(41, BENCH, 0)]);
    warmupPreset = await createPreset('Warmup Numeric Test', [
      normalRow(42, BENCH, 0, { includeWarmup: true }),
    ]);
    serializedDropdownPreset = await createPreset('Dropdown Numeric Test', [
      normalRow(43, BENCH, 0, { type: 'dropdown', sets: 2, dropdowns: 2 }),
    ]);
  });

  it('test_integer_weight_serializes_as_number', async () => {
    const token = await login('numeric-integer');
    const started = await startWorkout(token, normalPreset);
    await api.call('PATCH', `/api/workouts/sets/${started.sets[0].id}/`, {
      body: { weight: 60 },
      token,
    });
    const data = await fetchedSession(token, started.session.id);
    const set = data.sets.find((item: any) => item.id === started.sets[0].id);
    assert.equal(typeof set.weight, 'number');
    assert.equal(set.weight, 60);
  });

  it('test_decimal_weight_serializes_as_number', async () => {
    const token = await login('numeric-decimal');
    const started = await startWorkout(token, normalPreset);
    await api.call('PATCH', `/api/workouts/sets/${started.sets[0].id}/`, {
      body: { weight: 60.5 },
      token,
    });
    const set = (await fetchedSession(token, started.session.id)).sets[0];
    assert.equal(typeof set.weight, 'number');
    assert.equal(set.weight, 60.5);
  });

  it('test_null_weight_serializes_as_null', async () => {
    const token = await login('numeric-null');
    const started = await startWorkout(token, warmupPreset);
    const warmup = requiredSet(started.sets.find((set) => set.setType === 'warmup'));
    assert.equal(warmup.weight, null);
  });

  it('test_bodyweight_session_serializes_as_number', async () => {
    const token = await login('numeric-bodyweight');
    const created = await api.call('POST', '/api/workouts/sessions/', {
      body: { name: 'Test', bodyweight: 75.5 },
      token,
    });
    assert.equal(created.status, 201);
    assert.equal(typeof created.body.bodyweight, 'number');
    assert.equal(created.body.bodyweight, 75.5);
  });

  it('test_dropdown_weights_serialize_as_numbers', async () => {
    const token = await login('numeric-dropdown');
    const started = await startWorkout(token, serializedDropdownPreset);
    for (const item of started.sets[0].dropdownWeights) {
      assert.equal(typeof item.weight, 'number');
    }
  });
});

describe('TestDropdownUncompleteResumeComplete', () => {
  let resumePreset: number;

  before(async () => {
    resumePreset = await createPreset('Push Day Resume', [
      normalRow(51, BENCH, 0, { type: 'dropdown', dropdowns: 2 }),
    ]);
  });

  it('test_dropdown_uncomplete_reload_complete', async () => {
    const token = await login('dropdown-resume-old');
    const started = await startWorkout(token, resumePreset);
    assert.equal(started.sets.length, 3);
    const weights = [
      { weight: 60, reps: 10 },
      { weight: 57.5, reps: 10 },
      { weight: 55, reps: 10 },
    ];
    for (const set of started.sets) {
      await api.call('PATCH', `/api/workouts/sets/${set.id}/`, {
        body: { dropdownWeights: weights },
        token,
      });
      await api.call('POST', `/api/workouts/sets/${set.id}/complete/`, { token });
    }

    const uncompleted = await api.call(
      'POST',
      `/api/workouts/sets/${started.sets[1].id}/uncomplete/`,
      { token },
    );
    assert.equal(uncompleted.body.loggedAt, null);
    assert.deepEqual(uncompleted.body.dropdownWeights, weights);
    assert.deepEqual(await storedSet(token, started.sets[1].id).then((set) => set.dropdown_weights), weights);

    const reloaded = (await activeSessions(token))[0];
    const resumedSet = reloaded.sets.find((set: any) => set.id === started.sets[1].id);
    assert.equal(resumedSet.setType, 'dropdown');
    assert.equal(resumedSet.loggedAt, null);
    assert.deepEqual(resumedSet.dropdownWeights, weights);

    const newWeights = [
      { weight: 65, reps: 8 },
      { weight: 62.5, reps: 8 },
      { weight: 60, reps: 8 },
    ];
    const recompleted = await api.call(
      'PATCH',
      `/api/workouts/sets/${started.sets[1].id}/`,
      { body: { dropdownWeights: newWeights }, token },
    ).then(async (updated) => {
      assert.deepEqual(updated.body.dropdownWeights, newWeights);
      return api.call('POST', `/api/workouts/sets/${started.sets[1].id}/complete/`, { token });
    });
    assert.deepEqual(recompleted.body.dropdownWeights, newWeights);
    assert.equal(
      (await activeSessions(token))[0].sets.filter((set: any) => set.loggedAt).length,
      3,
    );
  });

  it('test_dropdown_uncomplete_via_new_api', async () => {
    const token = await login('dropdown-resume-new');
    const started = await startWorkout(token, resumePreset);
    const setId = started.sets[0].id;
    const customWeights = [
      { weight: 70, reps: 8 },
      { weight: 65, reps: 8 },
      { weight: 60, reps: 8 },
    ];
    await api.call('PATCH', `/api/workouts/sessions/${started.session.id}/sets/${setId}/`, {
      body: { dropdownWeights: customWeights },
      token,
    });
    await api.call(
      'DELETE',
      `/api/workouts/sessions/${started.session.id}/sets/${setId}/completion/`,
      { token },
    );
    const reloaded = (await activeSessions(token))[0].sets.find((set: any) => set.id === setId);
    assert.equal(reloaded.setType, 'dropdown');
    assert.equal(reloaded.loggedAt, null);
    assert.deepEqual(reloaded.dropdownWeights, customWeights);

    const again = await api.call(
      'PATCH',
      `/api/workouts/sessions/${started.session.id}/sets/${setId}/`,
      { body: { dropdownWeights: customWeights }, token },
    );
    assert.notEqual(again.body.loggedAt, null);
  });
});

describe('TestE2ECompleteScenario', () => {
  it('test_complete_e2e_scenario', async () => {
    const pushDayPreset = await createPreset('Push Day E2E', [
      normalRow(61, BENCH, 0, { type: 'dropdown', sets: 4, dropdowns: 2 }),
      normalRow(62, INCLINE, 1, { sets: 4 }),
      normalRow(63, OHP, 2, { sets: 3 }),
      normalRow(64, LATERAL, 3, { sets: 3 }),
      normalRow(65, TRICEPS, 4, { sets: 3 }),
    ]);
    const token = await login('e2e-scenario');
    const started = await startWorkout(token, pushDayPreset);
    const sessionId = started.session.id;
    assert.equal(started.sets.length, 17);
    const benchSets = started.sets.filter((set) => set.exerciseId === BENCH);
    assert.equal(benchSets.length, 4);

    for (const setId of [benchSets[0].id, benchSets[1].id]) {
      const response = await api.call(
        'PATCH',
        `/api/workouts/sessions/${sessionId}/sets/${setId}/`,
        {
          body: {
            dropdownWeights: [
              { weight: 60, reps: 10 },
              { weight: 57.5, reps: 10 },
              { weight: 55, reps: 10 },
            ],
          },
          token,
        },
      );
      assert.equal(response.status, 200);
    }

    const ohpSet = requiredSet(started.sets.find((set) => set.exerciseId === OHP));
    const ohpResponse = await api.call(
      'PATCH',
      `/api/workouts/sessions/${sessionId}/sets/${ohpSet.id}/`,
      { body: { weight: 30, reps: 8 }, token },
    );
    assert.equal(ohpResponse.body.weight, 30);
    assert.equal((await fetchedSession(token, sessionId)).sets.filter((set: any) =>
      set.loggedAt).length, 3);

    await api.call('POST', `/api/workouts/sessions/${sessionId}/finish/`, { token });
    const resumed = await fetchedSession(token, sessionId);
    assert.equal(resumed.sets.length, 17);
    assert.equal(resumed.sets.filter((set: any) => set.loggedAt).length, 3);

    await api.call('PATCH', `/api/workouts/sessions/${sessionId}/sets/${benchSets[2].id}/`, {
      body: {
        dropdownWeights: [
          { weight: 62.5, reps: 8 },
          { weight: 60, reps: 8 },
          { weight: 57.5, reps: 8 },
        ],
      },
      token,
    });
    const lateralSet = requiredSet(started.sets.find((set) => set.exerciseId === LATERAL));
    await api.call('PATCH', `/api/workouts/sessions/${sessionId}/sets/${lateralSet.id}/`, {
      body: { weight: 10, reps: 12 },
      token,
    });
    await api.call('POST', `/api/workouts/sessions/${sessionId}/finish/`, { token });

    const allSessions = await api.call('GET', '/api/workouts/sessions/', { token });
    assert.equal(allSessions.body.filter((session: any) => session.id === sessionId).length, 1);
    const finalSession = await fetchedSession(token, sessionId);
    assert.equal(finalSession.name, 'Push Day E2E');
    assert.notEqual(finalSession.endedAt, null);
    assert.equal(finalSession.sets.filter((set: any) => set.loggedAt).length, 5);
  });
});

describe('TestSessionsSetsRoutes', () => {
  async function createSession(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, any>> {
    const response = await api.call('POST', '/api/workouts/sessions/', {
      body: {
        name: 'Original Session',
        notes: 'Original notes',
        bodyweight: 70.5,
        startedAt: new Date(BASE_MS).toISOString(),
        endedAt: null,
        sets: [
          { exerciseId: BENCH, set_order: 2, reps: 8, weight: 100 },
          { exerciseId: ROWS, set_order: 0, reps: 9 },
        ],
        ...overrides,
      },
      token,
    });
    assert.equal(response.status, 201);
    return response.body;
  }

  it('test_put_session_replaces_writable_fields_and_preserves_sets', async () => {
    const token = await login('session-put');
    const created = await createSession(token);
    const response = await api.call(
      'PUT',
      `/api/workouts/sessions/${created.id}/`,
      {
        body: {
          name: 'Replaced Session',
          notes: 'Replaced notes',
          bodyweight: 72,
          startedAt: new Date(BASE_MS + 60_000).toISOString(),
          endedAt: new Date(BASE_MS + 3_600_000).toISOString(),
        },
        token,
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      {
        id: response.body.id,
        name: response.body.name,
        notes: response.body.notes,
        bodyweight: response.body.bodyweight,
        startedAt: response.body.startedAt,
        endedAt: response.body.endedAt,
        preset: response.body.preset,
      },
      {
        id: created.id,
        name: 'Replaced Session',
        notes: 'Replaced notes',
        bodyweight: 72,
        startedAt: new Date(BASE_MS + 60_000).toISOString(),
        endedAt: new Date(BASE_MS + 3_600_000).toISOString(),
        preset: null,
      },
    );
    assert.deepEqual(response.body.sets.map((set: any) => set.id), created.sets.map((set: any) => set.id));

    const fetched = await fetchedSession(token, created.id);
    assert.equal(fetched.name, 'Replaced Session');
    assert.equal(fetched.sets.length, 2);
  });

  it('test_patch_session_clears_nullable_field_and_preserves_unspecified_fields', async () => {
    const token = await login('session-patch');
    const created = await createSession(token);
    const originalStartedAt = created.startedAt;
    const response = await api.call(
      'PATCH',
      `/api/workouts/sessions/${created.id}/`,
      {
        body: {
          notes: null,
          endedAt: new Date(BASE_MS + 60_000).toISOString(),
        },
        token,
      },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Original Session');
    assert.equal(response.body.notes, null);
    assert.equal(response.body.bodyweight, 70.5);
    assert.equal(response.body.startedAt, originalStartedAt);
    assert.equal(response.body.endedAt, new Date(BASE_MS + 60_000).toISOString());

    const clearedEnd = await api.call(
      'PATCH',
      `/api/workouts/sessions/${created.id}/`,
      { body: { endedAt: null }, token },
    );
    assert.equal(clearedEnd.status, 200);
    assert.equal(clearedEnd.body.endedAt, null);
  });

  it('test_get_all_sets_is_owner_scoped_and_sorted', async () => {
    const token = await login('sets-list');
    const otherToken = await login('sets-list-other');
    const owned = await createSession(token);
    const foreign = await createSession(otherToken);

    const ownedIds = owned.sets.map((set: any) => set.id);
    const foreignIds = foreign.sets.map((set: any) => set.id);
    assert.notDeepEqual(ownedIds, foreignIds);

    const listed = await api.call('GET', '/api/workouts/sets/', { token });
    assert.equal(listed.status, 200);
    const ownListed = listed.body.filter((set: any) => ownedIds.includes(set.id));
    assert.deepEqual(ownListed.map((set: any) => set.id), ownedIds);
    assert.equal(listed.body.some((set: any) => foreignIds.includes(set.id)), false);
    assert.deepEqual(
      ownListed.map((set: any) => [set.session, set.set_order]),
      [
        [owned.id, 0],
        [owned.id, 2],
      ],
    );
  });

  it('test_put_set_replaces_relationships_and_moves_sort_key_atomically', async () => {
    const token = await login('set-put');
    const source = await createSession(token);
    const target = await createSession(token, {
      name: 'Target Session',
      sets: [{ exerciseId: CURLS, set_order: 0, reps: 10 }],
    });
    const current = source.sets.find((set: any) => set.exerciseId === BENCH);

    const response = await api.call('PUT', `/api/workouts/sets/${current.id}/`, {
      body: {
        exerciseId: DIPS,
        session: target.id,
        setType: 'bodyweight',
        reps: 12,
        weight: null,
        set_order: 5,
      },
      token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exerciseId, DIPS);
    assert.equal(response.body.exerciseName, 'Dips');
    assert.equal(response.body.session, target.id);
    assert.equal(response.body.setType, 'bodyweight');
    assert.equal(response.body.reps, 12);
    assert.equal(response.body.weight, null);
    assert.equal(response.body.set_order, 5);

    const stored = await storedSet(token, current.id);
    assert.equal(stored.sk, `WORKOUT_SET#00000005#${current.id}`);
    const targetSession = await fetchedSession(token, target.id);
    assert.equal(targetSession.sets.filter((set: any) => set.id === current.id).length, 1);
    const sourceSession = await fetchedSession(token, source.id);
    assert.equal(sourceSession.sets.some((set: any) => set.id === current.id), false);
  });

  it('test_explicit_null_preferred_set_type_beats_snake_case_alias', async () => {
    const token = await login('alias-precedence');
    const created = await createSession(token);
    const current = created.sets[0];

    const rejected = await api.call('PATCH', `/api/workouts/sets/${current.id}/`, {
      body: { setType: null, set_type: 'bodyweight' },
      token,
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(rejected.body, {
      setType: ['"null" is not a valid choice.'],
    });

    const unchanged = await api.call('GET', `/api/workouts/sets/${current.id}/`, {
      token,
    });
    assert.equal(unchanged.body.setType, current.setType);
  });

  it('test_workout_delete_responses_have_no_body', async () => {
    const token = await login('empty-delete');
    const created = await createSession(token, {
      sets: [{ exerciseId: BENCH, set_order: 0 }],
    });
    const setId = created.sets[0].id;

    const deletedSet = await api.call('DELETE', `/api/workouts/sets/${setId}/`, {
      token,
    });
    assert.equal(deletedSet.status, 204);
    assert.equal(deletedSet.body, null);
    assert.equal(deletedSet.headers['content-type'], undefined);

    const deletedSession = await api.call(
      'DELETE',
      `/api/workouts/sessions/${created.id}/`,
      { token },
    );
    assert.equal(deletedSession.status, 204);
    assert.equal(deletedSession.body, null);
    assert.equal(deletedSession.headers['content-type'], undefined);

    assert.equal(
      (await api.call('GET', `/api/workouts/sessions/${created.id}/`, { token })).status,
      404,
    );
  });
});
