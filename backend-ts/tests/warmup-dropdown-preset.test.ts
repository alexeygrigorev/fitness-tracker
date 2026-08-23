import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  createWorkoutPreset,
  seedWorkoutExercise,
} from './workout-fixtures.js';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';

let api: TestApi;

const BENCH = 501;
const INCLINE = 502;
const OHP = 503;
const LATERAL = 504;
const TRICEPS = 505;
const DIPS = 506;
const PULLUPS = 507;

interface WorkoutSet {
  id: number;
  exerciseId: number;
  setType: string;
  weight: number | null;
  dropdownWeights: Array<Record<string, number>> | null;
  loggedAt: string | null;
}

let nextUser = 1;
const tokenOwners = new Map<string, number>();

before(async () => {
  api = await startTestApi({ exerciseIds: [] });
  await Promise.all([
    seedWorkoutExercise(api, BENCH, 'Bench Press', { compound: true }),
    seedWorkoutExercise(api, INCLINE, 'Incline Dumbbell Press', { compound: true }),
    seedWorkoutExercise(api, OHP, 'Overhead Press', { compound: true }),
    seedWorkoutExercise(api, LATERAL, 'Lateral Raises'),
    seedWorkoutExercise(api, TRICEPS, 'Tricep Pushdowns'),
    seedWorkoutExercise(api, DIPS, 'Dips', { bodyweight: true }),
    seedWorkoutExercise(api, PULLUPS, 'Pull-ups', { bodyweight: true }),
  ]);
  await Promise.all([
    createWorkoutPreset(api, 5001, 'Push Day', [
      {
        kind: 'normal',
        id: 5101,
        exerciseId: BENCH,
        type: 'dropdown',
        sets: 4,
        dropdowns: 2,
        includeWarmup: true,
        order: 0,
      },
      {
        kind: 'normal',
        id: 5102,
        exerciseId: INCLINE,
        sets: 4,
        order: 1,
      },
      {
        kind: 'normal',
        id: 5103,
        exerciseId: OHP,
        sets: 3,
        order: 2,
      },
      {
        kind: 'normal',
        id: 5104,
        exerciseId: LATERAL,
        sets: 3,
        order: 3,
      },
      {
        kind: 'normal',
        id: 5105,
        exerciseId: TRICEPS,
        sets: 3,
        order: 4,
      },
    ], { notes: 'Weekly push workout for chest, shoulders, and triceps' }),
    createWorkoutPreset(api, 5002, 'Bodyweight Day', [], {
      notes: 'Workout with bodyweight exercises',
    }),
  ]);
});

after(() => {
  api?.stop();
});

async function login(usernamePrefix: string): Promise<{
  token: string;
  userId: number;
}> {
  const suffix = nextUser++;
  const session = await registerAndLogin(
    api,
    `${usernamePrefix}-${suffix}`,
    `${usernamePrefix}-${suffix}@example.com`,
  );
  const result = { token: session.accessToken, userId: session.userId };
  tokenOwners.set(result.token, result.userId);
  return result;
}

async function startWorkout(token: string, presetId: number): Promise<WorkoutSet[]> {
  const response = await api.call(
    'POST',
    `/api/workouts/presets/${presetId}/start_workout/`,
    { body: {}, token },
  );
  assert.equal(response.status, 201);
  return response.body.sets;
}

describe('TestWarmupDropdownPreset', () => {
  it('test_warmup_set_has_correct_type', async () => {
    const user = await login('warmup-type');
    const sets = await startWorkout(user.token, 5001);

    assert.equal(sets.length, 18);
    assert.equal(sets[0].setType, 'warmup');
    assert.equal(sets[0].weight, null);
    assert.equal(sets[0].exerciseId, BENCH);
    const benchDropdowns = sets.filter((set) =>
      set.exerciseId === BENCH && set.setType === 'dropdown');
    assert.equal(benchDropdowns.length, 4);
    assert.ok(benchDropdowns.every((set) => set.dropdownWeights?.length === 3));
  });

  it('test_warmup_set_serialization', async () => {
    const user = await login('warmup-serialization');
    await startWorkout(user.token, 5001);
    const response = await api.call(
      'GET',
      '/api/workouts/sessions/active/',
      { token: user.token },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    const sets = response.body[0].sets;
    const warmupSets = sets.filter((set: WorkoutSet) => set.setType === 'warmup');
    assert.equal(warmupSets.length, 1);
    assert.equal(warmupSets[0].setType, 'warmup');
    assert.equal(warmupSets[0].weight, null);
    assert.equal(warmupSets[0].exerciseId, BENCH);
  });

  it('test_frontend_warmup_detection', async () => {
    const user = await login('warmup-detection');
    const sets = await startWorkout(user.token, 5001);
    assert.equal(sets.filter((set) => set.setType === 'warmup').length, 1);
    assert.equal(sets.filter((set) => set.setType === 'normal').length, 13);
    assert.equal(sets.filter((set) => set.setType === 'dropdown').length, 4);
  });

  it('test_warmup_set_can_be_completed', async () => {
    const user = await login('warmup-complete');
    const sets = await startWorkout(user.token, 5001);
    const response = await api.call(
      'POST',
      `/api/workouts/sets/${sets[0].id}/complete/`,
      { token: user.token },
    );
    assert.equal(response.status, 200);
    assert.notEqual(response.body.loggedAt, null);

    const stored = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${user.userId}`,
        ':prefix': 'WORKOUT_SET#',
      },
    }));
    const item = (stored.Items ?? []).find((row) => row.id === sets[0].id);
    assert.ok(item);
    assert.notEqual(item.completed_at, undefined);
    assert.notEqual(item.completed_at, null);
  });
});

describe('TestBodyweightWarmup', () => {
  it('test_bodyweight_exercise_with_warmup_creates_warmup_type', async () => {
    const user = await login('bodyweight-warmup');
    await createWorkoutPreset(api, 5002, 'Bodyweight Day', [{
      kind: 'normal',
      id: 5201,
      exerciseId: DIPS,
      type: 'bodyweight',
      sets: 3,
      includeWarmup: true,
      order: 0,
    }], { notes: 'Workout with bodyweight exercises' });
    const sets = await startWorkout(user.token, 5002);

    assert.equal(sets.length, 4);
    assert.equal(sets[0].setType, 'warmup');
    assert.equal(sets[0].weight, null);
    assert.equal(sets[0].exerciseId, DIPS);
    assert.equal(sets.filter((set) => set.setType === 'bodyweight').length, 3);
  });

  it('test_bodyweight_superset_with_warmup_creates_warmup_type', async () => {
    const user = await login('bodyweight-superset-warmup');
    await createWorkoutPreset(api, 5003, 'Bodyweight Superset Day', [{
      kind: 'superset',
      id: 5301,
      sets: 3,
      order: 0,
      children: [
        {
          id: 5311,
          exerciseId: DIPS,
          type: 'bodyweight',
          includeWarmup: true,
          order: 0,
        },
        {
          id: 5312,
          exerciseId: PULLUPS,
          type: 'bodyweight',
          includeWarmup: true,
          order: 1,
        },
      ],
    }], { notes: 'Workout with bodyweight exercises' });
    const sets = await startWorkout(user.token, 5003);

    assert.equal(sets.length, 8);
    const warmups = sets.filter((set) => set.setType === 'warmup');
    assert.equal(warmups.length, 2);
    assert.deepEqual(warmups.map((set) => set.exerciseId), [DIPS, PULLUPS]);
    assert.ok(warmups.every((set) => set.setType === 'warmup'));
  });
});
