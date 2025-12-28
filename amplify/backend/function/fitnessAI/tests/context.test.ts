// ============================================
// Context Builder Tests
// ============================================

import { describe, it, expect } from 'vitest';
import { buildContext } from '../src/utils/context.js';
import type { UserData } from '../src/types/index.js';

describe('buildContext', () => {
  it('should build context with workouts', () => {
    const userData: UserData = {
      recentWorkouts: [
        { type: 'strength', duration: 45 },
        { type: 'cardio', duration: 30 },
      ],
    };

    const result = buildContext('POST_WORKOUT', userData);

    expect(result).toContain('Recent workouts: 2 in the past week');
    expect(result).toContain('Last workout: strength');
  });

  it('should build context with meals', () => {
    const userData: UserData = {
      recentMeals: [
        { name: 'Chicken', calories: 300 },
        { name: 'Rice', calories: 200 },
      ],
    };

    const result = buildContext('END_OF_DAY', userData);

    expect(result).toContain('Recent meals: 2 logged, ~500 calories');
  });

  it('should build context with sleep data', () => {
    const userData: UserData = {
      sleepSessions: [
        { duration: 480, qualityScore: 85 },
      ],
    };

    const result = buildContext('MORNING', userData);

    expect(result).toContain('Last sleep: 480 minutes, quality score: 85');
  });

  it('should build context with goals', () => {
    const userData: UserData = {
      currentGoals: [
        { type: 'weight_loss' },
        { type: 'muscle_gain' },
      ],
    };

    const result = buildContext('CALORIE_PACING', userData);

    expect(result).toContain('Active goals: weight_loss, muscle_gain');
  });

  it('should build context with user profile', () => {
    const userData: UserData = {
      userProfile: {
        weight: 75,
        height: 180,
      },
    };

    const result = buildContext('MORNING', userData);

    expect(result).toContain('User weight: 75kg');
    expect(result).toContain('User height: 180cm');
  });

  it('should return default message when no data', () => {
    const userData: UserData = {};

    const result = buildContext('MORNING', userData);

    expect(result).toBe('No user data available');
  });

  it('should combine all data sources', () => {
    const userData: UserData = {
      recentWorkouts: [{ type: 'strength' }],
      recentMeals: [{ name: 'Salad', calories: 150 }],
      sleepSessions: [{ duration: 420, qualityScore: 80 }],
      currentGoals: [{ type: 'fitness' }],
      userProfile: { weight: 70, height: 175 },
    };

    const result = buildContext('END_OF_DAY', userData);

    expect(result).toContain('Recent workouts: 1 in the past week');
    expect(result).toContain('Recent meals: 1 logged, ~150 calories');
    expect(result).toContain('Last sleep: 420 minutes');
    expect(result).toContain('Active goals: fitness');
    expect(result).toContain('User weight: 70kg');
    expect(result).toContain('User height: 175cm');
  });
});
