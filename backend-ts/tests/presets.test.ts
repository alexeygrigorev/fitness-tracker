import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  createWorkoutPreset,
  seedWorkoutExercise,
} from './workout-fixtures.js';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';

let api: TestApi;

const BENCH = 301;
const ROWS = 302;
const DIPS = 303;
const BEND_ROWS = 304;
const OHP = 305;
const LATERAL = 306;
const SQUATS = 307;
const DEADLIFTS = 308;
const BARBELL_ROWS = 309;

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
    seedWorkoutExercise(api, BEND_ROWS, 'Bend Over Rows'),
    seedWorkoutExercise(api, OHP, 'Overhead Press'),
    seedWorkoutExercise(api, LATERAL, 'Lateral Raises'),
    seedWorkoutExercise(api, SQUATS, 'Squats'),
    seedWorkoutExercise(api, DEADLIFTS, 'Deadlifts'),
    seedWorkoutExercise(api, BARBELL_ROWS, 'Barbell Row'),
  ]);
});

after(() => {
  api?.stop();
});

let nextUser = 1;

async function login(username: string): Promise<string> {
  const session = await loginSession(username);
  return session.token;
}

async function loginSession(username: string): Promise<{
  token: string;
  userId: number;
}> {
  const suffix = nextUser++;
  const session = await registerAndLogin(
    api,
    `${username}-${suffix}`,
    `${username}-${suffix}@example.com`,
  );
  return { token: session.accessToken, userId: session.userId };
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

describe('TestComprehensiveScenarios', () => {
  let benchDropdownPresetId: number;
  let dipsRowsPresetId: number;
  let pushDayPresetId: number;

  before(async () => {
    await Promise.all([
      createWorkoutPreset(api, 4001, 'Bench Dropdown', [{
        kind: 'normal',
        id: 4101,
        exerciseId: BENCH,
        type: 'dropdown',
        sets: 3,
        dropdowns: 2,
        includeWarmup: true,
        order: 0,
      }]),
      createWorkoutPreset(api, 4002, 'Dips And Rows', [{
        kind: 'superset',
        id: 4201,
        sets: 4,
        order: 0,
        children: [
          { id: 4211, exerciseId: DIPS, includeWarmup: false, order: 0 },
          { id: 4212, exerciseId: BEND_ROWS, includeWarmup: true, order: 1 },
        ],
      }]),
      createWorkoutPreset(api, 4003, 'Full Push Day', [
        {
          kind: 'normal',
          id: 4301,
          exerciseId: BENCH,
          type: 'dropdown',
          sets: 4,
          dropdowns: 2,
          includeWarmup: true,
          order: 0,
        },
        {
          kind: 'superset',
          id: 4302,
          sets: 3,
          order: 1,
          children: [
            { id: 4311, exerciseId: DIPS, includeWarmup: true, order: 0 },
            { id: 4312, exerciseId: OHP, includeWarmup: true, order: 1 },
          ],
        },
        {
          kind: 'normal',
          id: 4303,
          exerciseId: LATERAL,
          sets: 3,
          includeWarmup: false,
          order: 2,
        },
      ]),
    ]);
    benchDropdownPresetId = 4001;
    dipsRowsPresetId = 4002;
    pushDayPresetId = 4003;
  });

  it('test_bench_press_with_warmup_and_dropdown_sets', async () => {
    const sets = await startGeneratedWorkout(
      await login('comprehensive-bench'),
      benchDropdownPresetId,
    );

    assert.equal(sets.length, 4);
    assert.equal(sets[0].setType, 'warmup');
    assert.equal(sets[0].weight, null);
    assert.ok(sets.slice(1).every((set) =>
      set.setType === 'dropdown' &&
      set.dropdownWeights?.length === 3 &&
      set.dropdownWeights[0].weight === 60));
  });

  it('test_superset_dips_and_bend_over_rows', async () => {
    const sets = await startGeneratedWorkout(
      await login('comprehensive-superset'),
      dipsRowsPresetId,
    );

    assert.equal(sets.length, 9);
    assert.equal(sets[0].weight, null);
  });

  it('test_full_push_day_scenario', async () => {
    const sets = await startGeneratedWorkout(
      await login('comprehensive-push-day'),
      pushDayPresetId,
    );

    assert.equal(sets.length, 16);
    assert.deepEqual(sets.slice(0, 5).map((set) => [
      set.exerciseId,
      set.setType,
    ]), [
      [BENCH, 'warmup'],
      [BENCH, 'dropdown'],
      [BENCH, 'dropdown'],
      [BENCH, 'dropdown'],
      [BENCH, 'dropdown'],
    ]);
    assert.deepEqual(sets.slice(5, 13).map((set) => [
      set.exerciseId,
      set.setType,
    ]), [
      [DIPS, 'warmup'],
      [OHP, 'warmup'],
      [DIPS, 'bodyweight'],
      [OHP, 'normal'],
      [DIPS, 'bodyweight'],
      [OHP, 'normal'],
      [DIPS, 'bodyweight'],
      [OHP, 'normal'],
    ]);
    assert.deepEqual(sets.slice(13).map((set) => set.exerciseId), [
      LATERAL,
      LATERAL,
      LATERAL,
    ]);
  });
});

describe('TestStartWorkoutIntegration', () => {
  it('test_full_push_day_workout_via_api', async () => {
    const user = await loginSession('integration-push');
    const createdExercises: Array<{ id: number; name: string }> = [];
    for (const [, exercise] of [
      { name: 'Bench Press', is_bodyweight: false },
      { name: 'Dips', is_bodyweight: true },
      { name: 'Overhead Press', is_bodyweight: false },
      { name: 'Lateral Raises', is_bodyweight: false },
    ].entries()) {
      const response = await api.call('POST', '/api/workouts/exercises/', {
        body: exercise,
        token: user.token,
      });
      assert.equal(response.status, 201);
      createdExercises.push({
        id: response.body.id,
        name: response.body.name,
      });
    }
    const exerciseId = (name: string): number => {
      const found = createdExercises.find((item) => item.name === name);
      assert.ok(found);
      return found.id;
    };

    const createdPreset = await api.call('POST', '/api/workouts/presets/', {
      body: { name: 'Push Day', notes: 'Weekly push workout' },
      token: user.token,
    });
    assert.equal(createdPreset.status, 201);
    const presetId = createdPreset.body.id;

    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `PRESET#${presetId}`,
        sk: 'PRESET_EXERCISE#7001',
        entity_type: 'preset_exercise',
        id: 7001,
        parent_preset_id: presetId,
        exercise_id: exerciseId('Bench Press'),
        type: 'dropdown',
        sets: 3,
        dropdowns: 2,
        include_warmup: true,
        order: 0,
      },
    }));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `PRESET#${presetId}`,
        sk: 'PRESET_EXERCISE#7002',
        entity_type: 'preset_exercise',
        id: 7002,
        parent_preset_id: presetId,
        exercise_id: null,
        type: 'superset',
        sets: 3,
        include_warmup: false,
        order: 1,
      },
    }));
    await Promise.all([7003, 7004].map((rowId, index) =>
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: {
          pk: `PRESET#${presetId}`,
          sk: `SUPERSET_ITEM#7002#${rowId}`,
          entity_type: 'superset_item',
          id: rowId,
          parent_row_id: 7002,
          parent_preset_id: presetId,
          exercise_id: index === 0
            ? exerciseId('Dips')
            : exerciseId('Overhead Press'),
          type: 'normal',
          include_warmup: true,
          order: index,
        },
      }))));
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `PRESET#${presetId}`,
        sk: 'PRESET_EXERCISE#7005',
        entity_type: 'preset_exercise',
        id: 7005,
        parent_preset_id: presetId,
        exercise_id: exerciseId('Lateral Raises'),
        type: 'normal',
        sets: 3,
        include_warmup: false,
        order: 2,
      },
    }));

    const started = await api.call(
      'POST',
      `/api/workouts/presets/${presetId}/start_workout/`,
      { body: {}, token: user.token },
    );
    assert.equal(started.status, 201);
    assert.deepEqual(started.body.session, {
      id: started.body.session.id,
      name: 'Push Day',
      notes: 'Weekly push workout',
      bodyweight: null,
      startedAt: started.body.session.startedAt,
      endedAt: null,
      user_id: user.userId,
      preset_id: presetId,
    });

    const sets = started.body.sets;
    assert.equal(sets.length, 15);
    assert.ok(sets.filter((set: any) => set.weight === null).length >= 3);
    const benchSets = sets.filter((set: any) =>
      set.exerciseId === exerciseId('Bench Press'));
    assert.equal(benchSets.length, 4);
    assert.equal(benchSets[0].weight, null);
    assert.ok(benchSets.slice(1).every((set: any) =>
      set.dropdownWeights?.length === 3));
    const dipSets = sets.filter((set: any) => set.exerciseId === exerciseId('Dips'));
    const ohpSets = sets.filter((set: any) =>
      set.exerciseId === exerciseId('Overhead Press'));
    assert.equal(dipSets.length, 4);
    assert.equal(ohpSets.length, 4);

    const persisted = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${user.userId}`,
        ':prefix': 'WORKOUT_SET#',
      },
    }));
    const dbSets = [...(persisted.Items ?? [])].sort((left: any, right: any) =>
      left.set_order - right.set_order);
    assert.equal(dbSets.length, 15);
    assert.deepEqual(dbSets.map((set: any) => set.set_order), [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });
});

describe('TestPresetExercisesInAPI', () => {
  it('test_list_presets_includes_exercises', async () => {
    const user = await loginSession('preset-list');
    await createWorkoutPreset(api, 4101, 'Push Day', [{
      kind: 'normal',
      id: 7111,
      exerciseId: BENCH,
      sets: 3,
      order: 0,
    }], { ownerId: user.userId });

    const response = await api.call('GET', '/api/workouts/presets/', {
      token: user.token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].exercises.length, 1);
    assert.equal(response.body[0].exercises[0].type, 'normal');
    assert.equal(response.body[0].exercises[0].sets, 3);
    assert.equal(response.body[0].exercises[0].exerciseId, BENCH);
  });

  it('test_get_preset_detail_includes_exercises', async () => {
    const user = await loginSession('preset-detail');
    await createWorkoutPreset(api, 4102, 'Full Body', [
      {
        kind: 'normal',
        id: 7121,
        exerciseId: BENCH,
        sets: 3,
        order: 0,
      },
      {
        kind: 'normal',
        id: 7122,
        exerciseId: SQUATS,
        type: 'dropdown',
        sets: 4,
        dropdowns: 2,
        order: 1,
      },
    ], { ownerId: user.userId });

    const response = await api.call('GET', '/api/workouts/presets/4102/', {
      token: user.token,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.exercises.map((row: any) => row.exerciseId), [
      BENCH,
      SQUATS,
    ]);
  });

  it('test_create_preset_then_get_includes_exercises', async () => {
    const user = await loginSession('preset-create-get');
    const created = await api.call('POST', '/api/workouts/presets/', {
      body: { name: 'Push Day', notes: 'Chest focused' },
      token: user.token,
    });
    assert.equal(created.status, 201);
    const presetId = created.body.id;
    await api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: {
        pk: `PRESET#${presetId}`,
        sk: 'PRESET_EXERCISE#7131',
        entity_type: 'preset_exercise',
        id: 7131,
        parent_preset_id: presetId,
        exercise_id: BENCH,
        type: 'normal',
        sets: 3,
        include_warmup: false,
        order: 0,
      },
    }));

    const fetched = await api.call('GET', `/api/workouts/presets/${presetId}/`, {
      token: user.token,
    });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.exercises.length, 1);
  });

  it('test_superset_exercise_includes_superset_exercises', async () => {
    const user = await loginSession('preset-superset-read');
    await createWorkoutPreset(api, 4103, 'Upper Body', [{
      kind: 'superset',
      id: 7141,
      sets: 3,
      order: 0,
      children: [
        { id: 7142, exerciseId: BENCH, order: 0 },
        { id: 7143, exerciseId: SQUATS, order: 1 },
      ],
    }], { ownerId: user.userId });

    const response = await api.call('GET', '/api/workouts/presets/4103/', {
      token: user.token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exercises.length, 1);
    assert.equal(response.body.exercises[0].type, 'superset');
    assert.deepEqual(response.body.exercises[0].supersetExercises.map((item: any) =>
      item.exerciseId), [BENCH, SQUATS]);
  });
});

describe('TestPresetLastUsedWeights', () => {
  it('test_preset_includes_last_used_weights', async () => {
    const user = await loginSession('last-used');
    const saved = await api.call(
      'POST',
      `/api/auth/exercise-settings/${BENCH}/`,
      { body: { weight: 80, reps: 10 }, token: user.token },
    );
    assert.equal(saved.status, 200);
    await createWorkoutPreset(api, 4104, 'Test Preset', [{
      kind: 'normal',
      id: 7151,
      exerciseId: BENCH,
      sets: 3,
      order: 0,
    }], { ownerId: user.userId });

    const response = await api.call('GET', '/api/workouts/presets/4104/', {
      token: user.token,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.lastUsedWeights[String(BENCH)], {
      weight: 80,
      reps: 10,
    });
  });
});

describe('TestCreatePresetWithExercisesViaAPI', () => {
  it('test_create_preset_with_exercises_in_single_request', async () => {
    const user = await loginSession('single-request');
    const created = await api.call('POST', '/api/workouts/presets/', {
      body: {
        name: 'Test Bench Press Preset',
        dayLabel: 'Monday',
        tags: ['strength'],
        exercises: [{
          exerciseId: BENCH,
          type: 'normal',
          sets: 3,
          includeWarmup: true,
          order: 0,
        }],
      },
      token: user.token,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Test Bench Press Preset');
    assert.equal(created.body.dayLabel, 'Monday');
    assert.deepEqual(created.body.tags, ['strength']);
    const presetId = created.body.id;

    const fetched = await api.call('GET', `/api/workouts/presets/${presetId}/`, {
      token: user.token,
    });
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body.exercises, [{
      id: fetched.body.exercises[0].id,
      exerciseId: BENCH,
      exerciseName: 'Bench Press',
      type: 'normal',
      sets: 3,
      dropdowns: null,
      includeWarmup: true,
      order: 0,
      supersetExercises: [],
    }]);

    const listed = await api.call('GET', '/api/workouts/presets/', {
      token: user.token,
    });
    assert.ok(listed.body.some((preset: any) => preset.id === presetId));

    const deleted = await api.call(
      'DELETE',
      `/api/workouts/presets/${presetId}/`,
      { token: user.token },
    );
    assert.equal(deleted.status, 204);
    const remaining = await api.call('GET', '/api/workouts/presets/', {
      token: user.token,
    });
    assert.ok(!remaining.body.some((preset: any) => preset.id === presetId));
    const stored = await api.documentClient.send(new (await import('@aws-sdk/lib-dynamodb')).GetCommand({
      TableName: api.tableName,
      Key: { pk: `PRESET#${presetId}`, sk: 'METADATA' },
    }));
    assert.equal(stored.Item, undefined);
  });

  it('test_create_preset_with_multiple_exercises', async () => {
    const user = await loginSession('multiple-exercises');
    const created = await api.call('POST', '/api/workouts/presets/', {
      body: {
        name: 'Lower Day',
        dayLabel: 'Tuesday',
        tags: ['strength'],
        exercises: [
          {
            exerciseId: SQUATS,
            type: 'normal',
            sets: 3,
            includeWarmup: true,
            order: 0,
          },
          {
            exerciseId: DEADLIFTS,
            type: 'dropdown',
            sets: 3,
            dropdowns: 2,
            includeWarmup: true,
            order: 1,
          },
          {
            exerciseId: BENCH,
            type: 'normal',
            sets: 3,
            includeWarmup: false,
            order: 2,
          },
        ],
      },
      token: user.token,
    });
    assert.equal(created.status, 201);
    const response = await api.call(
      'GET',
      `/api/workouts/presets/${created.body.id}/`,
      { token: user.token },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.exercises.map((row: any) => ({
      exerciseId: row.exerciseId,
      order: row.order,
    })), [
      { exerciseId: SQUATS, order: 0 },
      { exerciseId: DEADLIFTS, order: 1 },
      { exerciseId: BENCH, order: 2 },
    ]);
  });

  it('test_partial_update_without_exercises_preserves_rows', async () => {
    const user = await loginSession('scalar-patch');
    await createWorkoutPreset(api, 4105, 'Lower Day', [
      {
        kind: 'normal',
        id: 7161,
        exerciseId: BENCH,
        sets: 2,
        includeWarmup: true,
        order: 0,
      },
      {
        kind: 'normal',
        id: 7162,
        exerciseId: SQUATS,
        type: 'dropdown',
        sets: 1,
        dropdowns: 3,
        order: 1,
      },
    ], { ownerId: user.userId });

    const response = await api.call('PATCH', '/api/workouts/presets/4105/', {
      body: { name: 'Renamed Lower Day', dayLabel: 'Wednesday' },
      token: user.token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exercises.length, 2);
    assert.equal(response.body.exercises[0].exerciseId, BENCH);
    assert.equal(response.body.exercises[0].sets, 2);
    assert.equal(response.body.exercises[0].includeWarmup, true);
    assert.equal(response.body.exercises[1].exerciseId, SQUATS);
    assert.equal(response.body.exercises[1].dropdowns, 3);
  });
});

describe('TestCreatePresetWithSuperset', () => {
  it('test_create_preset_with_superset_exercises', async () => {
    const user = await loginSession('superset-create');
    const created = await api.call('POST', '/api/workouts/presets/', {
      body: {
        name: 'Chest Back Superset',
        dayLabel: 'Monday',
        tags: ['strength'],
        exercises: [{
          type: 'superset',
          sets: 4,
          order: 0,
          supersetExercises: [
            {
              exerciseId: BENCH,
              type: 'normal',
              includeWarmup: true,
              order: 0,
            },
            {
              exerciseId: BARBELL_ROWS,
              type: 'normal',
              includeWarmup: false,
              order: 1,
            },
          ],
        }],
      },
      token: user.token,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Chest Back Superset');

    const fetched = await api.call(
      'GET',
      `/api/workouts/presets/${created.body.id}/`,
      { token: user.token },
    );
    assert.equal(fetched.status, 200);
    const superset = fetched.body.exercises[0];
    assert.equal(superset.type, 'superset');
    assert.equal(superset.sets, 4);
    assert.equal(superset.supersetExercises.length, 2);
    assert.equal(superset.supersetExercises[0].exerciseId, BENCH);
    assert.equal(superset.supersetExercises[0].includeWarmup, true);
    assert.equal(superset.supersetExercises[1].exerciseId, BARBELL_ROWS);
    assert.equal(superset.supersetExercises[1].includeWarmup, false);
  });

  it('test_create_preset_with_superset_all_without_warmup', async () => {
    const user = await loginSession('superset-no-warmup');
    const created = await api.call('POST', '/api/workouts/presets/', {
      body: {
        name: 'Superset No Warmup',
        dayLabel: 'Tuesday',
        tags: ['strength'],
        exercises: [{
          type: 'superset',
          sets: 3,
          order: 0,
          supersetExercises: [
            { exerciseId: BENCH, type: 'normal', includeWarmup: false, order: 0 },
            { exerciseId: BARBELL_ROWS, type: 'normal', includeWarmup: false, order: 1 },
          ],
        }],
      },
      token: user.token,
    });
    assert.equal(created.status, 201);
    const fetched = await api.call(
      'GET',
      `/api/workouts/presets/${created.body.id}/`,
      { token: user.token },
    );
    assert.equal(fetched.status, 200);
    assert.ok(fetched.body.exercises[0].supersetExercises.every((item: any) =>
      item.includeWarmup === false));

    const deleted = await api.call(
      'DELETE',
      `/api/workouts/presets/${created.body.id}/`,
      { token: user.token },
    );
    assert.equal(deleted.status, 204);
    const remaining = await api.call('GET', '/api/workouts/presets/', {
      token: user.token,
    });
    assert.ok(!remaining.body.some((preset: any) =>
      preset.id === created.body.id));
  });
});
