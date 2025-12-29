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
  createSetItem,
  createSetItems,
} from '@/workout/setItems';

const mockExercise = {
  id: 'ex-1',
  name: 'Bench Press',
  category: 'compound',
  muscleGroups: ['chest'],
  equipment: ['barbell'],
  instructions: 'Lie on bench...',
};

describe('SetItem Classes', () => {
  describe('WarmupSetItem', () => {
    it('should create warmup set with correct defaults', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });

      expect(warmup.setType).toBe('warmup');
      expect(warmup.badgeLabel).toBe('Warmup');
      expect(warmup.badgeColor).toBe('bg-yellow-100 text-yellow-700');
      expect(warmup.setDisplayLabel).toBe('W');
    });

    it('should not show weight or reps input for warmup', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });

      expect(warmup.showWeightInput).toBe(false);
      expect(warmup.showRepsInput).toBe(false);
    });

    it('should mark as completed with timestamp', () => {
      const warmup = new WarmupSetItem({
        id: 'w-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });

      const completed = warmup.markCompleted();
      expect(completed.completed).toBe(true);
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('NormalSetItem', () => {
    it('should create normal set with correct defaults', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
        weight: 100,
      });

      expect(normal.setType).toBe('normal');
      expect(normal.badgeLabel).toBe('');
      expect(normal.setDisplayLabel).toBe('1');
      expect(normal.weight).toBe(100);
    });

    it('should show weight input for normal sets', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });

      expect(normal.showWeightInput).toBe(true);
      expect(normal.showRepsInput).toBe(true);
    });

    it('should get completed display with weight and reps', () => {
      const completedAt = new Date();
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: true,
        completedAt,
        isBodyweight: false,
        reps: 10,
        weight: 100,
      });

      const display = normal.getCompletedDisplay();
      expect(display).toHaveLength(3);
      expect(display[0]).toEqual({ text: '100 kg', className: 'font-medium text-gray-900' });
      expect(display[1]).toEqual({ text: '10 reps', className: 'text-gray-600' });
      expect(display[2]).toEqual({ isTimestamp: true, time: completedAt });
    });
  });

  describe('BodyweightSetItem', () => {
    it('should create bodyweight set with correct defaults', () => {
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 'ex-1',
        exerciseName: 'Push-ups',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: true,
        reps: 15,
      });

      expect(bw.setType).toBe('bodyweight');
      expect(bw.badgeLabel).toBe('BW');
      expect(bw.badgeColor).toBe('bg-amber-100 text-amber-700');
      expect(bw.isBodyweight).toBe(true);
    });

    it('should not show weight input for bodyweight', () => {
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 'ex-1',
        exerciseName: 'Push-ups',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: true,
        reps: 15,
      });

      expect(bw.showWeightInput).toBe(false);
    });

    it('should get completed display without weight', () => {
      const completedAt = new Date();
      const bw = new BodyweightSetItem({
        id: 'bw-1',
        exerciseId: 'ex-1',
        exerciseName: 'Push-ups',
        exercise: mockExercise,
        setNumber: 1,
        completed: true,
        completedAt,
        isBodyweight: true,
        reps: 15,
      });

      const display = bw.getCompletedDisplay();
      expect(display).toHaveLength(2);
      expect(display[0]).toEqual({ text: '15 reps', className: 'text-gray-600' });
      expect(display[1]).toEqual({ isTimestamp: true, time: completedAt });
    });
  });

  describe('DropdownSetItem', () => {
    const subSets = [
      { weight: 60, reps: 10, completed: false },
      { weight: 50, reps: 10, completed: false },
      { weight: 40, reps: 10, completed: false },
    ];

    it('should create dropdown set with subSets', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 'ex-1',
        exerciseName: 'Lat Pulldown',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        subSets,
      });

      expect(dropdown.setType).toBe('dropdown');
      expect(dropdown.badgeLabel).toBe('Dropdown');
      expect(dropdown.badgeColor).toBe('bg-purple-100 text-purple-700');
      expect(dropdown.totalSubSets).toBe(3);
    });

    it('should track completed subSets', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 'ex-1',
        exerciseName: 'Lat Pulldown',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        subSets: [
          { weight: 60, reps: 10, completed: true },
          { weight: 50, reps: 10, completed: false },
          { weight: 40, reps: 10, completed: false },
        ],
      });

      expect(dropdown.completedSubSets).toBe(1);
      expect(dropdown.allSubSetsCompleted).toBe(false);
      expect(dropdown.isFullyCompleted).toBe(false);
    });

    it('should mark all subSets as completed', () => {
      const dropdown = new DropdownSetItem({
        id: 'dd-1',
        exerciseId: 'ex-1',
        exerciseName: 'Lat Pulldown',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        subSets,
      });

      const completed = dropdown.markCompleted();
      expect(completed.allSubSetsCompleted).toBe(true);
      expect(completed.isFullyCompleted).toBe(true);
    });
  });

  describe('createSetItem factory', () => {
    it('should create WarmupSetItem for setType warmup', () => {
      const item = createSetItem({
        id: 'w-1',
        setType: 'warmup',
        exerciseId: 'ex-1',
        exerciseName: 'Test',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });
      expect(item).toBeInstanceOf(WarmupSetItem);
    });

    it('should create BodyweightSetItem for setType bodyweight', () => {
      const item = createSetItem({
        id: 'bw-1',
        setType: 'bodyweight',
        exerciseId: 'ex-1',
        exerciseName: 'Test',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: true,
        reps: 10,
      });
      expect(item).toBeInstanceOf(BodyweightSetItem);
    });

    it('should create DropdownSetItem for setType dropdown', () => {
      const item = createSetItem({
        id: 'dd-1',
        setType: 'dropdown',
        exerciseId: 'ex-1',
        exerciseName: 'Test',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        subSets: [],
        reps: 10,
      });
      expect(item).toBeInstanceOf(DropdownSetItem);
    });

    it('should create NormalSetItem for unknown setType', () => {
      const item = createSetItem({
        id: 'n-1',
        setType: 'normal',
        exerciseId: 'ex-1',
        exerciseName: 'Test',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
      });
      expect(item).toBeInstanceOf(NormalSetItem);
    });
  });

  describe('createSetItems', () => {
    it('should create array of SetItems from data array', () => {
      const data = [
        { setType: 'warmup', id: 'w-1', exerciseId: 'ex-1', exerciseName: 'W1', exercise: mockExercise, setNumber: 1, completed: false, isBodyweight: false, reps: 10 },
        { setType: 'normal', id: 'n-1', exerciseId: 'ex-1', exerciseName: 'N1', exercise: mockExercise, setNumber: 2, completed: false, isBodyweight: false, reps: 8 },
        { setType: 'bodyweight', id: 'bw-1', exerciseId: 'ex-1', exerciseName: 'BW1', exercise: mockExercise, setNumber: 3, completed: false, isBodyweight: true, reps: 15 },
      ];

      const items = createSetItems(data);

      expect(items).toHaveLength(3);
      expect(items[0]).toBeInstanceOf(WarmupSetItem);
      expect(items[1]).toBeInstanceOf(NormalSetItem);
      expect(items[2]).toBeInstanceOf(BodyweightSetItem);
    });
  });

  describe('toWorkoutSets', () => {
    it('should return empty array for uncompleted set', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: false,
        isBodyweight: false,
        reps: 10,
        weight: 100,
      });

      const workoutSets = normal.toWorkoutSets(new Date());
      expect(workoutSets).toEqual([]);
    });

    it('should return workout set for completed set', () => {
      const completedAt = new Date();
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: true,
        completedAt,
        isBodyweight: false,
        reps: 10,
        weight: 100,
      });

      const workoutSets = normal.toWorkoutSets(new Date());
      expect(workoutSets).toHaveLength(1);
      expect(workoutSets[0]).toMatchObject({
        id: 'n-1',
        exerciseId: 'ex-1',
        setType: 'normal',
        reps: 10,
        weight: 100,
      });
    });

    it('should not return workout set if already saved', () => {
      const normal = new NormalSetItem({
        id: 'n-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exercise: mockExercise,
        setNumber: 1,
        completed: true,
        completedAt: new Date(),
        isBodyweight: false,
        reps: 10,
        weight: 100,
        alreadySaved: true,
      });

      const workoutSets = normal.toWorkoutSets(new Date());
      expect(workoutSets).toEqual([]);
    });
  });
});
