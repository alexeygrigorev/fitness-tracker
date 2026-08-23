import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  buildMigrationItems,
} from '../src/migration/snapshot.js';
import {
  loadMigrationItems,
  MigrationLoadError,
} from '../src/migration/load.js';
import { startTestApi, type TestApi } from './helpers.js';

let api!: TestApi;

function migrationSnapshotFixture() {
  const timestamp = '2026-01-15T10:00:00Z';
  const tables = {
    users: [{
      id: 7,
      password: 'pbkdf2_sha256$600000$migration$salt-hash',
      username: 'migration-user',
      email: 'migration@example.com',
      date_joined: timestamp,
      is_active: true,
      dark_mode: false,
    }],
    exercise_settings: [{
      id: 8,
      user_id: 7,
      exercise_id: 21,
      weight: 80,
      reps: 8,
      sub_sets: [{ weight: 70, reps: 6 }],
      updated_at: timestamp,
    }],
    muscle_regions: [{ id: 1, name: 'Upper Body' }],
    muscle_groups: [{ id: 1, name: 'Pectorals', region_id: 1 }],
    equipment: [{ id: 1, name: 'Barbell' }],
    exercise_tags: [{ id: 1, name: 'strength', is_preset: true }],
    exercise_muscle_groups: [{
      id: 1,
      exercise_id: 21,
      muscle_group_id: 1,
      target_type: 'primary',
    }],
    exercises: [{
      id: 21,
      user_id: 7,
      name: 'Bench Press',
      muscle_group_names: ['Pectorals'],
      tag_ids: [1],
      equipment_id: 1,
      description: null,
      category: 'compound',
      instructions: ['Lower under control.'],
      is_compound: true,
      is_bodyweight: false,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    workout_presets: [{
      id: 31,
      user_id: 7,
      name: 'Push Day',
      notes: null,
      status: 'active',
      day_label: null,
      tags: ['strength'],
      is_public: false,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    workout_preset_exercises: [{
      id: 32,
      preset_id: 31,
      exercise_id: 21,
      exercise_name: 'Bench Press',
      type: 'normal',
      sets: 3,
      dropdowns: null,
      include_warmup: false,
      order: 0,
    }],
    superset_exercise_items: [],
    workout_plans: [{
      id: 41,
      user_id: 7,
      name: 'Strength Block',
      description: null,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    workout_plan_presets: [{
      id: 42,
      plan_id: 41,
      preset_id: 31,
      order: 0,
    }],
    workout_sessions: [{
      id: 51,
      user_id: 7,
      preset_id: 31,
      name: 'Migration Session',
      notes: null,
      bodyweight: 82.5,
      created_at: timestamp,
      finished_at: null,
    }],
    workout_sets: [{
      id: 52,
      session_id: 51,
      set_order: 0,
      exercise_id: 21,
      set_type: 'normal',
      weight: 100,
      reps: 8,
      bodyweight: 82.5,
      dropdown_weights: null,
      completed_at: timestamp,
    }],
    food_items: [{
      id: 61,
      user_id: null,
      name: 'Chicken Breast',
      brand: null,
      barcode: null,
      source: 'canonical',
      serving_size: 100,
      serving_unit: 'g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
      sugar: 0,
      saturated_fat: 1,
      sodium: 74,
      category: 'protein',
      glycemic_index: 0,
      absorption_speed: null,
      insulin_response: 0,
      satiety_score: 2,
      protein_quality: 3,
    }],
    meals: [{
      id: 71,
      user_id: 7,
      name: 'Post Workout',
      meal_type: 'post_workout',
      date: '2026-08-24',
      logged_at: timestamp,
      event_time: '12:00:00',
      notes: null,
      source: 'manual',
    }],
    meal_food_items: [{
      id: 72,
      meal_id: 71,
      food_id: 61,
      grams: 150,
      order: 0,
    }],
    meal_templates: [{
      id: 81,
      user_id: 7,
      name: 'Breakfast Template',
      category: 'breakfast',
      notes: null,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    meal_template_food_items: [{
      id: 82,
      template_id: 81,
      food_id: 61,
      grams: 120,
      order: 0,
    }],
  };

  return {
    schemaVersion: 1,
    sourceEngine: 'django-sqlite',
    sourceSchema: 'django-current',
    counts: Object.fromEntries(
      Object.entries(tables).map(([name, entries]) => [name, entries.length]),
    ),
    tables,
  };
}

describe('SQLite migration rehearsal', () => {
  let snapshot: ReturnType<typeof migrationSnapshotFixture>;

  before(async () => {
    api = await startTestApi({ exerciseIds: [] });
    snapshot = migrationSnapshotFixture();
  });

  after(() => {
    api?.stop();
  });

  it('imports every generated item and preserves runtime counters', async () => {
    const built = buildMigrationItems(snapshot);
    assert.equal(built.sourceRowCount, 19);
    assert.equal(built.domainItems.length, 22);
    assert.equal(built.counterItems.length, 20);

    const result = await loadMigrationItems(api, built.allItems);
    assert.deepEqual(result, {
      itemCount: 42,
      batchCount: 2,
      verifiedItemCount: 42,
    });

    const expectedCounters: Array<[string, number]> = [
      ['user', 8],
      ['exercise_setting', 9],
      ['muscle_region', 2],
      ['muscle_group', 2],
      ['equipment', 2],
      ['exercise_tag', 2],
      ['exercise_muscle_group', 2],
      ['exercise', 22],
      ['preset', 32],
      ['preset_exercise', 33],
      ['superset_item', 1],
      ['workout_plan', 42],
      ['plan_preset', 43],
      ['workout_session', 52],
      ['workout_set', 53],
      ['food', 62],
      ['meal', 72],
      ['meal_food_item', 73],
      ['meal_template', 82],
      ['meal_template_food_item', 83],
    ];
    await Promise.all(expectedCounters.map(async ([entity, nextId]) => {
      const result = await api.documentClient.send(new GetCommand({
        TableName: api.tableName,
        Key: { pk: `COUNTER#${entity}`, sk: 'NEXT_ID' },
      }));
      assert.equal(result.Item?.nextId, nextId, entity);
    }));
  });

  it('preserves representative numeric-ID runtime keys', async () => {
    const expectations = [
      [{ pk: 'USER#7', sk: 'PROFILE' }, 'user'],
      [{ pk: 'USERNAME#migration-user', sk: 'RESERVATION' }, 'user_reservation'],
      [{ pk: 'EMAIL#migration@example.com', sk: 'RESERVATION' }, 'user_reservation'],
      [{ pk: 'EXERCISE#21', sk: 'METADATA' }, 'exercise'],
      [{ pk: 'PRESET#31', sk: 'PRESET_EXERCISE#32' }, 'preset_exercise'],
      [{ pk: 'USER#7', sk: 'SESSION#00000051' }, 'workout_session'],
      [{ pk: 'USER#7', sk: 'WORKOUT_SET#00000000#52' }, 'workout_set'],
      [{ pk: 'CANONICAL_FOODS', sk: 'FOOD#61' }, 'food_item'],
      [{ pk: 'MEAL_TEMPLATE#81', sk: 'TEMPLATE_FOOD_ITEM#82' }, 'meal_template_food_item'],
    ] as const;

    await Promise.all(expectations.map(async ([key, entityType]) => {
      const result = await api.documentClient.send(new GetCommand({
        TableName: api.tableName,
        Key: key,
      }));
      assert.ok(result.Item, JSON.stringify(key));
      assert.equal(result.Item.pk, key.pk);
      assert.equal(result.Item.sk, key.sk);
      assert.equal(result.Item.entity_type, entityType);
    }));
  });

  it('rejects a foreign-key target that does not exist', () => {
    const dangling = structuredClone(snapshot);
    dangling.tables.exercise_settings[0].user_id = 999999;
    assert.throws(
      () => buildMigrationItems(dangling),
      /User 999999 does not exist/,
    );
  });

  it('refuses a nonempty target without writing again', async () => {
    const built = buildMigrationItems(snapshot);
    await assert.rejects(
      loadMigrationItems(api, built.allItems),
      (error: unknown) => {
        assert.ok(error instanceof MigrationLoadError);
        assert.match(error.message, /target table .* is not empty/);
        return true;
      },
    );
  });
});
