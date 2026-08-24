import { emptyResponse, jsonResponse } from '../http.js';
import type { ApiResponse, RouteContext, RouteDefinition } from '../router.js';
import type { FitnessRepository } from '../repository.js';
import type { JsonObject } from '../types.js';
import { HttpError } from '../types.js';
import { ValidationFailure } from '../validation.js';

export type NutritionFoodItem = {
  pk: string;
  sk: string;
  entity_type?: 'food_item';
  id: number;
  user_id?: number | null;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  source: 'canonical' | 'user' | 'ai_generated';
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  category?: string | null;
  glycemic_index?: number | null;
  absorption_speed?: string | null;
  insulin_response?: number | null;
  satiety_score?: number | null;
  protein_quality?: number | null;
};

interface MealItem {
  pk: string;
  sk: string;
  entity_type: 'meal_food_item';
  id: number;
  meal_id: number;
  food_id: number;
  grams: number;
  order: number;
}

interface TemplateItem {
  pk: string;
  sk: string;
  entity_type: 'meal_template_food_item';
  id: number;
  template_id: number;
  food_id: number;
  grams: number;
  order: number;
}

interface MealRecord {
  pk: string;
  sk: string;
  entity_type: 'meal';
  id: number;
  user_id: number;
  name: string;
  meal_type: string;
  date: string;
  logged_at: string | null;
  event_time: string | null;
  notes: string | null;
  source: 'manual' | 'ai_assisted';
}

interface MealTemplateRecord {
  pk: string;
  sk: string;
  entity_type: 'meal_template';
  id: number;
  user_id: number;
  name: string;
  category: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface FoodFields {
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
  glycemicIndex: number | null;
  absorptionSpeed: string | null;
  insulinResponse: number | null;
  satietyScore: number | null;
  proteinQuality: number | null;
  category: string | null;
}

type FoodInput = Partial<FoodFields>;

interface IngredientFields {
  foodId: number;
  grams: number;
  order: number;
}

interface MealFields {
  name: string;
  mealType: string;
  date: string | null;
  loggedAt: string | null;
  eventTime: string | null;
  notes: string | null;
  source: string | null;
}

interface TemplateFields {
  name: string;
  category: string | null;
  notes: string | null;
}

interface RecordPayload<Fields extends object> {
  fields: Partial<Fields>;
  items?: Array<Omit<IngredientFields, 'foodId'> & { foodId: number }>;
}

const mealTypes = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'post_workout',
  'beverage',
]);

const mealSources = new Set(['manual', 'ai_assisted']);
const foodCategories = new Set(['carb', 'protein', 'fat', 'mixed', 'beverage']);

function assertJsonObject(data: unknown): JsonObject {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new HttpError(400, { detail: ['Invalid request body.'] });
  }
  return data as JsonObject;
}

function addError(errors: JsonObject, field: string, message: string): void {
  const existing = errors[field];
  if (Array.isArray(existing)) existing.push(message);
  else errors[field] = [message];
}

function fail(errors: JsonObject): never {
  throw new ValidationFailure(errors);
}

function parsedNumber(value: unknown): number | undefined {
  const converted = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
  return typeof converted === 'number' && Number.isFinite(converted)
    ? converted
    : undefined;
}

function decimal(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  options: { minimum: number; maximum?: number } = { minimum: 0 },
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
  let valid = true;
  if (value < options.minimum) {
    addError(
      errors,
      field,
      `Ensure this value is greater than or equal to ${options.minimum}.`,
    );
    valid = false;
  }
  if (options.maximum !== undefined && Math.abs(value) >= options.maximum) {
    addError(
      errors,
      field,
      'Ensure that there are no more than 10 digits in total.',
    );
    valid = false;
  }
  return valid ? Math.round((value + Number.EPSILON) * 100) / 100 : undefined;
}

function optionalDecimal(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  maximum = 100_000_000,
): number | null | undefined {
  if (!(field in input)) return undefined;
  if (input[field] === null) return null;
  return decimal(errors, { [field]: input[field] }, field, { minimum: 0, maximum });
}

function requiredInteger(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  minimum: number,
): number | undefined {
  const value = decimal(errors, input, field, { minimum });
  if (value === undefined || Number.isSafeInteger(value)) return value;
  addError(errors, field, 'A valid integer is required.');
  return undefined;
}

function optionalInteger(
  errors: JsonObject,
  input: JsonObject,
  field: string,
): number | null | undefined {
  if (!(field in input)) return undefined;
  if (input[field] === null) return null;
  return requiredInteger(errors, { [field]: input[field] }, field, -Number.MAX_SAFE_INTEGER);
}

function requiredString(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  maxLength?: number,
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
  if (value.trim().length === 0) {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
    return undefined;
  }
  return value;
}

function optionalText(
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
  if (maxLength !== undefined && value.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
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
  const value = requiredString(errors, input, field);
  if (value === undefined) return undefined;
  if (!choices.has(value)) {
    addError(errors, field, `"${value}" is not a valid choice.`);
    return undefined;
  }
  return value;
}

function optionalChoice(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  choices: ReadonlySet<string>,
  allowNull = false,
): string | null | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null && allowNull) return null;
  if (value === '') return allowNull ? null : undefined;
  const validated = requiredChoice(
    errors,
    { [field]: value },
    field,
    choices,
  );
  return validated;
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return value;
}

function parseDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, hour, minute, second = '00'] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    return null;
  }
  return `${hour}:${minute}:${second}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numeric(value: number | null | undefined): number | null {
  return value ?? null;
}

export function foodResponse(item: NutritionFoodItem): Record<string, unknown> {
  return {
    id: item.id,
    user: item.user_id ?? null,
    name: item.name,
    brand: item.brand ?? null,
    barcode: item.barcode ?? null,
    source: item.source,
    servingSize: numeric(item.serving_size),
    servingType: item.serving_unit,
    calories: numeric(item.calories),
    protein: numeric(item.protein),
    carbs: numeric(item.carbs),
    fat: numeric(item.fat),
    saturatedFat: numeric(item.saturated_fat),
    fiber: numeric(item.fiber),
    sugar: numeric(item.sugar),
    sodium: numeric(item.sodium),
    glycemicIndex: item.glycemic_index ?? null,
    absorptionSpeed: item.absorption_speed ?? null,
    satietyScore: item.satiety_score ?? null,
    proteinQuality: item.protein_quality ?? null,
    insulinResponse: numeric(item.insulin_response),
    category: item.category ?? null,
  };
}

function validateFood(data: unknown, partial: boolean): FoodInput {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const result: FoodInput = {};

  const assign = <Key extends keyof FoodFields>(
    key: Key,
    value: FoodFields[Key] | undefined,
  ): void => {
    if (value !== undefined) result[key] = value;
  };

  assign('name', partial && !('name' in input)
    ? undefined
    : requiredString(errors, input, 'name', 255));
  assign('brand', optionalText(errors, input, 'brand', 255));
  assign('barcode', optionalText(errors, input, 'barcode', 255));
  assign('servingSize', partial && !('servingSize' in input')
    ? undefined
    : decimal(errors, input, 'servingSize', { minimum: 0.01, maximum: 100_000_000 }));
  assign('servingType', partial && !('servingType' in input')
    ? undefined
    : requiredString(errors, input, 'servingType', 50));
  for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
    assign(field, partial && !(field in input)
      ? undefined
      : decimal(errors, input, field, { minimum: 0, maximum: 100_000_000 }));
  }
  for (const field of ['saturatedFat', 'fiber', 'sugar', 'sodium'] as const) {
    assign(field, optionalDecimal(errors, input, field));
  }
  for (const field of ['glycemicIndex', 'satietyScore', 'proteinQuality'] as const) {
    assign(field, optionalInteger(errors, input, field));
  }
  assign('insulinResponse', optionalDecimal(errors, input, 'insulinResponse', 1_000));
  const absorption = optionalText(errors, input, 'absorptionSpeed', 20);
  if (absorption !== undefined && absorption !== null && absorption.trim().length === 0) {
    addError(errors, 'absorptionSpeed', 'This field may not be blank.');
  } else {
    assign('absorptionSpeed', absorption);
  }
  assign('category', optionalChoice(errors, input, 'category', foodCategories, true));
  fail(errors);
  return result;
}

async function accessibleFoodMap(
  repository: FitnessRepository,
  userId: number,
): Promise<Map<number, NutritionFoodItem>> {
  const [canonical, owned] = await Promise.all([
    repository.queryPartition<NutritionFoodItem>({
      partitionKey: 'CANONICAL_FOODS',
      sortPrefix: 'FOOD#',
    }),
    repository.queryPartition<NutritionFoodItem>({
      partitionKey: `USER#${userId}`,
      sortPrefix: 'FOOD#',
    }),
  ]);
  return new Map([...canonical, ...owned].map((food) => [food.id, food]));
}

async function loadVisibleFood(
  context: RouteContext,
  id: number,
): Promise<NutritionFoodItem | undefined> {
  const authorization = context.request.headers.authorization;
  if (!authorization) {
    return context.repository.get<NutritionFoodItem>({
      pk: 'CANONICAL_FOODS',
      sk: `FOOD#${id}`,
    });
  }
  const user = await context.requireUser();
  const [owned, canonical] = await Promise.all([
    context.repository.get<NutritionFoodItem>({
      pk: `USER#${user.id}`,
      sk: `FOOD#${id}`,
    }),
    context.repository.get<NutritionFoodItem>({
      pk: 'CANONICAL_FOODS',
      sk: `FOOD#${id}`,
    }),
  ]);
  return owned ?? canonical;
}

async function createFood(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = validateFood(context.request.body, false);
  const id = await context.repository.nextId('food');
  const food: NutritionFoodItem = {
    pk: `USER#${user.id}`,
    sk: `FOOD#${id}`,
    entity_type: 'food_item',
    id,
    user_id: user.id,
    name: input.name ?? '',
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    source: 'user',
    serving_size: input.servingSize ?? 0,
    serving_unit: input.servingType ?? '',
    calories: input.calories ?? 0,
    protein: input.protein ?? 0,
    carbs: input.carbs ?? 0,
    fat: input.fat ?? 0,
    saturated_fat: input.saturatedFat ?? null,
    fiber: input.fiber ?? null,
    sugar: input.sugar ?? null,
    sodium: input.sodium ?? null,
    category: input.category ?? null,
    glycemic_index: input.glycemicIndex ?? null,
    absorption_speed: input.absorptionSpeed ?? null,
    insulin_response: input.insulinResponse ?? null,
    satiety_score: input.satietyScore ?? null,
    protein_quality: input.proteinQuality ?? null,
  };
  await context.repository.putNewItemsTransactionally([food]);
  return jsonResponse(201, foodResponse(food), context.cors);
}

function mergeFood(
  existing: NutritionFoodItem,
  input: FoodInput,
): NutritionFoodItem {
  return {
    ...existing,
    name: input.name ?? existing.name,
    brand: input.brand === undefined ? existing.brand ?? null : input.brand,
    barcode: input.barcode === undefined ? existing.barcode ?? null : input.barcode,
    serving_size: input.servingSize ?? existing.serving_size,
    serving_unit: input.servingType ?? existing.serving_unit,
    calories: input.calories ?? existing.calories,
    protein: input.protein ?? existing.protein,
    carbs: input.carbs ?? existing.carbs,
    fat: input.fat ?? existing.fat,
    saturated_fat: input.saturatedFat === undefined
      ? existing.saturated_fat ?? null
      : input.saturatedFat,
    fiber: input.fiber === undefined ? existing.fiber ?? null : input.fiber,
    sugar: input.sugar === undefined ? existing.sugar ?? null : input.sugar,
    sodium: input.sodium === undefined ? existing.sodium ?? null : input.sodium,
    category: input.category === undefined ? existing.category ?? null : input.category,
    glycemic_index: input.glycemicIndex === undefined
      ? existing.glycemic_index ?? null
      : input.glycemicIndex,
    absorption_speed: input.absorptionSpeed === undefined
      ? existing.absorption_speed ?? null
      : input.absorptionSpeed,
    insulin_response: input.insulinResponse === undefined
      ? existing.insulin_response ?? null
      : input.insulinResponse,
    satiety_score: input.satietyScore === undefined
      ? existing.satiety_score ?? null
      : input.satietyScore,
    protein_quality: input.proteinQuality === undefined
      ? existing.protein_quality ?? null
      : input.proteinQuality,
  };
}

async function updateFood(
  context: RouteContext,
  id: number,
  partial: boolean,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const existing = await loadVisibleFood(context, id);
  if (!existing || existing.user_id === null || existing.user_id !== user.id) {
    if (existing?.user_id === null) {
      throw new HttpError(403, {
        error: 'Only the food owner can modify this item.',
      });
    }
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const input = validateFood(context.request.body, partial);
  const updated = mergeFood(existing, input);
  await context.repository.put(updated);
  return jsonResponse(200, foodResponse(updated), context.cors);
}

async function destroyFood(context: RouteContext, id: number): Promise<ApiResponse> {
  const user = await context.requireUser();
  const existing = await loadVisibleFood(context, id);
  if (!existing || existing.user_id === null || existing.user_id !== user.id) {
    if (existing?.user_id === null) {
      throw new HttpError(403, {
        error: 'Only the food owner can modify this item.',
      });
    }
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const related = await context.repository.scan<MealItem | TemplateItem>({
    FilterExpression: 'food_id = :foodId AND (#entity = :meal OR #entity = :template)',
    ExpressionAttributeNames: { '#entity': 'entity_type' },
    ExpressionAttributeValues: {
      ':foodId': id,
      ':meal': 'meal_food_item',
      ':template': 'meal_template_food_item',
    },
  });
  await context.repository.deleteAllTransactionally([
    { pk: existing.pk, sk: existing.sk },
    ...related.map((item) => ({ pk: item.pk, sk: item.sk })),
  ]);
  return emptyResponse(204, context.cors);
}

async function listFoods(context: RouteContext): Promise<ApiResponse> {
  const authorization = context.request.headers.authorization;
  const user = authorization ? await context.requireUser() : undefined;
  const foods = user
    ? await accessibleFoodMap(context.repository, user.id)
    : new Map((await context.repository.queryPartition<NutritionFoodItem>({
        partitionKey: 'CANONICAL_FOODS',
        sortPrefix: 'FOOD#',
      })).map((food) => [food.id, food]));
  const visible = [...foods.values()].sort((left, right) => left.id - right.id);
  return jsonResponse(200, visible.map(foodResponse), context.cors);
}

function validateIngredients(
  entries: unknown[],
  foods: Map<number, NutritionFoodItem>,
): Array<Omit<IngredientFields, 'foodId'> & { foodId: number }> {
  const errors = entries.map(() => ({}) as JsonObject);
  const parsedFoodIds: Array<number | undefined> = [];
  const items = entries.map((entry, index) => {
    const itemErrors = errors[index];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(itemErrors, 'non_field_errors', 'Invalid data. Expected a dictionary.');
      parsedFoodIds.push(undefined);
      return undefined;
    }
    const input = entry as JsonObject;
    const rawFoodId = requiredInteger(itemErrors, input, 'foodId', 1);
    parsedFoodIds.push(rawFoodId);
    if (
      rawFoodId !== undefined &&
      (!Number.isSafeInteger(rawFoodId) || !foods.has(rawFoodId))
    ) {
      addError(itemErrors, 'foodId', `Invalid pk "${rawFoodId}" - object does not exist.`);
    }
    const grams = decimal(itemErrors, input, 'grams', {
      minimum: 0.01,
      maximum: 100_000_000,
    });
    const order = 'order' in input && input.order !== null
      ? requiredInteger(itemErrors, input, 'order', -Number.MAX_SAFE_INTEGER)
      : undefined;
    if (Object.keys(itemErrors).length > 0) return undefined;
    return {
      foodId: rawFoodId as number,
      grams: grams as number,
      ...(order === undefined ? {} : { order }),
    };
  });

  if (errors.some((itemErrors) => Object.keys(itemErrors).length > 0)) {
    fail({ food_items: errors });
  }
  return items.map((item, index) => ({
    foodId: item?.foodId ?? parsedFoodIds[index] as number,
    grams: item?.grams ?? 0,
    order: item?.order ?? index,
  }));
}

function validateMealFields(
  input: JsonObject,
  errors: JsonObject,
  partial: boolean,
): Partial<MealFields> {
  const result: Partial<MealFields> = {};
  const assign = <Key extends keyof MealFields>(
    key: Key,
    value: MealFields[Key] | undefined,
  ): void => {
    if (value !== undefined) result[key] = value;
  };
  assign('name', partial && !('name' in input)
    ? undefined
    : requiredString(errors, input, 'name', 255));
  assign('mealType', partial && !('mealType' in input')
    ? undefined
    : requiredString(errors, input, 'mealType', 20));
  if ('date' in input) {
    if (input.date === null) result.date = null;
    else {
      const date = parseIsoDate(input.date);
      if (date === null) addError(errors, 'date', 'Date has wrong format.');
      else result.date = date;
    }
  }
  if ('loggedAt' in input) {
    if (input.loggedAt === null) {
      addError(errors, 'loggedAt', 'This field may not be null.');
    } else {
      const parsed = parseDateTime(input.loggedAt);
      if (parsed === null) addError(errors, 'loggedAt', 'Datetime has wrong format.');
      else result.loggedAt = parsed.toISOString();
    }
  }
  if ('eventTime' in input) {
    if (input.eventTime === null) result.eventTime = null;
    else {
      const time = parseTime(input.eventTime);
      if (time === null) addError(errors, 'eventTime', 'Time has wrong format.');
      else result.eventTime = time;
    }
  }
  assign('notes', optionalText(errors, input, 'notes'));
  if ('source' in input) {
    const source = optionalChoice(errors, input, 'source', mealSources);
    if (source !== undefined) result.source = source;
  }
  return result;
}

function validateTemplateFields(
  input: JsonObject,
  errors: JsonObject,
  partial: boolean,
): Partial<TemplateFields> {
  const result: Partial<TemplateFields> = {};
  const assign = <Key extends keyof TemplateFields>(
    key: Key,
    value: TemplateFields[Key] | undefined,
  ): void => {
    if (value !== undefined) result[key] = value;
  };
  assign('name', partial && !('name' in input)
    ? undefined
    : requiredString(errors, input, 'name', 255));
  assign('category', partial && !('category' in input')
    ? undefined
    : requiredChoice(errors, input, 'category', mealTypes));
  assign('notes', optionalText(errors, input, 'notes'));
  return result;
}

function prepareRecordPayload<Fields extends object>(
  data: unknown,
  partial: boolean,
  foods: Map<number, NutritionFoodItem>,
  validateFields: (
    input: JsonObject,
    errors: JsonObject,
    partial: boolean,
  ) => Partial<Fields>,
): RecordPayload<Fields> {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const fields = validateFields(input, errors, partial);
  let items: ReturnType<typeof validateIngredients> | undefined;
  if ('food_items' in input) {
    if (!Array.isArray(input.food_items)) {
      addError(errors, 'food_items', 'Expected a list of items but got type other.');
    } else {
      items = validateIngredients(input.food_items, foods);
    }
  } else if (!partial) {
    items = [];
  }
  fail(errors);
  return { fields, items };
}

function mealResponse(
  meal: MealRecord,
  items: MealItem[],
  foods: Map<number, NutritionFoodItem>,
): Record<string, unknown> {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    const food = foods.get(item.food_id);
    if (!food || food.serving_size <= 0) continue;
    const multiplier = item.grams / food.serving_size;
    totals.calories += food.calories * multiplier;
    totals.protein += food.protein * multiplier;
    totals.carbs += food.carbs * multiplier;
    totals.fat += food.fat * multiplier;
  }
  return {
    id: meal.id,
    name: meal.name,
    mealType: meal.meal_type,
    date: meal.date,
    loggedAt: meal.logged_at,
    eventTime: meal.event_time,
    notes: meal.notes,
    source: meal.source,
    food_items: [...items]
      .sort((left, right) => left.id - right.id)
      .map((item) => ({
        id: item.id,
        foodId: item.food_id,
        grams: numeric(item.grams),
        order: item.order,
      })),
    totalCalories: round2(totals.calories),
    totalProtein: round2(totals.protein),
    totalCarbs: round2(totals.carbs),
    totalFat: round2(totals.fat),
  };
}

function templateResponse(
  template: MealTemplateRecord,
  items: TemplateItem[],
): Record<string, unknown> {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    notes: template.notes,
    food_items: [...items]
      .sort((left, right) => left.id - right.id)
      .map((item) => ({
        id: item.id,
        foodId: item.food_id,
        grams: numeric(item.grams),
        order: item.order,
      })),
  };
}

async function mealItems(
  repository: FitnessRepository,
  mealIds: readonly number[],
): Promise<MealItem[]> {
  const chunks: number[][] = [];
  for (let offset = 0; offset < mealIds.length; offset += 100) {
    chunks.push(mealIds.slice(offset, offset + 100));
  }
  const groups = await Promise.all(chunks.map((ids) => {
    const values: Record<string, unknown> = { ':type': 'meal_food_item' };
    const placeholders = ids.map((id, index) => {
      values[`:meal${index}`] = id;
      return `:meal${index}`;
    });
    return repository.scan<MealItem>({
      FilterExpression: `entity_type = :type AND meal_id IN (${placeholders.join(', ')})`,
      ExpressionAttributeValues: values,
    });
  }));
  return groups.flat();
}

async function templateItems(
  repository: FitnessRepository,
  templateIds: readonly number[],
): Promise<TemplateItem[]> {
  const chunks: number[][] = [];
  for (let offset = 0; offset < templateIds.length; offset += 100) {
    chunks.push(templateIds.slice(offset, offset + 100));
  }
  const groups = await Promise.all(chunks.map((ids) => {
    const values: Record<string, unknown> = { ':type': 'meal_template_food_item' };
    const placeholders = ids.map((id, index) => {
      values[`:template${index}`] = id;
      return `:template${index}`;
    });
    return repository.scan<TemplateItem>({
      FilterExpression: `entity_type = :type AND template_id IN (${placeholders.join(', ')})`,
      ExpressionAttributeValues: values,
    });
  }));
  return groups.flat();
}

async function userMeals(
  repository: FitnessRepository,
  userId: number,
): Promise<MealRecord[]> {
  const meals = await repository.queryPartition<MealRecord>({
    partitionKey: `USER#${userId}`,
    sortPrefix: 'MEAL#',
  });
  return meals.filter((meal) => meal.entity_type === 'meal')
    .sort((left, right) => left.id - right.id);
}

async function userTemplates(
  repository: FitnessRepository,
  userId: number,
): Promise<MealTemplateRecord[]> {
  const templates = await repository.queryPartition<MealTemplateRecord>({
    partitionKey: `USER#${userId}`,
    sortPrefix: 'MEAL_TEMPLATE#',
  });
  return templates.filter((template) => template.entity_type === 'meal_template')
    .sort((left, right) => left.id - right.id);
}

async function createMeal(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const foods = await accessibleFoodMap(context.repository, user.id);
  const payload = prepareRecordPayload(context.request.body, false, foods, validateMealFields);
  const now = new Date().toISOString();
  const providedLoggedAt = payload.fields.loggedAt;
  const date = payload.fields.date ??
    (providedLoggedAt ? providedLoggedAt.slice(0, 10) : now.slice(0, 10));
  const mealId = await context.repository.nextId('meal');
  const itemIds = await Promise.all(payload.items!.map(() =>
    context.repository.nextId('meal_food_item')));
  const meal: MealRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL#${mealId}`,
    entity_type: 'meal',
    id: mealId,
    user_id: user.id,
    name: payload.fields.name ?? '',
    meal_type: payload.fields.mealType ?? '',
    date,
    logged_at: now,
    event_time: payload.fields.eventTime ?? null,
    notes: payload.fields.notes ?? null,
    source: (payload.fields.source ?? 'manual') as MealRecord['source'],
  };
  const items = payload.items!.map((item, index) => ({
    pk: `MEAL#${mealId}`,
    sk: `MEAL_FOOD_ITEM#${itemIds[index]}`,
    entity_type: 'meal_food_item' as const,
    id: itemIds[index],
    meal_id: mealId,
    food_id: item.foodId,
    grams: item.grams,
    order: item.order ?? index,
  }));
  await context.repository.putNewItemsTransactionally([meal, ...items]);
  return jsonResponse(201, mealResponse(meal, items, foods), context.cors);
}

async function createTemplate(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const foods = await accessibleFoodMap(context.repository, user.id);
  const payload = prepareRecordPayload(
    context.request.body,
    false,
    foods,
    validateTemplateFields,
  );
  const now = new Date().toISOString();
  const templateId = await context.repository.nextId('meal_template');
  const itemIds = await Promise.all(payload.items!.map(() =>
    context.repository.nextId('meal_template_food_item')));
  const template: MealTemplateRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL_TEMPLATE#${templateId}`,
    entity_type: 'meal_template',
    id: templateId,
    user_id: user.id,
    name: payload.fields.name ?? '',
    category: payload.fields.category ?? '',
    notes: payload.fields.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  const items = payload.items!.map((item, index) => ({
    pk: `MEAL_TEMPLATE#${templateId}`,
    sk: `TEMPLATE_FOOD_ITEM#${itemIds[index]}`,
    entity_type: 'meal_template_food_item' as const,
    id: itemIds[index],
    template_id: templateId,
    food_id: item.foodId,
    grams: item.grams,
    order: item.order ?? index,
  }));
  await context.repository.putNewItemsTransactionally([template, ...items]);
  return jsonResponse(201, templateResponse(template, items), context.cors);
}

async function loadOwnMeal(
  context: RouteContext,
  userId: number,
  id: number,
): Promise<{ meal: MealRecord; items: MealItem[] }> {
  const meal = await context.repository.get<MealRecord>({
    pk: `USER#${userId}`,
    sk: `MEAL#${id}`,
  });
  if (!meal || meal.entity_type !== 'meal') {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const items = await context.repository.queryPartition<MealItem>({
    partitionKey: `MEAL#${id}`,
    sortPrefix: 'MEAL_FOOD_ITEM#',
  });
  return { meal, items };
}

async function loadOwnTemplate(
  context: RouteContext,
  userId: number,
  id: number,
): Promise<{ template: MealTemplateRecord; items: TemplateItem[] }> {
  const template = await context.repository.get<MealTemplateRecord>({
    pk: `USER#${userId}`,
    sk: `MEAL_TEMPLATE#${id}`,
  });
  if (!template || template.entity_type !== 'meal_template') {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  const items = await context.repository.queryPartition<TemplateItem>({
    partitionKey: `MEAL_TEMPLATE#${id}`,
    sortPrefix: 'TEMPLATE_FOOD_ITEM#',
  });
  return { template, items };
}

async function updateMeal(
  context: RouteContext,
  id: number,
  partial: boolean,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const { meal, items } = await loadOwnMeal(context, user.id, id);
  const foods = await accessibleFoodMap(context.repository, user.id);
  const payload = prepareRecordPayload(context.request.body, partial, foods, validateMealFields);
  const updated: MealRecord = {
    ...meal,
    name: payload.fields.name ?? meal.name,
    meal_type: payload.fields.mealType ?? meal.meal_type,
    date: payload.fields.date ?? meal.date,
    logged_at: payload.fields.loggedAt ?? meal.logged_at,
    event_time: payload.fields.eventTime === undefined
      ? meal.event_time
      : payload.fields.eventTime,
    notes: payload.fields.notes === undefined ? meal.notes : payload.fields.notes,
    source: ((payload.fields.source ?? meal.source) as MealRecord['source']),
  };
  if (payload.items === undefined) {
    await context.repository.put(updated);
    return jsonResponse(200, mealResponse(updated, items, foods), context.cors);
  }
  const itemIds = await Promise.all(payload.items.map(() =>
    context.repository.nextId('meal_food_item')));
  const replacementItems = payload.items.map((item, index) => ({
    pk: `MEAL#${id}`,
    sk: `MEAL_FOOD_ITEM#${itemIds[index]}`,
    entity_type: 'meal_food_item' as const,
    id: itemIds[index],
    meal_id: id,
    food_id: item.foodId,
    grams: item.grams,
    order: item.order ?? index,
  }));
  await context.repository.transact([
    { Put: { TableName: context.config.tableName, Item: updated } },
    ...items.map((item) => ({
      Delete: { TableName: context.config.tableName, Key: { pk: item.pk, sk: item.sk } },
    })),
    ...replacementItems.map((item) => ({
      Put: {
        TableName: context.config.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })),
  ]);
  return jsonResponse(200, mealResponse(updated, replacementItems, foods), context.cors);
}

async function updateTemplate(
  context: RouteContext,
  id: number,
  partial: boolean,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const { template, items } = await loadOwnTemplate(context, user.id, id);
  const foods = await accessibleFoodMap(context.repository, user.id);
  const payload = prepareRecordPayload(
    context.request.body,
    partial,
    foods,
    validateTemplateFields,
  );
  const now = new Date().toISOString();
  const updated: MealTemplateRecord = {
    ...template,
    name: payload.fields.name ?? template.name,
    category: payload.fields.category ?? template.category,
    notes: payload.fields.notes === undefined ? template.notes : payload.fields.notes,
    updated_at: now,
  };
  if (payload.items === undefined) {
    await context.repository.put(updated);
    return jsonResponse(200, templateResponse(updated, items), context.cors);
  }
  const itemIds = await Promise.all(payload.items.map(() =>
    context.repository.nextId('meal_template_food_item')));
  const replacementItems = payload.items.map((item, index) => ({
    pk: `MEAL_TEMPLATE#${id}`,
    sk: `TEMPLATE_FOOD_ITEM#${itemIds[index]}`,
    entity_type: 'meal_template_food_item' as const,
    id: itemIds[index],
    template_id: id,
    food_id: item.foodId,
    grams: item.grams,
    order: item.order ?? index,
  }));
  await context.repository.transact([
    { Put: { TableName: context.config.tableName, Item: updated } },
    ...items.map((item) => ({
      Delete: { TableName: context.config.tableName, Key: { pk: item.pk, sk: item.sk } },
    })),
    ...replacementItems.map((item) => ({
      Put: {
        TableName: context.config.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })),
  ]);
  return jsonResponse(200, templateResponse(updated, replacementItems), context.cors);
}

async function destroyMeal(context: RouteContext, id: number): Promise<ApiResponse> {
  const user = await context.requireUser();
  const { meal, items } = await loadOwnMeal(context, user.id, id);
  await context.repository.deleteAllTransactionally([
    { pk: meal.pk, sk: meal.sk },
    ...items.map((item) => ({ pk: item.pk, sk: item.sk })),
  ]);
  return emptyResponse(204, context.cors);
}

async function destroyTemplate(context: RouteContext, id: number): Promise<ApiResponse> {
  const user = await context.requireUser();
  const { template, items } = await loadOwnTemplate(context, user.id, id);
  await context.repository.deleteAllTransactionally([
    { pk: template.pk, sk: template.sk },
    ...items.map((item) => ({ pk: item.pk, sk: item.sk })),
  ]);
  return emptyResponse(204, context.cors);
}

function macroRequest(data: unknown): JsonObject & Record<string, number> {
  const input = assertJsonObject(data);
  const errors: JsonObject = {};
  const result: Record<string, number> = {};
  for (const field of ['protein_g', 'carbs_g', 'fat_g'] as const) {
    const value = field in input
      ? decimal(errors, input, field, { minimum: 0, maximum: 100_000_000 })
      : 0;
    if (value !== undefined) result[field] = value;
  }
  const fiber = 'fiber_g' in input
    ? decimal(errors, input, 'fiber_g', { minimum: 0, maximum: 100_000_000 })
    : 0;
  if (fiber !== undefined) result.fiber_g = fiber;
  const foodType = 'food_type' in input ? input.food_type : '';
  if (typeof foodType !== 'string') {
    addError(errors, 'food_type', 'A valid string is required.');
  } else if (foodType.length > 255) {
    addError(errors, 'food_type', 'Ensure this field has no more than 255 characters.');
  } else {
    result.food_type = foodType;
  }
  fail(errors);
  return result as JsonObject & Record<string, number>;
}

function metabolismResponse(input: Record<string, number>): Record<string, string> {
  const total = input.protein_g + input.carbs_g + input.fat_g;
  const foodType = input.food_type.toLowerCase();
  let glycemicIndex: string;
  if (input.carbs_g > 0 && input.fiber_g > 0) {
    glycemicIndex = input.fiber_g >= 5
      ? 'low'
      : input.fiber_g >= 3
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
  const thermicEffect = input.protein_g > total * 0.3
    ? 'high'
    : input.protein_g > total * 0.15
      ? 'medium'
      : 'low';
  let score = 0;
  if (input.protein_g > total * 0.2) score += 3;
  if (input.fiber_g >= 5) score += 3;
  else if (input.fiber_g >= 3) score += 2;
  else if (input.fiber_g > 0) score += 1;
  if (input.fat_g > total * 0.2) score += 2;
  const satietyLevel = score >= 6
    ? 'very_high'
    : score >= 4
      ? 'high'
      : score >= 2
        ? 'moderate'
        : 'low';
  return {
    glycemic_index: glycemicIndex,
    absorption_speed: absorptionSpeed,
    thermic_effect: thermicEffect,
    satiety_level: satietyLevel,
  };
}

async function calculateNutrition(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = assertJsonObject(context.request.body);
  if (!Array.isArray(input.food_items)) {
    fail({ food_items: ['Expected a list of items but got type other.'] });
  }
  const entries = input.food_items as unknown[];
  if (entries.length > 200) {
    fail({ food_items: ['Ensure this field has no more than 200 elements.'] });
  }
  const errors = entries.map(() => ({}) as JsonObject);
  const requests = entries.map((entry, index) => {
    const itemErrors = errors[index];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(itemErrors, 'non_field_errors', 'Invalid data. Expected a dictionary.');
      return { food_id: 0, grams: 0 };
    }
    const itemInput = entry as JsonObject;
    const foodId = requiredInteger(itemErrors, itemInput, 'food_id', 1);
    const grams = decimal(itemErrors, itemInput, 'grams', {
      minimum: 0.01,
      maximum: 100_000_000,
    });
    return { food_id: foodId ?? 0, grams: grams ?? 0 };
  });
  if (errors.some((itemErrors) => Object.keys(itemErrors).length > 0)) {
    fail({ food_items: errors });
  }

  const foods = await accessibleFoodMap(context.repository, user.id);
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
    const food = foods.get(request.food_id);
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

function invalidDate(): HttpError {
  return new HttpError(400, {
    error: 'Invalid date format. Use YYYY-MM-DD',
  });
}

export function registerNutritionRoutes(
  addRoute: (route: RouteDefinition) => void,
): void {
  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-calories',
    handle: async (context) => {
      const input = macroRequest(context.request.body);
      return jsonResponse(200, {
        calories: round2(input.protein_g * 4 + input.carbs_g * 4 + input.fat_g * 9),
        protein_g: input.protein_g,
        carbs_g: input.carbs_g,
        fat_g: input.fat_g,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/detect-category',
    handle: async (context) => {
      const input = macroRequest(context.request.body);
      const total = input.protein_g + input.carbs_g + input.fat_g;
      const category = total === 0
        ? 'unknown'
        : input.protein_g > total * 0.4
          ? 'protein'
          : input.carbs_g > total * 0.5
            ? 'carb'
            : input.fat_g > total * 0.5
              ? 'fat'
              : 'balanced';
      return jsonResponse(200, {
        category,
        protein_ratio: total === 0 ? 0 : input.protein_g / total,
        carb_ratio: total === 0 ? 0 : input.carbs_g / total,
        fat_ratio: total === 0 ? 0 : input.fat_g / total,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/infer-metabolism',
    handle: async (context) => jsonResponse(
      200,
      metabolismResponse(macroRequest(context.request.body)),
      context.cors,
    ),
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-nutrition',
    authRequired: true,
    authBeforeMethod: true,
    handle: calculateNutrition,
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/foods',
    handle: async (context) => context.request.method === 'GET'
      ? listFoods(context)
      : createFood(context),
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/foods/:id',
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        const food = await loadVisibleFood(context, id);
        if (!food) throw new HttpError(404, { detail: 'Not found.' });
        return jsonResponse(200, foodResponse(food), context.cors);
      }
      if (context.request.method === 'DELETE') return destroyFood(context, id);
      return updateFood(context, id, context.request.method === 'PATCH');
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/date/:date_str:text',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const dateString = params.date_str as string;
      const date = parseIsoDate(dateString);
      if (!date) throw invalidDate();
      const user = await context.requireUser();
      const meals = (await userMeals(context.repository, user.id))
        .filter((meal) => meal.date === date);
      const [items, foods] = await Promise.all([
        mealItems(context.repository, meals.map((meal) => meal.id)),
        accessibleFoodMap(context.repository, user.id),
      ]);
      return jsonResponse(200, meals.map((meal) => mealResponse(
        meal,
        items.filter((item) => item.meal_id === meal.id),
        foods,
      )), context.cors);
    },
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/daily/totals/:date_str:text',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const dateString = params.date_str as string;
      const date = parseIsoDate(dateString);
      if (!date) throw invalidDate();
      const user = await context.requireUser();
      const meals = (await userMeals(context.repository, user.id))
        .filter((meal) => meal.date === date);
      const [items, foods] = await Promise.all([
        mealItems(context.repository, meals.map((meal) => meal.id)),
        accessibleFoodMap(context.repository, user.id),
      ]);
      const totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      };
      for (const item of items) {
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
      return jsonResponse(200, {
        date: dateString,
        calories: totals.calories,
        protein_g: totals.protein,
        carbs_g: totals.carbs,
        fat_g: totals.fat,
        fiber_g: totals.fiber,
        sugar_g: totals.sugar,
        sodium_mg: totals.sodium,
      }, context.cors);
    },
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/meals',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const user = await context.requireUser();
      if (context.request.method === 'POST') return createMeal(context);
      const meals = await userMeals(context.repository, user.id);
      const [items, foods] = await Promise.all([
        mealItems(context.repository, meals.map((meal) => meal.id)),
        accessibleFoodMap(context.repository, user.id),
      ]);
      return jsonResponse(200, meals.map((meal) => mealResponse(
        meal,
        items.filter((item) => item.meal_id === meal.id),
        foods,
      )), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/meals/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'DELETE') return destroyMeal(context, id);
      if (context.request.method === 'GET') {
        const user = await context.requireUser();
        const { meal, items } = await loadOwnMeal(context, user.id, id);
        const foods = await accessibleFoodMap(context.repository, user.id);
        return jsonResponse(200, mealResponse(meal, items, foods), context.cors);
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
      if (context.request.method === 'POST') return createTemplate(context);
      const templates = await userTemplates(context.repository, user.id);
      const items = await templateItems(
        context.repository,
        templates.map((template) => template.id),
      );
      return jsonResponse(200, templates.map((template) => templateResponse(
        template,
        items.filter((item) => item.template_id === template.id),
      )), context.cors);
    },
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/templates/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'DELETE') return destroyTemplate(context, id);
      if (context.request.method === 'GET') {
        const user = await context.requireUser();
        const { template, items } = await loadOwnTemplate(context, user.id, id);
        return jsonResponse(200, templateResponse(template, items), context.cors);
      }
      return updateTemplate(context, id, context.request.method === 'PATCH');
    },
  });
}
