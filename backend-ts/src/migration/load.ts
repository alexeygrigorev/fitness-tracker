import assert from 'node:assert/strict';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DocumentItem } from '../repository.js';

export interface MigrationLoadTarget {
  readonly documentClient: DynamoDBDocumentClient;
  readonly tableName: string;
}

export interface MigrationLoadOptions {
  readonly maxRetries?: number;
}

export interface MigrationLoadResult {
  readonly itemCount: number;
  readonly batchCount: number;
  readonly verifiedItemCount: number;
}

export class MigrationLoadError extends Error {}

const BATCH_SIZE = 25;

function itemKey(item: DocumentItem): string {
  if (typeof item.pk !== 'string' || typeof item.sk !== 'string') {
    throw new MigrationLoadError('Every migration item must have string pk and sk keys');
  }
  return `${item.pk}\u0000${item.sk}`;
}

function partition<T>(entries: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    batches.push(entries.slice(index, index + size));
  }
  return batches;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function scanAll(target: MigrationLoadTarget): Promise<DocumentItem[]> {
  const items: DocumentItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await target.documentClient.send(new ScanCommand({
      TableName: target.tableName,
      ConsistentRead: true,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    }));
    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

export async function assertTableEmpty(
  target: MigrationLoadTarget,
): Promise<void> {
  const result = await target.documentClient.send(new ScanCommand({
    TableName: target.tableName,
    ConsistentRead: true,
    Limit: 1,
  }));
  if ((result.Count ?? 0) > 0 || result.Items?.length) {
    throw new MigrationLoadError(
      `Refusing migration: target table ${target.tableName} is not empty`,
    );
  }
}

async function writeBatch(
  target: MigrationLoadTarget,
  batch: readonly DocumentItem[],
  batchNumber: number,
  maxRetries: number,
): Promise<void> {
  const request = {
    RequestItems: {
      [target.tableName]: batch.map((Item) => ({ PutRequest: { Item } })),
    },
  };
  let response = await target.documentClient.send(new BatchWriteCommand(request));
  let pending = response.UnprocessedItems?.[target.tableName] ?? [];
  let attempt = 0;

  while (pending.length > 0) {
    if (attempt >= maxRetries) {
      throw new MigrationLoadError(
        `Migration batch ${batchNumber} still has ${pending.length} unprocessed items after ${maxRetries} retries`,
      );
    }
    attempt += 1;
    await delay(Math.min(25 * 2 ** (attempt - 1), 1_000));
    response = await target.documentClient.send(new BatchWriteCommand({
      RequestItems: {
        [target.tableName]: pending.map((writeRequest) => {
          const Item = writeRequest.PutRequest?.Item;
          if (!Item) {
            throw new MigrationLoadError(
              `DynamoDB returned an invalid PutRequest in migration batch ${batchNumber}`,
            );
          }
          return { PutRequest: { Item } };
        }),
      },
    }));
    pending = response.UnprocessedItems?.[target.tableName] ?? [];
  }
}

export async function loadMigrationItems(
  target: MigrationLoadTarget,
  items: readonly DocumentItem[],
  options: MigrationLoadOptions = {},
): Promise<MigrationLoadResult> {
  if (!Array.isArray(items)) {
    throw new MigrationLoadError('Migration items must be an array');
  }
  for (const item of items) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new MigrationLoadError('Every migration item must be an object');
    }
  }

  const expectedByKey = new Map<string, DocumentItem>();
  for (const item of items as readonly DocumentItem[]) {
    const key = itemKey(item);
    if (expectedByKey.has(key)) {
      throw new MigrationLoadError(
        `Duplicate migration item key ${String(item.pk)} / ${String(item.sk)}`,
      );
    }
    expectedByKey.set(key, item);
  }

  await assertTableEmpty(target);
  const batches = partition(items as readonly DocumentItem[], BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    await writeBatch(target, batch, index + 1, options.maxRetries ?? 8);
  }

  const loadedItems = await scanAll(target);
  if (loadedItems.length !== expectedByKey.size) {
    throw new MigrationLoadError(
      `Post-load verification failed: expected ${expectedByKey.size} items, found ${loadedItems.length}`,
    );
  }
  for (const loadedItem of loadedItems) {
    const expectedItem = expectedByKey.get(itemKey(loadedItem));
    if (!expectedItem) {
      throw new MigrationLoadError(
        `Post-load verification found unexpected key ${String(loadedItem.pk)} / ${String(loadedItem.sk)}`,
      );
    }
    assert.deepStrictEqual(loadedItem, expectedItem);
  }

  return {
    itemCount: items.length,
    batchCount: batches.length,
    verifiedItemCount: loadedItems.length,
  };
}
