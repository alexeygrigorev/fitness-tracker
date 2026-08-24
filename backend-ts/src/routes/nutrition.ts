import { emptyResponse, jsonResponse } from '../http.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';
import type {
  FoodCategory,
  FoodItemRecord,
  JsonObject,
  MealRecord,
  MealSource,
  MealTemplateRecord,
  NestedFoodItemRecord,
} from '../types.js';
import { HttpError } from '../types.js';
import { ValidationFailure } from '../validation.js';

const FOOD_CATEGORIES: ReadonlySet<string> = new Set([
  'carb', 'protein', 'fat', 'mixed', 'beverage',
]);
const MEAL_TYPES: ReadonlySet<string> = new Set([
  'breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'beverage',
]);
const ABSORPTION_SPEEDS: ReadonlySet<string> = new Set([
  'slow', 'moderate', 'fast',
]);
const MEAL_SOURCES: ReadonlySet<string> = new Set(['manual', 'ai_assisted']);
const DECIMAL_LIMITS = {
  standard: 99_999_999.99,
  small: 999.99,
} as const;

interface FoodValues {
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  glycemic_index: number | null;
  absorption_speed: 'slow' | 'moderate' | 'fast' | null;
  insulin_response: number | null;
  satiety_score: number | null;
  protein_quality: number | null;
  category: FoodCategory | '' | null;
}

interface MealValues {
  name: string;
  meal_type: string;
  date: string;
  event_time: string | null;
  notes: string | null;
  source: MealSource;
}

interface TemplateValues {
  name: string;
  category: string;
  notes: string | null;
}

function bodyObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationFailure({ detail: ['Invalid request body.'] });
  }
  return value as JsonObject;
}

function addError(errors: JsonObject, field: string, message: string): void {
  const existing = errors[field];
  if (Array.isArray(existing)) {
    existing.push(message);
  } else {
    errors[field] = [message];
  }
}

function fail(errors: JsonObject): void {
  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure(errors);
  }
}

function decimal(
  errors: JsonObject,
  field: string,
  value: unknown,
  options: {
    allowNull?: boolean;
    min?: number;
    max?: number;
    maximumDigits?: number;
    fieldLabel?: string;
  } = {},
): number | null | undefined {
  if (value === null && options.allowNull) {
    return null;
  }
  let parsed = value;
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) {
      addError(errors, field, 'A valid number is required.');
      return undefined;
    }
    parsed = Number(trimmed);
  }
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    addError(errors, field, 'A valid number is required.');
    return undefined;
  }
  const raw = typeof value === 'string' ? value.trim() : String(value);
  const places = /\.(\d+)/.exec(raw)?.[1].length ?? 0;
  const maximumDigits = options.maximumDigits ?? 10;
  const minimum = options.min ?? -Infinity;
  const maximum = options.max ?? DECIMAL_LIMITS.standard;
  if (parsed < minimum) {
    addError(
      errors,
      field,
      `Ensure this value is greater than or equal to ${minimum}.`,
    );
  }
  if (parsed > maximum) {
    addError(
      errors,
      field,
      `Ensure this value is less than or equal to ${maximum}.`,
    );
  }
  if (places > 2) {
    addError(errors, field, `Ensure that there are no more than 2 decimal places.`);
  }
  const magnitudeLimit = DECIMAL_LIMITS[maximumDigits === 5 ? 'small' : 'standard'];
  if (Math.abs(parsed) > magnitudeLimit) {
    addError(
      errors,
      field,
      `Ensure that there are no more than ${maximumDigits} digits in total.`,
    );
  }
  return Number(parsed.toFixed(2));
}

function integer(
  errors: JsonObject,
  field: string,
  value: unknown,
  options: {
    allowNull?: boolean;
    choices?: readonly number[];
    max?: number;
    min?: number;
  } = {},
): number | null | undefined {
  if (value === null && options.allowNull) {
    return null;
  }
  if (!Number.isInteger(value)) {
    addError(errors, field, 'A valid integer is required.');
    return undefined;
  }
  const result = value as number;
  if (options.choices && !options.choices.includes(result)) {
    addError(errors, field, `"${result}" is not a valid choice.`);
    return undefined;
  }
  if (options.min !== undefined && result < options.min) {
    addError(
      errors,
      field,
      `Ensure this value is greater than or equal to ${options.min}.`,
    );
    return undefined;
  }
  if (options.max !== undefined && result > options.max) {
    addError(
      errors,
      field,
      `Ensure this value is less than or equal to ${options.max}.`,
    );
    return undefined;
  }
  if (Math.abs(result) > 2_147_483_647) {
    addError(errors, field, 'Integer value is out of range.');
    return undefined;
  }
  return result;
}

function nullableString(
  errors: JsonObject,
  field: string,
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  if (value.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
    return undefined;
  }
  return value === '' ? null : value;
}

function requiredText(
  errors: JsonObject,
  field: string,
  value: unknown,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
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

function choice(
  errors: JsonObject,
  field: string,
  value: unknown,
  choices: ReadonlySet<string>,
): string | undefined {
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

function optionalChoice(
  errors: JsonObject,
  field: string,
  value: unknown,
  choices: ReadonlySet<string>,
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined || value === '') {
    return '';
  }
  const selected = choice(errors, field, value, choices);
  return selected as FoodCategory | undefined;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function calendarDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function normalizedEventTime(
  errors: JsonObject,
  field: string,
  value: unknown,
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);
  const [, hour = '', minute = '', second = ''] = match ?? [];
  if (
    !match ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  const [, hour, minute, second] = match;
  return `${hour}:${minute}:${second || '00'}`;
}

function validateFood(
  data: JsonObject,
  existing?: FoodItemRecord,
): FoodValues {
  const errors: JsonObject = {};
  const isCreate = !existing;

  let name = existing?.name;
  if (isCreate || 'name' in data) {
    name = requiredText(errors, 'name', data.name, 255);
  }

  let brand = existing?.brand ?? null;
  if ('brand' in data) {
    brand = nullableString(errors, 'brand', data.brand, 255);
  }

  let barcode = existing?.barcode ?? null;
  if ('barcode' in data) {
    barcode = nullableString(errors, 'barcode', data.barcode, 255);
  }

  let servingSize = existing?.serving_size ?? 0;
  if (isCreate || 'servingSize' in data) {
    const value = decimal(errors, 'servingSize', data.servingSize);
    if (value !== undefined && value !== null && value <= 0) {
      addError(errors, 'servingSize', 'Serving size must be greater than zero.');
    } else if (value !== undefined && value !== null) {
      servingSize = value;
    }
  }

  let servingType = existing?.serving_unit ?? '';
  if (isCreate || 'servingType' in data) {
    servingType = requiredText(errors, 'servingType', data.servingType, 50) ?? '';
  }

  const numericFields = [
    'calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'fiber', 'sugar',
    'sodium', 'insulinResponse',
  ] as const;
  const currentNumbers = {
    calories: existing?.calories ?? 0,
    protein: existing?.protein ?? 0,
    carbs: existing?.carbs ?? 0,
    fat: existing?.fat ?? 0,
    saturatedFat: existing?.saturated_fat ?? null,
    fiber: existing?.fiber ?? null,
    sugar: existing?.sugar ?? null,
    sodium: existing?.sodium ?? null,
    insulinResponse: existing?.insulin_response ?? null,
  };
  const parsedNumbers: Record<typeof numericFields[number], number | null> =
    structuredClone(currentNumbers);
  for (const field of numericFields) {
    if (isCreate || field in data) {
      const value = decimal(
        errors,
        field,
        data[field],
        {
          allowNull: field !== 'calories',
          maximumDigits: field === 'insulinResponse' ? 5 : 10,
        },
      );
      if (value !== undefined) {
        parsedNumbers[field] = value;
      }
    }
  }

  let glycemicIndex = existing?.glycemic_index ?? null;
  if ('glycemicIndex' in data) {
    glycemicIndex = integer(errors, 'glycemicIndex', data.glycemicIndex, {
      allowNull: true,
    }) ?? null;
  }

  let satietyScore = existing?.satiety_score ?? null;
  if ('satietyScore' in data) {
    satietyScore = integer(errors, 'satietyScore', data.satietyScore, {
      allowNull: true,
    }) ?? null;
  }

  let proteinQuality = existing?.protein_quality ?? null;
  if ('proteinQuality' in data) {
    proteinQuality = integer(errors, 'proteinQuality', data.proteinQuality, {
      allowNull: true,
      choices: [1, 2, 3],
    }) ?? null;
  }

  let absorptionSpeed = existing?.absorption_speed ?? null;
  if ('absorptionSpeed' in data) {
    if (data.absorptionSpeed === null) {
      absorptionSpeed = null;
    } else if (data.absorptionSpeed === '') {
      absorptionSpeed = null;
    } else {
      const selected = choice(
        errors,
        'absorptionSpeed',
        data.absorptionSpeed,
        ABSORPTION_SPEEDS,
      );
      absorptionSpeed = (selected ?? null) as 'slow' | 'moderate' | 'fast' | null;
    }
  }

  let category = existing?.category ?? null;
  if ('category' in data) {
    category = optionalChoice(
      errors,
      'category',
      data.category,
      FOOD_CATEGORIES,
    ) as FoodCategory | '' | null;
  }

  fail(errors);
  return {
    name: name ?? '',
    brand,
    barcode,
    serving_size: servingSize,
    serving_unit: servingType,
    calories: parsedNumbers.calories,
    protein: parsedNumbers.protein,
    carbs: parsedNumbers.carbs,
    fat: parsedNumbers.fat,
    saturated_fat: parsedNumbers.saturatedFat,
    fiber: parsedNumbers.fiber,
    sugar: parsedNumbers.sugar,
    sodium: parsedNumbers.sodium,
    glycemic_index: glycemicIndex,
    absorption_speed: absorptionSpeed,
    insulin_response: parsedNumbers.insulinResponse,
    satiety_score: satietyScore,
    protein_quality: proteinQuality,
    category,
  };
}

interface ParsedNestedItem {
  foodId: number;
  grams: number;
  order?: number;
}

function parseNestedItems(
  errors: JsonObject,
  value: unknown,
): ParsedNestedItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    addError(errors, 'food_items', 'Expected a list of items but got type "str".');
    return undefined;
  }

  const items: ParsedNestedItem[] = [];
  value.forEach((entry, index) => {
    const field = `food_items[${index}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(errors, field, 'Invalid data. Expected a dictionary, but got an object.');
      return;
    }
    const item = entry as JsonObject;
    let foodId: number | undefined;
    if (typeof item.foodId === 'number' && Number.isInteger(item.foodId) && item.foodId >= 1) {
      foodId = item.foodId;
    } else if (
      typeof item.foodId === 'string' &&
      /^\d+$/.test(item.foodId) &&
      Number.parseInt(item.foodId, 10) >= 1
    ) {
      foodId = Number.parseInt(item.foodId, 10);
    } else {
      addError(errors, `${field}.foodId`, 'A valid integer is required.');
    }

    const grams = decimal(errors, `${field}.grams`, item.grams, { min: 0.01 });
    if (grams === undefined || grams === null) {
      return;
    }
    let order: number | undefined;
    if ('order' in item) {
      order = integer(errors, `${field}.order`, item.order) ?? undefined;
    }
    if (foodId !== undefined) {
      items.push({ foodId, grams, ...(order !== undefined ? { order } : {}) });
    }
  });
  return items;
}

function validateMeal(
  data: JsonObject,
  existing?: MealRecord,
  timezone = 'UTC',
): Omit<MealValues, 'food_items'> & {
  nestedIds?: ParsedNestedItem[];
} {
  const errors: JsonObject = {};
  const isCreate = !existing;

  let name = existing?.name;
  if (isCreate || 'name' in data) {
    name = requiredText(errors, 'name', data.name, 255);
  }

  let mealType = existing?.meal_type;
  if (isCreate || 'mealType' in data) {
    mealType = choice(errors, 'mealType', data.mealType, MEAL_TYPES);
  }

  let loggedAt = existing ? new Date(existing.logged_at) : new Date();
  if ('loggedAt' in data && data.loggedAt !== null) {
    const value = data.loggedAt;
    const matchesIso = typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value);
    const parsed = matchesIso ? new Date(value) : new Date(Number.NaN);
    if (Number.isNaN(parsed.getTime())) {
      addError(errors, 'loggedAt', 'Datetime has wrong format.');
    } else {
      // Django's auto_now_add column ignores the supplied timestamp on insert.
      loggedAt = parsed;
    }
  }

  let date = existing?.date ?? calendarDate(loggedAt, timezone);
  if ('date' in data && data.date !== null && data.date !== undefined) {
    if (typeof data.date !== 'string' || !validDate(data.date)) {
      addError(errors, 'date', 'Date has wrong format.');
    } else {
      date = data.date;
    }
  } else if (isCreate) {
    date = calendarDate(loggedAt, timezone);
  }

  let eventTime = existing?.event_time ?? null;
  if ('eventTime' in data) {
    eventTime = normalizedEventTime(errors, 'eventTime', data.eventTime) ?? null;
  }

  let notes = existing?.notes ?? null;
  if ('notes' in data) {
    if (data.notes === null) {
      notes = null;
    } else if (typeof data.notes === 'string') {
      notes = data.notes === '' ? null : data.notes;
    } else {
      addError(errors, 'notes', 'A valid string is required.');
    }
  }

  let source = existing?.source ?? 'manual';
  if ('source' in data) {
    source = (choice(errors, 'source', data.source, MEAL_SOURCES) ?? 'manual') as MealSource;
  }

  const nestedIds = parseNestedItems(errors, data.food_items);
  fail(errors);
  return {
    name: name ?? '',
    meal_type: mealType ?? 'breakfast',
    date,
    event_time: eventTime,
    notes,
    source,
    ...(nestedIds ? { nestedIds } : {}),
  };
}

function validateTemplate(
  data: JsonObject,
  existing?: MealTemplateRecord,
): Omit<TemplateValues, 'food_items'> & {
  nestedIds?: ParsedNestedItem[];
} {
  const errors: JsonObject = {};
  const isCreate = !existing;

  let name = existing?.name;
  if (isCreate || 'name' in data) {
    name = requiredText(errors, 'name', data.name, 255);
  }

  let category = existing?.category;
  if (isCreate || 'category' in data) {
    category = choice(errors, 'category', data.category, MEAL_TYPES);
  }

  let notes = existing?.notes ?? null;
  if ('notes' in data) {
    if (data.notes === null) {
      notes = null;
    } else if (typeof data.notes === 'string') {
      notes = data.notes === '' ? null : data.notes;
    } else {
      addError(errors, 'notes', 'A valid string is required.');
    }
  }

  const nestedIds = parseNestedItems(errors, data.food_items);
  fail(errors);
  return {
    name: name ?? '',
    category: category ?? 'breakfast',
    notes,
    ...(nestedIds ? { nestedIds } : {}),
  };
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function nutritionMultiplier(food: FoodItemRecord | undefined, grams: number): number | undefined {
  if (!food || !(food.serving_size > 0)) {
    return undefined;
  }
  return grams / food.serving_size;
}

function foodResponse(food: FoodItemRecord): Record<string, unknown> {
  return {
    id: food.id,
    user: food.user_id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    source: food.source,
    servingSize: food.serving_size,
    servingType: food.serving_unit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    saturatedFat: food.saturated_fat,
    fiber: food.fiber,
    sugar: food.sugar,
    sodium: food.sodium,
    glycemicIndex: food.glycemic_index,
    absorptionSpeed: food.absorption_speed,
    satietyScore: food.satiety_score,
    proteinQuality: food.protein_quality,
    insulinResponse: food.insulin_response,
    category: food.category,
  };
}

async function foodMap(
  context: RouteContext,
  userId: number | undefined,
  ids: Iterable<number>,
): Promise<Map<number, FoodItemRecord>> {
  return context.repository.accessibleFoods(ids, userId);
}

function nestedResponse(items: NestedFoodItemRecord[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    foodId: item.food_id,
    grams: item.grams,
    order: item.order,
  }));
}

function mealTotals(
  items: NestedFoodItemRecord[],
  foods: Map<number, FoodItemRecord>,
): Record<'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat', number> {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) {
    const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
    if (multiplier === undefined) {
      continue;
    }
    const food = foods.get(item.food_id)!;
    totals.calories += food.calories * multiplier;
    totals.protein += food.protein * multiplier;
    totals.carbs += food.carbs * multiplier;
    totals.fat += food.fat * multiplier;
  }
  return {
    totalCalories: round2(totals.calories),
    totalProtein: round2(totals.protein),
    totalCarbs: round2(totals.carbs),
    totalFat: round2(totals.fat),
  };
}

function mealResponse(
  meal: MealRecord,
  items: readonly NestedFoodItemRecord[],
  foods: Map<number, FoodItemRecord>,
): Record<string, unknown> {
  return {
    id: meal.id,
    name: meal.name,
    mealType: meal.meal_type,
    date: meal.date,
    loggedAt: meal.logged_at,
    eventTime: meal.event_time,
    notes: meal.notes,
    source: meal.source,
    food_items: nestedResponse(items),
    ...mealTotals(items, foods),
  };
}

function templateResponse(
  template: MealTemplateRecord,
  items: readonly NestedFoodItemRecord[],
): Record<string, unknown> {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    notes: template.notes,
    food_items: nestedResponse(items),
  };
}

async function authenticatedUser(context: RouteContext) {
  if (!context.request.headers.authorization) {
    return undefined;
  }
  return context.requireUser();
}

function visibleFood(food: FoodItemRecord | undefined, userId?: number): FoodItemRecord | undefined {
  if (!food) {
    return undefined;
  }
  return food.user_id === null || food.user_id === userId ? food : undefined;
}

async function resolveNestedFoods(
  context: RouteContext,
  userId: number,
  kind: 'meal' | 'template',
  parentPk: string,
  parentId: number,
  items: ParsedNestedItem[],
): Promise<NestedFoodItemRecord[]> {
  const foods = await foodMap(context, userId, items.map((item) => item.foodId));
  const errors: JsonObject = {};
  const resolved: NestedFoodItemRecord[] = [];
  for (const [index, item] of items.entries()) {
    const food = visibleFood(foods.get(item.foodId), userId);
    if (!food) {
      addError(
        errors,
        `food_items[${index}].foodId`,
        `Invalid pk "${item.foodId}" - object does not exist.`,
      );
      continue;
    }
    const id = await context.repository.nextId(
      kind === 'meal' ? 'meal_food_item' : 'meal_template_food_item',
    );
    resolved.push({
      pk: parentPk,
      sk: `${kind === 'meal' ? 'MEAL_FOOD_ITEM' : 'TEMPLATE_FOOD_ITEM'}#${id}`,
      entity_type: kind === 'meal' ? 'meal_food_item' : 'meal_template_food_item',
      id,
      ...(kind === 'meal' ? { meal_id: parentId } : { template_id: parentId }),
      food_id: item.foodId,
      grams: item.grams,
      order: item.order ?? index,
    });
  }
  fail(errors);
  return resolved;
}

async function createFood(context: RouteContext) {
  const user = await context.requireUser();
  const values = validateFood(bodyObject(context.request.body));
  const id = await context.repository.nextId('food');
  const food: FoodItemRecord = {
    pk: `FOOD#${id}`,
    sk: 'METADATA',
    id,
    user_id: user.id,
    source: 'user',
    ...values,
  };
  await context.repository.saveFood(food);
  return jsonResponse(201, foodResponse(food), context.cors);
}

async function listFoods(context: RouteContext) {
  const user = await authenticatedUser(context);
  const foods = await context.repository.listFoods(user?.id);
  return jsonResponse(200, foods.map(foodResponse), context.cors);
}

async function retrieveFood(context: RouteContext, id: number) {
  const user = await authenticatedUser(context);
  const food = visibleFood(await context.repository.getFood(id), user?.id);
  if (!food) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return jsonResponse(200, foodResponse(food), context.cors);
}

async function updateFood(context: RouteContext, id: number, partial: boolean) {
  const user = await context.requireUser();
  const existing = await context.repository.getFood(id);
  if (!existing || (existing.user_id !== null && existing.user_id !== user.id)) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  if (existing.user_id === null) {
    throw new HttpError(403, { detail: 'Only the food owner can modify this item.' });
  }
  const values = validateFood(bodyObject(context.request.body), partial ? existing : undefined);
  const updated: FoodItemRecord = { ...existing, ...values };
  await context.repository.replaceFood(updated);
  return jsonResponse(200, foodResponse(updated), context.cors);
}

async function destroyFood(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await context.repository.getFood(id);
  if (!existing || (existing.user_id !== null && existing.user_id !== user.id)) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  if (existing.user_id === null) {
    throw new HttpError(403, { detail: 'Only the food owner can modify this item.' });
  }
  await context.repository.deleteFood(existing);
  return emptyResponse(204, context.cors);
}

async function createMeal(context: RouteContext) {
  const user = await context.requireUser();
  const input = validateMeal(bodyObject(context.request.body), undefined, context.config.timezone);
  const nested = await resolveNestedFoods(context, user.id, input.nestedIds ?? []);
  const id = await context.repository.nextId('meal');
  const meal: MealRecord = {
    pk: `MEAL#${id}`,
    sk: 'METADATA',
    id,
    user_id: user.id,
    name: input.name,
    meal_type: input.meal_type,
    date: input.date,
    logged_at: new Date().toISOString(),
    event_time: input.event_time,
    notes: input.notes,
    source: input.source,
    food_items: nested,
  };
  await context.repository.saveNewMeal(meal);
  return jsonResponse(201, mealResponse(meal, await foodMap(context, nested)), context.cors);
}

async function listMeals(context: RouteContext) {
  const user = await context.requireUser();
  const meals = await context.repository.listMeals(user.id);
  const foods = await foodMap(context, meals.flatMap((meal) =>
    meal.food_items.map((item) => item.food_id)
  ));
  return jsonResponse(200, meals.map((meal) => mealResponse(meal, foods)), context.cors);
}

async function loadOwnedMeal(context: RouteContext, id: number, userId: number) {
  const meal = await context.repository.getMeal(id);
  if (!meal || meal.user_id !== userId) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return meal;
}

async function retrieveMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const meal = await loadOwnedMeal(context, id, user.id);
  return jsonResponse(
    200,
    mealResponse(meal, await foodMap(context, meal.food_items)),
    context.cors,
  );
}

async function updateMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await loadOwnedMeal(context, id, user.id);
  const input = validateMeal(bodyObject(context.request.body), existing, context.config.timezone);
  let nested = existing.food_items;
  if (input.nestedIds) {
    nested = await resolveNestedFoods(context, user.id, input.nestedIds);
  }
  const updated: MealRecord = {
    ...existing,
    name: input.name,
    meal_type: input.meal_type,
    date: input.date,
    event_time: input.event_time,
    notes: input.notes,
    source: input.source,
    food_items: nested,
  };
  await context.repository.replaceMeal(updated);
  return jsonResponse(200, mealResponse(updated, await foodMap(context, nested)), context.cors);
}

async function destroyMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  await loadOwnedMeal(context, id, user.id);
  await context.repository.deleteMeal(id);
  return emptyResponse(204, context.cors);
}

async function mealsByDate(context: RouteContext, date: string) {
  if (!validDate(date)) {
    throw new HttpError(400, { error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  const user = await context.requireUser();
  const meals = (await context.repository.listMeals(user.id))
    .filter((meal) => meal.date === date);
  const foods = await foodMap(context, meals.flatMap((meal) =>
    meal.food_items.map((item) => item.food_id)
  ));
  return jsonResponse(200, meals.map((meal) => mealResponse(meal, foods)), context.cors);
}

async function dailyTotals(context: RouteContext, date: string) {
  if (!validDate(date)) {
    throw new HttpError(400, { error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  const user = await context.requireUser();
  const meals = (await context.repository.listMeals(user.id))
    .filter((meal) => meal.date === date);
  const foods = await foodMap(context, meals.flatMap((meal) =>
    meal.food_items.map((item) => item.food_id)
  ));
  const totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
  };
  for (const meal of meals) {
    for (const item of meal.food_items) {
      const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
      if (multiplier === undefined) {
        continue;
      }
      const food = foods.get(item.food_id)!;
      totals.calories += food.calories * multiplier;
      totals.protein_g += food.protein * multiplier;
      totals.carbs_g += food.carbs * multiplier;
      totals.fat_g += food.fat * multiplier;
      totals.fiber_g += (food.fiber ?? 0) * multiplier;
      totals.sugar_g += (food.sugar ?? 0) * multiplier;
      totals.sodium_mg += (food.sodium ?? 0) * multiplier;
    }
  }
  return jsonResponse(200, { date, ...totals }, context.cors);
}

async function createTemplate(context: RouteContext) {
  const user = await context.requireUser();
  const input = validateTemplate(bodyObject(context.request.body));
  const nested = await resolveNestedFoods(context, user.id, input.nestedIds ?? []);
  const id = await context.repository.nextId('template');
  const now = new Date().toISOString();
  const template: MealTemplateRecord = {
    pk: `TEMPLATE#${id}`,
    sk: 'METADATA',
    id,
    user_id: user.id,
    name: input.name,
    category: input.category,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    food_items: nested,
  };
  await context.repository.saveNewMealTemplate(template);
  return jsonResponse(201, templateResponse(template), context.cors);
}

async function listTemplates(context: RouteContext) {
  const user = await context.requireUser();
  const templates = await context.repository.listMealTemplates(user.id);
  return jsonResponse(200, templates.map(templateResponse), context.cors);
}

async function loadOwnedTemplate(context: RouteContext, id: number, userId: number) {
  const template = await context.repository.getMealTemplate(id);
  if (!template || template.user_id !== userId) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return template;
}

async function retrieveTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const template = await loadOwnedTemplate(context, id, user.id);
  return jsonResponse(200, templateResponse(template), context.cors);
}

async function updateTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await loadOwnedTemplate(context, id, user.id);
  const input = validateTemplate(bodyObject(context.request.body), existing);
  let nested = existing.food_items;
  if (input.nestedIds) {
    nested = await resolveNestedFoods(context, user.id, input.nestedIds);
  }
  const updated: MealTemplateRecord = {
    ...existing,
    name: input.name,
    category: input.category,
    notes: input.notes,
    updated_at: new Date().toISOString(),
    food_items: nested,
  };
  await context.repository.replaceMealTemplate(updated);
  return jsonResponse(200, templateResponse(updated), context.cors);
}

async function destroyTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  await loadOwnedTemplate(context, id, user.id);
  await context.repository.deleteMealTemplate(id);
  return emptyResponse(204, context.cors);
}

function macroInputs(data: JsonObject): { protein: number; carbs: number; fat: number } {
  const errors: JsonObject = {};
  const read = (field: string): number => {
    const value = decimal(errors, field, data[field], { min: 0 }) ?? 0;
    return value;
  };
  const protein = read('protein_g');
  const carbs = read('carbs_g');
  const fat = read('fat_g');
  fail(errors);
  return { protein, carbs, fat };
}

function calculateNutritionInput(context: RouteContext): Array<{ food_id: number; grams: number }> {
  const data = bodyObject(context.request.body);
  if (!Array.isArray(data.food_items)) {
    throw new ValidationFailure({ food_items: ['This field is required.'] });
  }
  if (data.food_items.length > 200) {
    throw new ValidationFailure({
      food_items: ['Ensure this field has no more than 200 elements.'],
    });
  }
  const errors: JsonObject = {};
  const items = data.food_items.flatMap((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      addError(errors, `food_items[${index}]`, 'Invalid data.');
      return [];
    }
    const item = entry as JsonObject;
    const foodId = integer(errors, `food_items[${index}].food_id`, item.food_id, { min: 1 } as never);
    const grams = decimal(errors, `food_items[${index}].grams`, item.grams, { min: 0.01 });
    if (foodId === undefined || foodId === null || grams === undefined || grams === null) {
      return [];
    }
    return [{ food_id: foodId, grams }];
  });
  fail(errors);
  return items;
}

export function registerNutritionRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/foods',
    handle: async (context) => (
      context.request.method === 'POST'
        ? createFood(context)
        : listFoods(context)
    ),
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/foods/:id',
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        return retrieveFood(context, id);
      }
      if (context.request.method === 'DELETE') {
        return destroyFood(context, id);
      }
      return updateFood(context, id, context.request.method === 'PATCH');
    },
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/meals',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => (
      context.request.method === 'POST'
        ? createMeal(context)
        : listMeals(context)
    ),
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/date/:date:string',
    authRequired: true,
    authBeforeMethod: true,
    handle: (context, params) => mealsByDate(context, params.date as string),
  });

  addRoute({
    method: 'GET',
    pattern: '/api/food/meals/daily/totals/:date:string',
    authRequired: true,
    authBeforeMethod: true,
    handle: (context, params) => dailyTotals(context, params.date as string),
  });

  addRoute({
    method: ['GET', 'PATCH', 'DELETE'],
    pattern: '/api/food/meals/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        return retrieveMeal(context, id);
      }
      if (context.request.method === 'DELETE') {
        return destroyMeal(context, id);
      }
      return updateMeal(context, id);
    },
  });

  addRoute({
    method: ['GET', 'POST'],
    pattern: '/api/food/templates',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => (
      context.request.method === 'POST'
        ? createTemplate(context)
        : listTemplates(context)
    ),
  });

  addRoute({
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
    pattern: '/api/food/templates/:id',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context, params) => {
      const id = params.id as number;
      if (context.request.method === 'GET') {
        return retrieveTemplate(context, id);
      }
      if (context.request.method === 'DELETE') {
        return destroyTemplate(context, id);
      }
      if (context.request.method === 'PUT') {
        throw new HttpError(405, { detail: 'Method "PUT" not allowed.' });
      }
      return updateTemplate(context, id);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-calories',
    handle: async (context) => {
      const macros = macroInputs(bodyObject(context.request.body));
      return jsonResponse(200, {
        calories: macros.protein * 4 + macros.carbs * 4 + macros.fat * 9,
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
      const { protein, carbs, fat } = macroInputs(bodyObject(context.request.body));
      const total = protein + carbs + fat;
      const category = total === 0
        ? 'unknown'
        : protein > total * 0.4
          ? 'protein'
          : carbs > total * 0.5
            ? 'carb'
            : fat > total * 0.5
              ? 'fat'
              : 'balanced';
      return jsonResponse(200, {
        category,
        protein_ratio: total > 0 ? protein / total : 0,
        carb_ratio: total > 0 ? carbs / total : 0,
        fat_ratio: total > 0 ? fat / total : 0,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/infer-metabolism',
    handle: async (context) => {
      const data = bodyObject(context.request.body);
      const errors: JsonObject = {};
      const readMacro = (field: string): number =>
        decimal(errors, field, data[field], { min: 0 }) ?? 0;
      const protein = readMacro('protein_g');
      const carbs = readMacro('carbs_g');
      const fat = readMacro('fat_g');
      const fiber = readMacro('fiber_g');
      let foodType = '';
      if (data.food_type !== undefined) {
        if (typeof data.food_type !== 'string') {
          addError(errors, 'food_type', 'A valid string is required.');
        } else if (data.food_type.length > 255) {
          addError(errors, 'food_type', 'Ensure this field has no more than 255 characters.');
        } else {
          foodType = data.food_type.toLowerCase();
        }
      }
      fail(errors);

      const total = protein + carbs + fat;
      let glycemicIndex = 'medium';
      if (carbs > 0 && fiber > 0) {
        glycemicIndex = fiber >= 5 ? 'low' : fiber >= 3 ? 'medium' : 'high';
      } else if (foodType.includes('whole') || foodType.includes('complex')) {
        glycemicIndex = 'low';
      } else if (
        foodType.includes('sugar') ||
        foodType.includes('candy') ||
        foodType.includes('soda')
      ) {
        glycemicIndex = 'high';
      }
      const thermicEffect = protein > total * 0.3
        ? 'high'
        : protein > total * 0.15
          ? 'medium'
          : 'low';
      let satietyScore = 0;
      if (protein > total * 0.2) satietyScore += 3;
      if (fiber >= 5) satietyScore += 3;
      else if (fiber >= 3) satietyScore += 2;
      else if (fiber > 0) satietyScore += 1;
      if (fat > total * 0.2) satietyScore += 2;
      const satietyLevel = satietyScore >= 6
        ? 'very_high'
        : satietyScore >= 4
          ? 'high'
          : satietyScore >= 2
            ? 'moderate'
            : 'low';

      return jsonResponse(200, {
        glycemic_index: glycemicIndex,
        absorption_speed: glycemicIndex === 'high'
          ? 'fast'
          : glycemicIndex === 'low'
            ? 'slow'
            : 'moderate',
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
    handle: async (context) => {
      const user = await context.requireUser();
      const items = calculateNutritionInput(context);
      const foods = await foodMap(context, items.map((item) => item.food_id));
      const totals = {
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
        total_fiber_g: 0,
        total_sugar_g: 0,
        total_sodium_mg: 0,
      };
      for (const item of items) {
        const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
        if (multiplier === undefined) {
          continue;
        }
        const food = foods.get(item.food_id)!;
        totals.total_calories += food.calories * multiplier;
        totals.total_protein_g += food.protein * multiplier;
        totals.total_carbs_g += food.carbs * multiplier;
        totals.total_fat_g += food.fat * multiplier;
        totals.total_fiber_g += (food.fiber ?? 0) * multiplier;
        totals.total_sugar_g += (food.sugar ?? 0) * multiplier;
        totals.total_sodium_mg += (food.sodium ?? 0) * multiplier;
      }
      return jsonResponse(200, Object.fromEntries(Object.entries(totals).map(([key, value]) => [
        key,
        round2(value),
      ])), context.cors);
    },
  });
}
