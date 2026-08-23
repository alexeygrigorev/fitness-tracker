import type {
  ApiResponse,
  JsonObject,
  NormalizedRequest,
} from '../types.js';
import { HttpError } from '../types.js';
import { jsonResponse } from '../http.js';
import { ValidationFailure } from '../validation.js';
import type {
  RouteContext,
  RouteDefinition,
} from '../router.js';

export interface FoodItemItem {
  pk: string;
  sk: string;
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
}

interface AnalyzedIngredient {
  name: string;
  brand?: string | null;
  category: string;
  servingSize: number;
  servingType: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number | null;
  sugar: number;
  fiber: number;
  sodium?: number | null;
  glycemicIndex: number;
  absorptionSpeed: string;
  insulinResponse: number;
  satietyScore: number;
  proteinQuality: number;
}

const foodCategories = new Set(['carb', 'protein', 'fat', 'mixed', 'beverage']);
const absorptionSpeeds = new Set(['slow', 'moderate', 'fast']);

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

function validateDescription(request: NormalizedRequest): string {
  const input = assertJsonObject(request.body);
  const errors: JsonObject = {};
  const value = input.description ?? '';
  if (typeof value !== 'string') {
    errors.description = ['A valid string is required.'];
    throw new ValidationFailure(errors);
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length > 2000) {
    addError(errors, 'description', 'Ensure this field has no more than 2000 characters.');
    throw new ValidationFailure(errors);
  }
  return trimmedValue;
}

function pythonTitle(value: string): string {
  let atWordStart = true;
  let result = '';
  for (const character of value.toLowerCase()) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      result += atWordStart ? character.toUpperCase() : character;
      atWordStart = false;
    } else {
      result += character;
      atWordStart = true;
    }
  }
  return result;
}

function analysisName(description: string, fallback: string): string {
  return description ? pythonTitle(description) : fallback;
}

function parsedNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue)
    ? numberValue
    : undefined;
}

function requiredNumber(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  minimum: number,
): number | undefined {
  if (!(field in input)) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  const value = parsedNumber(input[field]);
  if (value === undefined) {
    addError(errors, field, 'A valid number is required.');
    return undefined;
  }
  if (value < minimum) {
    addError(errors, field, `Ensure this value is greater than or equal to ${minimum}.`);
    return undefined;
  }
  return value;
}

function optionalNullableNumber(
  errors: JsonObject,
  input: JsonObject,
  field: string,
): number | null | undefined {
  if (!(field in input)) {
    return undefined;
  }
  const raw = input[field];
  if (raw === null) {
    return null;
  }
  const value = parsedNumber(raw);
  if (value === undefined) {
    addError(errors, field, 'A valid number is required.');
    return undefined;
  }
  if (value < 0) {
    addError(errors, field, 'Ensure this value is greater than or equal to 0.');
    return undefined;
  }
  return value;
}

function requiredInteger(
  errors: JsonObject,
  input: JsonObject,
  field: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = requiredNumber(errors, input, field, minimum);
  if (value === undefined || !Number.isSafeInteger(value)) {
    if (value !== undefined) {
      addError(errors, field, 'A valid integer is required.');
    }
    return undefined;
  }
  if (value < minimum || value > maximum) {
    addError(errors, field, `Ensure this value is between ${minimum} and ${maximum}.`);
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
  const value = input[field];
  if (!(field in input)) {
    addError(errors, field, 'This field is required.');
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
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  if (maxLength !== undefined && trimmedValue.length > maxLength) {
    addError(errors, field, `Ensure this field has no more than ${maxLength} characters.`);
    return undefined;
  }
  return trimmedValue;
}

function optionalBrand(input: JsonObject, errors: JsonObject): string | null | undefined {
  if (!('brand' in input)) {
    return undefined;
  }
  const value = input.brand;
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    addError(errors, 'brand', 'A valid string is required.');
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length > 255) {
    addError(errors, 'brand', 'Ensure this field has no more than 255 characters.');
    return undefined;
  }
  return trimmedValue === '' ? null : trimmedValue;
}

function parseAnalyzedFood(entry: unknown, index: number): AnalyzedIngredient {
  const errors: JsonObject = {};
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new ValidationFailure({
      foods: [{ [index]: ['Invalid data. Expected a dictionary, but got other type.'] }],
    });
  }
  const input = entry as JsonObject;
  const name = requiredString(errors, input, 'name', 255);
  const brand = optionalBrand(input, errors);
  const category = requiredChoice(errors, input, 'category', foodCategories);
  const servingSize = requiredNumber(errors, input, 'servingSize', 0.01);
  const servingType = requiredString(errors, input, 'servingType', 50);
  const grams = requiredNumber(errors, input, 'grams', 0.01);
  const calories = requiredNumber(errors, input, 'calories', 0);
  const protein = requiredNumber(errors, input, 'protein', 0);
  const carbs = requiredNumber(errors, input, 'carbs', 0);
  const fat = requiredNumber(errors, input, 'fat', 0);
  const saturatedFat = optionalNullableNumber(errors, input, 'saturatedFat');
  const sugar = requiredNumber(errors, input, 'sugar', 0);
  const fiber = requiredNumber(errors, input, 'fiber', 0);
  const sodium = optionalNullableNumber(errors, input, 'sodium');
  const glycemicIndex = requiredInteger(errors, input, 'glycemicIndex', 0, 100);
  const absorptionSpeed = requiredChoice(errors, input, 'absorptionSpeed', absorptionSpeeds);
  const insulinResponse = requiredNumber(errors, input, 'insulinResponse', 0);
  if (
    insulinResponse !== undefined &&
    (insulinResponse < 0 || insulinResponse > 100)
  ) {
    addError(errors, 'insulinResponse', 'Ensure this value is between 0 and 100.');
  }
  const satietyScore = requiredInteger(errors, input, 'satietyScore', 0, 10);
  const proteinQuality = requiredInteger(errors, input, 'proteinQuality', 1, 3);

  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure({ foods: [{ [index]: errors }] });
  }

  return {
    name: name as string,
    ...(brand === undefined ? {} : { brand }),
    category: category as string,
    servingSize: servingSize as number,
    servingType: servingType as string,
    grams: grams as number,
    calories: calories as number,
    protein: protein as number,
    carbs: carbs as number,
    fat: fat as number,
    ...(saturatedFat === undefined ? {} : { saturatedFat }),
    sugar: sugar as number,
    fiber: fiber as number,
    ...(sodium === undefined ? {} : { sodium }),
    glycemicIndex: glycemicIndex as number,
    absorptionSpeed: absorptionSpeed as string,
    insulinResponse: insulinResponse as number,
    satietyScore: satietyScore as number,
    proteinQuality: proteinQuality as number,
  };
}

function validateIngredients(data: unknown): AnalyzedIngredient[] {
  const input = assertJsonObject(data);
  if (!('foods' in input) || !Array.isArray(input.foods)) {
    throw new ValidationFailure({ foods: ['This field is required.'] });
  }
  if (input.foods.length === 0) {
    throw new ValidationFailure({ foods: ['At least one food is required.'] });
  }
  if (input.foods.length > 200) {
    throw new ValidationFailure({ foods: ['A meal may contain at most 200 foods.'] });
  }
  return input.foods.map((entry, index) => parseAnalyzedFood(entry, index));
}

function normalizedIdentity(name: string, brand: string | null | undefined): string {
  const normalizedBrand = (brand ?? '').trim().toLowerCase();
  return `${name.trim().toLowerCase()}\u0000${normalizedBrand}`;
}

function decimalRepresentation(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number.isInteger(value) ? value : value;
}

function foodResponse(item: FoodItemItem): Record<string, unknown> {
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

function foodFromIngredient(
  id: number,
  userId: number,
  ingredient: AnalyzedIngredient,
): FoodItemItem {
  const name = ingredient.name.trim();
  const brand = ingredient.brand?.trim() || null;
  return {
    pk: `USER#${userId}`,
    sk: `FOOD#${id}`,
    id,
    user_id: userId,
    name,
    ...(brand === null ? {} : { brand }),
    barcode: null,
    source: 'user',
    serving_size: ingredient.servingSize,
    serving_unit: ingredient.servingType,
    calories: ingredient.calories,
    protein: ingredient.protein,
    carbs: ingredient.carbs,
    fat: ingredient.fat,
    saturated_fat: ingredient.saturatedFat ?? null,
    fiber: ingredient.fiber,
    sugar: ingredient.sugar,
    sodium: ingredient.sodium ?? null,
    category: ingredient.category,
    glycemic_index: ingredient.glycemicIndex,
    absorption_speed: ingredient.absorptionSpeed,
    insulin_response: ingredient.insulinResponse,
    satiety_score: ingredient.satietyScore,
    protein_quality: ingredient.proteinQuality,
  };
}

async function resolveMealIngredients(
  context: RouteContext,
): Promise<ApiResponse> {
  const user = await context.requireUser();
  const ingredients = validateIngredients(context.request.body);

  const identityByIngredient = ingredients.map((ingredient) =>
    normalizedIdentity(ingredient.name, ingredient.brand),
  );
  const uniqueIngredients = new Map(identityByIngredient.map((identity, index) => [
    identity,
    ingredients[index],
  ] as const));

  const [canonicalFoods, userFoods] = await Promise.all([
    context.repository.queryPartition<FoodItemItem>({
      partitionKey: 'CANONICAL_FOODS',
      sortPrefix: 'FOOD#',
    }),
    context.repository.queryPartition<FoodItemItem>({
      partitionKey: `USER#${user.id}`,
      sortPrefix: 'FOOD#',
    }),
  ]);

  const canonicalByIdentity = new Map<string, FoodItemItem>();
  for (const food of [...canonicalFoods].sort((left, right) => left.id - right.id)) {
    const identity = normalizedIdentity(food.name, food.brand);
    if (!canonicalByIdentity.has(identity)) {
      canonicalByIdentity.set(identity, food);
    }
  }
  const ownedByIdentity = new Map<string, FoodItemItem>();
  for (const food of [...userFoods].sort((left, right) => left.id - right.id)) {
    const identity = normalizedIdentity(food.name, food.brand);
    if (!ownedByIdentity.has(identity)) {
      ownedByIdentity.set(identity, food);
    }
  }

  const resolvedByIdentity = new Map<string, FoodItemItem>();
  const missingIdentities: string[] = [];
  for (const [identity] of uniqueIngredients.entries()) {
    const existing = ownedByIdentity.get(identity) ?? canonicalByIdentity.get(identity);
    if (existing) {
      resolvedByIdentity.set(identity, existing);
    } else {
      missingIdentities.push(identity);
    }
  }

  if (missingIdentities.length > 0) {
    const createdFoods: FoodItemItem[] = [];
    for (const identity of missingIdentities) {
      const id = await context.repository.nextId('food');
      createdFoods.push(
        foodFromIngredient(id, user.id, uniqueIngredients.get(identity) as AnalyzedIngredient),
      );
    }

    await context.repository.transact(createdFoods.map((food) => ({
      Put: {
        TableName: context.config.tableName,
        Item: food,
        ConditionExpression:
          'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })));

    for (const [index, identity] of missingIdentities.entries()) {
      resolvedByIdentity.set(identity, createdFoods[index]);
    }
  }

  return jsonResponse(
    200,
    identityByIngredient.map((identity) =>
      foodResponse(resolvedByIdentity.get(identity) as FoodItemItem)),
    context.cors,
  );
}

async function createFood(context: RouteContext): Promise<ApiResponse> {
  const user = await context.requireUser();
  const input = assertJsonObject(context.request.body);
  const errors: JsonObject = {};
  const name = requiredString(errors, input, 'name', 255);
  const servingSize = requiredNumber(errors, input, 'servingSize', 0.01);
  const servingType = requiredString(errors, input, 'servingType', 50);
  const calories = requiredNumber(errors, input, 'calories', 0);
  const protein = requiredNumber(errors, input, 'protein', 0);
  const carbs = requiredNumber(errors, input, 'carbs', 0);
  const fat = requiredNumber(errors, input, 'fat', 0);
  const saturatedFat = optionalNullableNumber(errors, input, 'saturatedFat');
  const sugar = requiredNumber(errors, input, 'sugar', 0);
  const fiber = requiredNumber(errors, input, 'fiber', 0);
  const sodium = optionalNullableNumber(errors, input, 'sodium');
  const brand = optionalBrand(input, errors);
  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure(errors);
  }

  const id = await context.repository.nextId('food');
  const food = {
    pk: `USER#${user.id}`,
    sk: `FOOD#${id}`,
    id,
    user_id: user.id,
    name: name as string,
    ...(brand === undefined || brand === null ? {} : { brand }),
    barcode: null,
    source: 'user' as const,
    serving_size: servingSize as number,
    serving_unit: servingType as string,
    calories: calories as number,
    protein: protein as number,
    carbs: carbs as number,
    fat: fat as number,
    saturated_fat: saturatedFat ?? null,
    fiber: fiber as number,
    sugar: sugar as number,
    sodium: sodium ?? null,
    category: typeof input.category === 'string' && input.category !== '' ? input.category : null,
    glycemic_index: typeof input.glycemicIndex === 'number' ? input.glycemicIndex : null,
    absorption_speed: typeof input.absorptionSpeed === 'string' && input.absorptionSpeed !== '' ? input.absorptionSpeed : null,
    insulin_response: typeof input.insulinResponse === 'number' ? input.insulinResponse : null,
    satiety_score: typeof input.satietyScore === 'number' ? input.satietyScore : null,
    protein_quality: typeof input.proteinQuality === 'number' ? input.proteinQuality : null,
  } satisfies FoodItemItem;
  await context.repository.put(food);
  return jsonResponse(201, foodResponse(food), context.cors);
}

export function registerAiRoutes(addRoute: (route: RouteDefinition) => void): void {
  addRoute({
    method: 'POST',
    pattern: '/api/ai/analyze-food',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const description = validateDescription(context.request);
      return jsonResponse(200, {
        name: analysisName(description, 'Unknown Food'),
        brand: null,
        category: 'mixed',
        servingSize: 100,
        servingType: 'g',
        calories: 150,
        protein: 10,
        carbs: 20,
        fat: 5,
        saturatedFat: 1,
        sugar: 5,
        fiber: 2,
        sodium: 300,
        glycemicIndex: 45,
        absorptionSpeed: 'moderate',
        insulinResponse: 45,
        satietyScore: 5,
        proteinQuality: 2,
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/ai/analyze-meal',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const description = validateDescription(context.request);
      const proteinSource = {
        name: 'Protein Source',
        brand: null,
        category: 'protein',
        servingSize: 100,
        servingType: 'g',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 4,
        saturatedFat: 1,
        sugar: 0,
        fiber: 0,
        sodium: 75,
        glycemicIndex: 0,
        absorptionSpeed: 'slow',
        insulinResponse: 20,
        satietyScore: 8,
        proteinQuality: 3,
        grams: 150,
      };
      return jsonResponse(200, {
        name: analysisName(description, 'Unknown Meal'),
        mealType: 'lunch',
        foods: [
          proteinSource,
          {
            ...proteinSource,
            name: 'Vegetable',
            category: 'mixed',
            calories: 50,
            protein: 2,
            carbs: 10,
            fat: 0,
            saturatedFat: 0,
            sugar: 4,
            fiber: 3,
            sodium: 30,
            glycemicIndex: 35,
            absorptionSpeed: 'moderate',
            insulinResponse: 25,
            satietyScore: 5,
            proteinQuality: 1,
            grams: 100,
          },
        ],
      }, context.cors);
    },
  });

  addRoute({
    method: 'POST',
    pattern: '/api/ai/meal-foods',
    authRequired: true,
    authBeforeMethod: true,
    handle: resolveMealIngredients,
  });

  addRoute({
    method: 'POST',
    pattern: '/api/ai/analyze-exercise',
    authRequired: true,
    authBeforeMethod: true,
    handle: async (context) => {
      const description = validateDescription(context.request);
      return jsonResponse(200, {
        name: analysisName(description, 'Unknown Exercise'),
        category: 'compound',
        muscleGroups: ['chest', 'triceps', 'shoulders'],
        equipment: 'dumbbells',
        instructions: [
          'Lie on a bench holding dumbbells at chest height.',
          'Press the dumbbells upward until your arms are extended.',
          'Lower them under control to the starting position.',
        ],
        bodyweight: false,
      }, context.cors);
    },
  });

  // This narrow write path preserves the AI-created food contract until the
  // nutrition lane's complete FoodItem CRUD is merged.
  addRoute({
    method: 'POST',
    pattern: '/api/food/foods',
    authRequired: true,
    authBeforeMethod: true,
    handle: createFood,
  });
}
