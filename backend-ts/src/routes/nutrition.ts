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
import type { Rational } from '../nutrition-decimal.js';
import {
  addRational,
  compareRational,
  divideRational,
  multiplyRational,
  rational,
  rationalFromInteger,
  rationalToNumber,
  roundedNumber,
  zeroRational,
} from '../nutrition-decimal.js';
import { ValidationFailure } from '../validation.js';

const FOOD_CATEGORIES: ReadonlySet<string> = new Set([
  'carb', 'protein', 'fat', 'mixed', 'beverage',
]);
const MEAL_TYPES: ReadonlySet<string> = new Set([
  'breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'beverage',
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
  absorption_speed: string | null;
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

/**
 * DRF's FoodItem serializer uses FloatField for nutrition scalars.  The
 * underlying SQLite DecimalField rounds values when they are read back, but
 * it does not reject extra precision during request validation.  Keep this
 * parser separate from the DecimalField parser used by calculation endpoints
 * so request/response behavior remains compatible with the legacy API.
 */
function numberValue(
  errors: JsonObject,
  field: string,
  value: unknown,
  options: {
    allowNull?: boolean;
    min?: number;
    max?: number;
  } = {},
): number | null | undefined {
  if (value === undefined) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  if (value === null) {
    if (options.allowNull) return null;
    addError(errors, field, 'This field may not be null.');
    return undefined;
  }
  const parsed = typeof value === 'string'
    ? (value.trim() ? Number(value.trim()) : Number.NaN)
    : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    addError(errors, field, 'A valid number is required.');
    return undefined;
  }
  if (options.min !== undefined && parsed < options.min) {
    addError(
      errors,
      field,
      `Ensure this value is greater than or equal to ${options.min}.`,
    );
  }
  if (options.max !== undefined && parsed > options.max) {
    addError(
      errors,
      field,
      `Ensure this value is less than or equal to ${options.max}.`,
    );
  }
  return parsed;
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
    addError(errors, field, 'Ensure that there are no more than 2 decimal places.');
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
  if (value === null) {
    if (options.allowNull) {
      return null;
    }
    addError(errors, field, 'This field may not be null.');
    return undefined;
  }
  const parsed = typeof value === 'string'
    ? (/^[+-]?\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN)
    : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
    addError(errors, field, 'A valid integer is required.');
    return undefined;
  }
  const result = parsed;
  if (options.min !== undefined && result < options.min) {
    addError(
      errors,
      field,
      `Ensure this value is greater than or equal to ${options.min}.`,
    );
  }
  if (options.max !== undefined && result > options.max) {
    addError(
      errors,
      field,
      `Ensure this value is less than or equal to ${options.max}.`,
    );
  }
  return result;
}

function optionalNonBlankString(
  errors: JsonObject,
  field: string,
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  return normalized;
}

function nullableString(
  errors: JsonObject,
  field: string,
  value: unknown,
  maxLength: number,
  { trim = true }: { trim?: boolean } = {},
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  const normalized = trim ? value.trim() : value;
  if (normalized.length > maxLength) {
    addError(
      errors,
      field,
      `Ensure this field has no more than ${maxLength} characters.`,
    );
    return undefined;
  }
  return normalized;
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
  if (value === null) {
    addError(errors, field, 'This field may not be null.');
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
  if (value === null) {
    addError(errors, field, 'This field may not be null.');
    return undefined;
  }
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
  if (typeof value !== 'string') {
    addError(errors, field, `"${String(value)}" is not a valid choice.`);
    return undefined;
  }
  if (value === '') {
    return '';
  }
  if (!choices.has(value)) {
    addError(errors, field, `"${value}" is not a valid choice.`);
    return undefined;
  }
  return value;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function padDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizedDate(
  errors: JsonObject,
  field: string,
  value: unknown,
): string | undefined {
  if (typeof value !== 'string' || !validDate(value)) {
    addError(
      errors,
      field,
      'Date has wrong format. Use one of these formats instead: YYYY-MM-DD.',
    );
    return undefined;
  }
  return padDate(value);
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
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(value);
  const [, hour = '', minute = '', second = '', fraction = ''] = match ?? [];
  if (
    !match ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    addError(errors, field, 'A valid time is required.');
    return undefined;
  }
  const normalizedFraction = fraction
    ? `.${fraction.padEnd(6, '0')}`
    : '';
  return `${hour}:${minute}:${second || '00'}${normalizedFraction}`;
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
  brand = nullableString(errors, 'brand', data.brand, 255) ?? null;
  }

  let barcode = existing?.barcode ?? null;
  if ('barcode' in data) {
  barcode = nullableString(errors, 'barcode', data.barcode, 255) ?? null;
  }

  let servingSize = existing?.serving_size ?? 0;
  if (isCreate || 'servingSize' in data) {
    const value = numberValue(errors, 'servingSize', data.servingSize);
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
    // FoodItem.model defines fiber and sugar with a default of zero.  DRF
    // therefore returns 0 when either field is omitted on create.
    fiber: existing?.fiber ?? 0,
    sugar: existing?.sugar ?? 0,
    sodium: existing?.sodium ?? null,
    insulinResponse: existing?.insulin_response ?? null,
  };
  const parsedNumbers: Record<typeof numericFields[number], number | null> =
    structuredClone(currentNumbers);
  for (const field of numericFields) {
    if (field in data) {
      const value = numberValue(
        errors,
        field,
        data[field],
        {
          allowNull: field !== 'calories',
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
    }) ?? null;
  }

  let absorptionSpeed = existing?.absorption_speed ?? null;
  if ('absorptionSpeed' in data) {
    const selected = optionalNonBlankString(
      errors,
      'absorptionSpeed',
      data.absorptionSpeed,
    );
    if (selected !== undefined) absorptionSpeed = selected;
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
    calories: parsedNumbers.calories ?? 0,
    protein: parsedNumbers.protein ?? 0,
    carbs: parsedNumbers.carbs ?? 0,
    fat: parsedNumbers.fat ?? 0,
    saturated_fat: parsedNumbers.saturatedFat,
    fiber: parsedNumbers.fiber,
    sugar: parsedNumbers.sugar,
    sodium: parsedNumbers.sodium,
    glycemic_index: glycemicIndex,
    absorption_speed: absorptionSpeed ?? null,
    insulin_response: parsedNumbers.insulinResponse,
    satiety_score: satietyScore,
    protein_quality: proteinQuality,
    category,
  };
}

interface ParsedNestedItem {
  inputIndex: number;
  foodId: number;
  grams: number;
  order?: number;
}

interface ResolvedNestedItems {
  items: NestedFoodItemRecord[];
  foods: Map<number, FoodItemRecord>;
}

function drfTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'object') return 'dict';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'string') return 'str';
  return typeof value;
}

function nestedItemErrorObject(errors: JsonObject, index: number): JsonObject {
  const list = Array.isArray(errors.food_items) ? errors.food_items : [];
  if (errors.food_items !== list) errors.food_items = list;
  while (list.length <= index) list.push({});
  const current = list[index];
  if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
    return current as JsonObject;
  }
  const replacement: JsonObject = {};
  list[index] = replacement;
  return replacement;
}

function addNestedError(
  errors: JsonObject,
  index: number,
  field: string,
  message: string,
): void {
  addError(nestedItemErrorObject(errors, index), field, message);
}

function parseNestedItems(
  errors: JsonObject,
  value: unknown,
): ParsedNestedItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    errors.food_items = ['This field may not be null.'];
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.food_items = [
      `Expected a list of items but got type "${drfTypeName(value)}".`,
    ];
    return undefined;
  }

  const items: ParsedNestedItem[] = [];
  const itemErrors: unknown[] = [];
  let hasErrors = false;
  value.forEach((entry, index) => {
    if (entry === null) {
      itemErrors[index] = ['This field may not be null.'];
      hasErrors = true;
      return;
    }
    if (typeof entry !== 'object' || Array.isArray(entry)) {
      itemErrors[index] = {
        non_field_errors: [
          `Invalid data. Expected a dictionary, but got ${drfTypeName(entry)}.`,
        ],
      };
      hasErrors = true;
      return;
    }
    const item = entry as JsonObject;
    const nestedErrors: JsonObject = {};
    let foodId: number | undefined;
    if (!('foodId' in item)) {
      nestedErrors.foodId = ['This field is required.'];
    } else if (item.foodId === null) {
      nestedErrors.foodId = ['This field may not be null.'];
    } else if (typeof item.foodId === 'number' && Number.isInteger(item.foodId)) {
      foodId = item.foodId;
    } else if (typeof item.foodId === 'string' && /^[+-]?\d+$/.test(item.foodId.trim())) {
      foodId = Number.parseInt(item.foodId.trim(), 10);
    } else {
      nestedErrors.foodId = [
        `Incorrect type. Expected pk value, received ${drfTypeName(item.foodId)}.`,
      ];
    }

    const grams = numberValue(nestedErrors, 'grams', item.grams, { min: 0.01 });
    if (grams === undefined || grams === null) {
      if (Object.keys(nestedErrors).length > 0) {
        itemErrors[index] = nestedErrors;
        hasErrors = true;
      }
      return;
    }
    let order: number | undefined;
    if ('order' in item) {
      order = integer(nestedErrors, 'order', item.order) ?? undefined;
    }
    if (Object.keys(nestedErrors).length > 0) {
      itemErrors[index] = nestedErrors;
      hasErrors = true;
    }
    if (foodId !== undefined) {
      // MealFoodItem is a DecimalField(decimal_places=2), so its persisted
      // value is rounded when the nested row is loaded by the serializer.
      const persistedGrams = Number(grams.toFixed(2));
      items.push({
        inputIndex: index,
        foodId,
        grams: persistedGrams,
        ...(order !== undefined ? { order } : {}),
      });
    }
  });
  if (hasErrors) {
    errors.food_items = itemErrors.map((entry) => entry ?? {});
  }
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
    // The legacy serializer exposes mealType as a plain CharField rather
    // than a ChoiceField, so non-empty custom values remain valid.
    mealType = requiredText(errors, 'mealType', data.mealType, 255);
  }

  let loggedAt = existing ? new Date(existing.logged_at) : new Date();
  if ('loggedAt' in data) {
    if (data.loggedAt === null) {
      addError(errors, 'loggedAt', 'This field may not be null.');
    } else if (data.loggedAt === undefined) {
      // Test callers sometimes use an explicit undefined to model an
      // omitted optional field; leave the auto timestamp untouched.
    } else {
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
  }

  let date = existing?.date ?? calendarDate(loggedAt, timezone);
  if ('date' in data) {
    if (data.date === null) {
      addError(errors, 'date', 'This field may not be null.');
    } else if (data.date !== undefined) {
      const normalized = normalizedDate(errors, 'date', data.date);
      if (normalized !== undefined) {
        date = normalized;
      }
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
      notes = data.notes.trim();
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
      notes = data.notes.trim();
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

function nutritionMultiplier(
  food: FoodItemRecord | undefined,
  grams: number,
): Rational | undefined {
  if (!food || !(food.serving_size > 0)) {
    return undefined;
  }
  return divideRational(rational(grams), rational(food.serving_size));
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

function nestedResponse(items: readonly NestedFoodItemRecord[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    foodId: item.food_id,
    grams: item.grams,
    order: item.order,
  }));
}

function mealTotals(
  items: readonly NestedFoodItemRecord[],
  foods: Map<number, FoodItemRecord>,
): Record<'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat', number> {
  let calories = zeroRational();
  let protein = zeroRational();
  let carbs = zeroRational();
  let fat = zeroRational();
  for (const item of items) {
    const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
    if (multiplier === undefined) {
      continue;
    }
    const food = foods.get(item.food_id)!;
    calories = addRational(calories, multiplyRational(rational(food.calories), multiplier));
    protein = addRational(protein, multiplyRational(rational(food.protein), multiplier));
    carbs = addRational(carbs, multiplyRational(rational(food.carbs), multiplier));
    fat = addRational(fat, multiplyRational(rational(food.fat), multiplier));
  }
  return {
    totalCalories: roundedNumber(calories),
    totalProtein: roundedNumber(protein),
    totalCarbs: roundedNumber(carbs),
    totalFat: roundedNumber(fat),
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
  parentKey: string,
  parentId: number,
  items: ParsedNestedItem[],
): Promise<ResolvedNestedItems> {
  const foods = await foodMap(context, userId, items.map((item) => item.foodId));
  const errors: JsonObject = {};
  for (const item of items) {
    const food = visibleFood(foods.get(item.foodId), userId);
    if (!food) {
      addNestedError(
        errors,
        item.inputIndex,
        'foodId',
        `Invalid pk "${item.foodId}" - object does not exist.`,
      );
    }
  }
  if (Array.isArray(errors.food_items)) {
    // A parser error list may already have established the DRF positional
    // shape.  Preserve empty entries for valid siblings.
    const parsedErrors = errors.food_items;
    while (parsedErrors.length < Math.max(...items.map((item) => item.inputIndex + 1), 0)) {
      parsedErrors.push({});
    }
  }
  fail(errors);

  const resolved: NestedFoodItemRecord[] = [];
  for (const item of items) {
    const id = await context.repository.nextId(
      kind === 'meal' ? 'meal_food_item' : 'meal_template_food_item',
    );
    resolved.push({
      pk: parentKey,
      sk: `${kind === 'meal' ? 'MEAL_FOOD_ITEM' : 'TEMPLATE_FOOD_ITEM'}#${id}`,
      entity_type: kind === 'meal'
        ? 'meal_food_item'
        : 'meal_template_food_item',
      id,
      ...(kind === 'meal' ? { meal_id: parentId } : { template_id: parentId }),
      food_id: item.foodId,
      grams: item.grams,
      order: item.order ?? item.inputIndex,
    });
  }
  return { items: resolved, foods };
}

async function createFood(context: RouteContext) {
  const user = await context.requireUser();
  const values = validateFood(bodyObject(context.request.body));
  const id = await context.repository.nextId('food');
  const food: FoodItemRecord = {
    pk: `USER#${user.id}`,
    sk: `FOOD#${id}`,
    entity_type: 'food_item',
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
  const food = visibleFood(await context.repository.getFood(id, user?.id), user?.id);
  if (!food) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return jsonResponse(200, foodResponse(food), context.cors);
}

async function updateFood(context: RouteContext, id: number, partial: boolean) {
  const user = await context.requireUser();
  const existing = await context.repository.getFood(id, user.id);
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
  const existing = await context.repository.getFood(id, user.id);
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
  const id = await context.repository.nextId('meal');
  const resolved = await resolveNestedFoods(
    context,
    user.id,
    'meal',
    `MEAL#${id}`,
    id,
    input.nestedIds ?? [],
  );
  const meal: MealRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL#${id}`,
    entity_type: 'meal',
    id,
    user_id: user.id,
    name: input.name,
    meal_type: input.meal_type,
    date: input.date,
    logged_at: new Date().toISOString(),
    event_time: input.event_time,
    notes: input.notes,
    source: input.source,
    food_item_ids: [...resolved.items]
      .sort((left, right) => left.order - right.order)
      .map((item) => item.id),
  };
  await context.repository.saveMealWithItems(meal, resolved.items);
  return jsonResponse(201, mealResponse(meal, resolved.items, resolved.foods), context.cors);
}

async function listMeals(context: RouteContext) {
  const user = await context.requireUser();
  const meals = await context.repository.listMeals(user.id);
  const itemsByMeal = await context.repository.getNutritionItemsForParents(
    'meal',
    meals.map((meal) => ({ id: meal.id, food_item_ids: meal.food_item_ids })),
  );
  const foods = await foodMap(
    context,
    user.id,
    [...itemsByMeal.values()].flat().map((item) => item.food_id),
  );
  return jsonResponse(
    200,
    meals.map((meal) => mealResponse(
      meal,
      itemsByMeal.get(meal.id) ?? [],
      foods,
    )),
    context.cors,
  );
}

async function loadOwnedMeal(context: RouteContext, id: number, userId: number) {
  const meal = await context.repository.getMeal(id, userId);
  if (!meal || meal.user_id !== userId) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return meal;
}

async function retrieveMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const meal = await loadOwnedMeal(context, id, user.id);
  const items = await context.repository.getNutritionItems(
    'meal',
    meal.id,
    meal.food_item_ids,
  );
  const foods = await foodMap(
    context,
    user.id,
    items.map((item) => item.food_id),
  );
  return jsonResponse(
    200,
    mealResponse(meal, items, foods),
    context.cors,
  );
}

async function updateMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await loadOwnedMeal(context, id, user.id);
  const input = validateMeal(bodyObject(context.request.body), existing, context.config.timezone);
  let resolved: ResolvedNestedItems | undefined;
  if (input.nestedIds) {
    resolved = await resolveNestedFoods(
      context,
      user.id,
      'meal',
      `MEAL#${existing.id}`,
      existing.id,
      input.nestedIds,
    );
  } else {
    const items = await context.repository.getNutritionItems(
      'meal',
      existing.id,
      existing.food_item_ids,
    );
    const foods = await foodMap(
      context,
      user.id,
      items.map((item) => item.food_id),
    );
    const updated: MealRecord = {
      ...existing,
      name: input.name,
      meal_type: input.meal_type,
      date: input.date,
      event_time: input.event_time,
      notes: input.notes,
      source: input.source,
    };
    await context.repository.replaceMealWithItems(
      updated,
      existing.food_item_ids,
      items,
    );
    return jsonResponse(200, mealResponse(updated, items, foods), context.cors);
  }
  const updated: MealRecord = {
    ...existing,
    name: input.name,
    meal_type: input.meal_type,
    date: input.date,
    event_time: input.event_time,
    notes: input.notes,
    source: input.source,
    food_item_ids: resolved.items.map((item) => item.id),
  };
  await context.repository.replaceMealWithItems(
    updated,
    existing.food_item_ids,
    resolved.items,
  );
  return jsonResponse(200, mealResponse(updated, resolved.items, resolved.foods), context.cors);
}

async function destroyMeal(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const meal = await loadOwnedMeal(context, id, user.id);
  await context.repository.deleteMealWithItems(meal);
  return emptyResponse(204, context.cors);
}

async function mealsByDate(context: RouteContext, rawDate: string) {
  if (!validDate(rawDate)) {
    throw new HttpError(400, { error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  const date = padDate(rawDate);
  const user = await context.requireUser();
  const meals = (await context.repository.listMeals(user.id))
    .filter((meal) => meal.date === date);
  const itemsByMeal = await context.repository.getNutritionItemsForParents(
    'meal',
    meals.map((meal) => ({ id: meal.id, food_item_ids: meal.food_item_ids })),
  );
  const foods = await foodMap(
    context,
    user.id,
    [...itemsByMeal.values()].flat().map((item) => item.food_id),
  );
  return jsonResponse(
    200,
    meals.map((meal) => mealResponse(meal, itemsByMeal.get(meal.id) ?? [], foods)),
    context.cors,
  );
}

async function dailyTotals(context: RouteContext, rawDate: string) {
  if (!validDate(rawDate)) {
    throw new HttpError(400, { error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  const date = padDate(rawDate);
  const user = await context.requireUser();
  const meals = (await context.repository.listMeals(user.id))
    .filter((meal) => meal.date === date);
  const itemsByMeal = await context.repository.getNutritionItemsForParents(
    'meal',
    meals.map((meal) => ({ id: meal.id, food_item_ids: meal.food_item_ids })),
  );
  const foods = await foodMap(
    context,
    user.id,
    [...itemsByMeal.values()].flat().map((item) => item.food_id),
  );
  const totals = {
    calories: zeroRational(),
    protein_g: zeroRational(),
    carbs_g: zeroRational(),
    fat_g: zeroRational(),
    fiber_g: zeroRational(),
    sugar_g: zeroRational(),
    sodium_mg: zeroRational(),
  };
  for (const meal of meals) {
    for (const item of itemsByMeal.get(meal.id) ?? []) {
      const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
      if (multiplier === undefined) {
        continue;
      }
      const food = foods.get(item.food_id)!;
      const weighted = (field: keyof FoodItemRecord): Rational =>
        multiplyRational(rational((food[field] ?? 0) as number), multiplier);
      totals.calories = addRational(totals.calories, weighted('calories'));
      totals.protein_g = addRational(totals.protein_g, weighted('protein'));
      totals.carbs_g = addRational(totals.carbs_g, weighted('carbs'));
      totals.fat_g = addRational(totals.fat_g, weighted('fat'));
      totals.fiber_g = addRational(totals.fiber_g, weighted('fiber'));
      totals.sugar_g = addRational(totals.sugar_g, weighted('sugar'));
      totals.sodium_mg = addRational(totals.sodium_mg, weighted('sodium'));
    }
  }
  return jsonResponse(200, {
    date,
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [
      key,
      rationalToNumber(value as Rational),
    ])),
  }, context.cors);
}

async function createTemplate(context: RouteContext) {
  const user = await context.requireUser();
  const input = validateTemplate(bodyObject(context.request.body));
  const id = await context.repository.nextId('template');
  const resolved = await resolveNestedFoods(
    context,
    user.id,
    'template',
    `MEAL_TEMPLATE#${id}`,
    id,
    input.nestedIds ?? [],
  );
  const now = new Date().toISOString();
  const template: MealTemplateRecord = {
    pk: `USER#${user.id}`,
    sk: `MEAL_TEMPLATE#${id}`,
    entity_type: 'meal_template',
    id,
    user_id: user.id,
    name: input.name,
    category: input.category,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    food_item_ids: resolved.items.map((item) => item.id),
  };
  await context.repository.saveMealTemplateWithItems(template, resolved.items);
  return jsonResponse(201, templateResponse(template, resolved.items), context.cors);
}

async function listTemplates(context: RouteContext) {
  const user = await context.requireUser();
  const templates = await context.repository.listMealTemplates(user.id);
  const itemsByTemplate = await context.repository.getNutritionItemsForParents(
    'template',
    templates.map((template) => ({
      id: template.id,
      food_item_ids: template.food_item_ids,
    })),
  );
  return jsonResponse(
    200,
    templates.map((template) => templateResponse(
      template,
      itemsByTemplate.get(template.id) ?? [],
    )),
    context.cors,
  );
}

async function loadOwnedTemplate(context: RouteContext, id: number, userId: number) {
  const template = await context.repository.getMealTemplate(id, userId);
  if (!template || template.user_id !== userId) {
    throw new HttpError(404, { detail: 'Not found.' });
  }
  return template;
}

async function retrieveTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const template = await loadOwnedTemplate(context, id, user.id);
  const items = await context.repository.getNutritionItems(
    'template',
    template.id,
    template.food_item_ids,
  );
  return jsonResponse(200, templateResponse(template, items), context.cors);
}

async function updateTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const existing = await loadOwnedTemplate(context, id, user.id);
  const input = validateTemplate(bodyObject(context.request.body), existing);
  let items: NestedFoodItemRecord[];
  if (input.nestedIds) {
    const resolved = await resolveNestedFoods(
      context,
      user.id,
      'template',
      `MEAL_TEMPLATE#${existing.id}`,
      existing.id,
      input.nestedIds,
    );
    items = resolved.items;
  } else {
    items = await context.repository.getNutritionItems(
      'template',
      existing.id,
      existing.food_item_ids,
    );
  }
  const updated: MealTemplateRecord = {
    ...existing,
    name: input.name,
    category: input.category,
    notes: input.notes,
    updated_at: new Date().toISOString(),
    food_item_ids: items.map((item) => item.id),
  };
  await context.repository.replaceMealTemplateWithItems(
    updated,
    existing.food_item_ids,
    items,
  );
  return jsonResponse(200, templateResponse(updated, items), context.cors);
}

async function destroyTemplate(context: RouteContext, id: number) {
  const user = await context.requireUser();
  const template = await loadOwnedTemplate(context, id, user.id);
  await context.repository.deleteMealTemplateWithItems(template);
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
    method: ['GET', 'PUT', 'PATCH', 'DELETE'],
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
      if (context.request.method === 'PUT') {
        return updateMeal(context, id);
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
      return updateTemplate(context, id);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/food/calculations/calculate-calories',
    handle: async (context) => {
      const macros = macroInputs(bodyObject(context.request.body));
      const protein = rational(macros.protein);
      const carbs = rational(macros.carbs);
      const fat = rational(macros.fat);
      return jsonResponse(200, {
        calories: rationalToNumber(addRational(addRational(
          multiplyRational(protein, rationalFromInteger(4)),
          multiplyRational(carbs, rationalFromInteger(4)),
        ), multiplyRational(fat, rationalFromInteger(9)))),
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
      const proteinRatio = rational(protein);
      const carbsRatio = rational(carbs);
      const fatRatio = rational(fat);
      const total = addRational(addRational(proteinRatio, carbsRatio), fatRatio);
      const category = total.numerator === 0n
        ? 'unknown'
        : compareRational(
            proteinRatio,
            multiplyRational(total, { numerator: 2n, denominator: 5n }),
          ) > 0
          ? 'protein'
          : compareRational(
              carbsRatio,
              divideRational(total, rationalFromInteger(2)),
            ) > 0
            ? 'carb'
            : compareRational(
                fatRatio,
                divideRational(total, rationalFromInteger(2)),
              ) > 0
              ? 'fat'
              : 'balanced';
      return jsonResponse(200, {
        category,
        protein_ratio: total.numerator === 0n
          ? 0
          : rationalToNumber(divideRational(proteinRatio, total)),
        carb_ratio: total.numerator === 0n
          ? 0
          : rationalToNumber(divideRational(carbsRatio, total)),
        fat_ratio: total.numerator === 0n
          ? 0
          : rationalToNumber(divideRational(fatRatio, total)),
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
      const proteinRatio = rational(protein);
      const carbsRatio = rational(carbs);
      const fatRatio = rational(fat);
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

      const total = addRational(addRational(proteinRatio, carbsRatio), fatRatio);
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
      const thermicEffect = compareRational(
        proteinRatio,
        multiplyRational(total, { numerator: 3n, denominator: 10n }),
      ) > 0
        ? 'high'
        : compareRational(
            proteinRatio,
            multiplyRational(total, { numerator: 3n, denominator: 20n }),
          ) > 0
          ? 'medium'
          : 'low';
      let satietyScore = 0;
      if (compareRational(
        proteinRatio,
        multiplyRational(total, { numerator: 1n, denominator: 5n }),
      ) > 0) satietyScore += 3;
      if (fiber >= 5) satietyScore += 3;
      else if (fiber >= 3) satietyScore += 2;
      else if (fiber > 0) satietyScore += 1;
      if (compareRational(
        fatRatio,
        multiplyRational(total, { numerator: 1n, denominator: 5n }),
      ) > 0) satietyScore += 2;
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
      const foods = await foodMap(context, user.id, items.map((item) => item.food_id));
      const totals = {
        total_calories: zeroRational(),
        total_protein_g: zeroRational(),
        total_carbs_g: zeroRational(),
        total_fat_g: zeroRational(),
        total_fiber_g: zeroRational(),
        total_sugar_g: zeroRational(),
        total_sodium_mg: zeroRational(),
      };
      for (const item of items) {
        const multiplier = nutritionMultiplier(foods.get(item.food_id), item.grams);
        if (multiplier === undefined) {
          continue;
        }
        const food = foods.get(item.food_id)!;
        const weighted = (field: keyof FoodItemRecord): Rational =>
          multiplyRational(rational((food[field] ?? 0) as number), multiplier);
        totals.total_calories = addRational(totals.total_calories, weighted('calories'));
        totals.total_protein_g = addRational(totals.total_protein_g, weighted('protein'));
        totals.total_carbs_g = addRational(totals.total_carbs_g, weighted('carbs'));
        totals.total_fat_g = addRational(totals.total_fat_g, weighted('fat'));
        totals.total_fiber_g = addRational(totals.total_fiber_g, weighted('fiber'));
        totals.total_sugar_g = addRational(totals.total_sugar_g, weighted('sugar'));
        totals.total_sodium_mg = addRational(totals.total_sodium_mg, weighted('sodium'));
      }
      return jsonResponse(200, Object.fromEntries(Object.entries(totals).map((
        [key, value],
      ) => [key, roundedNumber(value)])), context.cors);
    },
  });
}
