import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { registerAndLogin, startTestApi, type TestApi } from './helpers.js';

let api: TestApi;
let accessToken: string;
let userId: number;

async function storedSetting(ownerId: number): Promise<Record<string, unknown> | undefined> {
  const result = await api.documentClient.send(new GetCommand({
    TableName: api.tableName,
    Key: {
      pk: `USER#${ownerId}`,
      sk: 'EXERCISE_SETTING#1',
    },
  }));
  return result.Item;
}

describe('ExerciseSettingsTests', () => {
  before(async () => {
    api = await startTestApi({ exerciseIds: [1] });
    const session = await registerAndLogin(api, 'exercise-settings-user');
    accessToken = session.accessToken;
    userId = session.userId;
  });

  after(() => {
    api?.stop();
  });

  beforeEach(async () => {
    await api.documentClient.send(new DeleteCommand({
      TableName: api.tableName,
      Key: {
        pk: `USER#${userId}`,
        sk: 'EXERCISE_SETTING#1',
      },
    }));
  });

  it('test_create_exercise_settings', async () => {
    const response = await api.call(
      'POST',
      '/api/auth/exercise-settings/1/',
      { body: { weight: 80, reps: 10 }, token: accessToken },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { weight: 80, reps: 10 });

    const stored = await storedSetting(userId);
    assert.equal(stored?.weight, 80);
    assert.equal(stored?.reps, 10);
  });

  it('test_update_exercise_settings', async () => {
    await api.call('POST', '/api/auth/exercise-settings/1/', {
      body: { weight: 60, reps: 8 },
      token: accessToken,
    });

    const response = await api.call(
      'POST',
      '/api/auth/exercise-settings/1/',
      { body: { weight: 80, reps: 10 }, token: accessToken },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { weight: 80, reps: 10 });

    const stored = await storedSetting(userId);
    assert.equal(stored?.weight, 80);
    assert.equal(stored?.reps, 10);
  });

  it('test_exercise_settings_with_dropdowns', async () => {
    const subSets = [
      { weight: 60, reps: 10 },
      { weight: 57.5, reps: 10 },
      { weight: 55, reps: 10 },
    ];
    const response = await api.call(
      'POST',
      '/api/auth/exercise-settings/1/',
      { body: { weight: 60, reps: 10, subSets }, token: accessToken },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.subSets, subSets);

    const stored = await storedSetting(userId);
    assert.deepEqual(stored?.sub_sets, subSets);
  });

  it('test_exercise_settings_unique_per_user', async () => {
    await api.call('POST', '/api/auth/exercise-settings/1/', {
      body: { weight: 80, reps: 10 },
      token: accessToken,
    });

    const secondUser = await registerAndLogin(
      api,
      'exercise-settings-second',
      'exercise-settings-second@example.com',
    );
    await api.call('POST', '/api/auth/exercise-settings/1/', {
      body: { weight: 60, reps: 8 },
      token: secondUser.accessToken,
    });

    const firstStored = await storedSetting(userId);
    const secondStored = await storedSetting(secondUser.userId);
    assert.equal(firstStored?.weight, 80);
    assert.equal(secondStored?.weight, 60);

    const firstListed = await api.call('GET', '/api/auth/exercise-settings/', {
      token: accessToken,
    });
    const secondListed = await api.call('GET', '/api/auth/exercise-settings/', {
      token: secondUser.accessToken,
    });
    assert.deepEqual(firstListed.body, { 1: { weight: 80, reps: 10 } });
    assert.deepEqual(secondListed.body, { 1: { weight: 60, reps: 8 } });
  });
});
