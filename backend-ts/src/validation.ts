import type { JsonObject } from './types.js';
import { HttpError } from './types.js';

export class ValidationFailure extends HttpError {
  constructor(errors: JsonObject) {
    super(400, errors);
    this.name = 'ValidationFailure';
  }
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

function requiredString(
  errors: JsonObject,
  data: JsonObject,
  field: string,
  maxLength?: number,
): string | undefined {
  if (!(field in data)) {
    addError(errors, field, 'This field is required.');
    return undefined;
  }
  const value = data[field];
  if (typeof value !== 'string') {
    addError(errors, field, 'A valid string is required.');
    return undefined;
  }
  if (value.trim().length === 0) {
    addError(errors, field, 'This field may not be blank.');
    return undefined;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    addError(errors, field, `Ensure this field has no more than ${maxLength} characters.`);
    return undefined;
  }
  return value;
}

export interface LoginInput {
  username: string;
  password: string;
}

export function validateLogin(data: unknown): LoginInput {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationFailure({ detail: ['Invalid request body.'] });
  }
  const input = data as JsonObject;
  const errors: JsonObject = {};
  const username = requiredString(errors, input, 'username', 255);
  const password = requiredString(errors, input, 'password');
  failIfErrors(errors);
  return { username: username as string, password: password as string };
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

const commonPasswords = new Set([
  'password', '12345678', 'qwerty123', 'password1', 'iloveyou',
  'admin123', 'letmein123', 'welcome1', 'monkey123', 'dragon123',
]);

function similarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }
  const distance = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = distance[0];
    distance[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = distance[leftIndex];
      distance[leftIndex] = Math.min(
        distance[leftIndex] + 1,
        distance[leftIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return (Math.max(left.length, right.length) - distance[left.length]) /
    Math.max(left.length, right.length);
}

export function validateRegistration(data: unknown): RegistrationInput {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationFailure({ detail: ['Invalid request body.'] });
  }
  const input = data as JsonObject;
  const errors: JsonObject = {};

  const username = requiredString(errors, input, 'username', 255);
  const email = requiredString(errors, input, 'email', 255);
  const password = requiredString(errors, input, 'password');
  const passwordConfirm = requiredString(errors, input, 'password_confirm');
  if (email !== undefined && !validEmail(email)) {
    addError(errors, 'email', 'Enter a valid email address.');
  }
  if (password !== undefined && password.length < 8) {
    addError(errors, 'password', 'Ensure this field has at least 8 characters.');
  }
  failIfErrors(errors);

  if (password !== passwordConfirm) {
    throw new ValidationFailure({ error: 'Password fields did not match.' });
  }

  if (
    username === undefined ||
    email === undefined ||
    password === undefined ||
    passwordConfirm === undefined
  ) {
    throw new ValidationFailure(errors);
  }

  const passwordMessages: string[] = [];
  if (similarity(password.toLowerCase(), username.toLowerCase()) > 0.7) {
    passwordMessages.push('The password is too similar to the username.');
  }
  if (similarity(password.toLowerCase(), email.toLowerCase()) > 0.7) {
    passwordMessages.push('The password is too similar to the email address.');
  }
  if (commonPasswords.has(password.toLowerCase())) {
    passwordMessages.push('This password is too common.');
  }
  if (/^\d+$/.test(password)) {
    passwordMessages.push('This password is entirely numeric.');
  }
  if (passwordMessages.length > 0) {
    throw new ValidationFailure({ error: passwordMessages.join(' ') });
  }

  return {
    username: username as string,
    email: email as string,
    password: password as string,
    password_confirm: passwordConfirm as string,
  };
}

type NumberLike = number;

function invalidNumber(value: unknown): value is string | boolean | null | object {
  return typeof value !== 'number' || !Number.isFinite(value);
}

function validateWeight(
  errors: JsonObject,
  field: string,
  value: unknown,
  allowNull: boolean,
): void {
  if (value === undefined || (allowNull && value === null)) {
    return;
  }
  if (invalidNumber(value)) {
    addError(errors, field, 'A valid number is required.');
    return;
  }
  const numberValue = value as NumberLike;
  if (numberValue < 0) {
    addError(errors, field, 'Ensure this value is greater than or equal to 0.');
  }
  if (numberValue > 9_999.99) {
    addError(errors, field, 'Ensure this value is less than or equal to 9999.99.');
  }
}

function validateReps(errors: JsonObject, field: string, value: unknown): number | undefined {
  if (!Number.isSafeInteger(value)) {
    addError(errors, field, 'A valid integer is required.');
    return undefined;
  }
  const numberValue = value as number;
  if (numberValue < 0) {
    addError(errors, field, 'Ensure this value is greater than or equal to 0.');
  }
  if (numberValue > 10_000) {
    addError(errors, field, 'Ensure this value is less than or equal to 10000.');
  }
  return numberValue;
}

export interface ExerciseSettingsInput {
  weight?: number | null;
  reps: number;
  subSets?: Array<{ weight?: number | null; reps: number }>;
}

export function validateExerciseSettings(data: unknown): ExerciseSettingsInput {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationFailure({ detail: ['Invalid request body.'] });
  }
  const input = data as JsonObject;
  const errors: JsonObject = {};
  const hasWeight = 'weight' in input;
  validateWeight(errors, 'weight', input.weight, true);

  let reps = 10;
  if ('reps' in input) {
    const parsedReps = validateReps(errors, 'reps', input.reps);
    if (parsedReps !== undefined) {
      reps = parsedReps;
    }
  }

  let subSets: Array<{ weight?: number | null; reps: number }> | undefined;
  if ('subSets' in input) {
    if (!Array.isArray(input.subSets)) {
      addError(errors, 'subSets', 'Expected a list of items but got type "str".');
    } else {
      if (input.subSets.length > 20) {
        addError(errors, 'subSets', 'Ensure this field has no more than 20 elements.');
      }
      const parsedSubSets: Array<{ weight?: number | null; reps: number }> = [];
      const subsetErrors = input.subSets.map(() => ({}) as JsonObject);
      input.subSets.forEach((entry, index) => {
        const target = subsetErrors[index];
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          addError(target, 'weight', 'A valid number is required.');
          addError(target, 'reps', 'A valid integer is required.');
          return;
        }
        const subset = entry as JsonObject;
        if (!('weight' in subset)) {
          addError(target, 'weight', 'This field is required.');
        } else {
          validateWeight(target, 'weight', subset.weight, false);
        }
        if ('reps' in subset) {
          const subsetReps = validateReps(target, 'reps', subset.reps);
          if (Object.keys(target).length === 0 && subsetReps !== undefined) {
            const result: { weight?: number | null; reps: number } = { reps: subsetReps };
            if (subset.weight !== undefined) {
              result.weight = subset.weight as number;
            }
            parsedSubSets.push(result);
          }
        } else {
          addError(target, 'reps', 'This field is required.');
        }
      });
      if (subsetErrors.some((entry) => Object.keys(entry).length > 0)) {
        errors.subSets = subsetErrors;
      } else {
        subSets = parsedSubSets;
      }
    }
  }

  failIfErrors(errors);
  return {
    ...(hasWeight ? { weight: input.weight as number | null } : {}),
    reps,
    ...(subSets !== undefined ? { subSets } : {}),
  };
}
