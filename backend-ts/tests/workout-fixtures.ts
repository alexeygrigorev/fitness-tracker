import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { TestApi } from './helpers.js';

export interface ExerciseSpec {
  bodyweight?: boolean;
  compound?: boolean;
}

export interface NormalRowSpec {
  kind?: 'normal';
  id: number;
  exerciseId: number;
  type?: 'normal' | 'dropdown' | 'bodyweight';
  sets: number;
  dropdowns?: number;
  includeWarmup?: boolean;
  order: number;
}

export interface SupersetChildSpec {
  id: number;
  exerciseId: number;
  type?: 'normal' | 'dropdown';
  dropdowns?: number;
  includeWarmup?: boolean;
  order: number;
}

export type PresetRowSpec =
  | NormalRowSpec
  | {
    kind: 'superset';
    id: number;
    sets: number;
    order: number;
    children: SupersetChildSpec[];
  };

export async function seedWorkoutExercise(
  api: TestApi,
  id: number,
  name: string,
  options: ExerciseSpec = {},
): Promise<void> {
  await api.documentClient.send(new PutCommand({
    TableName: api.tableName,
    Item: {
      pk: `EXERCISE#${id}`,
      sk: 'METADATA',
      entity_type: 'exercise',
      id,
      user_id: null,
      name,
      is_bodyweight: options.bodyweight === true,
      is_compound: options.compound === true,
    },
  }));
}

export async function createWorkoutPreset(
  api: TestApi,
  presetId: number,
  name: string,
  rows: PresetRowSpec[],
  options: { notes?: string; dayLabel?: string } = {},
): Promise<void> {
  const partition = `PRESET#${presetId}`;
  const items: Array<Record<string, unknown>> = [{
    pk: partition,
    sk: 'METADATA',
    entity_type: 'workout_preset',
    id: presetId,
    user_id: null,
    name,
    ...(options.notes === undefined ? {} : { notes: options.notes }),
    ...(options.dayLabel === undefined ? {} : { day_label: options.dayLabel }),
    is_public: false,
  }];

  for (const row of rows) {
    if (row.kind === 'superset') {
      items.push({
        pk: partition,
        sk: `ROW#${String(row.order).padStart(4, '0')}#${row.id}`,
        entity_type: 'preset_exercise',
        id: row.id,
        exercise_id: null,
        type: 'superset',
        sets: row.sets,
        include_warmup: false,
        order: row.order,
      });
      for (const child of row.children) {
        items.push({
          pk: partition,
          sk: `SUPERSET_ITEM#${row.id}#${child.order}`,
          entity_type: 'superset_item',
          id: child.id,
          parent_row_id: row.id,
          exercise_id: child.exerciseId,
          type: child.type ?? 'normal',
          ...(child.dropdowns === undefined ? {} : { dropdowns: child.dropdowns }),
          include_warmup: child.includeWarmup === true,
          order: child.order,
        });
      }
      continue;
    }

    items.push({
      pk: partition,
      sk: `ROW#${String(row.order).padStart(4, '0')}#${row.id}`,
      entity_type: 'preset_exercise',
      id: row.id,
      exercise_id: row.exerciseId,
      type: row.type ?? 'normal',
      sets: row.sets,
      ...(row.dropdowns === undefined ? {} : { dropdowns: row.dropdowns }),
      include_warmup: row.includeWarmup === true,
      order: row.order,
    });
  }

  await Promise.all(items.map((item) =>
    api.documentClient.send(new PutCommand({
      TableName: api.tableName,
      Item: item,
    }))));
}
