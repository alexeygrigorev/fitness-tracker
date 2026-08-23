import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

type JsonObject = Record<string, unknown>;

const schema = JSON.parse(
  await readFile(`${process.cwd()}/openapi.json`, 'utf8'),
) as JsonObject;

function paths(): JsonObject {
  return schema.paths as JsonObject;
}

function components(): JsonObject {
  return schema.components as JsonObject;
}

function operation(path: string, method: string): JsonObject {
  return (paths()[path] as JsonObject)[method] as JsonObject;
}

function requestBodySchema(path: string, method: string): unknown {
  const body = operation(path, method).requestBody as JsonObject;
  const content = body.content as JsonObject;
  const json = content['application/json'] as JsonObject;
  return json.schema;
}

function responseSchema(path: string, method: string, status = 200): unknown {
  const responses = operation(path, method).responses as JsonObject;
  const response = responses[String(status)] as JsonObject;
  const content = response.content as JsonObject;
  const json = content['application/json'] as JsonObject;
  return json.schema;
}

describe('OpenApiContractTests', () => {
  it('test_documented_user_and_settings_contracts_match_responses', async () => {
    assert.equal(
      (responseSchema('/api/auth/login/', 'post') as JsonObject).$ref,
      '#/components/schemas/LoginResponse',
    );

    const schemas = components().schemas as JsonObject;
    const loginResponse = schemas.LoginResponse as JsonObject;
    const loginProperties = loginResponse.properties as JsonObject;
    assert.deepEqual(
      new Set(Object.keys(loginProperties)),
      new Set(['access', 'refresh', 'user']),
    );

    assert.equal(
      (requestBodySchema('/api/auth/me/update/', 'patch') as JsonObject).$ref,
      '#/components/schemas/PatchedUserProfileUpdateRequestRequest',
    );

    const settingsResponse = responseSchema(
      '/api/auth/exercise-settings/',
      'get',
    ) as JsonObject;
    assert.equal(settingsResponse.type, 'object');
    assert.equal(
      (settingsResponse.additionalProperties as JsonObject).$ref,
      '#/components/schemas/ExerciseSettingsResponse',
    );

    assert.equal(
      (
        requestBodySchema(
          '/api/auth/exercise-settings/{exercise_id}/',
          'post',
        ) as JsonObject
      ).$ref,
      '#/components/schemas/ExerciseSettingsRequestRequest',
    );
    assert.equal(
      (
        responseSchema(
          '/api/auth/exercise-settings/{exercise_id}/',
          'post',
        ) as JsonObject
      ).$ref,
      '#/components/schemas/ExerciseSettingsResponse',
    );
  });
});
