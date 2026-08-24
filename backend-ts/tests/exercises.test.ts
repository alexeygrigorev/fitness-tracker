import assert from 'node:assert/strict';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { after, before, describe, it } from 'node:test';
import {
  registerAndLogin,
  seedExercises,
  startTestApi,
  type TestApi,
} from './helpers.js';

let api!: TestApi;

describe('TestCommonExercises', () => {
  let accessToken: string;

  before(async () => {
    api = await startTestApi();
    await seedExercises(api.documentClient, api.tableName, [{
      id: 201,
      name: 'Bench Press',
      is_compound: true,
    }]);
    const account = await registerAndLogin(api, 'common-user-one');
    accessToken = account.accessToken;
  });

  it('test_anyone_can_view_common_exercises', async () => {
    const anonymous = await api.call('GET', '/api/workouts/exercises/');
    assert.equal(anonymous.status, 200);
    assert.ok(anonymous.body.some((exercise: any) => exercise.id === 201));

    const authenticated = await api.call('GET', '/api/workouts/exercises/', {
      token: accessToken,
    });
    assert.equal(authenticated.status, 200);
    assert.ok(authenticated.body.some((exercise: any) => exercise.id === 201));
  });

  it('test_common_exercise_has_no_user', async () => {
    const response = await api.call('GET', '/api/workouts/exercises/201/');
    assert.equal(response.status, 200);
    assert.equal(response.body.id, 201);

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#201', sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.user_id, null);
  });

  it('test_user_cannot_delete_common_exercise', async () => {
    const response = await api.call('DELETE', '/api/workouts/exercises/201/', {
      token: accessToken,
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'Cannot delete common exercises');

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#201', sk: 'METADATA' },
    }));
    assert.ok(stored.Item);
  });

  it('test_user_cannot_modify_common_exercise', async () => {
    const response = await api.call('PATCH', '/api/workouts/exercises/201/', {
      body: { name: 'Modified Bench Press' },
      token: accessToken,
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'Cannot modify common exercises');

    const fetched = await api.call('GET', '/api/workouts/exercises/201/');
    assert.equal(fetched.body.name, 'Bench Press');
  });
});

describe('TestUserExercises', () => {
  let owner: Awaited<ReturnType<typeof registerAndLogin>>;
  let other: Awaited<ReturnType<typeof registerAndLogin>>;

  before(async () => {
    if (!api) {
      api = await startTestApi();
    }
    owner = await registerAndLogin(api, 'exercise-owner');
    other = await registerAndLogin(api, 'exercise-other');
    await seedExercises(api.documentClient, api.tableName, [
      {
        id: 202,
        name: 'Owner Custom Exercise',
        user_id: owner.userId,
        is_bodyweight: true,
      },
      {
        id: 203,
        name: 'Other Custom Exercise',
        user_id: other.userId,
        is_bodyweight: true,
      },
    ]);
  });

  it('test_user_exercise_has_owner', async () => {
    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#202', sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.user_id, owner.userId);
  });

  it('test_create_exercise_assigns_to_authenticated_user', async () => {
    const response = await api.call('POST', '/api/workouts/exercises/', {
      body: {
        name: 'My New Exercise',
        is_compound: false,
        is_bodyweight: true,
        muscleGroups: [' Chest '],
        equipment: ' Dumbbell ',
        instructions: ['Keep the wrist neutral.'],
      },
      token: owner.accessToken,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: response.body.id,
      name: 'My New Exercise',
      muscleGroups: ['Chest'],
      equipment: 'Dumbbell',
      bodyweight: true,
      category: 'isolation',
      instructions: ['Keep the wrist neutral.'],
    });

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: `EXERCISE#${response.body.id}`, sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.user_id, owner.userId);
  });

  it('test_owner_can_view_their_exercises', async () => {
    const response = await api.call('GET', '/api/workouts/exercises/', {
      token: owner.accessToken,
    });
    const ids = response.body.map((exercise: any) => exercise.id);
    assert.ok(ids.includes(202));
  });

  it('test_owner_can_modify_their_exercise', async () => {
    const response = await api.call('PATCH', '/api/workouts/exercises/202/', {
      body: { name: 'Updated Exercise' },
      token: owner.accessToken,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Updated Exercise');

    const fetched = await api.call('GET', '/api/workouts/exercises/202/', {
      token: owner.accessToken,
    });
    assert.equal(fetched.body.name, 'Updated Exercise');
  });

  it('test_owner_can_delete_their_exercise', async () => {
    await seedExercises(api.documentClient, api.tableName, [{
      id: 206,
      name: 'Disposable Custom Exercise',
      user_id: owner.userId,
      is_bodyweight: true,
    }]);
    const response = await api.call('DELETE', '/api/workouts/exercises/206/', {
      token: owner.accessToken,
    });
    assert.equal(response.status, 204);
    assert.equal(response.body, null);

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#206', sk: 'METADATA' },
    }));
    assert.equal(stored.Item, undefined);
  });

  it('test_user_cannot_modify_another_users_exercise', async () => {
    const response = await api.call('PATCH', '/api/workouts/exercises/203/', {
      body: { name: 'Hacked Exercise' },
      token: owner.accessToken,
    });
    assert.equal(response.status, 403);
    assert.equal(
      response.body.error,
      'Cannot modify exercises created by another user',
    );

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#203', sk: 'METADATA' },
    }));
    assert.equal(stored.Item?.name, 'Other Custom Exercise');
  });

  it('test_user_cannot_delete_another_users_exercise', async () => {
    const response = await api.call('DELETE', '/api/workouts/exercises/203/', {
      token: owner.accessToken,
    });
    assert.equal(response.status, 403);
    assert.equal(
      response.body.error,
      'Cannot delete exercises created by another user',
    );

    const stored = await api.documentClient.send(new GetCommand({
      TableName: api.tableName,
      Key: { pk: 'EXERCISE#203', sk: 'METADATA' },
    }));
    assert.ok(stored.Item);
  });
});

describe('TestEquipmentCaseParity', () => {
  let owner: Awaited<ReturnType<typeof registerAndLogin>>;

  before(async () => {
    if (!api) {
      api = await startTestApi();
    }
    owner = await registerAndLogin(api, 'equipment-case-owner');
    await Promise.all([
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: {
          pk: 'TAXONOMY#EQUIPMENT',
          sk: 'ID#301',
          entity_type: 'equipment',
          id: 301,
          name: 'Kettlebell',
        },
      })),
      api.documentClient.send(new PutCommand({
        TableName: api.tableName,
        Item: {
          pk: 'TAXONOMY#EQUIPMENT',
          sk: 'ID#302',
          entity_type: 'equipment',
          id: 302,
          name: 'kettlebell',
        },
      })),
    ]);
  });

  it('test_equipment_case_variants_reuse_deterministically', async () => {
    const created = await api.call('POST', '/api/workouts/exercises/', {
      body: {
        name: 'Case Variant Exercise',
        equipment: ' KeTtLeBeLl ',
      },
      token: owner.accessToken,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.equipment, 'Kettlebell');

    const updated = await api.call(
      'PATCH',
      `/api/workouts/exercises/${created.body.id}/`,
      {
        body: { equipment: 'kettleBELL' },
        token: owner.accessToken,
      },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.equipment, 'Kettlebell');

    const newEquipmentFirst = await api.call(
      'POST',
      '/api/workouts/exercises/',
      {
        body: { name: 'Sandbag First Spelling', equipment: 'Loaded Sandbag' },
        token: owner.accessToken,
      },
    );
    assert.equal(newEquipmentFirst.status, 201);
    assert.equal(newEquipmentFirst.body.equipment, 'Loaded Sandbag');

    const newEquipmentVariant = await api.call(
      'POST',
      '/api/workouts/exercises/',
      {
        body: {
          name: 'Sandbag Case Variant',
          equipment: 'loaded sandbag',
        },
        token: owner.accessToken,
      },
    );
    assert.equal(newEquipmentVariant.status, 201);
    assert.equal(newEquipmentVariant.body.equipment, 'Loaded Sandbag');

    const result = await api.documentClient.send(new QueryCommand({
      TableName: api.tableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'TAXONOMY#EQUIPMENT' },
      ConsistentRead: true,
    }));
    const equipmentNames = (result.Items ?? [])
      .filter((item: any) => item.entity_type === 'equipment')
      .map((item: any) => String(item.name));
    assert.equal(
      equipmentNames.filter((name: string) =>
        name.toLowerCase() === 'kettlebell'
      ).length,
      2,
    );
    assert.deepEqual(
      equipmentNames.filter((name: string) =>
        name.toLowerCase() === 'loaded sandbag'
      ),
      ['Loaded Sandbag'],
    );
  });
});

describe('TestExerciseListFiltering', () => {
  let account: Awaited<ReturnType<typeof registerAndLogin>>;

  before(async () => {
    if (!api) {
      api = await startTestApi();
    }
    account = await registerAndLogin(
      api,
      'filter-user',
      'filter-user@example.com',
    );
    await seedExercises(api.documentClient, api.tableName, [
      { id: 207, name: 'Squat', is_compound: true },
      { id: 208, name: 'Deadlift', is_compound: true },
      {
        id: 209,
        name: 'My Custom Exercise',
        user_id: account.userId,
      },
    ]);
  });

  it('test_list_shows_all_exercises', async () => {
    const response = await api.call('GET', '/api/workouts/exercises/', {
      token: account.accessToken,
    });
    const names = response.body.map((exercise: any) => exercise.name);
    assert.ok(names.includes('Squat'));
    assert.ok(names.includes('Deadlift'));
    assert.ok(names.includes('My Custom Exercise'));
  });

  it('test_unauthenticated_can_see_common_exercises', async () => {
    const response = await api.call('GET', '/api/workouts/exercises/');
    const names = response.body.map((exercise: any) => exercise.name);
    assert.ok(names.includes('Squat'));
    assert.ok(names.includes('Deadlift'));
    assert.ok(!names.includes('My Custom Exercise'));
  });

  after(() => {
    api?.stop();
  });
});
