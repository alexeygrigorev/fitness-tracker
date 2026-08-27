import {
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchGetCommand as DocBatchGetCommand,
  DeleteCommand as DocDeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand as DocQueryCommand,
  ScanCommand as DocScanCommand,
  TransactWriteCommand as DocTransactWriteCommand,
  UpdateCommand as DocUpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  DeleteCommandInput,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {
  FoodItemRecord,
  ExerciseItem,
  ExerciseSettingsItem,
  MealRecord,
  MealTemplateRecord,
  NestedFoodItemRecord,
  UserItem,
} from './types.js';
import { HttpError } from './types.js';

export type DocumentItem = Record<string, unknown>;
export type TransactionOperations = NonNullable<
  TransactWriteCommandInput['TransactItems']
>;

type NutritionParentRecord = MealRecord | MealTemplateRecord;

interface EquipmentTaxonomyItem {
  pk: string;
  sk: string;
  entity_type: 'equipment';
  id: number;
  name: string;
}

const DYNAMODB_TRANSACTION_LIMIT = 100;

export interface ExerciseSettingsInput {
  weight?: number | null;
  reps: number;
  subSets?: Array<{ weight?: number | null; reps: number }>;
}

export class FitnessRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
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
    } catch {
      // Any startup/connectivity failure means the API is not ready yet.
      return false;
    }
  }

  async batchGet<T = DocumentItem>(
    keys: ReadonlyArray<Record<string, unknown>>,
  ): Promise<T[]> {
    const items: T[] = [];
    let pendingKeys = [...keys];
    for (let attempt = 0; pendingKeys.length > 0 && attempt < 10; attempt += 1) {
      const batches = Array.from(
        { length: Math.ceil(pendingKeys.length / 100) },
        (_, index) => pendingKeys.slice(index * 100, (index + 1) * 100),
      );
      pendingKeys = [];
      const results = await Promise.all(batches.map((batchKeys) =>
        this.client.send(new DocBatchGetCommand({
          RequestItems: { [this.tableName]: { Keys: batchKeys } },
        }))
      ));

      for (const result of results) {
        items.push(...((result.Responses?.[this.tableName] ?? []) as T[]));
        const unprocessed = result.UnprocessedKeys?.[this.tableName]?.Keys ?? [];
        pendingKeys.push(...(unprocessed as Array<Record<string, unknown>>));
      }

      if (pendingKeys.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(25 * (attempt + 1), 100)));
      }
    }

    if (pendingKeys.length > 0) {
      throw new Error('DynamoDB batch read left unprocessed keys');
    }
    return items;
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
    // Reservation placeholder rows are keyed by the same attribute values as
    // the profile row so uniqueness can be enforced without an extra read.
    // Prefer the real `USER#<id>` profile item over any reservation rows the
    // GSI query may also match.
    const keys = (result.Items ?? [])
      .map((item) => item.pk)
      .filter((pk): pk is string => typeof pk === 'string');
    const key = keys.find((pk) => pk.startsWith('USER#')) ?? keys[0];
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

  /**
   * Migrated exercises flatten the Django equipment foreign key, but migrated
   * taxonomy rows remain authoritative for deterministic case-insensitive reuse.
   */
  async resolveEquipmentName(rawName: string): Promise<string> {
    const name = rawName.trim();
    if (!name) return '';

    const equipmentItems = await this.queryPartition<EquipmentTaxonomyItem>({
      partitionKey: 'TAXONOMY#EQUIPMENT',
      sortPrefix: 'ID#',
      consistentRead: true,
    });
    const normalized = name.toLowerCase();
    const existing = equipmentItems
      .filter((item) => item.entity_type === 'equipment' && typeof item.name === 'string')
      .sort((left, right) => left.id - right.id)
      .find((item) => item.name.toLowerCase() === normalized);
    if (existing) return existing.name;

    const id = await this.nextId('equipment');
    const item: EquipmentTaxonomyItem = {
      pk: 'TAXONOMY#EQUIPMENT',
      sk: `ID#${id}`,
      entity_type: 'equipment',
      id,
      name,
    };
    await this.put(item, {
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    });
    return item.name;
  }

  async putExercise(exercise: ExerciseItem): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: exercise }));
  }

  async getFood(id: number, userId?: number): Promise<FoodItemRecord | undefined> {
    const keys = [{ pk: 'CANONICAL_FOODS', sk: `FOOD#${id}` }];
    if (userId !== undefined) {
      keys.push({ pk: `USER#${userId}`, sk: `FOOD#${id}` });
    }
    const foods = await this.batchGet<FoodItemRecord>(keys);
    return foods.find((food) => food.user_id === null || food.user_id === userId);
  }

  async listFoods(userId?: number): Promise<FoodItemRecord[]> {
    const foods = await Promise.all([
      this.queryPartition<FoodItemRecord>({
        partitionKey: 'CANONICAL_FOODS',
        sortPrefix: 'FOOD#',
      }),
      ...(userId === undefined ? [] : [
        this.queryPartition<FoodItemRecord>({
          partitionKey: `USER#${userId}`,
          sortPrefix: 'FOOD#',
        }),
      ]),
    ]);

    const foodsById = new Map<number, FoodItemRecord>();
    for (const food of foods.flat()) {
      if (
        typeof food.id !== 'number' ||
        !(food.source === 'canonical' || food.user_id === userId)
      ) {
        continue;
      }
      foodsById.set(food.id, food);
    }
    return [...foodsById.values()].sort((left, right) => left.id - right.id);
  }

  async saveFood(food: FoodItemRecord): Promise<void> {
    await this.put(food, {
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    });
  }

  async replaceFood(food: FoodItemRecord): Promise<void> {
    await this.put(food, {
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
    });
  }

  async deleteFood(food: FoodItemRecord): Promise<void> {
    await this.deleteFoodAndReferences(food);
  }

  async getMeal(id: number, userId: number): Promise<MealRecord | undefined> {
    const meal = await this.getItem<MealRecord>({
      pk: `USER#${userId}`,
      sk: `MEAL#${id}`,
    });
    return meal?.user_id === userId ? meal : undefined;
  }

  async listMeals(userId: number): Promise<MealRecord[]> {
    const meals = await this.queryPartition<MealRecord>({
      partitionKey: `USER#${userId}`,
      sortPrefix: 'MEAL#',
    });
    return meals.filter((meal) => (
      meal.entity_type === 'meal' && meal.user_id === userId
    ))
      .sort((left, right) => left.id - right.id);
  }

  async getMealTemplate(
    id: number,
    userId: number,
  ): Promise<MealTemplateRecord | undefined> {
    const template = await this.getItem<MealTemplateRecord>({
      pk: `USER#${userId}`,
      sk: `MEAL_TEMPLATE#${id}`,
    });
    return template?.user_id === userId ? template : undefined;
  }

  async listMealTemplates(userId: number): Promise<MealTemplateRecord[]> {
    const templates = await this.queryPartition<MealTemplateRecord>({
        partitionKey: `USER#${userId}`,
        sortPrefix: 'MEAL_TEMPLATE#',
    });
    return templates.filter((template) => (
      template.entity_type === 'meal_template' && template.user_id === userId
    ))
      .sort((left, right) => left.id - right.id);
  }

  async accessibleFoods(
    ids: Iterable<number>,
    userId?: number,
  ): Promise<Map<number, FoodItemRecord>> {
    const uniqueIds = [...new Set(ids)].sort((left, right) => left - right);
    if (uniqueIds.length === 0) return new Map();
    const keys = uniqueIds.flatMap((id) => {
      const candidates = [
        { pk: 'CANONICAL_FOODS', sk: `FOOD#${id}` },
      ];
      if (userId !== undefined) {
        candidates.push({ pk: `USER#${userId}`, sk: `FOOD#${id}` });
      }
      return candidates;
    });
    const foods = await this.batchGet<FoodItemRecord>(keys);
    const result = new Map<number, FoodItemRecord>();
    for (const food of foods) {
      if ((food.user_id === null || food.user_id === userId) && !result.has(food.id)) {
        result.set(food.id, food);
      }
    }
    return result;
  }

  async getNutritionItems(
    kind: 'meal' | 'template',
    parentId: number,
    itemIds: ReadonlyArray<number>,
  ): Promise<NestedFoodItemRecord[]> {
    if (itemIds.length === 0) return [];
    const prefix = kind === 'meal' ? 'MEAL#' : 'MEAL_TEMPLATE#';
    const sortPrefix = kind === 'meal' ? 'MEAL_FOOD_ITEM#' : 'TEMPLATE_FOOD_ITEM#';
    const parentField = kind === 'meal' ? 'meal_id' : 'template_id';
    const keys = [...new Set(itemIds)].map((itemId) => ({
      pk: `${prefix}${parentId}`,
      sk: `${sortPrefix}${itemId}`,
    }));
    const items = await this.batchGet<NestedFoodItemRecord>(keys);
    return items
      .filter((item) => item[parentField] === parentId)
      .sort((left, right) => left.order - right.order || left.id - right.id);
  }

  async getNutritionItemsForParents(
    kind: 'meal' | 'template',
    parents: ReadonlyArray<{ id: number; food_item_ids: ReadonlyArray<number> }>,
  ): Promise<Map<number, NestedFoodItemRecord[]>> {
    const result = new Map<number, NestedFoodItemRecord[]>(
      parents.map(({ id }) => [id, []]),
    );
    const prefix = kind === 'meal' ? 'MEAL#' : 'MEAL_TEMPLATE#';
    const sortPrefix = kind === 'meal' ? 'MEAL_FOOD_ITEM#' : 'TEMPLATE_FOOD_ITEM#';
    const parentField = kind === 'meal' ? 'meal_id' : 'template_id';
    const keysByParent = new Map<string, number>();
    for (const parent of parents) {
      for (const itemId of new Set(parent.food_item_ids)) {
        keysByParent.set(`${prefix}${parent.id}|${sortPrefix}${itemId}`, parent.id);
      }
    }
    if (keysByParent.size === 0) return result;
    const keys = [...keysByParent.keys()].map((key) => {
      const [pk, sk] = key.split('|');
      return { pk, sk };
    });
    const items = await this.batchGet<NestedFoodItemRecord>(keys);
    for (const item of items) {
      const parentId = item[parentField];
      const expectedParentId = keysByParent.get(`${item.pk}|${item.sk}`);
      if (typeof parentId !== 'number' || parentId !== expectedParentId) continue;
      result.get(parentId)?.push(item);
    }
    for (const parentItems of result.values()) {
      parentItems.sort((left, right) => left.order - right.order || left.id - right.id);
    }
    return result;
  }

  async saveMealWithItems(
    meal: MealRecord,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    await this.createNutritionRecordWithItems(meal, items);
  }

  async replaceMealWithItems(
    meal: MealRecord,
    previousItemIds: ReadonlyArray<number>,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    await this.replaceNutritionItems(
      'meal',
      meal,
      previousItemIds,
      items,
    );
  }

  async deleteMealWithItems(meal: MealRecord): Promise<void> {
    await this.deleteNutritionItemsAndParent(
      'meal',
      meal,
      meal.food_item_ids,
    );
  }

  async saveMealTemplateWithItems(
    template: MealTemplateRecord,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    await this.createNutritionRecordWithItems(template, items);
  }

  async replaceMealTemplateWithItems(
    template: MealTemplateRecord,
    previousItemIds: ReadonlyArray<number>,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    await this.replaceNutritionItems(
      'template',
      template,
      previousItemIds,
      items,
    );
  }

  async deleteMealTemplateWithItems(template: MealTemplateRecord): Promise<void> {
    await this.deleteNutritionItemsAndParent(
      'template',
      template,
      template.food_item_ids,
    );
  }

  private async deleteNutritionItemsAndParent(
    kind: 'meal' | 'template',
    parent: MealRecord | MealTemplateRecord,
    itemIds: ReadonlyArray<number>,
  ): Promise<void> {
    const itemOperations = this.nutritionItemDeleteOperations(
      kind,
      parent.id,
      itemIds,
    );
    const parentOperation: TransactionOperations[number] = {
      Delete: {
        TableName: this.tableName,
        Key: { pk: parent.pk, sk: parent.sk },
      },
    };

    if (itemOperations.length + 1 <= DYNAMODB_TRANSACTION_LIMIT) {
      await this.transact([...itemOperations, parentOperation]);
      return;
    }

    // The parent is the visible pointer. Removing it first makes the whole
    // meal disappear atomically; child cleanup failures cannot expose a
    // partially deleted collection through owner-scoped parent queries.
    await this.transact([parentOperation]);
    // Once the visible parent is gone the API operation is complete. Child
    // cleanup is best-effort so a transient chunk failure cannot turn a
    // successful delete into a false error while leaving unreachable rows.
    await this.writeBoundedTransactionsQuietly(itemOperations);
  }

  private async deleteFoodAndReferences(food: FoodItemRecord): Promise<void> {
    const nutritionRecords = await this.scan<DocumentItem>({
      FilterExpression:
        'entity_type IN (:meal, :template, :mealFoodItem, :templateFoodItem)',
      ExpressionAttributeValues: {
        ':meal': 'meal',
        ':template': 'meal_template',
        ':mealFoodItem': 'meal_food_item',
        ':templateFoodItem': 'meal_template_food_item',
      },
    });

    const parents = new Map<string, NutritionParentRecord>();
    const targetIngredientsByParent = new Map<string, NestedFoodItemRecord[]>();
    const orphanTargetIngredients = new Map<string, NestedFoodItemRecord>();
    for (const record of nutritionRecords) {
      const entityType = record.entity_type;
      const parentId = record.id;
      if (entityType === 'meal' || entityType === 'meal_template') {
        if (
          typeof parentId === 'number' &&
          typeof record.pk === 'string' &&
          typeof record.sk === 'string' &&
          Array.isArray(record.food_item_ids)
        ) {
          const parentKey = `${entityType}:${parentId}`;
          parents.set(
            parentKey,
            record as unknown as NutritionParentRecord,
          );
        }
        continue;
      }
      if (
        entityType !== 'meal_food_item' &&
        entityType !== 'meal_template_food_item'
      ) {
        continue;
      }
      if (
        typeof parentId !== 'number' ||
        record.food_id !== food.id ||
        typeof record.pk !== 'string' ||
        typeof record.sk !== 'string'
      ) {
        continue;
      }
      const linkedId = entityType === 'meal_food_item'
        ? record.meal_id
        : record.template_id;
      if (typeof linkedId !== 'number') {
        continue;
      }
      const parentKey = `${
        entityType === 'meal_food_item' ? 'meal' : 'meal_template'
      }:${linkedId}`;
      orphanTargetIngredients.set(
        `${record.pk}|${record.sk}`,
        record as unknown as NestedFoodItemRecord,
      );
      const targetIngredients = targetIngredientsByParent.get(parentKey) ?? [];
      targetIngredients.push(record as unknown as NestedFoodItemRecord);
      targetIngredientsByParent.set(parentKey, targetIngredients);
    }

    for (const [parentKey, ingredients] of targetIngredientsByParent) {
      if (!parents.has(parentKey)) continue;
      for (const ingredient of ingredients) {
        orphanTargetIngredients.delete(`${ingredient.pk}|${ingredient.sk}`);
      }
    }

    const orphanOperations = [...orphanTargetIngredients.values()].map((item) => ({
      Delete: {
        TableName: this.tableName,
        Key: { pk: item.pk, sk: item.sk },
      },
    }));
    const cleanupGroups = [...parents.entries()]
      .flatMap(([parentKey, parent]) => {
        const removedTargetIds = new Set(
          (targetIngredientsByParent.get(parentKey) ?? []).map(({ id }) => id),
        );
        const retainedItemIds = parent.food_item_ids.filter((itemId) =>
          !removedTargetIds.has(itemId),
        );
        return {
          parent: {
            ...parent,
            food_item_ids: retainedItemIds,
          },
          childOperations: this.nutritionItemDeleteOperations(
            parent.entity_type === 'meal' ? 'meal' : 'template',
            parent.id,
            (targetIngredientsByParent.get(parentKey) ?? []).map(({ id }) => id),
          ),
          expectedItemIds: [...parent.food_item_ids],
        };
      })
      .filter((group) =>
        group.childOperations.length > 0 ||
        group.expectedItemIds.length !== group.parent.food_item_ids.length
      );

    const deleteFoodOperation: TransactionOperations[number] = {
      Delete: {
        TableName: this.tableName,
        Key: { pk: food.pk, sk: food.sk },
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      },
    };
    const cleanupOperations = cleanupGroups.flatMap((group) => [
      this.nutritionParentPointerOperation(group.parent, group.expectedItemIds),
      ...group.childOperations,
    ]);

    if (
      cleanupOperations.length + orphanOperations.length + 1 <=
      DYNAMODB_TRANSACTION_LIMIT
    ) {
      await this.transact([
        ...orphanOperations,
        ...cleanupOperations,
        deleteFoodOperation,
      ]);
      return;
    }

    // Repoint before deleting an oversized collection. The conditional parent
    // write rejects an intervening writer before any of its children disappear.
    await this.writeBoundedTransactions(orphanOperations);
    for (const group of cleanupGroups) {
      const parentOperation = this.nutritionParentPointerOperation(
        group.parent,
        group.expectedItemIds,
      );
      if (group.childOperations.length + 1 <= DYNAMODB_TRANSACTION_LIMIT) {
        await this.transact([parentOperation, ...group.childOperations]);
        continue;
      }
      await this.transact([parentOperation]);
      await this.writeBoundedTransactions(group.childOperations);
    }
    await this.delete(deleteFoodOperation.Delete!.Key!, {
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
    });
  }

  private async createNutritionRecordWithItems(
    parent: MealRecord | MealTemplateRecord,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    const parentOperation: TransactionOperations[number] = {
      Put: {
        TableName: this.tableName,
        Item: parent,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    };
    const itemOperations = items.map((item) => ({
      Put: {
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    }));

    if (itemOperations.length + 1 <= DYNAMODB_TRANSACTION_LIMIT) {
      await this.transact([...itemOperations, parentOperation]);
      return;
    }

    try {
      // Unreferenced children are invisible to owner queries. Write them in
      // bounded transactions and make the parent the visibility switch.
      await this.writeBoundedTransactions(itemOperations);
      await this.transact([parentOperation]);
    } catch (error) {
      await this.deleteWrittenKeysQuietly(itemOperations);
      throw error;
    }
  }

  private async replaceNutritionItems(
    kind: 'meal' | 'template',
    parent: MealRecord | MealTemplateRecord,
    previousItemIds: ReadonlyArray<number>,
    items: ReadonlyArray<NestedFoodItemRecord>,
  ): Promise<void> {
    const newItemIds = new Set(items.map(({ id }) => id));
    const removedItemIds = [...new Set(previousItemIds)]
      .filter((itemId) => !newItemIds.has(itemId));
    const changedItems = items.filter((item) =>
      !new Set(previousItemIds).has(item.id));
    const scalarUpdate = changedItems.length === 0;
    const parentOperation = this.nutritionParentPointerOperation(
      {
        ...parent,
        ...(scalarUpdate ? { food_item_ids: [...new Set(previousItemIds)] } : {}),
      },
      previousItemIds,
    );
    const itemPuts = changedItems.map((item) => ({
      Put: {
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    }));
    const itemDeletes = this.nutritionItemDeleteOperations(
      kind,
      parent.id,
      removedItemIds,
    );

    if (itemPuts.length + itemDeletes.length + 1 <= DYNAMODB_TRANSACTION_LIMIT) {
      await this.transact([...itemPuts, ...itemDeletes, parentOperation]);
      return;
    }

    try {
      // New ingredient IDs never overlap the old parent pointer. Stage them,
      // atomically repoint the visible parent, then clean up superseded rows.
      await this.writeBoundedTransactions(itemPuts);
      await this.transact([parentOperation]);
    } catch (error) {
      await this.deleteWrittenKeysQuietly(itemPuts);
      throw error;
    }
    await this.writeBoundedTransactionsQuietly(itemDeletes);
  }

  private async writeBoundedTransactions(
    operations: TransactionOperations,
  ): Promise<void> {
    for (
      let index = 0;
      index < operations.length;
      index += DYNAMODB_TRANSACTION_LIMIT
    ) {
      await this.transact(operations.slice(
        index,
        index + DYNAMODB_TRANSACTION_LIMIT,
      ));
    }
  }

  private async deleteWrittenKeysQuietly(
    operations: ReadonlyArray<TransactionOperations[number]>,
  ): Promise<void> {
    const keys = operations.flatMap((operation) => {
      const put = 'Put' in operation ? operation.Put : undefined;
      const item = put?.Item;
      return item && typeof item.pk === 'string' && typeof item.sk === 'string'
        ? [{ pk: item.pk, sk: item.sk }]
        : [];
    });
    const operationsToDelete = keys.map((key) => ({
      Delete: { TableName: this.tableName, Key: key },
    }));
    await this.writeBoundedTransactionsQuietly(operationsToDelete);
  }

  private async writeBoundedTransactionsQuietly(
    operations: TransactionOperations,
  ): Promise<void> {
    try {
      await this.writeBoundedTransactions(operations);
    } catch {
      // Cleanup rows are unreachable through parent queries. Never turn an
      // already-visible successful mutation into a contradictory API error.
    }
  }

  private nutritionItemDeleteOperations(
    kind: 'meal' | 'template',
    parentId: number,
    itemIds: ReadonlyArray<number>,
  ): TransactionOperations {
    const prefix = kind === 'meal' ? 'MEAL#' : 'MEAL_TEMPLATE#';
    const sortPrefix = kind === 'meal'
      ? 'MEAL_FOOD_ITEM#'
      : 'TEMPLATE_FOOD_ITEM#';
    return [...new Set(itemIds)].map((itemId) => ({
      Delete: {
        TableName: this.tableName,
        Key: { pk: `${prefix}${parentId}`, sk: `${sortPrefix}${itemId}` },
      },
    }));
  }

  private nutritionParentPointerOperation(
    parent: NutritionParentRecord,
    expectedItemIds: ReadonlyArray<number>,
  ): TransactionOperations[number] {
    return {
      Put: {
        TableName: this.tableName,
        Item: parent,
        ConditionExpression:
          'attribute_exists(pk) AND attribute_exists(sk) AND food_item_ids = :expectedItemIds',
        ExpressionAttributeValues: {
          ':expectedItemIds': [...expectedItemIds],
        },
      },
    };
  }

  async putAllTransactionally(items: readonly object[]): Promise<void> {
    await this.transact(items.map((item) => ({
      Put: { TableName: this.tableName, Item: item as DocumentItem },
    })));
  }

  /** Copy/create helpers rely on DynamoDB transactions to reject partial writes. */
  async putNewItemsTransactionally(items: readonly object[]): Promise<void> {
    await this.transact(items.map((item) => ({
      Put: {
        TableName: this.tableName,
        Item: item as DocumentItem,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })));
  }

  async deleteAllTransactionally(
    keys: ReadonlyArray<Record<string, unknown>>,
  ): Promise<void> {
    await this.transact(keys.map((key) => ({
      Delete: { TableName: this.tableName, Key: key },
    })));
  }

  async listExercises(userId?: number): Promise<ExerciseItem[]> {
    const items = await this.scan<ExerciseItem>({
      FilterExpression: '#sk = :sk AND (#owner = :null OR #owner = :user)',
      ExpressionAttributeNames: { '#sk': 'sk', '#owner': 'user_id' },
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
        ':null': null,
        ':user': userId ?? -1,
      },
    });
    return items.sort((left, right) => left.id - right.id);
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

  async put<T extends object>(
    item: T,
    options: Omit<PutCommandInput, 'Item' | 'TableName'> = {},
  ): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item as DocumentItem,
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
    consistentRead?: boolean;
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
      ...(input.consistentRead ? { ConsistentRead: true } : {}),
    });
  }

  async scan<T = DocumentItem>(
    options: Omit<ScanCommandInput, 'TableName'>,
  ): Promise<T[]> {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(new DocScanCommand({
        TableName: this.tableName,
        ...options,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }));
      items.push(...((result.Items ?? []) as T[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
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
