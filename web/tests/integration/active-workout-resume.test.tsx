/**
 * Integration test for ActiveWorkout resume functionality
 * Tests the React component with mocked API responses
 *
 * Scenario: Resume a partially completed workout and verify completed sets are displayed
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import ActiveWorkout from '@/workout/ActiveWorkout';
import type { WorkoutSession, Exercise } from '@/types';

// Mock exercises
const mockExercises: Exercise[] = [
  { id: 1, name: 'Bench Press', muscleGroups: [], equipment: null, bodyweight: false },
  { id: 2, name: 'Incline Dumbbell Press', muscleGroups: [], equipment: null, bodyweight: false },
  { id: 3, name: 'Overhead Press', muscleGroups: [], equipment: null, bodyweight: false },
  { id: 4, name: 'Lateral Raises', muscleGroups: [], equipment: null, bodyweight: false },
  { id: 5, name: 'Tricep Pushdowns', muscleGroups: [], equipment: null, bodyweight: false },
];

describe('ActiveWorkout Resume Integration', () => {
  beforeAll(() => {
    // Mock APIs that ActiveWorkout uses
    vi.mock('@/api/index', () => ({
      workoutsApi: {
        completeSet: vi.fn(() => Promise.resolve({})),
        uncompleteSet: vi.fn(() => Promise.resolve({})),
        deleteSet: vi.fn(() => Promise.resolve({})),
        addSet: vi.fn(() => Promise.resolve({ id: 999, exerciseId: 1, setType: 'normal', weight: 100, reps: 10, loggedAt: null })),
        finish: vi.fn(() => Promise.resolve({ id: 1, name: 'Push Day', startedAt: new Date(), endedAt: new Date(), sets: [] })),
        delete: vi.fn(() => Promise.resolve({})),
      },
      exercisesApi: {
        getAll: vi.fn(() => Promise.resolve(mockExercises)),
      },
      lastUsedWeightsApi: {
        getAll: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve({})),
      },
    }));

    // Mock localStorage for token
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as Storage;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe('resuming workout with completed sets', () => {
    it('should display checkmarks for sets with loggedAt when resuming', async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();
      const onDelete = vi.fn();

      // Session with first set completed (has loggedAt)
      const sessionWithCompletedSet: WorkoutSession = {
        id: 1,
        name: 'Push Day',
        startedAt: new Date('2025-01-06T09:00:00Z'),
        endedAt: null,
        sets: [
          {
            id: 1,
            exerciseId: 1,
            setType: 'dropdown',
            weight: 60,
            reps: 10,
            dropdownWeights: [{ weight: 57.5, reps: 10 }, { weight: 55, reps: 10 }],
            loggedAt: '2025-01-06T09:01:00Z', // COMPLETED
          },
          {
            id: 2,
            exerciseId: 1,
            setType: 'dropdown',
            weight: null,
            reps: 10,
            dropdownWeights: [{ weight: 57.5, reps: 10 }],
            loggedAt: null, // NOT COMPLETED
          },
        ],
      };

      const { container } = render(
        <ActiveWorkout
          session={sessionWithCompletedSet}
          exercises={mockExercises}
          onComplete={onComplete}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      );

      // Wait for the component to render
      await waitFor(() => {
        expect(screen.getByText(/Active Workout/)).toBeInTheDocument();
      });

      // Check for completed sets indicator (1/2 sets)
      const counterText = container.textContent;
      expect(counterText).toContain('1/2');
    });

    it('should NOT display checkmarks for sets without loggedAt', async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();
      const onDelete = vi.fn();

      // Session with NO completed sets
      const sessionWithNoCompletedSets: WorkoutSession = {
        id: 1,
        name: 'Push Day',
        startedAt: new Date('2025-01-06T09:00:00Z'),
        endedAt: null,
        sets: [
          {
            id: 1,
            exerciseId: 1,
            setType: 'dropdown',
            weight: null,
            reps: 10,
            dropdownWeights: [{ weight: 57.5, reps: 10 }],
            loggedAt: null,
          },
          {
            id: 2,
            exerciseId: 1,
            setType: 'dropdown',
            weight: null,
            reps: 10,
            dropdownWeights: [{ weight: 57.5, reps: 10 }],
            loggedAt: null,
          },
        ],
      };

      const { container } = render(
        <ActiveWorkout
          session={sessionWithNoCompletedSets}
          exercises={mockExercises}
          onComplete={onComplete}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Active Workout/)).toBeInTheDocument();
      });

      // Should show 0/2 sets (no completed sets)
      const counterText = container.textContent;
      expect(counterText).toContain('0/2');
    });
  });

  describe('exerciseId type matching (backend returns number)', () => {
    it('should match exercises when backend returns exerciseId as NUMBER', async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();
      const onDelete = vi.fn();

      // Exact backend response format: exerciseId is NUMBER, id is NUMBER, loggedAt is STRING
      const sessionFromBackend: WorkoutSession = {
        id: 4,
        name: 'Push Day',
        startedAt: '2026-01-04T18:08:47.769165Z',
        endedAt: '2026-01-04T18:08:47.878540Z',
        sets: [
          {
            id: 52,
            exerciseId: 1,  // NUMBER - should match mockExercises[0].id
            setType: 'dropdown',
            weight: 60,
            reps: 10,
            dropdownWeights: [
              { weight: 57.5, reps: 10 },
              { weight: 55, reps: 10 }
            ],
            loggedAt: '2026-01-04 18:08:47.872252+00:00',  // COMPLETED
          },
          {
            id: 53,
            exerciseId: 1,
            setType: 'dropdown',
            weight: null,
            reps: null,
            dropdownWeights: [
              { weight: 57.5, reps: 10 }
            ],
            loggedAt: null,  // NOT COMPLETED
          },
        ],
      };

      const { container } = render(
        <ActiveWorkout
          session={sessionFromBackend}
          exercises={mockExercises}
          onComplete={onComplete}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Active Workout/)).toBeInTheDocument();
      });

      // Wait for sets to be rendered
      await waitFor(() => {
        const setRows = container.querySelectorAll('.border');
        expect(setRows.length).toBeGreaterThan(0);
      });

      // Counter should show "1/2" - 1 completed out of 2 total sets
      const counterText = container.textContent;
      expect(counterText).toContain('1/2');
    });
  });

  describe('loggedAt as string vs Date', () => {
    it('should recognize loggedAt as string (from JSON.parse) as completed', async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();
      const onDelete = vi.fn();

      // Simulate what response.json() returns - loggedAt as STRING
      const sessionWithLoggedAtAsString: WorkoutSession = {
        id: 1,
        name: 'Push Day',
        startedAt: '2025-01-06T09:00:00Z',
        endedAt: '2025-01-06T09:05:00Z',
        sets: [
          {
            id: 1,
            exerciseId: 1,
            setType: 'normal',
            weight: 100,
            reps: 10,
            dropdownWeights: null,
            loggedAt: '2025-01-06T09:01:00Z', // STRING from JSON
          },
          {
            id: 2,
            exerciseId: 1,
            setType: 'normal',
            weight: null,
            reps: 10,
            dropdownWeights: null,
            loggedAt: null,
          },
        ],
      };

      const { container } = render(
        <ActiveWorkout
          session={sessionWithLoggedAtAsString}
          exercises={mockExercises}
          onComplete={onComplete}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Active Workout/)).toBeInTheDocument();
      });

      // Should recognize the string loggedAt as completed (1/2)
      const counterText = container.textContent;
      expect(counterText).toContain('1/2');
    });
  });
});
