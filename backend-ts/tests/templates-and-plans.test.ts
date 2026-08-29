import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';
import {
  createWorkoutPreset,
  seedWorkoutExercise,
} from './workout-fixtures.js';

type Item = Record<string, unknown>;

let api: TestApi;

const BENCH = 401;
const SQUAT = 402;
const ROWS = 403;
const DIPS = 404;
const OVERHEAD_PRESS = 405;

const TEMPLATE_PRESET_ID = 5001;
const PUBLIC_PRESET_ID = 5101;
const PRIVATE_PRESET_ID = 5102;
let publicOwnerToken = '';
let publicOwnerId = 0;
let presetCopierToken = '';
let presetCopierId = 0;
const PUSH_PRESET_ID = 5201;
const PULL_PRESET_ID = 5202;
const LEGS_PRESET_ID = 5203;
const UPPER_BODY_PRESET_ID = 5301;
const COMPLEX_PUSH_PRESET_ID = 5302;

interface PresetResponse {
  id: number;
  user_id: number | null;
  name: string;
  exercises: Array<{
    id: number;
    exerciseId: number | null;
    exerciseName: string | null;
    type: 'normal' | 'dropdown' | 'superset';
    sets: number;
    dropdowns: number | null;
    includeWarmup: boolean;
    order: number;
    supersetExercises: Array<{
      id: number;
      exerciseId: number;
      type: 'normal' | 'dropdown';
      dropdowns: number | null;
      includeWarmup: boolean;
      order: number;
    }>;
  }>;
}

interface PlanResponse {
  id: number;
  user_id: number;
  name: string;
}

async function put(items: Item[]): Promise<void> {
  await Promise.all(items.map((item) =>
    api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: item,
    })),
  ));
}

async function getItem(key: Item): Promise<Item | undefined> {
  const result = await api.documentClient.send(new GetCommand({
    TableName: api.tableName,
    Key: key,
  }));
  return result.Item;
}

async function partition(prefix: string): Promise<Item[]> {
  const result = await api.documentClient.send(new QueryCommand({
    TableName: api.tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': prefix },
  }));
  return result.Items ?? [];
}

async function ownedPresets(userId: number): Promise<Item[]> {
  const result = await api.documentClient.send(new ScanCommand({
    TableName: api.tableName,
    FilterExpression: '#entity = :presetType AND #owner = :userId',
    ExpressionAttributeNames: {
      '#entity': 'entity_type',
      '#owner': 'user_id',
    },
    ExpressionAttributeValues: {
      ':presetType': 'workout_preset',
      ':userId': userId,
    },
  }));
  return result.Items ?? [];
}

async function seedPlan(
  id: number,
  ownerId: number,
  name: string,
  presetIds: number[] = [],
): Promise<void> {
  await put([
    {
      pk: `PLAN#${id}`,
      sk: 'METADATA',
      entity_type: 'workout_plan',
      id,
      user_id: ownerId,
      name,
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...presetIds.map((presetId, index) => ({
      pk: `PLAN#${id}`,
      sk: `PLAN_PRESET#${String(index + 1).padStart(8, '0')}`,
      entity_type: 'plan_preset',
      id: index + 1,
      parent_plan_id: id,
      preset_id: presetId,
      order: index,
    })),
  ]);
}

before(async () => {
  api = await startTestApi({ exerciseIds: [] });
  await seedWorkoutExercise(api, BENCH, 'Bench Press');
  await seedWorkoutExercise(api, SQUAT, 'Squat');
  await seedWorkoutExercise(api, ROWS, 'Rows');
  await seedWorkoutExercise(api, DIPS, 'Dips', { bodyweight: true });
  await seedWorkoutExercise(api, OVERHEAD_PRESS, 'Overhead Press');

  await createWorkoutPreset(
    api,
    TEMPLATE_PRESET_ID,
    'Push Day Template',
    [{
      kind: 'normal',
      id: 50011,
      exerciseId: BENCH,
      sets: 3,
      order: 0,
    }],
    { notes: 'Standard push workout' },
  );
  await createWorkoutPreset(
    api,
    PUBLIC_PRESET_ID,
    'Public Preset',
    [{
      kind: 'normal',
      id: 51011,
      exerciseId: SQUAT,
      sets: 3,
      order: 0,
    }],
    { isPublic: false },
  );
  await createWorkoutPreset(
    api,
    PRIVATE_PRESET_ID,
    'Private Preset',
    [{
      kind: 'normal',
      id: 51021,
      exerciseId: ROWS,
      sets: 3,
      order: 0,
    }],
  );
  await createWorkoutPreset(api, PUSH_PRESET_ID, 'Push Day', [{
    kind: 'normal',
    id: 52011,
    exerciseId: BENCH,
    sets: 3,
    order: 0,
  }]);
  await createWorkoutPreset(api, PULL_PRESET_ID, 'Pull Day', [{
    kind: 'normal',
    id: 52021,
    exerciseId: ROWS,
    sets: 3,
    order: 0,
  }]);
  await createWorkoutPreset(api, LEGS_PRESET_ID, 'Legs Day', [{
    kind: 'normal',
    id: 52031,
    exerciseId: SQUAT,
    sets: 3,
    order: 0,
  }]);
  await createWorkoutPreset(api, UPPER_BODY_PRESET_ID, 'Upper Body', [{
    kind: 'superset',
    id: 53011,
    sets: 3,
    order: 0,
    children: [
      { id: 53012, exerciseId: BENCH, order: 0 },
      { id: 53013, exerciseId: ROWS, order: 1 },
    ],
  }]);
  await createWorkoutPreset(api, COMPLEX_PUSH_PRESET_ID, 'Complex Push', [{
    kind: 'superset',
    id: 53021,
    sets: 3,
    order: 0,
    children: [
      { id: 53022, exerciseId: DIPS, includeWarmup: true, order: 0 },
      {
        id: 53023,
        exerciseId: OVERHEAD_PRESS,
        type: 'dropdown',
        dropdowns: 2,
        includeWarmup: true,
        order: 1,
      },
    ],
  }]);
});

after(() => {
  api?.stop();
});

async function login(username: string): Promise<{
  token: string;
  userId: number;
}> {
  const session = await registerAndLogin(api, username);
  return { token: session.accessToken, userId: session.userId };
}

function templateIds(): Promise<number[]> {
  return api.call('GET', '/api/workouts/presets/templates/').then(
    (response) => response.body.map((preset: { id: number }) => preset.id),
  );
}

describe('TestPresetTemplates', () => {
  it('test_template_preset_has_no_user', async () => {
    const metadata = await getItem({
      pk: `PRESET#${TEMPLATE_PRESET_ID}`,
      sk: 'METADATA',
    });
    assert.equal(metadata?.user_id, null);
  });

  it('test_list_templates_returns_template_presets', async () => {
    assert.ok((await templateIds()).includes(TEMPLATE_PRESET_ID));
  });

  it('test_user_can_copy_template_preset', async () => {
    const user = await login('template-copier');
    const response = await api.call(
      'POST',
      '/api/workouts/presets/create_from_template/',
      { body: { template_id: TEMPLATE_PRESET_ID }, token: user.token },
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.name, 'Push Day Template');
    assert.equal(response.body.user_id, user.userId);
    assert.equal(response.body.exercises.length, 1);
    assert.equal(response.body.exercises[0].exerciseId, BENCH);

    const rows = await partition(`PRESET#${response.body.id}`);
    const copiedRow = rows.find((item) =>
      String(item.sk).startsWith('PRESET_EXERCISE#'));
    assert.equal(rows.filter((item) =>
      String(item.sk).startsWith('PRESET_EXERCISE#')).length, 1);
    assert.equal(copiedRow?.exercise_id, BENCH);
    assert.equal(copiedRow?.exercise_name, 'Bench Press');
  });

  it('test_template_preset_cannot_be_modified', async () => {
    const user = await login('template-modifier');
    const response = await api.call(
      'PATCH',
      `/api/workouts/presets/${TEMPLATE_PRESET_ID}/`,
      { body: { name: 'Hacked Template' }, token: user.token },
    );

    assert.equal(response.status, 403);
    assert.match(String(response.body.error), /Cannot modify template presets/);
    assert.equal((await getItem({
      pk: `PRESET#${TEMPLATE_PRESET_ID}`,
      sk: 'METADATA',
    }))?.name, 'Push Day Template');
  });

  it('test_template_preset_cannot_be_deleted', async () => {
    const user = await login('template-deleter');
    const response = await api.call(
      'DELETE',
      `/api/workouts/presets/${TEMPLATE_PRESET_ID}/`,
      { token: user.token },
    );

    assert.equal(response.status, 403);
    assert.match(String(response.body.error), /Cannot delete template presets/);
    assert.ok((await partition(`PRESET#${TEMPLATE_PRESET_ID}`)).length > 0);
  });
});

describe('TestPublicAndPrivatePresets', () => {
  before(async () => {
    const owner = await login('preset-owner');
    const copier = await login('preset-copier');
    publicOwnerToken = owner.token;
    publicOwnerId = owner.userId;
    presetCopierToken = copier.token;
    presetCopierId = copier.userId;

    await createWorkoutPreset(
      api,
      PUBLIC_PRESET_ID,
      'Public Preset',
      [{
        kind: 'normal',
        id: 51011,
        exerciseId: SQUAT,
        sets: 3,
        order: 0,
      }],
      { isPublic: true, ownerId: publicOwnerId },
    );
    await createWorkoutPreset(
      api,
      PRIVATE_PRESET_ID,
      'Private Preset',
      [{
        kind: 'normal',
        id: 51021,
        exerciseId: ROWS,
        sets: 3,
        order: 0,
      }],
      { ownerId: publicOwnerId },
    );
  });

  it('test_templates_endpoint_includes_public_presets', async () => {
    assert.ok((await templateIds()).includes(PUBLIC_PRESET_ID));
  });

  it('test_templates_endpoint_excludes_private_presets', async () => {
    assert.ok(!(await templateIds()).includes(PRIVATE_PRESET_ID));
  });

  it('test_can_copy_public_preset_from_another_user', async () => {
    const response = await api.call(
      'POST',
      '/api/workouts/presets/create_from_template/',
      { body: { template_id: PUBLIC_PRESET_ID }, token: presetCopierToken },
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.user_id, presetCopierId);
  });

  it('test_cannot_copy_private_preset_from_another_user', async () => {
    const before = (await ownedPresets(presetCopierId))
      .filter((item) => item.name === 'Private Preset').length;
    const response = await api.call(
      'POST',
      '/api/workouts/presets/create_from_template/',
      { body: { template_id: PRIVATE_PRESET_ID }, token: presetCopierToken },
    );

    assert.equal(response.status, 403);
    assert.match(
      String(response.body.error),
      /Cannot copy private preset/,
    );
    assert.equal((await ownedPresets(presetCopierId))
      .filter((item) => item.name === 'Private Preset').length, before);
  });

  it('test_user_can_copy_own_private_preset', async () => {
    const response = await api.call(
      'POST',
      '/api/workouts/presets/create_from_template/',
      { body: { template_id: PRIVATE_PRESET_ID }, token: publicOwnerToken },
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.user_id, publicOwnerId);
  });
});

describe('TestWorkoutPlans', () => {
  let ownerToken = '';
  let ownerId = 0;
  let otherToken = '';
  let otherId = 0;

  before(async () => {
    const owner = await login('plan-owner');
    const other = await login('plan-outsider');
    ownerToken = owner.token;
    ownerId = owner.userId;
    otherToken = other.token;
    otherId = other.userId;
  });

  it('test_create_workout_plan', async () => {
    const response = await api.call('POST', '/api/workouts/plans/', {
      body: {
        description: 'Push/Pull/Legs split',
        name: '3-Day Split',
        preset_ids: [PUSH_PRESET_ID, PULL_PRESET_ID, LEGS_PRESET_ID],
      },
      token: ownerToken,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, '3-Day Split');
    assert.equal(response.body.user_id, ownerId);
    const links = await partition(`PLAN#${response.body.id}`);
    assert.equal(links.filter((item) =>
      String(item.sk).startsWith('PLAN_PRESET#')).length, 3);
  });

  it('test_list_plans_returns_only_user_plans', async () => {
    await seedPlan(6001, ownerId, 'User1 Plan');
    await seedPlan(6002, otherId, 'User2 Plan');

    const response = await api.call('GET', '/api/workouts/plans/', {
      token: ownerToken,
    });
    const names: string[] = response.body
      .map((plan: PlanResponse) => plan.name);

    assert.equal(response.status, 200);
    assert.ok(names.includes('User1 Plan'));
    assert.ok(!names.includes('User2 Plan'));
  });

  it('test_retrieve_own_plan', async () => {
    await seedPlan(6100, ownerId, 'Retrievable Plan');

    const response = await api.call('GET', '/api/workouts/plans/6100/', {
      token: ownerToken,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.id, 6100);
    assert.equal(response.body.name, 'Retrievable Plan');
  });

  it('test_cannot_retrieve_another_users_plan', async () => {
    await seedPlan(6101, otherId, 'Private Plan');

    const response = await api.call('GET', '/api/workouts/plans/6101/', {
      token: ownerToken,
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Not found');
  });

  it('test_retrieve_missing_plan_returns_404', async () => {
    const response = await api.call('GET', '/api/workouts/plans/999999/', {
      token: ownerToken,
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { detail: 'Not found.' });
  });

  it('test_documented_get_plan_detail_matches_current_contract', async () => {
    await seedPlan(6008, ownerId, 'Detail Plan');

    const owned = await api.call('GET', '/api/workouts/plans/6008/', {
      token: ownerToken,
    });
    assert.equal(owned.status, 200);
    assert.deepEqual(owned.body, {
      id: 6008,
      user_id: ownerId,
      name: 'Detail Plan',
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const foreign = await api.call('GET', '/api/workouts/plans/6008/', {
      token: otherToken,
    });
    assert.equal(foreign.status, 404);
    assert.deepEqual(foreign.body, { error: 'Not found' });

    const missing = await api.call('GET', '/api/workouts/plans/999999/', {
      token: ownerToken,
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { detail: 'Not found.' });
  });

  it('test_get_use_plan_is_method_not_allowed', async () => {
    await seedPlan(6009, ownerId, 'Use Plan Drift');

    const response = await api.call(
      'GET',
      '/api/workouts/plans/6009/use_plan/',
      { token: ownerToken },
    );

    assert.equal(response.status, 405);
    assert.deepEqual(response.body, {
      detail: 'Method "GET" not allowed.',
    });
  });

  it('test_use_plan_copies_presets_to_user', async () => {
    await seedPlan(
      6003,
      ownerId,
      'PPL Split',
      [PUSH_PRESET_ID, PULL_PRESET_ID, LEGS_PRESET_ID],
    );

    const response = await api.call('POST', '/api/workouts/plans/6003/use_plan/', {
      token: ownerToken,
    });

    assert.equal(response.status, 201);
    assert.match(String(response.body.message), /^Copied 3 presets\b/);
    const copies = await ownedPresets(ownerId);
    const names = copies.map((item) => item.name);
    assert.deepEqual(names.sort(), ['Legs Day', 'Pull Day', 'Push Day']);
  });

  it('test_use_plan_copies_exercises_and_supersets', async () => {
    await seedPlan(6004, ownerId, 'Upper Plan', [UPPER_BODY_PRESET_ID]);

    const response = await api.call('POST', '/api/workouts/plans/6004/use_plan/', {
      token: ownerToken,
    });
    const copied: PresetResponse = response.body.presets[0];
    const rows = await partition(`PRESET#${copied.id}`);
    const supersetRows = rows.filter((item) =>
      String(item.sk).startsWith('PRESET_EXERCISE#') &&
      item.type === 'superset');
    const children = rows.filter((item) =>
      String(item.sk).startsWith('SUPERSET_ITEM#'));

    assert.equal(response.status, 201);
    assert.equal(supersetRows.length, 1);
    assert.equal(children.length, 2);
  });

  it('test_cannot_use_another_users_plan', async () => {
    await seedPlan(6005, ownerId, 'User1 Plan', [PUSH_PRESET_ID]);

    const response = await api.call('POST', '/api/workouts/plans/6005/use_plan/', {
      token: otherToken,
    });

    assert.equal(response.status, 403);
    assert.match(
      String(response.body.error),
      /Cannot use a plan created by another user/,
    );
    assert.equal((await ownedPresets(otherId)).length, 0);
  });

  it('test_user_can_delete_own_plan', async () => {
    await seedPlan(6006, ownerId, 'My Plan', [PUSH_PRESET_ID]);

    const response = await api.call('DELETE', '/api/workouts/plans/6006/', {
      token: ownerToken,
    });

    assert.equal(response.status, 204);
    assert.equal((await partition('PLAN#6006')).length, 0);
  });

  it('test_copy_superset_with_dropdown_and_warmup', async () => {
    await seedPlan(
      6007,
      ownerId,
      'Complex Plan',
      [COMPLEX_PUSH_PRESET_ID],
    );

    const response = await api.call('POST', '/api/workouts/plans/6007/use_plan/', {
      token: ownerToken,
    });
    const copied: PresetResponse = response.body.presets[0];
    const row = copied.exercises[0];
    const children = row.supersetExercises;

    assert.equal(response.status, 201);
    assert.equal(row.type, 'superset');
    assert.equal(row.sets, 3);
    assert.equal(children.length, 2);
    assert.equal(children[0].exerciseId, DIPS);
    assert.equal(children[0].includeWarmup, true);
    assert.equal(children[1].exerciseId, OVERHEAD_PRESS);
    assert.equal(children[1].type, 'dropdown');
    assert.equal(children[1].dropdowns, 2);
    assert.equal(children[1].includeWarmup, true);
  });
});
