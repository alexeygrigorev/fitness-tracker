import type { DocumentItem } from '../repository.js';
import { HttpError } from '../types.js';
import type { JsonObject } from '../types.js';
import { jsonResponse } from '../http.js';
import type { RouteContext, RouteDefinition } from '../router.js';
import {
  copyPresetItems,
  loadPresetPartition,
  serializePreset,
  type MaterializedPreset,
} from '../workout-preset-service.js';
import { nowIso } from '../workout-store.js';

interface PlanPresetItem extends DocumentItem {
  entity_type: 'plan_preset';
  id: number;
  parent_plan_id: number;
  preset_id: number;
  order: number;
}

interface LoadedPlan {
  plan: DocumentItem;
  links: PlanPresetItem[];
}

function requestBody(context: RouteContext): JsonObject {
  const value = context.request.body;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, { error: 'Invalid plan' });
  }
  return value as JsonObject;
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[-+]?\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  return typeof parsed === 'number' &&
    Number.isSafeInteger(parsed) &&
    parsed >= 1
    ? parsed
    : null;
}

async function loadPlan(
  context: RouteContext,
  planId: number,
): Promise<LoadedPlan> {
  const plan = await context.repository.get<DocumentItem>({
    pk: `PLAN#${planId}`,
    sk: 'METADATA',
  });
  if (!plan || plan.entity_type !== 'workout_plan') {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const links = await context.repository.queryPartition<PlanPresetItem>({
    partitionKey: `PLAN#${planId}`,
    sortPrefix: 'PLAN_PRESET#',
  });
  return {
    plan,
    links: links
      .filter((item) => item.entity_type === 'plan_preset')
      .sort((left, right) => left.order - right.order || left.id - right.id),
  };
}

async function loadAccessibleSource(
  context: RouteContext,
  userId: number,
  presetId: number,
): Promise<Parameters<typeof copyPresetItems>[1]> {
  let source;
  try {
    source = await loadPresetPartition(context.repository, userId, presetId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      throw new HttpError(403, {
        error: 'Plan contains a preset with an unavailable exercise',
      });
    }
    throw error;
  }
  const accessible = source.preset.user_id === null ||
    source.preset.user_id === undefined ||
    source.preset.user_id === userId ||
    source.preset.is_public === true;
  if (!accessible) {
    throw new HttpError(403, {
      error: 'Plan contains a preset with an unavailable exercise',
    });
  }
  return source;
}

export async function createOwnedPlan(context: RouteContext): Promise<Record<string, unknown>> {
  const user = await context.requireUser();
  const input = requestBody(context);
  const nameValue = input.name;
  if (typeof nameValue !== 'string' || !nameValue.trim()) {
    throw new HttpError(400, { error: 'name is required' });
  }
  let description = input.description ?? '';
  if (description === null) description = '';
  if (typeof description !== 'string') {
    throw new HttpError(400, { error: 'Invalid description' });
  }

  const rawIds = input.preset_ids ?? [];
  if (!Array.isArray(rawIds)) {
    throw new HttpError(400, { error: 'preset_ids must be a list' });
  }
  const seen = new Set<number>();
  const presetIds: number[] = [];
  for (const rawId of rawIds) {
    if (typeof rawId === 'boolean') {
      throw new HttpError(400, { error: 'One or more presets are unavailable' });
    }
    const normalizedId = normalizePositiveInteger(rawId);
    if (normalizedId === null || seen.has(normalizedId)) {
      throw new HttpError(400, { error: 'One or more presets are unavailable' });
    }
    seen.add(normalizedId);
    presetIds.push(normalizedId);
  }

  const timestamp = nowIso();
  const planId = await context.repository.nextId('workout_plan');
  const items: DocumentItem[] = [{
    pk: `PLAN#${planId}`,
    sk: 'METADATA',
    entity_type: 'workout_plan',
    id: planId,
    user_id: user.id,
    name: nameValue.trim(),
    description,
    created_at: timestamp,
    updated_at: timestamp,
  }];

  for (const [index, presetId] of presetIds.entries()) {
    try {
      await loadAccessibleSource(context, user.id, presetId);
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        throw new HttpError(400, { error: 'One or more presets are unavailable' });
      }
      if (error instanceof HttpError && error.status === 404) {
        throw new HttpError(400, { error: 'One or more presets are unavailable' });
      }
      throw error;
    }
    const linkId = await context.repository.nextId('plan_preset');
    items.push({
      pk: `PLAN#${planId}`,
      sk: `PLAN_PRESET#${linkId}`,
      entity_type: 'plan_preset',
      id: linkId,
      parent_plan_id: planId,
      preset_id: presetId,
      order: index,
    });
  }

  await context.repository.putNewItemsTransactionally(items);
  return items[0];
}

export async function useOwnedPlan(
  context: RouteContext,
  planId: number,
): Promise<Record<string, unknown>> {
  const user = await context.requireUser();
  const plan = await loadPlan(context, planId);
  if (plan.plan.user_id !== user.id) {
    throw new HttpError(403, {
      error: 'Cannot use a plan created by another user',
    });
  }

  const sources = [];
  for (const link of plan.links) {
    sources.push(await loadAccessibleSource(context, user.id, link.preset_id));
  }

  const copies: MaterializedPreset[] = [];
  for (const source of sources) {
    copies.push(await copyPresetItems(context.repository, source, user.id));
  }
  await context.repository.putNewItemsTransactionally(copies.flatMap((copy) => [
    copy.metadata,
    ...copy.rows,
    ...copy.children,
  ]));

  return {
    message: `Copied ${copies.length} presets from plan '${String(plan.plan.name)}'`,
    presets: copies.map((copy) => serializePreset({
      preset: copy.metadata,
      rows: copy.rows,
      children: copy.children,
    })),
  };
}

function planModel(plan: DocumentItem): Record<string, unknown> {
  return {
    id: plan.id,
    user_id: plan.user_id,
    name: plan.name,
    description: plan.description ?? null,
    created_at: plan.created_at ?? null,
    updated_at: plan.updated_at ?? null,
  };
}

export function registerPlanRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/workouts/plans',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      if (context.request.method === 'GET') {
        const plans = await context.repository.queryPartition<DocumentItem>({
          partitionKey: `USER#${user.id}`,
          sortPrefix: 'PLAN#',
        });
        return jsonResponse(
          200,
          plans.filter((item) => item.entity_type === 'workout_plan').map(planModel),
          context.cors,
        );
      }
      return jsonResponse(201, planModel(await createOwnedPlan(context)), context.cors);
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/workouts/plans/:planId/use_plan',
    authRequired: true,
    authBeforeMethod: true,
    handle: async () => {
      throw new HttpError(405, { detail: 'Method "GET" not allowed.' });
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/workouts/plans/:planId/use_plan',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => jsonResponse(
      201,
      await useOwnedPlan(context, params.planId as number),
      context.cors,
    ),
  });

  addRoute({
    method: ['PUT', 'PATCH'],
    pattern: '/api/workouts/plans/:planId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const user = await context.requireUser();
      const plan = await loadPlan(context, params.planId as number);
      if (plan.plan.user_id !== user.id) {
        throw new HttpError(403, {
          error: 'Cannot modify plans created by another user',
        });
      }
      const input = requestBody(context);
      const name = 'name' in input ? input.name : plan.plan.name;
      const description = 'description' in input
        ? (input.description ?? '')
        : plan.plan.description ?? '';
      if (typeof name !== 'string' || !name.trim() || typeof description !== 'string') {
        throw new HttpError(400, { error: 'Invalid plan' });
      }
      const updated: DocumentItem = {
        ...plan.plan,
        name,
        description,
        updated_at: nowIso(),
      };
      await context.repository.put(updated, {
        ConditionExpression: 'attribute_exists(pk)',
      });
      return jsonResponse(200, planModel(updated), context.cors);
    },
  });

  addRoute({
    method: 'DELETE',
    pattern: '/api/workouts/plans/:planId',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const user = await context.requireUser();
      const plan = await loadPlan(context, params.planId as number);
      if (plan.plan.user_id !== user.id) {
        throw new HttpError(403, {
          error: 'Cannot delete plans created by another user',
        });
      }
      await context.repository.deleteAllTransactionally([
        { pk: plan.plan.pk, sk: plan.plan.sk },
        ...plan.links.map((link) => ({ pk: link.pk, sk: link.sk })),
      ]);
      return jsonResponse(204, {}, context.cors);
    },
  });
}
