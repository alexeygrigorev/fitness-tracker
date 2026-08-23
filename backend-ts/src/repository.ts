import {
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  DeleteCommand as DocDeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand as DocQueryCommand,
  TransactWriteCommand as DocTransactWriteCommand,
  UpdateCommand as DocUpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  DeleteCommandInput,
  PutCommandInput,
  QueryCommandInput,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {
  AccessIndexRecord,
  ExerciseItem,
  ExerciseSettingsItem,
  FoodItemRecord,
  MealRecord,
  MealTemplateRecord,
  UserItem,
} from './types.js';
import { HttpError } from './types.js';

export type DocumentItem = Record<string, unknown>;
export type TransactionOperations = NonNullable<
  TransactWriteCommandInput['TransactItems']
>;

export interface ExerciseSettingsInput {
  weight?: number | null;
  reps: number;
  subSets?: Array<{ weight?: number | null; reps: number }>;
}

export class FitnessRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(
    readonly tableName: string,
    endpoint?: string,
  ) {
    const raw = new DynamoDBClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      ...(endpoint
        ? {
            endpoint,
            credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
          }
        : {}),
    });
    this.client = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async tableExists(): Promise<boolean> {
    try {
      await this.client.send(new DescribeTableCommand({ TableName: this.tableName }));
      return true;
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'ResourceNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  async nextId(entity: string): Promise<number> {
    const result = await this.client.send(
      new DocUpdateCommand({
        TableName: this.tableName,
        Key: { pk: `COUNTER#${entity}`, sk: 'NEXT_ID' },
        UpdateExpression: 'ADD nextId :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    const value = result.Attributes?.nextId;
    if (typeof value !== 'number') {
      throw new Error(`ID counter ${entity} returned no value`);
    }
    return value;
  }

  private async findUser(index: 'UsernameIndex' | 'EmailIndex', value: string) {
    const attributeName = index === 'UsernameIndex' ? 'username' : 'email';
    const result = await this.client.send(
      new DocQueryCommand({
        TableName: this.tableName,
        IndexName: index,
        KeyConditionExpression: '#value = :value',
        ExpressionAttributeNames: { '#value': attributeName },
        ExpressionAttributeValues: { ':value': value },
        ProjectionExpression: 'pk',
      }),
    );
    const key = result.Items?.[0]?.pk;
    return typeof key === 'string' ? this.getUserByKey(key) : undefined;
  }

  getUserByUsername(username: string): Promise<UserItem | undefined> {
    return this.findUser('UsernameIndex', username);
  }

  getUserByEmail(email: string): Promise<UserItem | undefined> {
    return this.findUser('EmailIndex', email);
  }

  getUserByKey(key: string): Promise<UserItem | undefined> {
    return this.getItem<UserItem>({ pk: key, sk: 'PROFILE' });
  }

  async createUser(user: UserItem): Promise<void> {
    const usernameKey = `USERNAME#${user.username}`;
    const emailKey = `EMAIL#${user.email}`;
    try {
      await this.client.send(
        new DocTransactWriteCommand({
          TransactItems: [
            {
                Put: {
                  TableName: this.tableName,
                  Item: { pk: usernameKey, sk: 'RESERVATION', id: user.id },
                  ConditionExpression: 'attribute_not_exists(pk)',
                },
            },
            {
                Put: {
                  TableName: this.tableName,
                  Item: { pk: emailKey, sk: 'RESERVATION', id: user.id },
                  ConditionExpression: 'attribute_not_exists(pk)',
                },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: user,
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
          ],
        }),
      );
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'TransactionCanceledException') {
        throw new HttpError(400, { error: 'Account already exists' });
      }
      throw error;
    }
  }

  async updateUserDarkMode(user: UserItem, darkMode: boolean): Promise<UserItem> {
    await this.client.send(
      new DocUpdateCommand({
        TableName: this.tableName,
        Key: { pk: user.pk, sk: user.sk },
        UpdateExpression: 'SET dark_mode = :darkMode',
        ExpressionAttributeValues: { ':darkMode': darkMode },
        ConditionExpression: 'attribute_exists(pk)',
      }),
    );
    return { ...user, dark_mode: darkMode };
  }

  getExercise(id: number): Promise<ExerciseItem | undefined> {
    return this.getItem<ExerciseItem>({ pk: `EXERCISE#${id}`, sk: 'METADATA' });
  }

  async putExercise(exercise: ExerciseItem): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: exercise }));
  }

  getFood(id: number): Promise<FoodItemRecord | undefined> {
    return this.getItem<FoodItemRecord>({ pk: `FOOD#${id}`, sk: 'METADATA' });
  }

  async listFoods(userId?: number): Promise<FoodItemRecord[]> {
    const partitions = userId === undefined
      ? ['CANONICAL#FOOD']
      : [`USER#${userId}`, 'CANONICAL#FOOD'];
    const indexes = await Promise.all(partitions.map((partition) =>
      this.queryPartition<AccessIndexRecord>({
        partitionKey: partition,
        sortPrefix: 'FOOD#',
      })
    ));

    const ids = [...new Set(indexes.flat().map((index) => index.id))]
      .sort((left, right) => left - right);
    const foods = await this.batchGet<FoodItemRecord>(ids.map((id) => ({
      pk: `FOOD#${id}`,
      sk: 'METADATA',
    })));
    return foods.filter((food) => (
      food.source === 'canonical' ||
      (userId !== undefined && food.user_id === userId)
    )).sort((left, right) => left.id - right.id);
  }

  async saveFood(food: FoodItemRecord): Promise<void> {
    const indexKey = food.user_id === null
      ? { pk: 'CANONICAL#FOOD', sk: `FOOD#${food.id}` }
      : { pk: `USER#${food.user_id}`, sk: `FOOD#${food.id}` };
    await this.transact([
      {
        Put: {
          TableName: this.tableName,
          Item: food,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: { ...indexKey, id: food.id },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
    ]);
  }

  async replaceFood(food: FoodItemRecord): Promise<void> {
    await this.put(food as DocumentItem);
  }

  async deleteFood(food: FoodItemRecord): Promise<void> {
    const indexKey = food.user_id === null
      ? { pk: 'CANONICAL#FOOD', sk: `FOOD#${food.id}` }
      : { pk: `USER#${food.user_id}`, sk: `FOOD#${food.id}` };
    await this.transact([
      { Delete: { TableName: this.tableName, Key: { pk: food.pk, sk: food.sk } } },
      { Delete: { TableName: this.tableName, Key: indexKey } },
    ]);
  }

  async getMeal(id: number): Promise<MealRecord | undefined> {
    return this.getItem<MealRecord>({ pk: `MEAL#${id}`, sk: 'METADATA' });
  }

  async listMeals(userId: number): Promise<MealRecord[]> {
    return this.listOwnedRecords<MealRecord>(`USER#${userId}`, 'MEAL#', 'MEAL#');
  }

  async saveNewMeal(meal: MealRecord): Promise<void> {
    await this.saveOwnedRecord(meal, `MEAL#${meal.id}`, `USER#${meal.user_id}`);
  }

  async replaceMeal(meal: MealRecord): Promise<void> {
    await this.put(meal);
  }

  async deleteMeal(id: number): Promise<void> {
    await this.deleteOwnedRecord(`MEAL#${id}`);
  }

  async getMealTemplate(id: number): Promise<MealTemplateRecord | undefined> {
    return this.getItem<MealTemplateRecord>({
      pk: `TEMPLATE#${id}`,
      sk: 'METADATA',
    });
  }

  async listMealTemplates(userId: number): Promise<MealTemplateRecord[]> {
    return this.listOwnedRecords<MealTemplateRecord>(
      `USER#${userId}`,
      'TEMPLATE#',
      'TEMPLATE#',
    );
  }

  async saveNewMealTemplate(template: MealTemplateRecord): Promise<void> {
    await this.saveOwnedRecord(
      template,
      `TEMPLATE#${template.id}`,
      `USER#${template.user_id}`,
    );
  }

  async replaceMealTemplate(template: MealTemplateRecord): Promise<void> {
    await this.put(template);
  }

  async deleteMealTemplate(id: number): Promise<void> {
    await this.deleteOwnedRecord(`TEMPLATE#${id}`);
  }

  private async listOwnedRecords<T extends { id: number }>(
    ownerPartition: string,
    indexSortPrefix: string,
    metadataPrefix: string,
  ): Promise<T[]> {
    const indexes = await this.queryPartition<AccessIndexRecord>({
      partitionKey: ownerPartition,
      sortPrefix: indexSortPrefix,
    });
    const records = await this.batchGet<T>(indexes.map((index) => ({
      pk: `${metadataPrefix.toUpperCase()}#${index.id}`,
      sk: 'METADATA',
    })));
    return records.sort((left, right) => left.id - right.id);
  }

  private async saveOwnedRecord(
    record: DocumentItem,
    metadataPk: string,
    ownerPartition: string,
  ): Promise<void> {
    const sortKey = metadataPk.split('#').slice(1).join('#');
    await this.transact([
      {
        Put: {
          TableName: this.tableName,
          Item: record,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: { pk: ownerPartition, sk: sortKey, id: record.id },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
    ]);
  }

  private async deleteOwnedRecord(metadataPk: string): Promise<void> {
    const metadata = await this.get<DocumentItem & { user_id?: number }>({
      pk: metadataPk,
      sk: 'METADATA',
    });
    const userId = metadata?.user_id;
    if (!metadata || typeof userId !== 'number') {
      return;
    }
    await this.transact([
      { Delete: { TableName: this.tableName, Key: { pk: metadataPk, sk: 'METADATA' } } },
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            pk: `USER#${userId}`,
            sk: metadataPk.split('#')[1] ?? '',
          },
        },
      },
    ]);
  }

  async listExerciseSettings(userId: number): Promise<Record<string, object>> {
    const result = await this.client.send(
      new DocQueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :user AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':user': `USER#${userId}`,
          ':prefix': 'EXERCISE_SETTING#',
        },
      }),
    );
    const output: Record<string, object> = {};
    for (const item of (result.Items ?? []) as ExerciseSettingsItem[]) {
      output[String(item.exercise_id)] = settingsResponse(item);
    }
    return output;
  }

  async getExerciseSetting(userId: number, exerciseId: number) {
    return this.getItem<ExerciseSettingsItem>({
      pk: `USER#${userId}`,
      sk: `EXERCISE_SETTING#${exerciseId}`,
    });
  }

  async saveExerciseSetting(item: ExerciseSettingsItem): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  private async getItem<T>(key: Record<string, unknown>): Promise<T | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: key }),
    );
    return result.Item as T | undefined;
  }

  get<T = DocumentItem>(key: Record<string, unknown>): Promise<T | undefined> {
    return this.getItem<T>(key);
  }

  async put<T extends DocumentItem>(
    item: T,
    options: Omit<PutCommandInput, 'Item' | 'TableName'> = {},
  ): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ...options,
    }));
  }

  async delete(
    key: Record<string, unknown>,
    options: Omit<DeleteCommandInput, 'Key' | 'TableName'> = {},
  ): Promise<void> {
    await this.client.send(new DocDeleteCommand({
      TableName: this.tableName,
      Key: key,
      ...options,
    }));
  }

  async query<T = DocumentItem>(
    options: Omit<QueryCommandInput, 'TableName'>,
  ): Promise<T[]> {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(new DocQueryCommand({
        TableName: this.tableName,
        ...options,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }));
      items.push(...((result.Items ?? []) as T[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  async queryPartition<T = DocumentItem>(input: {
    partitionKey: string;
    sortPrefix?: string;
    scanIndexForward?: boolean;
  }): Promise<T[]> {
    const values: Record<string, unknown> = { ':pk': input.partitionKey };
    let expression = 'pk = :pk';
    if (input.sortPrefix !== undefined) {
      expression += ' AND begins_with(sk, :prefix)';
      values[':prefix'] = input.sortPrefix;
    }

    return this.query<T>({
      KeyConditionExpression: expression,
      ExpressionAttributeValues: values,
      ScanIndexForward: input.scanIndexForward ?? true,
    });
  }

  async update<T = DocumentItem>(input: {
    key: Record<string, unknown>;
    updateExpression: string;
    conditionExpression?: string;
    values?: Record<string, unknown>;
    names?: Record<string, string>;
    returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
  }): Promise<T | undefined> {
    const result = await this.client.send(new DocUpdateCommand({
      TableName: this.tableName,
      Key: input.key,
      UpdateExpression: input.updateExpression,
      ...(input.conditionExpression ? { ConditionExpression: input.conditionExpression } : {}),
      ...(input.values ? { ExpressionAttributeValues: input.values } : {}),
      ...(input.names ? { ExpressionAttributeNames: input.names } : {}),
      ReturnValues: input.returnValues ?? 'NONE',
    }));
    return result.Attributes as T | undefined;
  }

  async transact(operations: TransactionOperations): Promise<void> {
    await this.client.send(new DocTransactWriteCommand({
      TransactItems: operations,
    }));
  }

  async batchGet<T = DocumentItem>(
    keys: ReadonlyArray<Record<string, unknown>>,
  ): Promise<T[]> {
    const items: T[] = [];
    const pending = [...keys];

    while (pending.length > 0) {
      const batch = pending.splice(0, 100);
      let requestKeys = batch;

      while (requestKeys.length > 0) {
        const result = await this.client.send(new BatchGetCommand({
          RequestItems: { [this.tableName]: { Keys: requestKeys } },
        }));
        items.push(...((result.Responses?.[this.tableName] ?? []) as T[]));

        const unprocessed = result.UnprocessedKeys?.[this.tableName]?.Keys ?? [];
        requestKeys = unprocessed as Array<Record<string, unknown>>;
      }
    }

    return items;
  }
}

export function settingsResponse(item: ExerciseSettingsItem): Record<string, unknown> {
  const response: Record<string, unknown> = { reps: item.reps };
  if (item.weight !== undefined && item.weight !== null) {
    response.weight = item.weight;
  }
  if (item.sub_sets?.length) {
    response.subSets = structuredClone(item.sub_sets);
  }
  return response;
}

export function mergeExerciseSetting(
  existing: ExerciseSettingsItem | undefined,
  userId: number,
  exerciseId: number,
  input: ExerciseSettingsInput,
): ExerciseSettingsItem {
  if (!existing) {
    return {
      pk: `USER#${userId}`,
      sk: `EXERCISE_SETTING#${exerciseId}`,
      exercise_id: exerciseId,
      reps: input.reps,
      sub_sets: input.subSets ?? [],
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
    };
  }
  return {
    ...existing,
    reps: input.reps,
    sub_sets: input.subSets ?? existing.sub_sets ?? [],
    ...(input.weight !== undefined && input.weight !== null
      ? { weight: input.weight }
      : {}),
  };
}
