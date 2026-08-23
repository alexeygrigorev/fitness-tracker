import type { JsonObject } from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import type { RouteContext, RouteDefinition } from '../router.js';
import { isPresetExercise, isSupersetItem } from '../workout-store.js';
import {
  appendPresetRows,
  copyPresetItems,
  loadPresetPartition,
  materializePreset,
  presetMetadataInput,
  serializePreset,
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
  return serializePreset({
    preset: created.metadata,
    rows: created.rows,
    children: created.children,
  });
}

async function ownedPreset(
  context: RouteContext,
  presetId: number,
) {
  const user = await context.requireUser();
  const loaded = await loadPresetPartition(
    context.repository,
    user.id,
    presetId,
  );
  if (loaded.preset.user_id === null || loaded.preset.user_id === undefined) {
    throw new HttpError(403, { error: 'Cannot modify template presets' });
  }
  if (loaded.preset.user_id !== user.id) {
    throw new HttpError(403, {
      error: 'Cannot modify presets created by another user',
    });
  }
  return { user, loaded };
}

export async function updateOwnedPreset(
  context: RouteContext,
  presetId: number,
): Promise<Record<string, unknown>> {
  const { loaded } = await ownedPreset(context, presetId);
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
    return serializePreset({
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
  return serializePreset({
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
  const source = await loadPresetPartition(
    context.repository,
    user.id,
    normalizedId,
  );
  const accessible = source.preset.user_id === null ||
    source.preset.user_id === undefined ||
    source.preset.user_id === user.id ||
    source.preset.is_public === true;
  if (!accessible) {
    throw new HttpError(403, {
      error: 'Cannot copy private preset from another user',
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
  return serializePreset({
    preset: copied.metadata,
    rows: copied.rows,
    children: copied.children,
  });
}

export function registerPresetRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: 'POST',
    pattern: '/api/workouts/presets',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => jsonResponse(
      201,
      await createOwnedPreset(context),
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
    method: ['PUT', 'PATCH'],
    pattern: '/api/workouts/presets/:presetId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => jsonResponse(
      200,
      await updateOwnedPreset(context, params.presetId as number),
      context.cors,
    ),
  });
}
