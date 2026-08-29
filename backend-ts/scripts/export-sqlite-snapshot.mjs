#!/usr/bin/env node
// Export the application tables from the SQLite source schema. Node 24's
// built-in SQLite reader keeps this migration utility dependency-free and
// preserves the numeric IDs used by DynamoDB.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.argv[2] ?? 'db.sqlite3');
const outputPath = resolve(process.argv[3] ?? '.tmp/migration-snapshot.json');

const db = new DatabaseSync(databasePath, { readOnly: true });

const BOOLEAN_FIELDS = new Set([
  'is_superuser', 'is_staff', 'is_active', 'dark_mode', 'is_compound',
  'is_bodyweight', 'is_public', 'include_warmup', 'is_preset',
]);
const JSON_FIELDS = new Set(['instructions', 'tags', 'sub_sets', 'dropdown_weights']);
const DATETIME_FIELDS = new Set([
  'last_login', 'date_joined', 'created_at', 'updated_at', 'finished_at',
  'logged_at', 'completed_at',
]);
const DECIMAL_FIELDS = new Set([
  'weight', 'bodyweight', 'serving_size', 'calories', 'protein', 'carbs', 'fat',
  'fiber', 'sugar', 'saturated_fat', 'sodium', 'insulin_response', 'grams',
]);

function normalizeDateTime(value) {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  if (value.includes('T') || /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  return `${value.replace(' ', 'T')}+00:00`;
}

function normalizeValue(field, value) {
  if (BOOLEAN_FIELDS.has(field)) return Boolean(value);
  if (JSON_FIELDS.has(field)) return value === null || value === undefined ? value : JSON.parse(value);
  if (DATETIME_FIELDS.has(field)) return normalizeDateTime(value);
  if (DECIMAL_FIELDS.has(field) && value !== null && value !== undefined) {
    return Number(Number(value).toFixed(2));
  }
  return value;
}

function rows(table) {
  return db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all().map((raw) => {
    const row = { id: raw.id };
    for (const [field, value] of Object.entries(raw)) {
      if (field === 'id') continue;
      row[field] = normalizeValue(field, value);
    }
    return row;
  });
}

function lookup(table, id) {
  return db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
}

function exerciseExtras(exerciseId) {
  const muscleGroups = db.prepare(`
    SELECT g.name
    FROM workouts_musclegroup AS g
    JOIN workouts_exercisemusclegroup AS link ON link.muscle_group_id = g.id
    WHERE link.exercise_id = ?
    ORDER BY g.name
  `).all(exerciseId).map((entry) => entry.name);
  const tagIds = db.prepare(`
    SELECT exercisetag_id
    FROM workouts_exercise_tags
    WHERE exercise_id = ?
    ORDER BY exercisetag_id
  `).all(exerciseId).map((entry) => entry.exercisetag_id);
  return { muscle_group_names: muscleGroups, tag_ids: tagIds };
}

const tables = {
  users: rows('users_user'),
  exercise_settings: rows('users_exercisesettings'),
  muscle_regions: rows('workouts_muscleregion'),
  muscle_groups: rows('workouts_musclegroup'),
  equipment: rows('workouts_equipment'),
  exercise_tags: rows('workouts_exercisetag'),
  exercise_muscle_groups: rows('workouts_exercisemusclegroup'),
  exercises: rows('workouts_exercise').map((exercise) => ({
    ...exercise,
    ...exerciseExtras(exercise.id),
  })),
  workout_presets: rows('workouts_workoutpreset'),
  workout_preset_exercises: rows('workouts_workoutpresetexercise').map((entry) => ({
    ...entry,
    exercise_name: entry.exercise_id === null ? null : lookup('workouts_exercise', entry.exercise_id)?.name ?? null,
  })),
  superset_exercise_items: rows('workouts_supersetexerciseitem').map((entry) => ({
    ...entry,
    exercise_name: lookup('workouts_exercise', entry.exercise_id)?.name ?? null,
  })),
  workout_plans: rows('workouts_workoutplan'),
  workout_plan_presets: rows('workouts_workoutplanpreset'),
  workout_sessions: rows('workouts_workoutsession'),
  workout_sets: rows('workouts_workoutset'),
  food_items: rows('food_fooditem'),
  meals: rows('food_meal'),
  meal_food_items: rows('food_mealfooditem'),
  meal_templates: rows('food_mealtemplate'),
  meal_template_food_items: rows('food_mealtemplatefooditem'),
};

const snapshot = {
  schemaVersion: 1,
  sourceEngine: 'sqlite',
  sourceSchema: 'fitness-tracker-v1',
  counts: Object.fromEntries(Object.entries(tables).map(([name, entries]) => [name, entries.length])),
  tables,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
db.close();
console.log(`Wrote SQLite migration snapshot to ${outputPath}`);
