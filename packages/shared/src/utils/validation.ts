import { z } from 'zod';

// Auth & User
export const userProfileSchema = z.object({
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  birthdate: z.coerce.date().optional(),
  units: z.enum(['METRIC', 'ENGLISH']),
});

// Exercise
export const exerciseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['WEIGHT_BASED', 'BODYWEIGHT', 'DURATION_BASED']),
  equipment: z.string().optional(),
  movementPattern: z.enum([
    'PUSH',
    'PULL',
    'HINGE',
    'SQUAT',
    'CARRY',
    'ROTATE',
    'LUNGE',
    'GAIT',
  ]).optional(),
  classification: z.enum(['UPPER_BODY', 'LOWER_BODY', 'CORE', 'FULL_BODY']),
  primaryMuscles: z.array(z.enum([
    'HEAD_NECK',
    'CHEST',
    'BACK',
    'SHOULDERS',
    'BICEPS',
    'TRICEPS',
    'FOREARMS',
    'ABS',
    'OBLIQUES',
    'LOWER_BACK',
    'GLUTES',
    'QUADS',
    'HAMSTRINGS',
    'CALVES',
    'HIP_FLEXORS',
    'ADDUCTORS',
    'ABDUCTORS',
  ])).min(1),
  secondaryMuscles: z.array(z.string()).optional(),
  stabilizerMuscles: z.array(z.string()).optional(),
});

// Workout Session
export const workoutSessionSchema = z.object({
  date: z.coerce.date(),
  startTimestamp: z.coerce.date(),
  endTimestamp: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

// Exercise Set
export const exerciseSetSchema = z.object({
  exerciseId: z.string().min(1),
  setType: z.enum(['WARM_UP', 'WORKING', 'DROP_SET', 'FAILURE']),
  weight: z.number().nonnegative().optional(),
  reps: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  endTimestamp: z.coerce.date(),
});

// Food Item
export const foodItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['CARB', 'PROTEIN', 'FAT', 'MIXED']),
  caloriesPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative().optional(),
  glycemicIndex: z.number().int().min(0).max(100).optional(),
  absorptionSpeed: z.enum(['FAST', 'MODERATE', 'SLOW']).optional(),
  insulinResponse: z.enum(['LOW', 'MODERATE', 'HIGH']).optional(),
  satietyScore: z.number().int().min(1).max(10).optional(),
  barcode: z.string().optional(),
});

// Meal Instance
export const mealInstanceSchema = z.object({
  timestamp: z.coerce.date(),
  category: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'POST_WORKOUT', 'BEVERAGE']),
  notes: z.string().max(1000).optional(),
  ingredients: z.array(z.object({
    foodItemId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});

// Sleep Session
export const sleepSessionSchema = z.object({
  date: z.coerce.date(),
  bedtime: z.coerce.date(),
  wakeTime: z.coerce.date(),
  qualityScore: z.number().int().min(1).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// Activity
export const activitySchema = z.object({
  type: z.enum(['WALKING', 'RUNNING', 'CYCLING', 'SWIMMING', 'HIKING', 'STANDING', 'OTHER']),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  steps: z.number().int().nonnegative().optional(),
  distance: z.number().nonnegative().optional(),
  caloriesBurned: z.number().int().nonnegative().optional(),
  averageHeartRate: z.number().int().positive().optional(),
  maxHeartRate: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

// Goal
export const goalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum([
    'WEIGHT_LOSS',
    'WEIGHT_GAIN',
    'MAINTENANCE',
    'MUSCLE_GAIN',
    'STRENGTH',
    'ENDURANCE',
    'HEALTH',
  ]),
  target: z.object({
    weight: z.number().positive().optional(),
    bodyFatPercentage: z.number().min(0).max(100).optional(),
    strength: z.object({
      exerciseId: z.string().min(1),
      targetWeight: z.number().positive(),
      targetReps: z.number().int().positive(),
    }).optional(),
    activity: z.object({
      workoutsPerWeek: z.number().int().positive().optional(),
      caloriesPerDay: z.number().int().positive().optional(),
      stepsPerDay: z.number().int().positive().optional(),
    }).optional(),
  }),
  startDate: z.coerce.date(),
  targetDate: z.coerce.date().optional(),
});

// Types
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type WorkoutSessionInput = z.infer<typeof workoutSessionSchema>;
export type ExerciseSetInput = z.infer<typeof exerciseSetSchema>;
export type FoodItemInput = z.infer<typeof foodItemSchema>;
export type MealInstanceInput = z.infer<typeof mealInstanceSchema>;
export type SleepSessionInput = z.infer<typeof sleepSessionSchema>;
export type ActivityInput = z.infer<typeof activitySchema>;
export type GoalInput = z.infer<typeof goalSchema>;
