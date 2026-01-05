/**
 * SetItem classes tests
 * Tests for workout set item classes and their methods
 */
import { describe, it, expect } from 'vitest';
import {
  WarmupSetItem,
  NormalSetItem,
  BodyweightSetItem,
  DropdownSetItem,
  createSetItemFromBackend,
  isDropdownSetItem,
} from '@/workout/setItems';
import type { WorkoutSet } from '@/types';

describe('SetItem Classes', () => {
  describe('WarmupSetItem', () => {
    it('should create warmup set with correct defaults', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        completed: false,
      });

      expect(warmup.setType).toBe('warmup');
      expect(warmup.badgeLabel).toBe('Warmup');
      expect(warmup.badgeColor).toContain('text-yellow');
      expect(warmup.setDisplayLabel).toBe('W');
    });

    it('should not show weight input for warmup', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        completed: false,
      });

      expect(warmup.showWeightInput).toBe(false);
    });

    it('should return empty display for uncompleted warmup', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        completed: false,
      });

      const display = warmup.getCompletedDisplay();
      expect(display).toEqual([]);
    });

    it('should return empty display even for completed warmup (no data shown)', () => {
      const completedAt = new Date();
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        completed: true,
        completedAt,
      });

      const display = warmup.getCompletedDisplay();
      // Warmup sets don't show completed data
      expect(display).toEqual([]);
    });
  });

  describe('NormalSetItem', () => {
    it('should create normal set with correct defaults', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        completed: false,
        weight: 100,
        reps: 10,
      });

      expect(normal.setType).toBe('normal');
      expect(normal.setDisplayLabel).toBe('N');
      expect(normal.weight).toBe(100);
      expect(normal.reps).toBe(10);
    });

    it('should show weight input for normal sets', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        completed: false,
        weight: 100,
        reps: 10,
      });

      expect(normal.showWeightInput).toBe(true);
    });

    it('should get completed display with weight and reps', () => {
      const completedAt = new Date();
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        completed: true,
        completedAt,
        weight: 100,
        reps: 10,
      });

      const display = normal.getCompletedDisplay();
      expect(display).toHaveLength(3);
      expect(display[0]).toMatchObject({ text: '100 kg' });
      expect(display[1]).toMatchObject({ text: '10 reps' });
      expect(display[2]).toEqual({ isTimestamp: true, time: completedAt });
    });
  });

  describe('BodyweightSetItem', () => {
    it('should create bodyweight set with correct defaults', () => {
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 1,
        exerciseName: 'Push-ups',
        setNumber: 1,
        completed: false,
        reps: 15,
      });

      expect(bw.setType).toBe('bodyweight');
      expect(bw.badgeLabel).toBe('Bodyweight');
      expect(bw.badgeColor).toContain('text-amber');
    });

    it('should not show weight input for bodyweight', () => {
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 1,
        exerciseName: 'Push-ups',
        setNumber: 1,
        completed: false,
        reps: 15,
      });

      expect(bw.showWeightInput).toBe(false);
    });

    it('should get completed display without weight', () => {
      const completedAt = new Date();
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 1,
        exerciseName: 'Push-ups',
        setNumber: 1,
        completed: true,
        completedAt,
        reps: 15,
      });

      const display = bw.getCompletedDisplay();
      expect(display).toHaveLength(2);
      expect(display[0]).toMatchObject({ text: '15 reps' });
      expect(display[1]).toEqual({ isTimestamp: true, time: completedAt });
    });
  });

  describe('DropdownSetItem', () => {
    const dropdownWeights = [
      { weight: 50, reps: 10 },
      { weight: 40, reps: 10 },
    ];

    it('should create dropdown set with dropdownWeights', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 1,
        exerciseName: 'Lat Pulldown',
        setNumber: 1,
        completed: false,
        weight: 60,
        reps: 10,
        subSets: dropdownWeights,
      });

      expect(dropdown.setType).toBe('dropdown');
      expect(dropdown.badgeLabel).toBe('Drop');
      expect(dropdown.badgeColor).toContain('text-blue');
      expect(dropdown.subSets).toEqual(dropdownWeights);
    });

    it('should not show weight input for dropdown (has custom UI)', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 1,
        exerciseName: 'Lat Pulldown',
        setNumber: 1,
        completed: false,
        weight: 60,
        reps: 10,
        subSets: dropdownWeights,
      });

      expect(dropdown.showWeightInput).toBe(false);
    });

    it('should get completed display with all dropdown weights', () => {
      const completedAt = new Date();
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 1,
        exerciseName: 'Lat Pulldown',
        setNumber: 1,
        completed: true,
        completedAt,
        weight: 60,
        reps: 10,
        subSets: dropdownWeights,
      });

      const display = dropdown.getCompletedDisplay();
      // Display includes main weight + subSets (60 → 50 → 40)
      expect(display).toHaveLength(3);
      expect(display[0]).toMatchObject({ text: '60 → 50 → 40' });
      expect(display[1]).toMatchObject({ text: '10 reps' });
      expect(display[2]).toEqual({ isTimestamp: true, time: completedAt });
    });
  });

  describe('createSetItemFromBackend factory', () => {
    it('should create WarmupSetItem for setType warmup', () => {
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'warmup',
        weight: null,
        reps: 10,
        dropdownWeights: null,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Bench Press', 1);
      expect(item).toBeInstanceOf(WarmupSetItem);
      expect(item.setType).toBe('warmup');
    });

    it('should create BodyweightSetItem for setType bodyweight', () => {
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'bodyweight',
        weight: null,
        reps: 15,
        dropdownWeights: null,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Push-ups', 1);
      expect(item).toBeInstanceOf(BodyweightSetItem);
      expect(item.setType).toBe('bodyweight');
    });

    it('should create DropdownSetItem for setType dropdown', () => {
      const dropdownWeights = [
        { weight: 50, reps: 10 },
        { weight: 40, reps: 10 },
      ];
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'dropdown',
        weight: 60,
        reps: 10,
        dropdownWeights,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Lat Pulldown', 1);
      expect(item).toBeInstanceOf(DropdownSetItem);
      expect(item.setType).toBe('dropdown');
    });

    it('should create NormalSetItem for setType normal', () => {
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'normal',
        weight: 100,
        reps: 10,
        dropdownWeights: null,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Bench Press', 1);
      expect(item).toBeInstanceOf(NormalSetItem);
      expect(item.setType).toBe('normal');
    });

    it('should detect bodyweight by exercise name', () => {
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'normal',
        weight: null,
        reps: 15,
        dropdownWeights: null,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Pull-ups', 1);
      expect(item).toBeInstanceOf(BodyweightSetItem);
      expect(item.setType).toBe('bodyweight');
    });

    it('should mark set as completed when loggedAt is present', () => {
      const completedAt = new Date();
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'normal',
        weight: 100,
        reps: 10,
        dropdownWeights: null,
        loggedAt: completedAt.toISOString(),
      };

      const item = createSetItemFromBackend(backendSet, 'Bench Press', 1);
      expect(item.completed).toBe(true);
      expect(item.completedAt).toEqual(completedAt);
    });

    it('should not be completed when loggedAt is null', () => {
      const backendSet: WorkoutSet = {
        id: 1,
        exerciseId: 1,
        setType: 'normal',
        weight: 100,
        reps: 10,
        dropdownWeights: null,
        loggedAt: null,
      };

      const item = createSetItemFromBackend(backendSet, 'Bench Press', 1);
      expect(item.completed).toBe(false);
      expect(item.completedAt).toBeNull();
    });
  });

  describe('isDropdownSetItem type guard', () => {
    it('should identify DropdownSetItem instances', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 1,
        exerciseName: 'Lat Pulldown',
        setNumber: 1,
        completed: false,
        weight: 60,
        reps: 10,
        subSets: [],
      });

      expect(isDropdownSetItem(dropdown)).toBe(true);
    });

    it('should not identify other types as DropdownSetItem', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        completed: false,
        weight: 100,
        reps: 10,
      });

      expect(isDropdownSetItem(normal)).toBe(false);
    });
  });
});
