import { describe, it, expect } from 'vitest';
import {
  userProfileSchema,
  exerciseSchema,
  workoutSessionSchema,
  exerciseSetSchema,
  foodItemSchema,
  mealInstanceSchema,
  sleepSessionSchema,
  activitySchema,
  goalSchema,
} from './validation';

describe('Validation Schemas', () => {
  describe('userProfileSchema', () => {
    it('should validate a valid user profile', () => {
      const result = userProfileSchema.safeParse({
        weight: 75,
        height: 180,
        birthdate: '1990-01-15',
        units: 'METRIC',
      });
      expect(result.success).toBe(true);
    });

    it('should validate with only units', () => {
      const result = userProfileSchema.safeParse({
        units: 'ENGLISH',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid units', () => {
      const result = userProfileSchema.safeParse({
        units: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative weight', () => {
      const result = userProfileSchema.safeParse({
        weight: -10,
        units: 'METRIC',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('exerciseSchema', () => {
    it('should validate a valid exercise', () => {
      const result = exerciseSchema.safeParse({
        name: 'Bench Press',
        type: 'WEIGHT_BASED',
        primaryMuscles: ['CHEST', 'TRICEPS'],
        classification: 'UPPER_BODY',
      });
      expect(result.success).toBe(true);
    });

    it('should validate with optional fields', () => {
      const result = exerciseSchema.safeParse({
        name: 'Squat',
        type: 'WEIGHT_BASED',
        equipment: 'Barbell',
        movementPattern: 'SQUAT',
        primaryMuscles: ['QUADS', 'GLUTES'],
        classification: 'LOWER_BODY',
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one primary muscle', () => {
      const result = exerciseSchema.safeParse({
        name: 'Exercise',
        type: 'WEIGHT_BASED',
        primaryMuscles: [],
        classification: 'UPPER_BODY',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid exercise type', () => {
      const result = exerciseSchema.safeParse({
        name: 'Exercise',
        type: 'INVALID',
        primaryMuscles: ['CHEST'],
        classification: 'UPPER_BODY',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('workoutSessionSchema', () => {
    it('should validate a valid workout session', () => {
      const result = workoutSessionSchema.safeParse({
        date: '2024-01-15',
        startTimestamp: '2024-01-15T10:00:00Z',
        endTimestamp: '2024-01-15T11:30:00Z',
        notes: 'Great workout!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimal workout session', () => {
      const result = workoutSessionSchema.safeParse({
        date: '2024-01-15',
        startTimestamp: '2024-01-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('exerciseSetSchema', () => {
    it('should validate a valid working set', () => {
      const result = exerciseSetSchema.safeParse({
        exerciseId: 'bench-press',
        setType: 'WORKING',
        weight: 80,
        reps: 10,
        rpe: 8,
        endTimestamp: '2024-01-15T10:15:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate a bodyweight set', () => {
      const result = exerciseSetSchema.safeParse({
        exerciseId: 'pull-up',
        setType: 'WORKING',
        reps: 15,
        endTimestamp: '2024-01-15T10:15:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate a duration-based set', () => {
      const result = exerciseSetSchema.safeParse({
        exerciseId: 'plank',
        setType: 'WORKING',
        duration: 60,
        endTimestamp: '2024-01-15T10:15:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative weight', () => {
      const result = exerciseSetSchema.safeParse({
        exerciseId: 'squat',
        setType: 'WORKING',
        weight: -10,
        reps: 10,
        endTimestamp: '2024-01-15T10:15:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject RPE outside valid range', () => {
      const result = exerciseSetSchema.safeParse({
        exerciseId: 'bench-press',
        setType: 'WORKING',
        weight: 80,
        reps: 10,
        rpe: 11, // Must be 1-10
        endTimestamp: '2024-01-15T10:15:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('foodItemSchema', () => {
    it('should validate a valid food item', () => {
      const result = foodItemSchema.safeParse({
        name: 'Chicken Breast',
        category: 'PROTEIN',
        caloriesPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        satietyScore: 8,
      });
      expect(result.success).toBe(true);
    });

    it('should validate with all optional fields', () => {
      const result = foodItemSchema.safeParse({
        name: 'Brown Rice',
        category: 'CARB',
        caloriesPer100g: 123,
        proteinPer100g: 2.6,
        carbsPer100g: 25.6,
        fatPer100g: 0.9,
        fiberPer100g: 1.6,
        glycemicIndex: 68,
        absorptionSpeed: 'MODERATE',
        insulinResponse: 'MODERATE',
        satietyScore: 6,
        barcode: '1234567890123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative calories', () => {
      const result = foodItemSchema.safeParse({
        name: 'Food',
        category: 'MIXED',
        caloriesPer100g: -10,
        proteinPer100g: 0,
        carbsPer100g: 0,
        fatPer100g: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('mealInstanceSchema', () => {
    it('should validate a valid meal', () => {
      const result = mealInstanceSchema.safeParse({
        timestamp: '2024-01-15T12:00:00Z',
        category: 'LUNCH',
        ingredients: [
          { foodItemId: 'chicken', quantity: 150 },
          { foodItemId: 'rice', quantity: 100 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one ingredient', () => {
      const result = mealInstanceSchema.safeParse({
        timestamp: '2024-01-15T12:00:00Z',
        category: 'LUNCH',
        ingredients: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative quantities', () => {
      const result = mealInstanceSchema.safeParse({
        timestamp: '2024-01-15T12:00:00Z',
        category: 'LUNCH',
        ingredients: [{ foodItemId: 'food', quantity: -10 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sleepSessionSchema', () => {
    it('should validate a valid sleep session', () => {
      const result = sleepSessionSchema.safeParse({
        date: '2024-01-15',
        bedtime: '2024-01-14T23:00:00Z',
        wakeTime: '2024-01-15T07:00:00Z',
        qualityScore: 85,
        notes: 'Slept well',
      });
      expect(result.success).toBe(true);
    });

    it('should accept sleep session without quality score', () => {
      const result = sleepSessionSchema.safeParse({
        date: '2024-01-15',
        bedtime: '2024-01-14T23:00:00Z',
        wakeTime: '2024-01-15T07:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject quality score outside valid range', () => {
      const result = sleepSessionSchema.safeParse({
        date: '2024-01-15',
        bedtime: '2024-01-14T23:00:00Z',
        wakeTime: '2024-01-15T07:00:00Z',
        qualityScore: 101, // Must be 1-100
      });
      expect(result.success).toBe(false);
    });
  });

  describe('activitySchema', () => {
    it('should validate a valid activity', () => {
      const result = activitySchema.safeParse({
        type: 'RUNNING',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:45:00Z',
        steps: 6000,
        distance: 5.5,
        caloriesBurned: 350,
        averageHeartRate: 145,
        maxHeartRate: 170,
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimal activity', () => {
      const result = activitySchema.safeParse({
        type: 'WALKING',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:30:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative distance', () => {
      const result = activitySchema.safeParse({
        type: 'RUNNING',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:45:00Z',
        distance: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('goalSchema', () => {
    it('should validate a valid weight loss goal', () => {
      const result = goalSchema.safeParse({
        name: 'Lose 10kg',
        description: 'Reach target weight by summer',
        type: 'WEIGHT_LOSS',
        target: {
          weight: 75,
        },
        startDate: '2024-01-15',
        targetDate: '2024-06-15',
      });
      expect(result.success).toBe(true);
    });

    it('should validate a strength goal', () => {
      const result = goalSchema.safeParse({
        name: 'Bench Press 100kg',
        type: 'STRENGTH',
        target: {
          strength: {
            exerciseId: 'bench-press',
            targetWeight: 100,
            targetReps: 5,
          },
        },
        startDate: '2024-01-15',
      });
      expect(result.success).toBe(true);
    });

    it('should validate an activity goal', () => {
      const result = goalSchema.safeParse({
        name: 'Workout 5x per week',
        type: 'HEALTH',
        target: {
          activity: {
            workoutsPerWeek: 5,
            stepsPerDay: 10000,
          },
        },
        startDate: '2024-01-15',
      });
      expect(result.success).toBe(true);
    });

    it('should require a name', () => {
      const result = goalSchema.safeParse({
        name: '',
        type: 'WEIGHT_LOSS',
        target: { weight: 75 },
        startDate: '2024-01-15',
      });
      expect(result.success).toBe(false);
    });
  });
});
