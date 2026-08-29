import type { RouteDefinition } from '../router.js';
import type { JsonObject } from '../types.js';
import { jsonResponse } from '../http.js';
import { ValidationFailure } from '../validation.js';
import {
  addRational,
  multiplyRational,
  rational,
  rationalFromInteger,
  rationalToNumber,
  zeroRational,
  type Rational,
} from '../nutrition-decimal.js';

// Mirrors workouts/serializers.py's VolumeSetSerializer /
// VolumeCalculationRequestSerializer (DecimalField(max_digits=8,
// decimal_places=2), IntegerField(min_value=0, max_value=10000), and the
// custom ExerciseIdentifierField).
const SETS_MAX_LENGTH = 10000;
const WEIGHT_MAX_DIGITS = 8;
const WEIGHT_DECIMAL_PLACES = 2;
const WEIGHT_WHOLE_DIGITS = WEIGHT_MAX_DIGITS - WEIGHT_DECIMAL_PLACES;
const REPS_MIN = 0;
const REPS_MAX = 10000;
const EXERCISE_ID_MAX_LENGTH = 100;

function addFieldError(errors: JsonObject, field: string, message: string): void {
  const existing = errors[field];
  if (Array.isArray(existing)) {
    existing.push(message);
  } else {
    errors[field] = [message];
  }
}

function bodyObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

interface DigitCounts {
  wholeDigits: number;
  decimalPlaces: number;
}

function digitCounts(raw: string): DigitCounts {
  const unsigned = raw.startsWith('-') || raw.startsWith('+') ? raw.slice(1) : raw;
  const [integerPart, fractionalPart = ''] = unsigned.split('.');
  const trimmedInteger = integerPart.replace(/^0+(?=\d)/, '');
  return {
    wholeDigits: trimmedInteger.length,
    decimalPlaces: fractionalPart.length,
  };
}

/** Weight in pounds: DecimalField(max_digits=8, decimal_places=2, min_value=0, default=0). */
function weightLbs(errors: JsonObject, field: string, value: unknown): Rational {
  if (value === undefined) {
    return zeroRational();
  }
  if (typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string')) {
    addFieldError(errors, field, 'A valid number is required.');
    return zeroRational();
  }
  const raw = typeof value === 'string' ? value.trim() : String(value);
  if (raw === '' || !/^[+-]?\d+(\.\d+)?$/.test(raw)) {
    addFieldError(errors, field, 'A valid number is required.');
    return zeroRational();
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    addFieldError(errors, field, 'A valid number is required.');
    return zeroRational();
  }
  // DRF's DecimalField.to_internal_value raises the first precision
  // violation it finds (max_digits, then max_decimal_places, then
  // max_whole_digits) and stops there; min_value is only checked
  // afterwards, as a separate validator, if precision passed.
  const { wholeDigits, decimalPlaces } = digitCounts(raw);
  const totalDigits = wholeDigits + decimalPlaces;
  if (totalDigits > WEIGHT_MAX_DIGITS) {
    addFieldError(
      errors,
      field,
      `Ensure that there are no more than ${WEIGHT_MAX_DIGITS} digits in total.`,
    );
    return zeroRational();
  }
  if (decimalPlaces > WEIGHT_DECIMAL_PLACES) {
    addFieldError(
      errors,
      field,
      `Ensure that there are no more than ${WEIGHT_DECIMAL_PLACES} decimal places.`,
    );
    return zeroRational();
  }
  if (wholeDigits > WEIGHT_WHOLE_DIGITS) {
    addFieldError(
      errors,
      field,
      `Ensure that there are no more than ${WEIGHT_WHOLE_DIGITS} digits before the decimal point.`,
    );
    return zeroRational();
  }
  if (numeric < 0) {
    addFieldError(errors, field, 'Ensure this value is greater than or equal to 0.');
    return zeroRational();
  }
  return rational(numeric);
}

/** reps: IntegerField(min_value=0, max_value=10000, default=0). */
function repsCount(errors: JsonObject, field: string, value: unknown): number {
  if (value === undefined) {
    return 0;
  }
  if (typeof value === 'boolean') {
    addFieldError(errors, field, 'A valid integer is required.');
    return 0;
  }
  // Mirrors IntegerField.to_internal_value's re_decimal handling: strip a
  // trailing ".0"/".00" (but not other fractional parts) before parsing.
  const raw = String(value).replace(/\.0*\s*$/, '');
  const parsed = /^[+-]?\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(parsed)) {
    addFieldError(errors, field, 'A valid integer is required.');
    return 0;
  }
  if (parsed < REPS_MIN) {
    addFieldError(errors, field, `Ensure this value is greater than or equal to ${REPS_MIN}.`);
    return 0;
  }
  if (parsed > REPS_MAX) {
    addFieldError(errors, field, `Ensure this value is less than or equal to ${REPS_MAX}.`);
    return 0;
  }
  return parsed;
}

/**
 * exercise_id: ExerciseIdentifierField(required=False, default="unknown", max_length=100).
 *
 * Numeric exercise identifiers are accepted as-is and grouped by their
 * string representation in the response.
 */
function exerciseIdentifier(errors: JsonObject, field: string, value: unknown): string | number {
  if (value === undefined) {
    return 'unknown';
  }
  if (typeof value === 'boolean' || (typeof value !== 'string' && typeof value !== 'number')) {
    addFieldError(errors, field, 'Not a valid string.');
    return 'unknown';
  }
  if (typeof value === 'number') {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    addFieldError(errors, field, 'This field may not be blank.');
    return 'unknown';
  }
  if (trimmed.length > EXERCISE_ID_MAX_LENGTH) {
    addFieldError(
      errors,
      field,
      `Ensure this field has no more than ${EXERCISE_ID_MAX_LENGTH} characters.`,
    );
    return 'unknown';
  }
  return trimmed;
}

interface VolumeSet {
  weightLbs: Rational;
  reps: number;
  exerciseId: string | number;
}

function validateVolumeRequest(body: JsonObject): VolumeSet[] {
  const topLevelErrors: JsonObject = {};
  const rawSets = 'sets' in body ? body.sets : [];
  if (rawSets === undefined || rawSets === null) {
    return [];
  }
  if (!Array.isArray(rawSets)) {
    addFieldError(
      topLevelErrors,
      'sets',
      `Expected a list of items but got type "${typeof rawSets === 'object' ? 'dict' : typeof rawSets}".`,
    );
    throw new ValidationFailure(topLevelErrors);
  }
  if (rawSets.length > SETS_MAX_LENGTH) {
    addFieldError(
      topLevelErrors,
      'sets',
      `Ensure this field has no more than ${SETS_MAX_LENGTH} elements.`,
    );
    throw new ValidationFailure(topLevelErrors);
  }

  const itemErrors: JsonObject = {};
  const sets: VolumeSet[] = [];
  rawSets.forEach((item, index) => {
    const errors: JsonObject = {};
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      addFieldError(
        errors,
        'non_field_errors',
        `Invalid data. Expected a dictionary, but got ${Array.isArray(item) ? 'list' : item === null ? 'NoneType' : typeof item}.`,
      );
      itemErrors[index] = errors;
      return;
    }
    const entry = item as JsonObject;
    const weight = weightLbs(errors, 'weight_lbs', entry.weight_lbs);
    const reps = repsCount(errors, 'reps', entry.reps);
    const exerciseId = exerciseIdentifier(errors, 'exercise_id', entry.exercise_id);
    if (Object.keys(errors).length > 0) {
      itemErrors[index] = errors;
      return;
    }
    sets.push({ weightLbs: weight, reps, exerciseId });
  });
  if (Object.keys(itemErrors).length > 0) {
    throw new ValidationFailure({ sets: itemErrors });
  }
  return sets;
}

export function registerWorkoutCalculationRoutes(
  addRoute: (route: RouteDefinition) => void,
): void {
  addRoute({
    method: 'POST',
    pattern: '/api/workouts/calculations/calculate-volume',
    handle: async (context) => {
      await context.requireUser();
      const sets = validateVolumeRequest(bodyObject(context.request.body));

      let totalVolume = zeroRational();
      const volumeByExercise = new Map<string, Rational>();
      for (const set of sets) {
        const setVolume = multiplyRational(set.weightLbs, rationalFromInteger(set.reps));
        totalVolume = addRational(totalVolume, setVolume);
        const key = String(set.exerciseId);
        volumeByExercise.set(
          key,
          addRational(volumeByExercise.get(key) ?? zeroRational(), setVolume),
        );
      }

      return jsonResponse(200, {
        total_volume: rationalToNumber(totalVolume),
        volume_by_exercise: Object.fromEntries(
          [...volumeByExercise.entries()].map(([key, value]) => [key, rationalToNumber(value)]),
        ),
      }, context.cors);
    },
  });
}
