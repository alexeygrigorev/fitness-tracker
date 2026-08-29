import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function requestBodySchema(path: string, method: string): JsonObject {
  const body = operation(path, method).requestBody as JsonObject;
  const content = body.content as JsonObject;
  const json = content['application/json'] as JsonObject;
  return json.schema as JsonObject;
}

function responseSchema(path: string, method: string, status = 200): JsonObject {
  const responses = operation(path, method).responses as JsonObject;
  const response = responses[String(status)] as JsonObject;
  const content = response.content as JsonObject;
  const json = content['application/json'] as JsonObject;
  return json.schema as JsonObject;
}

describe('OpenApiContractTests', () => {
  it('test_committed_typescript_contract_matches_recorded_hash', async () => {
    const committed = await readFile(`${process.cwd()}/openapi.json`);
    assert.equal(
      createHash('sha256').update(committed).digest('hex'),
      'c8389cf488b9f51896c417b4cdf8ed8c819d9a0deecda378d1401e0917bfe38a',
    );
  });

  it('test_documented_nutrition_day_contracts_match_responses', () => {
    assert.deepEqual(
      responseSchema('/api/food/meals/date/{date_str}/', 'get'),
      { type: 'array', items: { $ref: '#/components/schemas/Meal' } },
    );
    assert.equal(
      responseSchema('/api/food/meals/daily/totals/{date_str}/', 'get').$ref,
      '#/components/schemas/MealDailyTotals',
    );

    const schemas = components().schemas as JsonObject;
    const totals = schemas.MealDailyTotals as JsonObject;
    assert.deepEqual(
      new Set(Object.keys(totals.properties as JsonObject)),
      new Set([
        'date',
        'calories',
        'protein_g',
        'carbs_g',
        'fat_g',
        'fiber_g',
        'sugar_g',
        'sodium_mg',
      ]),
    );

    const mealProperties = (schemas.Meal as JsonObject).properties as JsonObject;
    for (const field of ['totalCalories', 'totalProtein', 'totalCarbs', 'totalFat']) {
      assert.equal((mealProperties[field] as JsonObject).type, 'number');
    }
  });

  it('test_documented_plan_use_contract_matches_response', () => {
    assert.equal(
      responseSchema('/api/workouts/plans/{id}/', 'get').$ref,
      '#/components/schemas/WorkoutPlan',
    );
    const usePlan = operation('/api/workouts/plans/{id}/use_plan/', 'post');
    assert.equal('requestBody' in usePlan, false);
    assert.equal(
      responseSchema('/api/workouts/plans/{id}/use_plan/', 'post', 201).$ref,
      '#/components/schemas/PlanUseResponse',
    );
  });

  it('test_documented_preset_template_contracts_match_responses', () => {
    assert.deepEqual(
      responseSchema('/api/workouts/presets/templates/', 'get'),
      { type: 'array', items: { $ref: '#/components/schemas/WorkoutPreset' } },
    );
    assert.equal(
      requestBodySchema('/api/workouts/presets/create_from_template/', 'post').$ref,
      '#/components/schemas/TemplateCopyRequestRequest',
    );
    assert.equal(
      responseSchema('/api/workouts/presets/create_from_template/', 'post', 201).$ref,
      '#/components/schemas/WorkoutPreset',
    );
    assert.equal(
      requestBodySchema('/api/workouts/presets/{id}/start_workout/', 'post').$ref,
      '#/components/schemas/StartedWorkoutRequestRequest',
    );
    assert.equal(
      responseSchema('/api/workouts/presets/{id}/start_workout/', 'post', 201).$ref,
      '#/components/schemas/StartedWorkoutResponse',
    );
  });

  it('test_documented_user_and_settings_contracts_match_responses', () => {
    assert.equal(
      responseSchema('/api/auth/login/', 'post').$ref,
      '#/components/schemas/LoginResponse',
    );

    const loginResponse = (components().schemas as JsonObject)
      .LoginResponse as JsonObject;
    assert.deepEqual(
      new Set(Object.keys(loginResponse.properties as JsonObject)),
      new Set(['access', 'refresh', 'user']),
    );
    assert.equal(
      requestBodySchema('/api/auth/me/update/', 'patch').$ref,
      '#/components/schemas/PatchedUserProfileUpdateRequestRequest',
    );

    const settingsResponse = responseSchema(
      '/api/auth/exercise-settings/',
      'get',
    );
    assert.equal(settingsResponse.type, 'object');
    assert.equal(
      (settingsResponse.additionalProperties as JsonObject).$ref,
      '#/components/schemas/ExerciseSettingsResponse',
    );
    assert.equal(
      requestBodySchema(
        '/api/auth/exercise-settings/{exercise_id}/',
        'post',
      ).$ref,
      '#/components/schemas/ExerciseSettingsRequestRequest',
    );
    assert.equal(
      responseSchema(
        '/api/auth/exercise-settings/{exercise_id}/',
        'post',
      ).$ref,
      '#/components/schemas/ExerciseSettingsResponse',
    );
  });

  it('test_documented_workout_lifecycle_contracts_match_responses', () => {
    const finish = operation('/api/workouts/sessions/{id}/finish/', 'post');
    assert.equal('requestBody' in finish, false);
    assert.deepEqual(
      responseSchema('/api/workouts/sessions/active/', 'get'),
      {
        type: 'array',
        items: { $ref: '#/components/schemas/WorkoutSession' },
      },
    );
    assert.equal(
      requestBodySchema(
        '/api/workouts/sessions/{id}/sets/{set_id}/',
        'patch',
      ).$ref,
      '#/components/schemas/PatchedWorkoutSetUpdateRequest',
    );
    assert.equal(
      responseSchema(
        '/api/workouts/sessions/{id}/sets/{set_id}/',
        'patch',
      ).$ref,
      '#/components/schemas/WorkoutSet',
    );

    const workoutSet = (components().schemas as JsonObject).WorkoutSet as JsonObject;
    const loggedAt = (workoutSet.properties as JsonObject).loggedAt as JsonObject;
    assert.equal(loggedAt.type, 'string');
    assert.equal(loggedAt.nullable, true);
    assert.equal(
      responseSchema(
        '/api/workouts/sessions/{id}/sets/{set_id}/completion/',
        'delete',
      ).$ref,
      '#/components/schemas/WorkoutSet',
    );
  });
});
