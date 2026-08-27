import type { DocumentItem } from '../repository.js';

export interface MigrationSnapshotRow {
  readonly [key: string]: unknown;
  readonly id: number;
}

export interface MigrationSnapshot {
  readonly schemaVersion: number;
  readonly sourceEngine: string;
  readonly sourceSchema: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly tables: Readonly<Record<string, readonly MigrationSnapshotRow[]>>;
}

export interface BuiltMigrationItems {
  readonly domainItems: readonly DocumentItem[];
  readonly counterItems: readonly DocumentItem[];
  readonly allItems: readonly DocumentItem[];
  readonly sourceRowCount: number;
}

const EXPECTED_TABLES = [
  'users',
  'exercise_settings',
  'muscle_regions',
  'muscle_groups',
  'equipment',
  'exercise_tags',
  'exercise_muscle_groups',
  'exercises',
  'workout_presets',
  'workout_preset_exercises',
  'superset_exercise_items',
  'workout_plans',
  'workout_plan_presets',
  'workout_sessions',
  'workout_sets',
  'food_items',
  'meals',
  'meal_food_items',
  'meal_templates',
  'meal_template_food_items',
] as const;

type ExpectedTable = typeof EXPECTED_TABLES[number];
type SnapshotTables = Record<ExpectedTable, readonly MigrationSnapshotRow[]>;

interface ValidationContext {
  readonly tables: SnapshotTables;
}

class MigrationContractError extends Error {}

function fail(message: string): never {
  throw new MigrationContractError(message);
}

function row(table: readonly MigrationSnapshotRow[], label: string, id: unknown): MigrationSnapshotRow {
  const found = table.find((candidate) => candidate.id === id);
  if (!found) fail(`${label} ${String(id)} does not exist`);
  return found;
}

function foreignKey(
  value: unknown,
  label: string,
  allowNull = false,
): number | null {
  if ((value === undefined || value === null) && allowNull) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    fail(`${label} must reference a positive integer`);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(`${label} must be text`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
  return value;
}

function decimal(value: unknown, label: string, allowNull = false): number | undefined {
  if ((value === undefined || value === null) && allowNull) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be a finite number`);
  }
  if (Math.abs(value) >= 10_000_000_000) fail(`${label} exceeds its database bound`);
  return value;
}

function timestamp(value: unknown, label: string, allowNull = false): string | undefined {
  if ((value === undefined || value === null) && allowNull) return undefined;
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) fail(`${label} must be an ISO timestamp`);
  return parsed;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function jsonValue(value: unknown, label: string): unknown {
  try {
    return structuredClone(value);
  } catch {
    fail(`${label} contains unsupported JSON data`);
  }
}

function validateUnique(
  rows: readonly MigrationSnapshotRow[],
  field: string,
  tableName: string,
): void {
  const seen = new Set<string>();
  for (const entry of rows) {
    const value = entry[field];
    if (typeof value !== 'string') fail(`${tableName}.${field} must be text`);
    if (seen.has(value)) fail(`Duplicate ${tableName}.${field}: ${value}`);
    seen.add(value);
  }
}

function validateReferences(localContext: ValidationContext): void {
  const context = localContext;
  const tables = context.tables;
  const reference = (
    value: unknown,
    label: string,
    targetTable: ExpectedTable,
    targetName: string,
    allowNull = false,
  ): number | null => {
    const id = foreignKey(value, label, allowNull);
    if (id !== null) row(tables[targetTable], targetName, id);
    return id;
  };

  for (const setting of tables.exercise_settings) {
    reference(
      setting.user_id,
      `exercise_settings[${setting.id}].user_id`,
      'users',
      'User',
    );
    reference(
      setting.exercise_id,
      `exercise_settings[${setting.id}].exercise_id`,
      'exercises',
      'Exercise',
    );
  }
  for (const group of tables.muscle_groups) {
    reference(
      group.region_id,
      `muscle_groups[${group.id}].region_id`,
      'muscle_regions',
      'Muscle region',
      true,
    );
  }
  for (const relation of tables.exercise_muscle_groups) {
    reference(
      relation.exercise_id,
      `exercise_muscle_groups[${relation.id}].exercise_id`,
      'exercises',
      'Exercise',
    );
    reference(
      relation.muscle_group_id,
      `exercise_muscle_groups[${relation.id}].muscle_group_id`,
      'muscle_groups',
      'Muscle group',
    );
  }
  for (const exercise of tables.exercises) {
    reference(
      exercise.user_id,
      `exercises[${exercise.id}].user_id`,
      'users',
      'User',
      true,
    );
    reference(
      exercise.equipment_id,
      `exercises[${exercise.id}].equipment_id`,
      'equipment',
      'Equipment',
      true,
    );
    for (const groupId of array(exercise.muscle_group_names, 'muscle_group_names')) {
      void groupId;
    }
    for (const tagId of array(exercise.tag_ids, 'tag_ids')) {
      row(tables.exercise_tags, 'Exercise tag', tagId);
    }
  }
  for (const preset of tables.workout_presets) {
    reference(
      preset.user_id,
      `workout_presets[${preset.id}].user_id`,
      'users',
      'User',
      true,
    );
  }
  for (const presetRow of tables.workout_preset_exercises) {
    reference(
      presetRow.preset_id,
      `preset rows[${presetRow.id}].preset_id`,
      'workout_presets',
      'Workout preset',
    );
    reference(
      presetRow.exercise_id,
      `preset rows[${presetRow.id}].exercise_id`,
      'exercises',
      'Exercise',
      true,
    );
  }
  for (const child of tables.superset_exercise_items) {
    reference(
      child.superset_id,
      `superset items[${child.id}].superset_id`,
      'workout_preset_exercises',
      'Superset parent',
    );
    reference(
      child.exercise_id,
      `superset items[${child.id}].exercise_id`,
      'exercises',
      'Exercise',
    );
  }
  for (const plan of tables.workout_plans) {
    reference(
      plan.user_id,
      `workout plans[${plan.id}].user_id`,
      'users',
      'User',
    );
  }
  for (const link of tables.workout_plan_presets) {
    reference(
      link.plan_id,
      `plan links[${link.id}].plan_id`,
      'workout_plans',
      'Workout plan',
    );
    reference(
      link.preset_id,
      `plan links[${link.id}].preset_id`,
      'workout_presets',
      'Workout preset',
    );
  }
  for (const session of tables.workout_sessions) {
    reference(
      session.user_id,
      `sessions[${session.id}].user_id`,
      'users',
      'User',
    );
    reference(
      session.preset_id,
      `sessions[${session.id}].preset_id`,
      'workout_presets',
      'Workout preset',
      true,
    );
  }
  for (const workoutSet of tables.workout_sets) {
    reference(
      workoutSet.session_id,
      `sets[${workoutSet.id}].session_id`,
      'workout_sessions',
      'Session',
    );
    reference(
      workoutSet.exercise_id,
      `sets[${workoutSet.id}].exercise_id`,
      'exercises',
      'Exercise',
    );
  }
  for (const food of tables.food_items) {
    const ownerId = reference(
      food.user_id,
      `foods[${food.id}].user_id`,
      'users',
      'Food owner',
      true,
    );
    if (food.source === 'canonical' && ownerId !== null) {
      fail(`Canonical food ${food.id} must not have an owner`);
    }
    if (food.source !== 'canonical' && ownerId === null) {
      fail(`Non-canonical food ${food.id} must have an owner`);
    }
  }
  for (const meal of tables.meals) {
    reference(meal.user_id, `meals[${meal.id}].user_id`, 'users', 'User');
  }
  for (const item of tables.meal_food_items) {
    reference(item.meal_id, `meal foods[${item.id}].meal_id`, 'meals', 'Meal');
    reference(
      item.food_id,
      `meal foods[${item.id}].food_id`,
      'food_items',
      'Food',
    );
  }
  for (const template of tables.meal_templates) {
    reference(
      template.user_id,
      `templates[${template.id}].user_id`,
      'users',
      'User',
    );
  }
  for (const item of tables.meal_template_food_items) {
    reference(
      item.template_id,
      `template foods[${item.id}].template_id`,
      'meal_templates',
      'Meal template',
    );
    reference(
      item.food_id,
      `template foods[${item.id}].food_id`,
      'food_items',
      'Food',
    );
  }
}

function validateDomainRules(tables: SnapshotTables): void {
  validateUnique(tables.users, 'username', 'users');
  validateUnique(tables.users, 'email', 'users');
  validateUnique(tables.muscle_regions, 'name', 'muscle_regions');
  validateUnique(tables.muscle_groups, 'name', 'muscle_groups');
  validateUnique(tables.equipment, 'name', 'equipment');
  validateUnique(tables.exercise_tags, 'name', 'exercise_tags');

  for (const user of tables.users) {
    text(user.password, `users[${user.id}].password`);
    boolean(user.dark_mode, `users[${user.id}].dark_mode`);
    boolean(user.is_active, `users[${user.id}].is_active`);
    timestamp(user.date_joined, `users[${user.id}].date_joined`, true);
  }
  for (const exercise of tables.exercises) {
    text(exercise.name, `exercises[${exercise.id}].name`);
    for (const instruction of array(exercise.instructions, 'instructions')) {
      jsonValue(instruction, `exercises[${exercise.id}].instructions`);
    }
    const materializedGroups = array(
      exercise.muscle_group_names,
      'muscle_group_names',
    ).map((name, index) => {
      return text(name, `exercises[${exercise.id}].muscle_group_names[${index}]`);
    });
    const materializedNames = new Set(materializedGroups);
    if (materializedGroups.length !== materializedNames.size) {
      fail(`exercises[${exercise.id}] has duplicate materialized muscle groups`);
    }
    const linkedNames = new Set(tables.exercise_muscle_groups
      .filter((relation) => relation.exercise_id === exercise.id)
      .map((relation) => {
        const group = row(
          tables.muscle_groups,
          'Muscle group',
          relation.muscle_group_id,
        );
        return text(group.name, `muscle_groups[${group.id}].name`);
      }));
    if (materializedNames.size !== linkedNames.size) {
      fail(`exercises[${exercise.id}] materialized muscle groups do not exactly match its links`);
    }
    for (const name of materializedGroups) {
      if (!linkedNames.has(name)) {
        fail(`exercises[${exercise.id}] has unlinked materialized muscle group ${name}`);
      }
    }
    for (const name of linkedNames) {
      if (!materializedNames.has(name)) {
        fail(`exercises[${exercise.id}] is missing materialized muscle group ${name}`);
      }
    }
    timestamp(exercise.created_at, `exercises[${exercise.id}].created_at`, true);
    timestamp(exercise.updated_at, `exercises[${exercise.id}].updated_at`, true);
  }
  for (const preset of tables.workout_presets) {
    array(preset.tags, `workout presets[${preset.id}].tags`);
  }
  for (const workoutSet of tables.workout_sets) {
    decimal(workoutSet.weight, `sets[${workoutSet.id}].weight`, true);
    decimal(workoutSet.bodyweight, `sets[${workoutSet.id}].bodyweight`, true);
    jsonValue(workoutSet.dropdown_weights, `sets[${workoutSet.id}].dropdown_weights`);
    timestamp(workoutSet.completed_at, `sets[${workoutSet.id}].completed_at`, true);
  }
  for (const session of tables.workout_sessions) {
    decimal(session.bodyweight, `sessions[${session.id}].bodyweight`, true);
  }
  for (const food of tables.food_items) {
    const servingSize = decimal(food.serving_size, `foods[${food.id}].serving_size`);
    if (servingSize !== undefined && servingSize <= 0) {
      fail(`foods[${food.id}].serving_size must be greater than zero`);
    }
    decimal(food.calories, `foods[${food.id}].calories`);
  }
  for (const item of [...tables.meal_food_items, ...tables.meal_template_food_items]) {
    const grams = decimal(item.grams, `nutrition items[${item.id}].grams`);
    if (grams !== undefined && grams <= 0) {
      fail(`nutrition items[${item.id}].grams must be greater than zero`);
    }
  }
}

function validateSnapshot(value: unknown): MigrationSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('Migration snapshot must be an object');
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) fail('Unsupported migration snapshot schemaVersion');
  if (candidate.sourceEngine !== 'django-sqlite') {
    fail('Migration snapshot was not produced by the supported SQLite exporter');
  }
  if (candidate.sourceSchema !== 'django-current') fail('Unknown source schema version');
  const rawTables = candidate.tables;
  if (typeof rawTables !== 'object' || rawTables === null || Array.isArray(rawTables)) {
    fail('Migration snapshot tables must be an object');
  }

  const inputTables = rawTables as Record<string, unknown>;
  const tables = Object.fromEntries(EXPECTED_TABLES.map((name) => {
    const entries = inputTables[name];
    if (!Array.isArray(entries)) fail(`Missing migration table ${name}`);
    const seenIds = new Set<number>();
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        fail(`${name} contains a non-object row`);
      }
      const id = (entry as Record<string, unknown>).id;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
        fail(`${name} contains an invalid row ID`);
      }
      if (seenIds.has(id)) fail(`Duplicate ${name} row ID ${id}`);
      seenIds.add(id);
    }
    return [name, entries] as const;
  })) as unknown as SnapshotTables;

  for (const name of EXPECTED_TABLES) {
    const declared = (candidate.counts as Record<string, unknown> | undefined)?.[name];
    if (declared !== tables[name].length) fail(`Count mismatch for ${name}`);
  }

  validateDomainRules(tables);
  validateReferences({ tables });
  return {
    schemaVersion: 1,
    sourceEngine: candidate.sourceEngine,
    sourceSchema: candidate.sourceSchema,
    counts: Object.fromEntries(EXPECTED_TABLES.map((name) => [name, tables[name].length])),
    tables,
  };
}

export function validateMigrationSnapshot(value: unknown): MigrationSnapshot {
  return validateSnapshot(value);
}

function taxonomyItem(partition: string, entityType: string, entry: MigrationSnapshotRow): DocumentItem {
  return {
    pk: partition,
    sk: `ID#${entry.id}`,
    entity_type: entityType,
    id: entry.id,
    name: entry.name,
    ...(entityType === 'muscle_group' ? { region_id: entry.region_id ?? null } : {}),
    ...(entityType === 'exercise_tag' ? { is_preset: entry.is_preset } : {}),
  };
}

function nutritionFields(entry: MigrationSnapshotRow): DocumentItem {
  return {
    id: entry.id,
    user_id: entry.user_id ?? null,
    name: entry.name,
    brand: entry.brand ?? null,
    barcode: entry.barcode ?? null,
    source: entry.source,
    serving_size: entry.serving_size,
    serving_unit: entry.serving_unit,
    calories: entry.calories,
    protein: entry.protein ?? 0,
    carbs: entry.carbs ?? 0,
    fat: entry.fat ?? 0,
    fiber: entry.fiber ?? null,
    sugar: entry.sugar ?? null,
    saturated_fat: entry.saturated_fat ?? null,
    sodium: entry.sodium ?? null,
    category: entry.category ?? null,
    glycemic_index: entry.glycemic_index ?? null,
    absorption_speed: entry.absorption_speed ?? null,
    insulin_response: entry.insulin_response ?? null,
    satiety_score: entry.satiety_score ?? null,
    protein_quality: entry.protein_quality ?? null,
  };
}

export function buildMigrationItems(input: unknown): BuiltMigrationItems {
  const snapshot = validateMigrationSnapshot(input);
  const tables = snapshot.tables;
  const items: DocumentItem[] = [];

  for (const entry of tables.users) {
    items.push({
      pk: `USER#${entry.id}`,
      sk: 'PROFILE',
      entity_type: 'user',
      id: entry.id,
      username: entry.username,
      email: entry.email,
      password: entry.password,
      dark_mode: entry.dark_mode,
      is_active: entry.is_active,
      ...(entry.date_joined === undefined ? {} : { date_joined: entry.date_joined }),
    }, {
      // Reservation items must not carry `username`/`email` attributes: both
      // GSIs (UsernameIndex/EmailIndex) key on those attribute names, and any
      // matching item — not just the PROFILE item — would be returned by a
      // lookup query, sometimes non-deterministically resolving logins to
      // this placeholder row instead of the real profile. Mirror
      // repository.ts's createUser(), which only stores `id` here.
      pk: `USERNAME#${entry.username}`,
      sk: 'RESERVATION',
      entity_type: 'user_reservation',
      id: entry.id,
    }, {
      pk: `EMAIL#${entry.email}`,
      sk: 'RESERVATION',
      entity_type: 'user_reservation',
      id: entry.id,
    });
  }

  for (const entry of tables.exercise_settings) {
    items.push({
      pk: `USER#${entry.user_id}`,
      sk: `EXERCISE_SETTING#${entry.exercise_id}`,
      entity_type: 'exercise_setting',
      id: entry.id,
      exercise_id: entry.exercise_id,
      weight: entry.weight ?? null,
      reps: entry.reps,
      sub_sets: structuredClone(entry.sub_sets ?? []),
      updated_at: entry.updated_at ?? null,
    });
  }

  for (const entry of tables.muscle_regions) {
    items.push(taxonomyItem('TAXONOMY#MUSCLE_REGION', 'muscle_region', entry));
  }
  for (const entry of tables.muscle_groups) {
    items.push(taxonomyItem('TAXONOMY#MUSCLE_GROUP', 'muscle_group', entry));
  }
  for (const entry of tables.equipment) {
    items.push(taxonomyItem('TAXONOMY#EQUIPMENT', 'equipment', entry));
  }
  for (const entry of tables.exercise_tags) {
    items.push(taxonomyItem('TAXONOMY#EXERCISE_TAG', 'exercise_tag', entry));
  }

  for (const relation of tables.exercise_muscle_groups) {
    items.push({
      pk: `EXERCISE#${relation.exercise_id}`,
      sk: `MUSCLE_GROUP_LINK#${relation.id}`,
      entity_type: 'exercise_muscle_group',
      id: relation.id,
      muscle_group_id: relation.muscle_group_id,
      target_type: relation.target_type,
    });
  }
  for (const exercise of tables.exercises) {
    const equipment = exercise.equipment_id === undefined ||
      exercise.equipment_id === null
      ? null
      : row(tables.equipment, 'Equipment', exercise.equipment_id).name;
    items.push({
      pk: `EXERCISE#${exercise.id}`,
      sk: 'METADATA',
      entity_type: 'exercise',
      id: exercise.id,
      user_id: exercise.user_id ?? null,
      name: exercise.name,
      muscle_groups: structuredClone(exercise.muscle_group_names ?? []),
      equipment_name: equipment,
      category: exercise.category,
      instructions: structuredClone(exercise.instructions ?? []),
      description: exercise.description ?? null,
      is_compound: exercise.is_compound,
      is_bodyweight: exercise.is_bodyweight,
      created_at: exercise.created_at ?? null,
      updated_at: exercise.updated_at ?? null,
    });
    for (const tagId of array(exercise.tag_ids, 'tag_ids')) {
      items.push({
        pk: `EXERCISE#${exercise.id}`,
        sk: `TAG_LINK#${tagId}`,
        entity_type: 'exercise_tag_link',
        exercise_id: exercise.id,
        tag_id: tagId,
      });
    }
  }

  for (const preset of tables.workout_presets) {
    items.push({
      pk: `PRESET#${preset.id}`,
      sk: 'METADATA',
      entity_type: 'workout_preset',
      id: preset.id,
      user_id: preset.user_id ?? null,
      name: preset.name,
      notes: preset.notes ?? null,
      status: preset.status,
      day_label: preset.day_label ?? null,
      tags: structuredClone(preset.tags ?? []),
      is_public: preset.is_public,
      created_at: preset.created_at ?? null,
      updated_at: preset.updated_at ?? null,
    });
  }
  for (const presetRow of tables.workout_preset_exercises) {
    const exercise = presetRow.exercise_id === undefined ||
      presetRow.exercise_id === null
      ? null
      : row(tables.exercises, 'Exercise', presetRow.exercise_id);
    items.push({
      pk: `PRESET#${presetRow.preset_id}`,
      sk: `PRESET_EXERCISE#${presetRow.id}`,
      entity_type: 'preset_exercise',
      id: presetRow.id,
      parent_preset_id: presetRow.preset_id,
      exercise_id: presetRow.exercise_id ?? null,
      exercise_name: exercise === null ? null : exercise.name,
      type: presetRow.type,
      sets: presetRow.sets,
      dropdowns: presetRow.dropdowns ?? null,
      include_warmup: presetRow.include_warmup,
      order: presetRow.order,
    });
  }
  for (const child of tables.superset_exercise_items) {
    const superset = row(
      tables.workout_preset_exercises,
      'Superset parent',
      child.superset_id,
    );
    const exercise = row(tables.exercises, 'Exercise', child.exercise_id);
    items.push({
      pk: `PRESET#${superset.preset_id}`,
      sk: `SUPERSET_ITEM#${child.superset_id}#${child.id}`,
      entity_type: 'superset_item',
      id: child.id,
      parent_row_id: child.superset_id,
      parent_preset_id: superset.preset_id,
      exercise_id: child.exercise_id,
      exercise_name: exercise.name,
      type: child.type,
      dropdowns: child.dropdowns ?? null,
      include_warmup: child.include_warmup,
      order: child.order,
    });
  }

  for (const plan of tables.workout_plans) {
    items.push({
      pk: `PLAN#${plan.id}`,
      sk: 'METADATA',
      entity_type: 'workout_plan',
      id: plan.id,
      user_id: plan.user_id,
      name: plan.name,
      description: plan.description ?? null,
      created_at: plan.created_at ?? null,
      updated_at: plan.updated_at ?? null,
    });
  }
  for (const link of tables.workout_plan_presets) {
    items.push({
      pk: `PLAN#${link.plan_id}`,
      sk: `PLAN_PRESET#${link.id}`,
      entity_type: 'plan_preset',
      id: link.id,
      parent_plan_id: link.plan_id,
      preset_id: link.preset_id,
      order: link.order,
    });
  }

  for (const session of tables.workout_sessions) {
    items.push({
      pk: `USER#${session.user_id}`,
      sk: `SESSION#${String(session.id).padStart(8, '0')}`,
      entity_type: 'workout_session',
      id: session.id,
      user_id: session.user_id,
      preset_id: session.preset_id ?? null,
      name: session.name,
      notes: session.notes ?? null,
      bodyweight: session.bodyweight ?? null,
      created_at: session.created_at ?? '',
      finished_at: session.finished_at ?? null,
    });
  }
  for (const workoutSet of tables.workout_sets) {
    const session = row(tables.workout_sessions, 'Session', workoutSet.session_id);
    const exercise = row(tables.exercises, 'Exercise', workoutSet.exercise_id);
    items.push({
      pk: `USER#${session.user_id}`,
      sk: `WORKOUT_SET#${String(workoutSet.set_order).padStart(8, '0')}#${workoutSet.id}`,
      entity_type: 'workout_set',
      id: workoutSet.id,
      session_id: session.id,
      user_id: session.user_id,
      set_order: workoutSet.set_order,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      set_type: workoutSet.set_type,
      weight: workoutSet.weight ?? null,
      reps: workoutSet.reps ?? null,
      bodyweight: workoutSet.bodyweight ?? null,
      dropdown_weights: structuredClone(workoutSet.dropdown_weights ?? null),
      completed_at: workoutSet.completed_at ?? null,
    });
  }

  for (const food of tables.food_items) {
    const canonical = food.source === 'canonical';
    items.push({
      pk: canonical ? 'CANONICAL_FOODS' : `USER#${food.user_id}`,
      sk: `FOOD#${food.id}`,
      entity_type: 'food_item',
      ...nutritionFields(food),
    });
  }
  for (const meal of tables.meals) {
    const foodItemIds = tables.meal_food_items
      .filter((item) => item.meal_id === meal.id)
      .map((item) => item.id)
      .sort((left, right) => left - right);
    items.push({
      pk: `USER#${meal.user_id}`,
      sk: `MEAL#${meal.id}`,
      entity_type: 'meal',
      id: meal.id,
      user_id: meal.user_id,
      name: meal.name,
      meal_type: meal.meal_type,
      date: meal.date,
      logged_at: meal.logged_at ?? null,
      event_time: meal.event_time ?? null,
      notes: meal.notes ?? null,
      source: meal.source,
      food_item_ids: foodItemIds,
    });
  }
  for (const item of tables.meal_food_items) {
    const meal = row(tables.meals, 'Meal', item.meal_id);
    items.push({
      pk: `MEAL#${meal.id}`,
      sk: `MEAL_FOOD_ITEM#${item.id}`,
      entity_type: 'meal_food_item',
      id: item.id,
      meal_id: meal.id,
      food_id: item.food_id,
      grams: item.grams,
      order: item.order,
    });
  }
  for (const template of tables.meal_templates) {
    const foodItemIds = tables.meal_template_food_items
      .filter((item) => item.template_id === template.id)
      .map((item) => item.id)
      .sort((left, right) => left - right);
    items.push({
      pk: `USER#${template.user_id}`,
      sk: `MEAL_TEMPLATE#${template.id}`,
      entity_type: 'meal_template',
      id: template.id,
      user_id: template.user_id,
      name: template.name,
      category: template.category,
      notes: template.notes ?? null,
      created_at: template.created_at ?? null,
      updated_at: template.updated_at ?? null,
      food_item_ids: foodItemIds,
    });
  }
  for (const item of tables.meal_template_food_items) {
    const template = row(tables.meal_templates, 'Template', item.template_id);
    items.push({
      pk: `MEAL_TEMPLATE#${template.id}`,
      sk: `TEMPLATE_FOOD_ITEM#${item.id}`,
      entity_type: 'meal_template_food_item',
      id: item.id,
      template_id: template.id,
      food_id: item.food_id,
      grams: item.grams,
      order: item.order,
    });
  }

  const counters: Array<[string, readonly MigrationSnapshotRow[]]> = [
    ['user', tables.users],
    ['exercise_setting', tables.exercise_settings],
    ['muscle_region', tables.muscle_regions],
    ['muscle_group', tables.muscle_groups],
    ['equipment', tables.equipment],
    ['exercise_tag', tables.exercise_tags],
    ['exercise_muscle_group', tables.exercise_muscle_groups],
    ['exercise', tables.exercises],
    ['preset', tables.workout_presets],
    ['preset_exercise', tables.workout_preset_exercises],
    ['superset_item', tables.superset_exercise_items],
    ['workout_plan', tables.workout_plans],
    ['plan_preset', tables.workout_plan_presets],
    ['workout_session', tables.workout_sessions],
    ['workout_set', tables.workout_sets],
    ['food', tables.food_items],
    ['meal', tables.meals],
    ['meal_food_item', tables.meal_food_items],
    ['meal_template', tables.meal_templates],
    ['meal_template_food_item', tables.meal_template_food_items],
  ];
  const counterItems = counters.map(([entity, entries]) => ({
    pk: `COUNTER#${entity}`,
    sk: 'NEXT_ID',
    nextId: entries.reduce((maximum, entry) => Math.max(maximum, entry.id), 0) + 1,
  }));

  const domainItems = items.sort((left, right) =>
    String(left.pk).localeCompare(String(right.pk)) ||
    String(left.sk).localeCompare(String(right.sk)));
  const seenKeys = new Set<string>();
  for (const item of domainItems) {
    const key = `${String(item.pk)}\u0000${String(item.sk)}`;
    if (seenKeys.has(key)) {
      fail(`Generated duplicate primary key ${String(item.pk)} / ${String(item.sk)}`);
    }
    seenKeys.add(key);
  }

  return {
    domainItems,
    counterItems,
    allItems: [...domainItems, ...counterItems],
    sourceRowCount: EXPECTED_TABLES.reduce(
      (total, table) => total + tables[table].length,
      0,
    ),
  };
}
