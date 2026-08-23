import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { startTestApi, registerAndLogin, type TestApi } from './helpers.js';

type Item = Record<string, unknown>;

let api: TestApi;
let aliceToken: string;
let aliceId = 0;
let bobToken: string;
let bobId = 0;

async function put(items: Item[]): Promise<void> {
  await Promise.all(items.map((item) =>
    api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: item,
    })),
  ));
}

async function get(key: Item): Promise<Item | undefined> {
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

async function findByName(name: string, typeName = 'name'): Promise<Item | undefined> {
  const result = await api.documentClient.send(new ScanCommand({
    TableName: api.tableName,
    FilterExpression: '#name = :name',
    ExpressionAttributeNames: { '#name': typeName },
    ExpressionAttributeValues: { ':name': name },
  }));
  return result.Items?.[0];
}

function seedExercise(id: number, ownerId: number | null, name: string): void {
  void put([{
    pk: `EXERCISE#${id}`,
    sk: 'METADATA',
    entity_type: 'exercise',
    id,
    user_id: ownerId,
    name,
  }]);
}

interface SeedPresetInput {
  id: number;
  ownerId?: number | null;
  name: string;
  isPublic?: boolean;
  notes?: string;
  rows: Array<{
    id: number;
    exerciseId?: number | null;
    type?: string;
    sets?: number;
    order: number;
    items?: Array<{
      id: number;
      exerciseId: number;
      order: number;
    }>;
  }>;
}

async function seedPreset(input: SeedPresetInput): Promise<void> {
  await put([
    {
      pk: `PRESET#${input.id}`,
      sk: 'METADATA',
      entity_type: 'workout_preset',
      id: input.id,
      user_id: input.ownerId ?? null,
      name: input.name,
      notes: input.notes ?? null,
      status: 'active',
      day_label: null,
      tags: [],
      is_public: input.isPublic === true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...input.rows.map((row) => ({
      pk: `PRESET#${input.id}`,
      sk: `PRESET_EXERCISE#${row.id}`,
      entity_type: 'preset_exercise',
      id: row.id,
      parent_preset_id: input.id,
      exercise_id: row.exerciseId ?? null,
      type: row.type ?? 'normal',
      sets: row.sets ?? 3,
      dropdowns: null,
      include_warmup: false,
      order: row.order,
    })),
    ...input.rows.flatMap((row) => (row.items ?? []).map((child) => ({
      pk: `PRESET#${input.id}`,
      sk: `SUPERSET_ITEM#${row.id}#${child.id}`,
      entity_type: 'superset_item',
      id: child.id,
      parent_row_id: row.id,
      parent_preset_id: input.id,
      exercise_id: child.exerciseId,
      type: 'normal',
      dropdowns: null,
      include_warmup: false,
      order: child.order,
    }))),
  ]);
}

function presetRows(items: Item[], presetId: number): Item[] {
  return items.filter((item) =>
    item.pk === `PRESET#${presetId}` &&
    String(item.sk).startsWith('PRESET_EXERCISE#'));
}

function supersetRows(items: Item[], presetId: number): Item[] {
  return items.filter((item) =>
    item.pk === `PRESET#${presetId}` &&
    String(item.sk).startsWith('SUPERSET_ITEM#'));
}

async function presetPartition(presetId: number): Promise<Item[]> {
  return partition(`PRESET#${presetId}`);
}

async function seedSession(
  id: number,
  ownerId: number,
  name: string,
): Promise<void> {
  await put([{
    pk: `USER#${ownerId}`,
    sk: `SESSION#${String(id).padStart(8, '0')}`,
    entity_type: 'workout_session',
    id,
    user_id: ownerId,
    preset_id: null,
    name,
    notes: null,
    bodyweight: null,
    created_at: '2026-01-01T00:00:00.000Z',
    finished_at: null,
  }]);
}

async function seedSet(
  id: number,
  ownerId: number,
  sessionId: number,
  exerciseId: number,
  order = 0,
): Promise<void> {
  await put([{
    pk: `USER#${ownerId}`,
    sk: `WORKOUT_SET#${String(order).padStart(8, '0')}#${id}`,
    entity_type: 'workout_set',
    id,
    session_id: sessionId,
    user_id: ownerId,
    set_order: order,
    exercise_id: exerciseId,
    set_type: 'normal',
    weight: null,
    reps: null,
    bodyweight: null,
    dropdown_weights: null,
    completed_at: null,
  }]);
}

async function seedPlan(
  id: number,
  ownerId: number,
  presetIds: number[],
): Promise<void> {
  await put([
    {
      pk: `PLAN#${id}`,
      sk: 'METADATA',
      entity_type: 'workout_plan',
      id,
      user_id: ownerId,
      name: 'Mixed Safety Plan',
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    ...presetIds.map((presetId, index) => ({
      pk: `PLAN#${id}`,
      sk: `PLAN_PRESET#${index + 1}`,
      entity_type: 'plan_preset',
      id: index + 1,
      parent_plan_id: id,
      preset_id: presetId,
      order: index,
    })),
  ]);
}

async function counter(entity: string): Promise<number> {
  const item = await get({ pk: `COUNTER#${entity}`, sk: 'NEXT_ID' });
  return typeof item?.nextId === 'number' ? item.nextId : 1;
}

describe('AuthorizationBoundaryTests', () => {
  before(async () => {
    api = await startTestApi();
    const alice = await registerAndLogin(api, 'security-alice');
    const bob = await registerAndLogin(api, 'security-bob');
    aliceToken = alice.accessToken;
    aliceId = alice.userId;
    bobToken = bob.accessToken;
    bobId = bob.userId;
    seedExercise(201, aliceId, 'Alice Secret Lift');
    seedExercise(202, null, 'Common Lift');
    seedExercise(203, aliceId, 'Second Secret Lift');
    seedExercise(204, null, 'Bench Press');
    seedExercise(205, null, 'Rows');
    seedExercise(206, null, 'Template Lift');
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  after(() => {
    api?.stop();
  });

  it('test_cannot_create_preset_with_private_foreign_exercise', async () => {
    const response = await api.call('POST', '/api/workouts/presets/', {
      token: bobToken,
      body: {
        name: 'Bob Preset',
        exercises: [{
          exerciseId: 201,
          type: 'normal',
          sets: 1,
          order: 0,
        }],
      },
    });

    assert.equal(response.status, 400);
    assert.equal(await findByName('Bob Preset'), undefined);
    const leaked = await api.documentClient.send(new ScanCommand({
      TableName: api.tableName,
      FilterExpression: 'exercise_id = :exerciseId',
      ExpressionAttributeValues: { ':exerciseId': 201 },
    }));
    assert.deepEqual(leaked.Items, []);
  });

  it('test_cannot_update_preset_with_private_foreign_exercise', async () => {
    await seedPreset({
      id: 1101,
      ownerId: bobId,
      name: 'Bob Preset',
      rows: [{ id: 5101, exerciseId: 202, sets: 3, order: 0 }],
    });

    const response = await api.call('PATCH', '/api/workouts/presets/1101/', {
      token: bobToken,
      body: {
        name: 'Bob Preset Updated',
        exercises: [{
          id: 5101,
          exerciseId: 201,
          type: 'normal',
          sets: 5,
          order: 0,
        }],
      },
    });

    assert.equal(response.status, 400);
    const row = await get({ pk: 'PRESET#1101', sk: 'PRESET_EXERCISE#5101' });
    assert.equal(row?.exercise_id, 202);
    assert.equal(row?.sets, 3);
  });

  it('test_cannot_start_public_preset_with_hidden_foreign_exercise', async () => {
    await seedPreset({
      id: 1102,
      ownerId: aliceId,
      name: 'Shared But Unsafe',
      isPublic: true,
      rows: [{ id: 5102, exerciseId: 201, sets: 1, order: 0 }],
    });

    const response = await api.call(
      'POST',
      '/api/workouts/presets/1102/start_workout/',
      { token: bobToken },
    );

    assert.equal(response.status, 403);
    const sessions = await api.documentClient.send(new ScanCommand({
      TableName: api.tableName,
      FilterExpression: 'user_id = :userId AND preset_id = :presetId',
      ExpressionAttributeValues: { ':userId': bobId, ':presetId': 1102 },
    }));
    assert.deepEqual(sessions.Items, []);
  });

  it('test_cannot_start_private_foreign_preset', async () => {
    await seedPreset({
      id: 1103,
      ownerId: aliceId,
      name: 'Alice Private Preset',
      rows: [],
    });

    const response = await api.call(
      'POST',
      '/api/workouts/presets/1103/start_workout/',
      { token: bobToken },
    );

    assert.equal(response.status, 404);
    const sessions = await api.documentClient.send(new ScanCommand({
      TableName: api.tableName,
      FilterExpression: 'user_id = :userId AND preset_id = :presetId',
      ExpressionAttributeValues: { ':userId': bobId, ':presetId': 1103 },
    }));
    assert.deepEqual(sessions.Items, []);
  });

  it('test_cannot_directly_create_session_from_unsafe_public_preset', async () => {
    await seedPreset({
      id: 1104,
      ownerId: aliceId,
      name: 'Shared But Unsafe',
      isPublic: true,
      rows: [{ id: 5103, exerciseId: 201, sets: 1, order: 0 }],
    });

    const response = await api.call('POST', '/api/workouts/sessions/', {
      token: bobToken,
      body: { name: 'Direct Session', preset_id: 1104 },
    });

    assert.equal(response.status, 403);
    assert.equal(await findByName('Direct Session'), undefined);
  });

  it('test_malformed_sets_payload_returns_400_without_session', async () => {
    const response = await api.call('POST', '/api/workouts/sessions/', {
      token: aliceToken,
      body: { name: 'Malformed Sets', sets: 'bad' },
    });

    assert.equal(response.status, 400);
    assert.equal(await findByName('Malformed Sets'), undefined);
  });

  it('test_use_plan_prevalidates_every_preset_before_copying', async () => {
    await seedPreset({
      id: 1106,
      ownerId: bobId,
      name: 'Bob Valid Preset',
      rows: [{ id: 5111, exerciseId: 202, sets: 1, order: 0 }],
    });
    await seedPreset({
      id: 1107,
      ownerId: aliceId,
      name: 'Alice Private Plan',
      rows: [],
    });
    await seedPlan(1201, bobId, [1106, 1107]);

    const response = await api.call(
      'POST',
      '/api/workouts/plans/1201/use_plan/',
      { token: bobToken },
    );

    assert.equal(response.status, 403);
    const copied = await api.documentClient.send(new ScanCommand({
      TableName: api.tableName,
      FilterExpression: 'user_id = :userId AND #name = :sourceName',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':userId': bobId,
        ':sourceName': 'Alice Private Plan',
      },
    }));
    assert.deepEqual(copied.Items, []);
  });

  it('test_cannot_move_set_into_foreign_session', async () => {
    await seedSession(1301, aliceId, 'Alice');
    await seedSet(1401, aliceId, 1301, 204);
    await seedSession(1302, bobId, 'Bob');

    const response = await api.call('PATCH', '/api/workouts/sets/1401/', {
      token: aliceToken,
      body: { session: 1302 },
    });

    assert.equal(response.status, 400);
    const moved = await get({
      pk: `USER#${aliceId}`,
      sk: 'WORKOUT_SET#00000000#1401',
    });
    assert.equal(moved?.session_id, 1301);
  });

  it('test_first_added_set_order_starts_at_zero', async () => {
    await seedSession(1303, aliceId, 'Alice');

    const response = await api.call('POST', '/api/workouts/sets/', {
      token: aliceToken,
      body: {
        session: 1303,
        exerciseId: 204,
        setType: 'normal',
        reps: 8,
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.set_order, 0);
  });

  it('test_converting_superset_row_removes_stale_items', async () => {
    await seedPreset({
      id: 1108,
      ownerId: aliceId,
      name: 'Alice Preset',
      rows: [{
        id: 5104,
        type: 'superset',
        sets: 3,
        order: 0,
        items: [{ id: 5301, exerciseId: 204, order: 0 }],
      }],
    });

    const response = await api.call('PATCH', '/api/workouts/presets/1108/', {
      token: aliceToken,
      body: {
        exercises: [{
          id: 5104,
          exerciseId: 205,
          type: 'normal',
          sets: 2,
          order: 0,
        }],
      },
    });

    assert.equal(response.status, 200);
    const row = await get({ pk: 'PRESET#1108', sk: 'PRESET_EXERCISE#5104' });
    assert.equal(row?.exercise_id, 205);
    const items = await presetPartition(1108);
    assert.equal(supersetRows(items, 1108).length, 0);
  });

  it('test_invalid_nested_set_does_not_leave_orphan_session', async () => {
    const response = await api.call('POST', '/api/workouts/sessions/', {
      token: aliceToken,
      body: {
        name: 'Broken Workout',
        sets: [{ exerciseId: 999999 }],
      },
    });

    assert.equal(response.status, 400);
    assert.equal(await findByName('Broken Workout'), undefined);
  });

  it('test_plan_creation_rejects_unavailable_presets_atomically', async () => {
    await seedPreset({
      id: 1109,
      ownerId: aliceId,
      name: 'Alice Private Plan',
      rows: [],
    });

    const response = await api.call('POST', '/api/workouts/plans/', {
      token: bobToken,
      body: { name: 'Leaky Plan', preset_ids: [1109] },
    });

    assert.equal(response.status, 400);
    assert.equal(await findByName('Leaky Plan'), undefined);
    assert.equal((await partition('PLAN#1201')).length, 0);
  });

  it('test_plan_creation_rejects_duplicate_preset_ids', async () => {
    await seedPreset({
      id: 1110,
      ownerId: aliceId,
      name: 'Alice Private Plan',
      rows: [],
    });

    const response = await api.call('POST', '/api/workouts/plans/', {
      token: aliceToken,
      body: { name: 'Duplicate Plan', preset_ids: [1110, '1110'] },
    });

    assert.equal(response.status, 400);
    assert.equal(await findByName('Duplicate Plan'), undefined);
  });

  it('test_template_copy_rolls_back_on_nested_copy_failure', async () => {
    await seedPreset({
      id: 1111,
      ownerId: null,
      name: 'Atomic Template',
      rows: [
        { id: 5105, exerciseId: 206, sets: 1, order: 0 },
        {
          id: 5106,
          type: 'superset',
          sets: 1,
          order: 1,
          items: [{ id: 5302, exerciseId: 206, order: 0 }],
        },
      ],
    });

    const presetId = await counter('preset');
    const normalRowId = await counter('preset_exercise');
    await put([{
      pk: `PRESET#${presetId}`,
      sk: `PRESET_EXERCISE#${normalRowId + 1}`,
      id: normalRowId + 1,
      entity_type: 'preset_exercise',
      collision: true,
    }]);

    const response = await api.call(
      'POST',
      '/api/workouts/presets/create_from_template/',
      {
        token: aliceToken,
        body: { template_id: 1111 },
      },
    );
    assert.equal(response.status, 500);

    assert.equal(await get({ pk: `PRESET#${presetId}`, sk: 'METADATA' }), undefined);
    const sourceItems = await presetPartition(1111);
    assert.equal(presetRows(sourceItems, 1111).length, 2);
    assert.equal(supersetRows(sourceItems, 1111).length, 1);
    assert.equal((await presetPartition(presetId)).length, 0);
  });
});
