import { emptyResponse, jsonResponse } from '../http.js';
import type {
  FoodItemRecord,
  JsonObject,
  MealRecord,
  MealTemplateRecord,
  NestedFoodItemRecord,
} from '../types.js';
import { HttpError } from '../types.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';
import { ValidationFailure } from '../validation.js';

type NutritionParent = MealRecord | MealTemplateRecord;

interface ParentWrite {
  readonly parent: NutritionParent;
  readonly childPartition: string;
  readonly childSortPrefix: string;
  readonly childEntityType: string;
  readonly childIdField: 'meal_id' | 'template_id';
}

interface FoodInput {
  name: string;
  brand: string | null;
  barcode: string | null;
  servingSize: number;
  servingType: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  category: string | null;
  glycemicIndex: number | null;
  absorptionSpeed: string | null;
  insulinResponse: number | null;
  satietyScore: number | null;
  proteinQuality: number | null;
}

interface MealScalarInput {
  name: string;
  mealType: string;
  date?: string;
  loggedAt?: string;
  eventTime: string | null;
  notes: string | null;
  source: 'manual' | 'ai_assisted';
  foodItems?: Array<Omit<NestedFoodItemRecord, 'id'>>;
}

interface TemplateScalarInput {
  name: string;
  category: string;
  notes: string | null;
  foodItems?: Array<Omit<NestedFoodItemRecord, 'id'>>;
}

const foodCategories = new Set(['carb', 'protein', 'fat', 'mixed', 'beverage']);
const absorptionSpeeds = new Set(['slow', 'moderate', 'fast']);
const mealCategories = new Set([
  'breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'beverage',
]);
const mealSources = new Set(['manual', 'ai_assisted']);

function assertJsonObject(data: unknown): JsonObject {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new HttpError(400, { detail: ['Invalid request body.'] });
  }
  return data as JsonObject;
}

function addError(errors: JsonObject, field: string, message: string): void {
  const existing = errors[field];
  if (Array.isArray(existing)) {
    existing.push(message);
  } else {
    errors[field] = [message];
  }
}

function failIfErrors(errors: JsonObject): void {
  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure(errors);
  }
}

function parsedNumber(value: unknown): number | undefined {
  const candidate = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function decimalValue(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  options: {
    minimum?: number;
    exclusiveMinimum?: boolean;
    maximumDigits?: boolean;
  } = {},
): number | undefined {
  if (!(field in input)) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  const raw = input[field];
  if (raw === null) {
    addError(errors, field, 'This field may not be null.');
    return undefined;
  }
  const value = parsedNumber(raw);
  if (value === undefined) {
    addError(errors, field, 'A valid number is required.');
    return undefined;
  }
  if (options.maximumDigits && Math.abs(value) >= 100_000_000) {
    addError(errors, field, 'Ensure that there are no more than 10 digits in total.');
    return undefined;
  }
  if (options.minimum !== undefined) {
    const valid = options.exclusiveMinimum
      ? value > options.minimum
      : value >= options.minimum;
    if (!valid) {
      addError(
        errors,
        field,
        options.exclusiveMinimum
          ? `Ensure this value is greater than ${options.minimum}.`
          : `Ensure this value is greater than or equal to ${options.minimum}.`,
      );
      return undefined;
    }
  }
  return Math.round(value * 100) / 100;
}

function nullableDecimal(
  errors: JsonObject,
  input: JsonObject,
  field: string,
): number | null | undefined {
  if (!(field in input)) return undefined;
  if (input[field] === null) return null;
  const value = decimalValue(errors, input, field, {
    minimum: 0,
    maximumDigits: true,
  });
  return value === undefined ? undefined : value;
}

function integerOrNull(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  choices?: ReadonlyArray<number>,
): number | null | undefined {
  if (!(field in input)) return undefined;
  const raw = input[field];
  if (raw === null) return null;
  const value = parsedNumber(raw);
  if (value === undefined || !Number.isSafeInteger(value)) {
    addError(errors, field, 'A valid integer is required.');
    return undefined;
  }
  if (choices && !choices.includes(value)) {
    addError(errors, field, `"${String(raw)}" is not a valid choice.`);
    return undefined;
  }
  return value;
}

function requiredText(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  maxLength: number,
): string | undefined {
  if (!(field in input)) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  const value = input[field];
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  if (trimmed.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
    return undefined;
  }
  return trimmed;
}

function nullableText(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  maxLength?: number,
): string | null | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  const trimmed = value.trim();
  if (maxLength !== undefined && trimmed.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
    return undefined;
  }
  return trimmed === '' ? null : trimmed;
}

function nullableChoice(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  choices: ReadonlySet<string>,
): string | null | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  if (!choices.has(value)) {
    addError(errors, field, `"${value}" is not a valid choice.`);
    return undefined;
  }
  return value;
}

function requiredChoice(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  choices: ReadonlySet<string>,
): string | undefined {
  if (!(field in input)) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  const value = input[field];
  if (typeof value !== 'string' || value.trim() === '') {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  if (!choices.has(value)) {
    addError(errors, field, `"${value}" is not a valid choice.`);
    return undefined;
  }
  return value;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function normalizedTime(
  errors: JsonObject,
  input: JsonObject,
  field: string,
): string | null | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(value);
  if (!match) {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? '00' : match[3];
  if (hours > 23 || minutes > 59 || Number(seconds.split('.')[0]) > 59) {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  return `${match[1]}:${match[2]}:${seconds}`;
}

function normalizedTimestamp(
  errors: JsonObject,
  input: JsonObject,
  field: string,
): string | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    addError(errors, field, 'A valid datetime is required.');
    return undefined;
  }
  return new Date(value).toISOString();
}

function localDate(timestamp: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function decimalRepresentation(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

function foodResponse(item: FoodItemRecord): Record<string, unknown> {
  return {
    id: item.id,
    user: item.user_id ?? null,
    name: item.name,
    brand: item.brand ?? null,
    barcode: item.barcode ?? null,
    source: item.source,
    servingSize: decimalRepresentation(item.serving_size),
    servingType: item.serving_unit,
    calories: decimalRepresentation(item.calories),
    protein: decimalRepresentation(item.protein),
    carbs: decimalRepresentation(item.carbs),
    fat: decimalRepresentation(item.fat),
    saturatedFat: decimalRepresentation(item.saturated_fat),
    fiber: decimalRepresentation(item.fiber),
    sugar: decimalRepresentation(item.sugar),
    sodium: decimalRepresentation(item.sodium),
    glycemicIndex: item.glycemic_index ?? null,
    absorptionSpeed: item.absorption_speed ?? null,
    satietyScore: item.satiety_score ?? null,
    proteinQuality: item.protein_quality ?? null,
    insulinResponse: decimalRepresentation(item.insulin_response),
    category: item.category ?? null,
  };
}

async function visibleFood(
  context: RouteContext,
  id: number,
  userId?: number,
): Promise<FoodItemRecord | undefined> {
  const keys: Array<Record<string, string>> = [
    { pk: 'CANONICAL_FOODS', sk: `FOOD#${id}` },
  ];
  if (userId !== undefined) {
    keys.push({ pk: `USER#${userId}`, sk: `FOOD#${id}` });
  }
  const foods = await context.repository.batchGet<FoodItemRecord>(keys);
  return foods.find((food) => userId === undefined || food.user_id === null ||
    food.user_id === userId);
}

async function accessibleFoods(
  context: RouteContext,
  ids: Iterable<number>,
  userId: number,
): Promise<Map<number, FoodItemRecord>> {
  const uniqueIds = [...new Set(ids)].filter((id) =>
    Number.isSafeInteger(id) && id > 0
  );
  const keys = uniqueIds.flatMap((id) => [
    { pk: 'CANONICAL_FOODS', sk: `FOOD#${id}` },
    { pk: `USER#${userId}`, sk: `FOOD#${id}` },
  ]);
  const records = await context.repository.batchGet<FoodItemRecord>(keys);
  const result = new Map<number, FoodItemRecord>();
  for (const food of records.sort((left, right) => left.id - right.id)) {
    if ((food.user_id === null || food.user_id === userId) &&
      !result.has(food.id)
    ) {
      result.set(food.id, food);
    }
  }
  return result;
}

function validateFood(data: unknown, partial = false): Partial<FoodInput> {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const present = (field: keyof FoodInput & string): boolean =>
    field in input || !(partial && true);

  const name = present('name')
    ? requiredText(errors, input, 'name', 255)
    : undefined;
  const servingSize = present('servingSize')
    ? decimalValue(errors, input, 'servingSize', {
      minimum: 0.01,
      maximumDigits: true,
    })
    : undefined;
  const servingType = present('servingType')
    ? requiredText(errors, input, 'servingType', 50)
    : undefined;
  const calories = present('calories')
    ? decimalValue(errors, input, 'calories', {
      minimum: 0,
      maximumDigits: true,
    })
    : undefined;
  const protein = present('protein')
    ? decimalValue(errors, input, 'protein', {
      minimum: 0,
      maximumDigits: true,
    })
    : undefined;
  const carbs = present('carbs')
    ? decimalValue(errors, input, 'carbs', {
      minimum: 0,
      maximumDigits: true,
    })
    : undefined;
  const fat = present('fat')
    ? decimalValue(errors, input, 'fat', {
      minimum: 0,
      maximumDigits: true,
    })
    : undefined;

  const brand = nullableText(errors, input, 'brand', 255);
  const barcode = nullableText(errors, input, 'barcode', 255);
  const saturatedFat = nullableDecimal(errors, input, 'saturatedFat');
  const fiber = nullableDecimal(errors, input, 'fiber');
  const sugar = nullableDecimal(errors, input, 'sugar');
  const sodium = nullableDecimal(errors, input, 'sodium');
  const category = nullableChoice(errors, input, 'category', foodCategories);
  const glycemicIndex = integerOrNull(errors, input, 'glycemicIndex');
  const absorptionSpeed = nullableChoice(
    errors,
    input,
    'absorptionSpeed',
    absorptionSpeeds,
  );
  const insulinResponse = nullableDecimal(errors, input, 'insulinResponse');
  const satietyScore = integerOrNull(errors, input, 'satietyScore');
  const proteinQuality = integerOrNull(
    errors,
    input,
    'proteinQuality',
    [1, 2, 3],
  );

  failIfErrors(errors);
  const result: Partial<FoodInput> = {};
  const assign = <Field extends keyof FoodInput>(
    field: Field,
    value: FoodInput[Field] | undefined,
  ): void => {
    if (value !== undefined) result[field] = value;
  };
  assign('name', name);
  assign('brand', brand);
  assign('barcode', barcode);
  assign('servingSize', servingSize);
  assign('servingType', servingType);
  assign('calories', calories);
  assign('protein', protein);
  assign('carbs', carbs);
  assign('fat', fat);
  assign('saturatedFat', saturatedFat);
  assign('fiber', fiber);
  assign('sugar', sugar);
  assign('sodium', sodium);
  assign('category', category);
  assign('glycemicIndex', glycemicIndex);
  assign('absorptionSpeed', absorptionSpeed);
  assign('insulinResponse', insulinResponse);
  assign('satietyScore', satietyScore);
  assign('proteinQuality', proteinQuality);
  return result;
}

function applyFoodInput(
  existing: FoodItemRecord | undefined,
  input: Partial<FoodInput>,
  userId: number,
  id: number,
): FoodItemRecord {
  const base = existing ?? {
    pk: `USER#${userId}`,
    sk: `FOOD#${id}`,
    id,
    user_id: userId,
    name: '',
    brand: null,
    barcode: null,
    source: 'user',
    serving_size: 0,
    serving_unit: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: null,
    saturated_fat: null,
    category: null,
    glycemic_index: null,
    absorption_speed: null,
    insulin_response: null,
    satiety_score: null,
    protein_quality: null,
  };
  return {
    ...base,
    ...(existing ? {} : { brand: null }),
    name: input.name ?? base.name,
    brand: input.brand === undefined ? base.brand ?? null : input.brand,
    barcode: input.barcode === undefined ? base.barcode ?? null : input.barcode,
    source: 'user',
    serving_size: input.servingSize ?? base.serving_size,
    serving_unit: input.servingType ?? base.serving_unit,
    calories: input.calories ?? base.calories,
    protein: input.protein ?? base.protein,
    carbs: input.carbs ?? base.carbs,
    fat: input.fat ?? base.fat,
    saturated_fat: input.saturatedFat === undefined
      ? base.saturated_fat ?? null
      : input.saturatedFat,
    fiber: input.fiber === undefined ? base.fiber ?? null : input.fiber,
    sugar: input.sugar === undefined ? base.sugar ?? null : input.sugar,
    sodium: input.sodium === undefined ? base.sodium ?? null : input.sodium,
    category: input.category === undefined ? base.category ?? null : input.category,
    glycemic_index: input.glycemicIndex === undefined
      ? base.glycemic_index ?? null
      : input.glycemicIndex,
    absorption_speed: input.absorptionSpeed === undefined
      ? base.absorption_speed ?? null
      : input.absorptionSpeed,
    insulin_response: input.insulinResponse === undefined
      ? base.insulin_response ?? null
      : input.insulinResponse,
    satiety_score: input.satietyScore === undefined
      ? base.satiety_score ?? null
      : input.satietyScore,
    protein_quality: input.proteinQuality === undefined
      ? base.protein_quality ?? null
      : input.proteinQuality,
  };
}

function parseNestedItems(
  input: JsonObject,
  errors: JsonObject,
): Array<Omit<NestedFoodItemRecord, 'id'>> | undefined {
  if (!('food_items' in input)) return undefined;
  if (!Array.isArray(input.food_items)) {
    addError(errors, 'food_items', 'Expected a list of items but got type "str".');
    return undefined;
  }

  const items: Array<Omit<NestedFoodItemRecord, 'id'>> = [];
  let invalid = false;
  input.food_items.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(errors, `food_items.${index}`, 'Invalid data. Expected a dictionary.');
      invalid = true;
      return;
    }
    const item = entry as JsonObject;
    const foodIdRaw = item.foodId;
    const grams = parsedNumber(item.grams);
    const orderRaw = item.order === undefined ? index : item.order;
    const foodId = typeof foodIdRaw === 'number' &&
      Number.isSafeInteger(foodIdRaw) && foodIdRaw > 0
      ? foodIdRaw
      : undefined;
    const order = typeof orderRaw === 'number' && Number.isSafeInteger(orderRaw)
      ? orderRaw
      : undefined;
    if (foodId === undefined) {
      addError(errors, `food_items.${index}.foodId`, 'A valid integer is required.');
      invalid = true;
    }
    if (grams === undefined || grams < 0.01 || grams >= 100_000_000) {
      addError(
        errors,
        `food_items.${index}.grams`,
        'Ensure this value is greater than or equal to 0.01.',
      );
      invalid = true;
    }
    if (order === undefined) {
      addError(errors, `food_items.${index}.order`, 'A valid integer is required.');
      invalid = true;
    }
    if (foodId !== undefined && grams !== undefined && order !== undefined) {
      items.push({ food_id: foodId, grams, order });
    }
  });
  return invalid ? undefined : items;
}

async function resolveNestedItems(
  context: RouteContext,
  userId: number,
  inputItems: Array<Omit<NestedFoodItemRecord, 'id'>>,
): Promise<NestedFoodItemRecord[]> {
  const foods = await accessibleFoods(
    context,
    inputItems.map((item) => item.food_id),
    userId,
  );
  const missing = inputItems.filter((item) => !foods.has(item.food_id));
  if (missing.length > 0) {
    throw new ValidationFailure({
      food_items: [{
        foodId: [
          `Invalid pk "${missing[0].food_id}" - object does not exist.`,
        ],
      }],
    });
  }
  return inputItems.map((item, index) => ({ id: 0, ...item, order: item.order }));
}

async function getParent(
  context: RouteContext,
  key: Record<string, string>,
): Promise<NutritionParent | undefined> {
  return context.repository.get<NutritionParent>(key);
}

async function writeParent(
  context: RouteContext,
  write: ParentWrite,
  previousItems: NestedFoodItemRecord[],
): Promise<void> {
  const table = context.config.tableName;
  const deleteOperations = previousItems.map((item) => ({
    Delete: {
      TableName: table,
      Key: {
        pk: write.childPartition,
        sk: `${write.childSortPrefix}${item.id}`,
      },
    },
  }));
  const putOperations = write.parent.food_items.map((item) => ({
    Put: {
      TableName: table,
      Item: {
        pk: write.childPartition,
        sk: `${write.childSortPrefix}${item.id}`,
        entity_type: write.childEntityType,
        id: item.id,
        [write.childIdField]: write.parent.id,
        food_id: item.food_id,
        grams: item.grams,
        order: item.order,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    },
  }));
  const metadataOperation = {
    Put: {
      TableName: table,
      Item: write.parent,
      ...(write.parent.id === write.parent.id
        ? {}
        : { ConditionExpression: 'attribute_not_exists(pk)' }),
    },
  };

  if (deleteOperations.length + putOperations.length + 1 <= 100) {
    await context.repository.transact([
      ...deleteOperations,
      ...putOperations,
      metadataOperation,
    ]);
    return;
  }

  for (let offset = 0; offset < deleteOperations.length; offset += 100) {
    await context.repository.transact(
      deleteOperations.slice(offset, offset + 100),
    );
  }
  for (let offset = 0; offset < putOperations.length; offset += 99) {
    await context.repository.transact(putOperations.slice(offset, offset + 99));
  }
  await context.repository.put(write.parent);
}

async function destroyParent(
  context: RouteContext,
  parent: NutritionParent,
  childPartition: string,
  childSortPrefix: string,
): Promise<void> {
  const keys = parent.food_items.map((item) => ({
    pk: childPartition,
    sk: `${childSortPrefix}${item.id}`,
  }));
  const metadataKey = { pk: parent.pk, sk: parent.sk };
  if (keys.length + 1 <= 100) {
    await context.repository.transact([
      ...keys.map((key) => ({
        Delete: { TableName: context.config.tableName, Key: key },
      })),
      { Delete: { TableName: context.config.tableName, Key: metadataKey } },
    ]);
    return;
  }
  for (let offset = 0; offset < keys.length; offset += 100) {
    await context.repository.transact(keys.slice(offset, offset + 100));
  }
  await context.repository.delete(metadataKey);
}

function nutritionTotals(
  records: readonly NutritionParent[],
  foods: Map<number, FoodItemRecord>,
): Map<number, Record<string, number>> {
  const totals = new Map<number, Record<string, number>>();
  for (const parent of records) {
    const values = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    for (const item of parent.food_items) {
      const food = foods.get(item.food_id);
      if (!food || food.serving_size <= 0) continue;
      const multiplier = item.grams / food.serving_size;
      values.calories += food.calories * multiplier;
      values.protein += food.protein * multiplier;
      values.carbs += food.carbs * multiplier;
      values.fat += food.fat * multiplier;
    }
    for (const key of Object.keys(values) as Array<keyof typeof values>) {
      values[key] = Math.round((values[key] + Number.EPSILON) * 100) / 100;
    }
    totals.set(parent.id, values);
  }
  return totals;
}

async function serializeParents(
  context: RouteContext,
  parents: readonly NutritionParent[],
  kind: 'meal' | 'template',
): Promise<Array<Record<string, unknown>>> {
  const foods = await accessibleFoods(
    context,
    parents.flatMap((parent) => parent.food_items.map((item) => item.food_id)),
    kind === 'meal' ? (parents[0] as MealRecord).user_id :
      (parents[0] as MealTemplateRecord).user_id,
  );
  const totals = nutritionTotals(parents, foods);
  return parents.map((parent) => {
    const base: Record<string, unknown> = {
      id: parent.id,
      name: parent.name,
      notes: parent.notes ?? null,
      food_items: parent.food_items.map((item) => ({
        id: item.id,
        foodId: item.food_id,
        grams: item.grams,
        order: item.order,
      })),
    };
    if (kind === 'meal') {
      const meal = parent as MealRecord;
      return {
        ...base,
        mealType: meal.meal_type,
        date: meal.date,
        loggedAt: meal.logged_at ?? null,
        eventTime: meal.event_time ?? null,
        source: meal.source,
        totalCalories: totals.get(meal.id)?.calories ?? 0,
        totalProtein: totals.get(meal.id)?.protein ?? 0,
        totalCarbs: totals.get(meal.id)?.carbs ?? 0,
        totalFat: totals.get(meal.id)?.fat ?? 0,
      };
    }
    const template = parent as MealTemplateRecord;
    return {
      ...base,
      category: template.category,
    };
  });
}

function validateMeal(
  data: unknown,
  partial = false,
): Partial<MealScalarInput> {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const has = (field: keyof MealScalarInput): boolean => field in input;
  const name = has('name') ? requiredText(errors, input, 'name', 255) : undefined;
  const mealType = has('mealType')
    ? requiredChoice(errors, input, 'mealType', mealCategories)
    : undefined;
  let date: string | undefined;
  if (has('date')) {
    if (typeof input.date !== 'string' || !isValidDate(input.date)) {
      addError(errors, 'date', 'A valid date is required.');
    } else {
      date = input.date;
    }
  }
  const loggedAt = has('loggedAt')
    ? normalizedTimestamp(errors, input, 'loggedAt')
    : undefined;
  const eventTime = normalizedTime(errors, input, 'eventTime');
  const notes = nullableText(errors, input, 'notes');
  let source: 'manual' | 'ai_assisted' | undefined;
  if (has('source')) {
    const selected = requiredChoice(errors, input, 'source', mealSources);
    if (selected === 'manual' || selected === 'ai_assisted') source = selected;
  }
  const foodItems = parseNestedItems(input, errors);
  failIfErrors(errors);

  return {
    ...(name === undefined ? {} : { name }),
    ...(mealType === undefined ? {} : { mealType }),
    ...(date === undefined ? {} : { date }),
    ...(loggedAt === undefined ? {} : { loggedAt }),
    ...(eventTime === undefined ? {} : { eventTime }),
    ...(notes === undefined ? {} : { notes }),
    ...(source === undefined ? {} : { source }),
    ...(foodItems === undefined ? {} : { foodItems }),
  };
}

function validateTemplate(
  data: unknown,
  partial = false,
): Partial<TemplateScalarInput> {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const has = (field: keyof TemplateScalarInput): boolean => field in input;
  const name = has('name') ? requiredText(errors, input, 'name', 255) : undefined;
  const category = has('category')
    ? requiredChoice(errors, input, 'category', mealCategories)
    : undefined;
  const notes = nullableText(errors, input, 'notes');
  const foodItems = parseNestedItems(input, errors);
  failIfErrors(errors);
  return {
    ...(name === undefined ? {} : { name }),
    ...(category === undefined ? {} : { category }),
    ...(notes === undefined ? {} : { notes }),
    ...(foodItems === undefined ? {} : { foodItems }),
  };
}

async function createMeal(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = validateMeal(context.request.body);
  const requestedItems = input.foodItems ?? [];
  await resolveNestedItems(context, user.id, requestedItems);
  const id = await context.repository.nextId('meal');
  const itemIds = await Promise.all(requestedItems.map(() =>
    context.repository.nextId('meal_food_item')
  ));
  const loggedAt = input.loggedAt ?? timestamp();
  const meal: MealRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL#${id}`,
    entity_type: 'meal',
    id,
    user_id: user.id,
    name: input.name ?? '',
    meal_type: input.mealType ?? '',
    date: input.date ?? localDate(loggedAt, context.config.timezone),
    logged_at: loggedAt,
    event_time: input.eventTime ?? null,
    notes: input.notes ?? null,
    source: input.source ?? 'manual',
    food_items: requestedItems.map((item, index) => ({
      ...item,
      id: itemIds[index],
    })),
  };
  await writeParent(context, {
    parent: meal,
    childPartition: `MEAL#${id}`,
    childSortPrefix: 'MEAL_FOOD_ITEM#',
    childEntityType: 'meal_food_item',
    childIdField: 'meal_id',
  }, []);
  return jsonResponse(201, (await serializeParents(context, [meal], 'meal'))[0], context.cors);
}

async function updateMeal(
  context: RouteContext,
  id: number,
  partial: boolean,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const existing = await getParent(context, {
    pk: `USER#${user.id}`,
    sk: `MEAL#${id}`,
  }) as MealRecord | undefined;
  if (!existing || existing.user_id !== user.id) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const input = validateMeal(context.request.body, partial);
  let foodItems = existing.food_items;
  let itemIds = foodItems.map((item) => item.id);
  if (input.foodItems !== undefined) {
    await resolveNestedItems(context, user.id, input.foodItems);
    itemIds = await Promise.all(input.foodItems.map(() =>
      context.repository.nextId('meal_food_item')
    ));
    foodItems = input.foodItems.map((item, index) => ({
      ...item,
      id: itemIds[index],
    }));
  }
  const loggedAt = input.loggedAt ?? existing.logged_at ?? null;
  const updated: MealRecord = {
    ...existing,
    name: input.name ?? existing.name,
    meal_type: input.mealType ?? existing.meal_type,
    date: input.date ?? existing.date,
    logged_at: loggedAt,
    event_time: input.eventTime === undefined
      ? existing.event_time ?? null
      : input.eventTime,
    notes: input.notes === undefined ? existing.notes ?? null : input.notes,
    source: input.source ?? existing.source,
    food_items: foodItems,
  };
  await writeParent(context, {
    parent: updated,
    childPartition: `MEAL#${id}`,
    childSortPrefix: 'MEAL_FOOD_ITEM#',
    childEntityType: 'meal_food_item',
    childIdField: 'meal_id',
  }, existing.food_items);
  return jsonResponse(200, (await serializeParents(context, [updated], 'meal'))[0], context.cors);
}

async function createTemplate(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = validateTemplate(context.request.body);
  const requestedItems = input.foodItems ?? [];
  await resolveNestedItems(context, user.id, requestedItems);
  const id = await context.repository.nextId('meal_template');
  const itemIds = await Promise.all(requestedItems.map(() =>
    context.repository.nextId('meal_template_food_item')
  ));
  const now = timestamp();
  const template: MealTemplateRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL_TEMPLATE#${id}`,
    entity_type: 'meal_template',
    id,
    user_id: user.id,
    name: input.name ?? '',
    category: input.category ?? '',
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
    food_items: requestedItems.map((item, index) => ({
      ...item,
      id: itemIds[index],
    })),
  };
  await writeParent(context, {
    parent: template,
    childPartition: `MEAL_TEMPLATE#${id}`,
    childSortPrefix: 'TEMPLATE_FOOD_ITEM#',
    childEntityType: 'meal_template_food_item',
    childIdField: 'template_id',
  }, []);
  return jsonResponse(
    201,
    (await serializeParents(context, [template], 'template'))[0],
    context.cors,
  );
}

async function updateTemplate(
  context: RouteContext,
  id: number,
  partial: boolean,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const existing = await getParent(context, {
    pk: `USER#${user.id}`,
    sk: `MEAL_TEMPLATE#${id}`,
  }) as MealTemplateRecord | undefined;
  if (!existing || existing.user_id !== user.id) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const input = validateTemplate(context.request.body, partial);
  let foodItems = existing.food_items;
  if (input.foodItems !== undefined) {
    await resolveNestedItems(context, user.id, input.foodItems);
    const itemIds = await Promise.all(input.foodItems.map(() =>
      context.repository.nextId('meal_template_food_item')
    ));
    foodItems = input.foodItems.map((item, index) => ({
      ...item,
      id: itemIds[index],
    }));
  }
  const updated: MealTemplateRecord = {
    ...existing,
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    notes: input.notes === undefined ? existing.notes ?? null : input.notes,
    updated_at: timestamp(),
    food_items: foodItems,
  };
  await writeParent(context, {
    parent: updated,
    childPartition: `MEAL_TEMPLATE#${id}`,
    childSortPrefix: 'TEMPLATE_FOOD_ITEM#',
    childEntityType: 'meal_template_food_item',
    childIdField: 'template_id',
  }, existing.food_items);
  return jsonResponse(
    200,
    (await serializeParents(context, [updated], 'template'))[0],
    context.cors,
  );
}

function calculationMacros(input: unknown): {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  foodType: string;
} {
  const data = assertJsonObject(input);
  const errors: JsonObject = {};
  const readMacro = (
    field: string,
  ): number => {
    const value = field in data
      ? decimalValue(errors, data, field, { minimum: 0, maximumDigits: true })
      : 0;
    return value ?? 0;
  };
  const protein = readMacro('protein_g');
  const carbs = readMacro('carbs_g');
  const fat = readMacro('fat_g');
  const fiber = readMacro('fiber_g');
  const foodType = nullableText(errors, data, 'food_type', 255) ?? '';
  failIfErrors(errors);
  return { protein, carbs, fat, fiber, foodType };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function calculateNutrition(
  context: RouteContext,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = assertJsonObject(context.request.body);
  if (!Array.isArray(input.food_items)) {
    throw new ValidationFailure({ food_items: ['This field is required.'] });
  }
  if (input.food_items.length > 200) {
    throw new ValidationFailure({
      food_items: ['Ensure this field has no more than 200 items.'],
    });
  }
  const errors: JsonObject = {};
  const requests = input.food_items.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(errors, `food_items.${index}`, 'Invalid data. Expected a dictionary.');
      return undefined;
    }
    const item = entry as JsonObject;
    const foodId = integerOrNull(errors, item, 'food_id');
    const grams = decimalValue(errors, item, 'grams', {
      minimum: 0.01,
      maximumDigits: true,
    });
    if (foodId === undefined || grams === undefined) return undefined;
    return { foodId, grams };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  failIfErrors(errors);

  const foods = await accessibleFoods(
    context,
    requests.map((request) => request.foodId),
    user.id,
  );
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };
  for (const request of requests) {
    const food = foods.get(request.foodId);
    if (!food || food.serving_size <= 0) continue;
    const multiplier = request.grams / food.serving_size;
    totals.calories += food.calories * multiplier;
    totals.protein += food.protein * multiplier;
    totals.carbs += food.carbs * multiplier;
    totals.fat += food.fat * multiplier;
    totals.fiber += (food.fiber ?? 0) * multiplier;
    totals.sugar += (food.sugar ?? 0) * multiplier;
    totals.sodium += (food.sodium ?? 0) * multiplier;
  }
  return jsonResponse(200, {
    total_calories: round2(totals.calories),
    total_protein_g: round2(totals.protein),
    total_carbs_g: round2(totals.carbs),
    total_fat_g: round2(totals.fat),
    total_fiber_g: round2(totals.fiber),
    total_sugar_g: round2(totals.sugar),
    total_sodium_mg: round2(totals.sodium),
  }, context.cors);
}

export function registerNutritionRoutes(
  addRoute: (route: RouteDefinition) => void,
): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/foods',
    handle: async (context) => {
      if (context.request.method === 'POST') {
        const user = await context.requireUser();
        const input = validateFood(context.request.body);
        const id = await context.repository.nextId('food');
        const food = applyFoodInput(undefined, input, user.id, id);
        await context.repository.put(food);
        return jsonResponse(201, foodResponse(food), context.cors);
      }

      const authorization = context.request.headers.authorization;
      const user = authorization ? await context.requireUser() : undefined;
      const [canonicalFoods, ownedFoods] = await Promise.all([
        context.repository.queryPartition<FoodItemRecord>({
          partitionKey: 'CANONICAL_FOODS',
          sortPrefix: 'FOOD#',
        }),
        user
          ? context.repository.queryPartition<FoodItemRecord>({
            partitionKey: `USER#${user.id}`,
            sortPrefix: 'FOOD#',
          })
          : Promise.resolve([]),
      ]);
      const foods = [...canonicalFoods, ...ownedFoods].sort((left, right) =>
        left.id - right.id
      );
      return jsonResponse(200, foods.map(foodResponse), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/foods/:id',
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        const authorization = context.request.headers.authorization;
        const user = authorization ? await context.requireUser() : undefined;
        const food = await visibleFood(context, id, user?.id);
        if (!food) throw new HttpError(404, { detail: 'Not found.' });
        return jsonResponse(200, foodResponse(food), context.cors);
      }

      const user = await context.requireUser();
      const existing = await visibleFood(context, id, user.id);
      if (!existing || existing.user_id === null || existing.user_id !== user.id) {
        if (existing?.user_id === null) {
          throw new HttpError(403, {
            error: 'Only the food owner can modify this item.',
          });
        }
        throw new HttpError(404, { detail: 'Not found.' });
      }
      if (context.request.method === 'DELETE') {
        await context.repository.delete({ pk: existing.pk, sk: existing.sk });
        return emptyResponse(204, context.cors);
      }
      const input = validateFood(
        context.request.body,
        context.request.method === 'PATCH',
      );
      const updated = applyFoodInput(existing, input, user.id, id);
      await context.repository.put(updated);
      return jsonResponse(200, foodResponse(updated), context.cors);
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/daily/totals/:date_str',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const date = params.date_str as string;
      if (!isValidDate(date)) {
        throw new HttpError(400, {
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
      }
      const user = await context.requireUser();
      const meals = (await context.repository.queryPartition<MealRecord>({
        partitionKey: `USER#${user.id}`,
        sortPrefix: 'MEAL#',
      })).filter((meal) => meal.date === date);
      const foods = await accessibleFoods(
        context,
        meals.flatMap((meal) => meal.food_items.map((item) => item.food_id)),
        user.id,
      );
      const totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      };
      for (const meal of meals) {
        for (const item of meal.food_items) {
          const food = foods.get(item.food_id);
          if (!food || food.serving_size <= 0) continue;
          const multiplier = item.grams / food.serving_size;
          totals.calories += food.calories * multiplier;
          totals.protein += food.protein * multiplier;
          totals.carbs += food.carbs * multiplier;
          totals.fat += food.fat * multiplier;
          totals.fiber += (food.fiber ?? 0) * multiplier;
          totals.sugar += (food.sugar ?? 0) * multiplier;
          totals.sodium += (food.sodium ?? 0) * multiplier;
        }
      }
      return jsonResponse(200, {
        date,
        calories: round2(totals.calories),
        protein_g: round2(totals.protein),
        carbs_g: round2(totals.carbs),
        fat_g: round2(totals.fat),
        fiber_g: round2(totals.fiber),
        sugar_g: round2(totals.sugar),
        sodium_mg: round2(totals.sodium),
      }, context.cors);
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/date/:date_str',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const date = params.date_str as string;
      if (!isValidDate(date)) {
        throw new HttpError(400, {
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
      }
      const user = await context.requireUser();
      const meals = (await context.repository.queryPartition<MealRecord>({
        partitionKey: `USER#${user.id}`,
        sortPrefix: 'MEAL#',
      })).filter((meal) => meal.date === date).sort((left, right) => left.id - right.id);
      return jsonResponse(
        200,
        await serializeParents(context, meals, 'meal'),
        context.cors,
      );
    },
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/meals',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => context.request.method === 'POST'
      ? createMeal(context)
      : jsonResponse(200, await serializeParents(
        context,
        (await context.repository.queryPartition<MealRecord>({
          partitionKey: `USER#${context.requireUser && (await context.requireUser()).id}`,
          sortPrefix: 'MEAL#',
        })).sort((left, right) => left.id - right.id),
        'meal',
      ), context.cors),
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/meals/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      const user = await context.requireUser();
      if (context.request.method === 'DELETE') {
        const existing = await getParent(context, {
          pk: `USER#${user.id}`,
          sk: `MEAL#${id}`,
        }) as MealRecord | undefined;
        if (!existing || existing.user_id !== user.id) {
          throw new HttpError(404, { detail: 'Not found.' });
        }
        await destroyParent(
          context,
          existing,
          `MEAL#${id}`,
          'MEAL_FOOD_ITEM#',
        );
        return emptyResponse(204, context.cors);
      }
      if (context.request.method === 'GET') {
        const meal = await getParent(context, {
          pk: `USER#${user.id}`,
          sk: `MEAL#${id}`,
        }) as MealRecord | undefined;
        if (!meal || meal.user_id !== user.id) {
          throw new HttpError(404, { detail: 'Not found.' });
        }
        return jsonResponse(
          200,
          (await serializeParents(context, [meal], 'meal'))[0],
          context.cors,
        );
      }
      return updateMeal(context, id, context.request.method === 'PATCH');
    },
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/templates',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      if (context.request.method === 'POST') {
        return createTemplate(context);
      }
      const templates = (await context.repository.queryPartition<MealTemplateRecord>({
        partitionKey: `USER#${user.id}`,
        sortPrefix: 'MEAL_TEMPLATE#',
      })).sort((left, right) => left.id - right.id);
      return jsonResponse(
        200,
        await serializeParents(context, templates, 'template'),
        context.cors,
      );
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/templates/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      const user = await context.requireUser();
      if (context.request.method === 'DELETE') {
        const existing = await getParent(context, {
          pk: `USER#${user.id}`,
          sk: `MEAL_TEMPLATE#${id}`,
        }) as MealTemplateRecord | undefined;
        if (!existing || existing.user_id !== user.id) {
          throw new HttpError(404, { detail: 'Not found.' });
        }
        await destroyParent(
          context,
          existing,
          `MEAL_TEMPLATE#${id}`,
          'TEMPLATE_FOOD_ITEM#',
        );
        return emptyResponse(204, context.cors);
      }
      if (context.request.method === 'GET') {
        const template = await getParent(context, {
          pk: `USER#${user.id}`,
          sk: `MEAL_TEMPLATE#${id}`,
        }) as MealTemplateRecord | undefined;
        if (!template || template.user_id !== user.id) {
          throw new HttpError(404, { detail: 'Not found.' });
        }
        return jsonResponse(
          200,
          (await serializeParents(context, [template], 'template'))[0],
          context.cors,
        );
      }
      return updateTemplate(context, id, context.request.method === 'PATCH');
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-calories',
    handle: async (context) => {
      const macros = calculationMacros(context.request.body);
      return jsonResponse(200, {
        calories: round2(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9),
        protein_g: macros.protein,
        carbs_g: macros.carbs,
        fat_g: macros.fat,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/detect-category',
    handle: async (context) => {
      const macros = calculationMacros(context.request.body);
      const total = macros.protein + macros.carbs + macros.fat;
      const category = total === 0
        ? 'unknown'
        : macros.protein > total * 0.4
        ? 'protein'
        : macros.carbs > total * 0.5
        ? 'carb'
        : macros.fat > total * 0.5
        ? 'fat'
        : 'balanced';
      return jsonResponse(200, {
        category,
        protein_ratio: total === 0 ? 0 : round2(macros.protein / total),
        carb_ratio: total === 0 ? 0 : round2(macros.carbs / total),
        fat_ratio: total === 0 ? 0 : round2(macros.fat / total),
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/infer-metabolism',
    handle: async (context) => {
      const macros = calculationMacros(context.request.body);
      const total = macros.protein + macros.carbs + macros.fat;
      const foodType = macros.foodType.toLowerCase();
      let glycemicIndex: string;
      if (macros.carbs > 0 && macros.fiber > 0) {
        glycemicIndex = macros.fiber >= 5
          ? 'low'
          : macros.fiber >= 3
          ? 'medium'
          : 'high';
      } else if (foodType.includes('whole') || foodType.includes('complex')) {
        glycemicIndex = 'low';
      } else if (
        foodType.includes('sugar') ||
        foodType.includes('candy') ||
        foodType.includes('soda')
      ) {
        glycemicIndex = 'high';
      } else {
        glycemicIndex = 'medium';
      }
      const absorptionSpeed = glycemicIndex === 'high'
        ? 'fast'
        : glycemicIndex === 'low'
        ? 'slow'
        : 'moderate';
      const thermicEffect = macros.protein > total * 0.3
        ? 'high'
        : macros.protein > total * 0.15
        ? 'medium'
        : 'low';
      let score = 0;
      if (macros.protein > total * 0.2) score += 3;
      if (macros.fiber >= 5) score += 3;
      else if (macros.fiber >= 3) score += 2;
      else if (macros.fiber > 0) score += 1;
      if (macros.fat > total * 0.2) score += 2;
      const satietyLevel = score >= 6
        ? 'very_high'
        : score >= 4
        ? 'high'
        : score >= 2
        ? 'moderate'
        : 'low';
      return jsonResponse(200, {
        glycemic_index: glycemicIndex,
        absorption_speed: absorptionSpeed,
        thermic_effect: thermicEffect,
        satiety_level: satietyLevel,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-nutrition',
    authRequired: true,
    authBeforeMethod: true,
    handle: calculateNutrition,
  });
}
