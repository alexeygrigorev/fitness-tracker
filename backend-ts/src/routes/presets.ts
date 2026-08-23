import type { JsonObject } from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import type { RouteContext, RouteDefinition } from '../router.js';
import {
  isPresetExercise,
  isSupersetItem,
  isWorkoutPreset,
  type WorkoutPresetItem,
} from '../workout-store.js';
import {
  appendPresetRows,
  copyPresetItems,
  lastUsedWeightsFor,
  materializePreset,
  presetMetadataInput,
  serializePreset,
  visibleExercise,
  type LoadedPreset,
  validatePresetExercises,
} from '../workout-preset-service.js';

function requestBody(context: RouteContext): JsonObject {
  const value = context.request.body;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, { detail: 'Invalid JSON body.' });
  }
  return value as JsonObject;
}

export async function createOwnedPreset(
  context: RouteContext,
): Promise<Record<string, unknown>> {
  const user = await context.requireUser();
  const input = requestBody(context);
  const metadata = presetMetadataInput(input);
  const rows = await validatePresetExercises(
    context.repository,
    user.id,
    input.exercises ?? [],
    [],
  );
  const created = await materializePreset(context.repository, {
    userId: user.id,
    ...metadata,
    rows,
  });
  await context.repository.putNewItemsTransactionally([
    created.metadata,
    ...created.rows,
    ...created.children,
  ]);
  return serializedPreset(context, user.id, {
    preset: created.metadata,
    rows: created.rows,
    items: created.children,
  });
}

async function loadRawPreset(
  context: RouteContext,
  presetId: number,
): Promise<LoadedPreset> {
  const preset = await context.repository.get<WorkoutPresetItem>({
    pk: `PRESET#${presetId}`,
    sk: 'METADATA',
  });
  if (!preset || !isWorkoutPreset(preset)) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const partition = await context.repository.queryPartition({
    partitionKey: String(preset.pk),
  });
  return {
    preset,
    partition,
    rows: partition.filter(isPresetExercise)
      .sort((left, right) => left.order - right.order || left.id - right.id),
    items: partition.filter(isSupersetItem)
      .sort((left, right) => left.order - right.order || left.id - right.id),
  };
}

function presetIsAccessible(preset: WorkoutPresetItem, userId: number): boolean {
  return preset.user_id === null ||
    preset.user_id === undefined ||
    preset.user_id === userId ||
    preset.is_public === true;
}

async function presetHasHiddenExercises(
  repository: RouteContext['repository'],
  loaded: LoadedPreset,
  userId: number,
): Promise<boolean> {
  for (const row of loaded.rows) {
    if (row.type === 'superset') {
      const children = loaded.items.filter((item) =>
        item.parent_row_id === row.id);
      for (const child of children) {
        if (!visibleExercise(await repository.getExercise(child.exercise_id), userId)) {
          return true;
        }
      }
    } else {
      const exercise = row.exercise_id === null || row.exercise_id === undefined
        ? undefined
        : await repository.getExercise(row.exercise_id);
      if (!visibleExercise(exercise, userId)) return true;
    }
  }
  return false;
}

async function serializedPreset(
  context: RouteContext,
  userId: number,
  loaded: Pick<LoadedPreset, 'preset' | 'rows' | 'items'>,
): Promise<Record<string, unknown>> {
  const settings = await context.repository.listExerciseSettings(userId);
  return serializePreset(loaded, {
    lastUsedWeights: lastUsedWeightsFor(loaded, settings),
  });
}

async function readablePreset(
  context: RouteContext,
  presetId: number,
): Promise<{ userId: number; loaded: LoadedPreset }> {
  const user = await context.requireUser();
  const loaded = await loadRawPreset(context, presetId);
  const hidden = await presetHasHiddenExercises(
    context.repository,
    loaded,
    user.id,
  );
  if (!presetIsAccessible(loaded.preset, user.id) || hidden) {
    throw new HttpError(404, { error: 'Not found' });
  }
  return { userId: user.id, loaded };
}

async function requireOwnedPreset(
  context: RouteContext,
  presetId: number,
  action: 'modify' | 'delete',
) {
  const user = await context.requireUser();
  const loaded = await loadRawPreset(context, presetId);
  if (loaded.preset.user_id === null || loaded.preset.user_id === undefined) {
    throw new HttpError(403, {
      error: action === 'delete'
        ? 'Cannot delete template presets'
        : 'Cannot modify template presets',
    });
  }
  if (loaded.preset.user_id !== user.id) {
    throw new HttpError(403, {
      error: action === 'delete'
        ? 'Cannot delete presets created by another user'
        : 'Cannot modify presets created by another user',
    });
  }
  return { user, loaded };
}

export async function updateOwnedPreset(
  context: RouteContext,
  presetId: number,
): Promise<Record<string, unknown>> {
  const { loaded } = await requireOwnedPreset(context, presetId, 'modify');
  const input = requestBody(context);
  const scalarInput = presetMetadataInput({
    name: input.name ?? loaded.preset.name,
    notes: input.notes ?? loaded.preset.notes ?? null,
    dayLabel: input.dayLabel ?? loaded.preset.day_label ?? null,
    tags: input.tags ?? loaded.preset.tags ?? [],
    is_public: input.is_public ?? loaded.preset.is_public === true,
  });
  const existingRows = loaded.partition.filter(isPresetExercise);
  const updatedMetadata: typeof loaded.preset = {
    ...loaded.preset,
    name: scalarInput.name,
    notes: scalarInput.notes,
    day_label: scalarInput.dayLabel,
    tags: scalarInput.tags,
    is_public: scalarInput.isPublic,
    updated_at: new Date().toISOString(),
  };

  if (!('exercises' in input)) {
    await context.repository.put(updatedMetadata, {
      ConditionExpression: 'attribute_exists(pk)',
    });
    return serializedPreset(context, loaded.preset.user_id as number, {
      ...loaded,
      preset: updatedMetadata,
    });
  }

  const requestedRows = await validatePresetExercises(
    context.repository,
    loaded.preset.user_id as number,
    input.exercises,
    existingRows,
  );
  const desired = await appendPresetRows(
    context.repository,
    updatedMetadata,
    requestedRows,
  );
  const desiredKeys = new Set(desired.rows.map((row) => String(row.sk)));
  const staleItems = loaded.partition.filter((item) =>
    (isPresetExercise(item) || isSupersetItem(item)) &&
    !desiredKeys.has(String(item.sk)));
  await context.repository.transact([
    {
      Put: {
        TableName: context.config.tableName,
        Item: desired.metadata,
        ConditionExpression: 'attribute_exists(pk)',
      },
    },
    ...staleItems.map((item) => ({
      Delete: {
        TableName: context.config.tableName,
        Key: { pk: item.pk, sk: item.sk },
      },
    })),
    ...[...desired.rows, ...desired.children].map((item) => ({
      Put: {
        TableName: context.config.tableName,
        Item: item,
      },
    })),
  ]);

  const partition = await context.repository.queryPartition({
    partitionKey: String(loaded.preset.pk),
  });
  return serializedPreset(context, loaded.preset.user_id as number, {
    preset: desired.metadata,
    rows: partition.filter(isPresetExercise),
    items: partition.filter(isSupersetItem),
  });
}

export async function copyAccessiblePreset(
  context: RouteContext,
  templateId: unknown,
): Promise<Record<string, unknown>> {
  const user = await context.requireUser();
  if (templateId === undefined || templateId === null || templateId === '') {
    throw new HttpError(400, { error: 'template_id is required' });
  }
  const normalizedId = typeof templateId === 'string' && /^\d+$/.test(templateId)
    ? Number(templateId)
    : templateId;
  if (typeof normalizedId !== 'number' || !Number.isSafeInteger(normalizedId)) {
    throw new HttpError(404, { error: 'Template not found' });
  }
  const source = await loadRawPreset(context, normalizedId);
  if (!presetIsAccessible(source.preset, user.id)) {
    throw new HttpError(403, {
      error: 'Cannot copy private preset from another user',
    });
  }
  if (await presetHasHiddenExercises(context.repository, source, user.id)) {
    throw new HttpError(403, {
      error: 'Template contains an unavailable exercise',
    });
  }

  const copied = await copyPresetItems(
    context.repository,
    source,
    user.id,
  );
  await context.repository.putNewItemsTransactionally([
    copied.metadata,
    ...copied.rows,
    ...copied.children,
  ]);
  return serializedPreset(context, user.id, {
    preset: copied.metadata,
    rows: copied.rows,
    items: copied.children,
  });
}

export async function listOwnedPresets(
  context: RouteContext,
): Promise<Array<Record<string, unknown>>> {
  const user = await context.requireUser();
  const [metadata, settings] = await Promise.all([
    context.repository.scan<WorkoutPresetItem>({
      FilterExpression: '#entity = :entity AND #owner = :owner',
      ExpressionAttributeNames: {
        '#entity': 'entity_type',
        '#owner': 'user_id',
      },
      ExpressionAttributeValues: {
        ':entity': 'workout_preset',
        ':owner': user.id,
      },
    }),
    context.repository.listExerciseSettings(user.id),
  ]);
  return Promise.all(metadata
    .sort((left, right) => left.id - right.id)
    .map(async (preset) => {
      const loaded = await loadRawPreset(context, preset.id);
      return serializePreset(loaded, {
        lastUsedWeights: lastUsedWeightsFor(loaded, settings),
      });
    }));
}

export async function listTemplatePresets(
  context: RouteContext,
): Promise<Array<Record<string, unknown>>> {
  const metadata = await context.repository.scan<WorkoutPresetItem>({
    FilterExpression:
      '#entity = :entity AND (#owner = :null OR #public = :public)',
    ExpressionAttributeNames: {
      '#entity': 'entity_type',
      '#owner': 'user_id',
      '#public': 'is_public',
    },
    ExpressionAttributeValues: {
      ':entity': 'workout_preset',
      ':null': null,
      ':public': true,
    },
  });
  const templates: Array<Record<string, unknown>> = [];
  for (const preset of metadata.sort((left, right) => left.id - right.id)) {
    const loaded = await loadRawPreset(context, preset.id);
    if (await presetHasHiddenExercises(context.repository, loaded, -1)) continue;
    templates.push(serializePreset(loaded));
  }
  return templates;
}

export async function readAccessiblePreset(
  context: RouteContext,
  presetId: number,
): Promise<Record<string, unknown>> {
  const { userId, loaded } = await readablePreset(context, presetId);
  return serializedPreset(context, userId, loaded);
}

export async function deleteOwnedPreset(
  context: RouteContext,
  presetId: number,
): Promise<void> {
  const { loaded } = await requireOwnedPreset(context, presetId, 'delete');
  await context.repository.deleteAllTransactionally(
    loaded.partition.map((item) => ({ pk: item.pk, sk: item.sk })),
  );
}

export function registerPresetRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/workouts/presets',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => jsonResponse(
      context.request.method === 'GET' ? 200 : 201,
      context.request.method === 'GET'
        ? await listOwnedPresets(context)
        : await createOwnedPreset(context),
      context.cors,
    ),
  });

  addRoute({
    method: 'GET',
    pattern: '/api/workouts/presets/templates',
    handle: async (context) => jsonResponse(
      200,
      await listTemplatePresets(context),
      context.cors,
    ),
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/presets/create_from_template',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const input = requestBody(context);
      return jsonResponse(
        201,
        await copyAccessiblePreset(context, input.template_id),
        context.cors,
      );
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/workouts/presets/:presetId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const presetId = params.presetId as number;
      if (context.request.method === 'GET') {
        return jsonResponse(
          200,
          await readAccessiblePreset(context, presetId),
          context.cors,
        );
      }
      if (context.request.method === 'DELETE') {
        await deleteOwnedPreset(context, presetId);
        return jsonResponse(204, {}, context.cors);
      }
      return jsonResponse(
        200,
        await updateOwnedPreset(context, presetId),
        context.cors,
      );
    },
  });
}
