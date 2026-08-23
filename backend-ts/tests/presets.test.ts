import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createWorkoutPreset,
  seedWorkoutExercise,
} from './workout-fixtures.js';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';

let api: TestApi;

const BENCH = 301;
const ROWS = 302;
const DIPS = 303;

interface GeneratedSetResponse {
  id: number;
  exerciseId: number;
  set_order: number;
  setType: 'normal' | 'bodyweight' | 'warmup' | 'dropdown';
  weight: number | null;
  reps: number | null;
  dropdownWeights: Array<{ weight: number; reps: number }> | null;
}

before(async () => {
  api = await startTestApi({ exerciseIds: [] });
  await Promise.all([
    seedWorkoutExercise(api, BENCH, 'Bench Press'),
    seedWorkoutExercise(api, ROWS, 'Rows'),
    seedWorkoutExercise(api, DIPS, 'Push-ups', { bodyweight: true }),
  ]);
});

after(() => {
  api?.stop();
});

let nextUser = 1;

async function login(username: string): Promise<string> {
  const suffix = nextUser++;
  const session = await registerAndLogin(
    api,
    `${username}-${suffix}`,
    `${username}-${suffix}@example.com`,
  );
  return session.accessToken;
}

async function startGeneratedWorkout(
  token: string,
  presetId: number,
): Promise<GeneratedSetResponse[]> {
  const response = await api.call(
    'POST',
    `/api/workouts/presets/${presetId}/start_workout/`,
    { body: {}, token },
  );
  assert.equal(response.status, 201);
  return response.body.sets;
}

describe('TestGenerateSets', () => {
  let bodyweightPresetId: number;
  let dropdownPresetId: number;
  let normalPresetId: number;
  let supersetPresetId: number;
  let supersetWarmupPresetId: number;
  let warmupPresetId: number;

  before(async () => {
    await Promise.all([
      createWorkoutPreset(api, 3001, 'Normal Sets', [{
        kind: 'normal',
        id: 3101,
        exerciseId: BENCH,
        sets: 3,
        includeWarmup: false,
        order: 0,
      }]),
      createWorkoutPreset(api, 3002, 'Normal With Warmup', [{
        kind: 'normal',
        id: 3201,
        exerciseId: BENCH,
        sets: 3,
        includeWarmup: true,
        order: 0,
      }]),
      createWorkoutPreset(api, 3003, 'Bodyweight Sets', [{
        kind: 'normal',
        id: 3301,
        exerciseId: DIPS,
        sets: 3,
        includeWarmup: false,
        order: 0,
      }]),
      createWorkoutPreset(api, 3004, 'Dropdown Sets', [{
        kind: 'normal',
        id: 3401,
        exerciseId: BENCH,
        type: 'dropdown',
        sets: 2,
        dropdowns: 2,
        includeWarmup: false,
        order: 0,
      }]),
      createWorkoutPreset(api, 3005, 'Superset Sets', [{
        kind: 'superset',
        id: 3501,
        sets: 3,
        order: 0,
        children: [
          { id: 3511, exerciseId: BENCH, order: 0 },
          { id: 3512, exerciseId: ROWS, order: 1 },
        ],
      }]),
      createWorkoutPreset(api, 3006, 'Superset Warmup Sets', [{
        kind: 'superset',
        id: 3601,
        sets: 2,
        order: 0,
        children: [
          { id: 3611, exerciseId: BENCH, includeWarmup: true, order: 0 },
          { id: 3612, exerciseId: ROWS, includeWarmup: true, order: 1 },
        ],
      }]),
    ]);

    normalPresetId = 3001;
    warmupPresetId = 3002;
    bodyweightPresetId = 3003;
    dropdownPresetId = 3004;
    supersetPresetId = 3005;
    supersetWarmupPresetId = 3006;
  });

  it('test_normal_exercise_creates_correct_sets', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-normal'),
      normalPresetId,
    );

    assert.equal(sets.length, 3);
    assert.ok(sets.every((set) => set.setType === 'normal'));
    assert.deepEqual(sets.map((set) => set.weight), [60, 60, 60]);
    assert.deepEqual(sets.map((set) => set.set_order), [0, 1, 2]);
  });

  it('test_normal_exercise_with_warmup', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-warmup'),
      warmupPresetId,
    );

    assert.equal(sets.length, 4);
    assert.equal(sets[0].setType, 'warmup');
    assert.equal(sets[0].weight, null);
    assert.deepEqual(sets.slice(1).map((set) => set.setType), [
      'normal',
      'normal',
      'normal',
    ]);
  });

  it('test_bodyweight_exercise_creates_correct_sets', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-bodyweight'),
      bodyweightPresetId,
    );

    assert.equal(sets.length, 3);
    assert.ok(sets.every((set) => set.setType === 'bodyweight'));
    assert.ok(sets.every((set) => set.weight === null));
  });

  it('test_dropdown_exercise_creates_working_and_drop_sets', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-dropdown'),
      dropdownPresetId,
    );

    assert.equal(sets.length, 2);
    for (const set of sets) {
      assert.equal(set.setType, 'dropdown');
      assert.deepEqual(set.dropdownWeights, [
        { weight: 60, reps: 10 },
        { weight: 57.5, reps: 10 },
        { weight: 55, reps: 10 },
      ]);
    }
  });

  it('test_superset_creates_round_robin_sets', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-superset'),
      supersetPresetId,
    );

    assert.equal(sets.length, 6);
    assert.deepEqual(sets.map((set) => set.exerciseId), [
      BENCH,
      ROWS,
      BENCH,
      ROWS,
      BENCH,
      ROWS,
    ]);
    assert.deepEqual(sets.map((set) => set.set_order), [0, 1, 2, 3, 4, 5]);
  });

  it('test_superset_with_warmup', async () => {
    const sets = await startGeneratedWorkout(
      await login('generate-superset-warmup'),
      supersetWarmupPresetId,
    );

    assert.equal(sets.length, 6);
    assert.deepEqual(sets.slice(0, 2).map((set) => [
      set.exerciseId,
      set.setType,
      set.weight,
    ]), [
      [BENCH, 'warmup', null],
      [ROWS, 'warmup', null],
    ]);
    assert.deepEqual(sets.slice(2).map((set) => set.exerciseId), [
      BENCH,
      ROWS,
      BENCH,
      ROWS,
    ]);
  });
});
