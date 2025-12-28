// ============================================
// Context Building Utilities
// ============================================

import type { UserData } from '../types/index.js';

/**
 * Build a human-readable context string from user data
 */
export function buildContext(_trigger: string, userData: UserData): string {
  const parts: string[] = [];

  if (userData.recentWorkouts && userData.recentWorkouts.length > 0) {
    parts.push(`Recent workouts: ${userData.recentWorkouts.length} in the past week`);
    const lastWorkout = userData.recentWorkouts[0];
    if (lastWorkout) {
      parts.push(`Last workout: ${lastWorkout.type || 'various exercises'}`);
    }
  }

  if (userData.recentMeals && userData.recentMeals.length > 0) {
    const totalCalories = userData.recentMeals.reduce(
      (sum: number, m: any) => sum + (m.calories || 0),
      0
    );
    parts.push(`Recent meals: ${userData.recentMeals.length} logged, ~${totalCalories} calories`);
  }

  if (userData.sleepSessions && userData.sleepSessions.length > 0) {
    const lastSleep = userData.sleepSessions[0];
    if (lastSleep) {
      parts.push(
        `Last sleep: ${lastSleep.duration || 0} minutes, quality score: ${lastSleep.qualityScore || 'N/A'}`
      );
    }
  }

  if (userData.currentGoals && userData.currentGoals.length > 0) {
    parts.push(`Active goals: ${userData.currentGoals.map((g: any) => g.type).join(', ')}`);
  }

  if (userData.userProfile) {
    const profile = userData.userProfile;
    if (profile.weight) {
      parts.push(`User weight: ${profile.weight}kg`);
    }
    if (profile.height) {
      parts.push(`User height: ${profile.height}cm`);
    }
  }

  return parts.join('\n') || 'No user data available';
}
