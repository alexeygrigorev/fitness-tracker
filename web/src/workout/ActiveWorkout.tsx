// ActiveWorkout.tsx - Clean implementation for active workout session
import { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTrash,
  faChevronDown,
  faChevronRight,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { workoutsApi, lastUsedWeightsApi } from '../api';
import { ExercisePicker } from './ExerciseSelector';
import SetRow, { type SetForm } from '../components/SetRow';
import {
  createSetItemFromBackend,
  type SetItem,
  type LastUsedData
} from './setItems';
import type { WorkoutSession, WorkoutSet, Exercise } from '../types';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  exercises: Exercise[];
  onComplete: (workout: WorkoutSession) => void;
  onCancel: () => void;
  onDelete: (workoutId: number) => void;
}

const getActionErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

// Get exercise info from ID
const getExerciseInfo = (exerciseId: number, exercises: Exercise[]) => {
  return exercises.find(e => e.id === exerciseId);
};

// Group sets by exercise ID
const groupSetsByExercise = (sets: SetItem[]) => {
  const groups = new Map<number, SetItem[]>();
  for (const set of sets) {
    const existing = groups.get(set.exerciseId) || [];
    groups.set(set.exerciseId, [...existing, set]);
  }
  return groups;
};

export default function ActiveWorkout({
  session,
  exercises,
  onComplete,
  onCancel,
  onDelete
}: ActiveWorkoutProps) {
  // Sets state - derived from backend response
  const [setItems, setSetItems] = useState<SetItem[]>([]);

  // UI state
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setForm, setSetForm] = useState<SetForm>({ reps: 10 });
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAllIncomplete, setShowAllIncomplete] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  // Exercise picker state
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Last used weights for each exercise
  const [lastUsedWeights, setLastUsedWeights] = useState<Record<number, LastUsedData>>({});

  // Fetch last used weights from server on mount
  useEffect(() => {
    const fetchLastUsedWeights = async () => {
      try {
        const data = await lastUsedWeightsApi.getAll();
        // Convert string keys to numbers and type the data
        const weights: Record<number, LastUsedData> = {};
        for (const [key, value] of Object.entries(data)) {
          weights[parseInt(key)] = value as LastUsedData;
        }
        setLastUsedWeights(weights);
      } catch (error) {
        console.error('Failed to fetch last used weights:', error);
      }
    };
    fetchLastUsedWeights();
  }, []);

  // Initialize set items from session
  useEffect(() => {
    if (session.sets && session.sets.length > 0) {
      const items = session.sets.map((backendSet, idx) => {
        const exerciseInfo = getExerciseInfo(backendSet.exerciseId, exercises);
        const exerciseName = exerciseInfo?.name || backendSet.exerciseName || 'Unknown';
        // Calculate set number per exercise
        const previousSetsSameExercise = session.sets.filter(
          (s, i) => i < idx && s.exerciseId === backendSet.exerciseId && s.setType !== 'warmup'
        );
        const setNumber = previousSetsSameExercise.length + 1;
        return createSetItemFromBackend(backendSet, exerciseName, setNumber);
      });
      setSetItems(items);
    }
  }, [session, exercises]);

  // Filter exercises for the picker
  const filteredExercises = useMemo(() => {
    if (!exerciseSearch) return exercises;
    return exercises.filter(ex =>
      ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      ex.muscleGroups?.some(mg => mg.toLowerCase().includes(exerciseSearch.toLowerCase()))
    );
  }, [exercises, exerciseSearch]);

  // Separate completed and incomplete sets
  const completedSets = useMemo(() => setItems.filter(s => s.completed), [setItems]);
  const incompleteSets = useMemo(() => setItems.filter(s => !s.completed), [setItems]);

  // Visible sets based on expand/collapse state
  const visibleCompletedSets = useMemo(() => {
    if (showAllCompleted) return completedSets;
    return completedSets.slice(-2); // Show last 2 completed
  }, [completedSets, showAllCompleted]);

  const visibleIncompleteSets = useMemo(() => {
    if (showAllIncomplete) return incompleteSets;
    return incompleteSets.slice(0, 3); // Show first 3 incomplete
  }, [incompleteSets, showAllIncomplete]);

  const visibleSetRows = useMemo(() => {
    return [...visibleCompletedSets, ...visibleIncompleteSets];
  }, [visibleCompletedSets, visibleIncompleteSets]);

  // Get exercises that are in the current workout (for "add set" buttons)
  const exercisesInWorkout = useMemo(() => {
    const groups = groupSetsByExercise(setItems);
    const result = new Map<number, { name: string; count: number }>();
    for (const [exerciseId, sets] of groups) {
      const exercise = getExerciseInfo(exerciseId, exercises);
      if (exercise) {
        result.set(exerciseId, { name: exercise.name, count: sets.length });
      }
    }
    return result;
  }, [setItems, exercises]);

  // Stats
  const totalSets = setItems.length;
  const completedCount = completedSets.length;

  // Open set form for editing
  const openSetForm = useCallback((item: SetItem) => {
    setEditingSetId(item.id);

    // Pre-fill form with current values or last used weights
    const lastUsed = lastUsedWeights[item.exerciseId];

    if (item.setType === 'dropdown') {
      // Dropdown sets have subSets
      // Form will handle these
      setSetForm({
        reps: item.completed ? 10 : (lastUsed?.reps || 10),
        subSets: lastUsed?.subSets || []
      });
    } else if (item.setType === 'bodyweight') {
      setSetForm({
        reps: lastUsed?.reps || 10
      });
    } else if (item.setType !== 'warmup') {
      setSetForm({
        weight: lastUsed?.weight,
        reps: lastUsed?.reps || 10
      });
    } else {
      setSetForm({ reps: 10 });
    }
  }, [lastUsedWeights]);

  // Close set form
  const closeSetForm = useCallback(() => {
    setEditingSetId(null);
    setSetForm({ reps: 10 });
  }, []);

  // Submit set (complete it)
  const submitSet = useCallback(async () => {
    if (!session.id) return;

    const item = setItems.find(s => s.id === editingSetId);
    if (!item) return;

    setLoading(true);
    setActionError(null);

    try {
      const setId = parseInt(item.id);

      // Prepare request data based on set type
      const requestData: { weight?: number; reps?: number; dropdownWeights?: Array<{ weight: number; reps: number }> } = {};

      if (item.setType === 'dropdown') {
        requestData.dropdownWeights = setForm.subSets;
        requestData.reps = setForm.subSets?.[0]?.reps || setForm.reps;
        requestData.weight = setForm.subSets?.[0]?.weight;
      } else if (item.setType === 'bodyweight') {
        requestData.reps = setForm.reps;
      } else if (item.setType !== 'warmup') {
        requestData.weight = setForm.weight;
        requestData.reps = setForm.reps;
      }

      // The response is authoritative: it contains the values actually persisted.
      const updatedSet = await workoutsApi.completeSet(
        session.id,
        setId,
        requestData,
      ) as WorkoutSet;
      setSetItems(prev => prev.map(s => {
        if (s.id === editingSetId) {
          return createSetItemFromBackend(
            updatedSet,
            s.exerciseName,
            s.setNumber
          );
        }
        return s;
      }));

      // Save to last used weights
      const lastUsedData: LastUsedData = { reps: setForm.reps };
      if (setForm.weight !== undefined) lastUsedData.weight = setForm.weight;
      if (setForm.subSets) lastUsedData.subSets = setForm.subSets;

      try {
        await lastUsedWeightsApi.set(String(item.exerciseId), lastUsedData);
      } catch (error) {
        console.error('Failed to update last used weights:', error);
      }

      setLastUsedWeights(prev => ({
        ...prev,
        [item.exerciseId]: lastUsedData
      }));

      closeSetForm();
    } catch (error) {
      console.error('Failed to complete set:', error);
      setActionError(getActionErrorMessage(error, 'Unable to save the set. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, setItems, editingSetId, setForm, closeSetForm]);

  // Uncomplete a set
  const uncompleteSet = useCallback(async (itemId?: string) => {
    if (!session.id) return;

    const targetId = itemId || editingSetId;
    const item = setItems.find(s => s.id === targetId);
    if (!item) return;

    setLoading(true);
    setActionError(null);

    try {
      const setId = parseInt(item.id);
      const updatedSet = await workoutsApi.uncompleteSet(
        session.id,
        setId,
      ) as WorkoutSet;
      setSetItems(prev => prev.map(s => {
        if (s.id === targetId) {
          return createSetItemFromBackend(
            updatedSet,
            s.exerciseName,
            s.setNumber
          );
        }
        return s;
      }));

      closeSetForm();
    } catch (error) {
      console.error('Failed to uncomplete set:', error);
      setActionError(getActionErrorMessage(error, 'Unable to uncomplete the set. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, setItems, editingSetId, closeSetForm]);

  // Delete a set
  const deleteSet = useCallback(async (itemId?: string) => {
    if (!session.id) return;

    const targetId = itemId || editingSetId;
    const item = setItems.find(s => s.id === targetId);
    if (!item) return;

    setLoading(true);
    setActionError(null);

    try {
      const setId = parseInt(item.id);
      await workoutsApi.deleteSet(setId);

      // Remove from local state
      setSetItems(prev => prev.filter(s => s.id !== targetId));
      closeSetForm();
    } catch (error) {
      console.error('Failed to delete set:', error);
      setActionError(getActionErrorMessage(error, 'Unable to delete the set. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, setItems, editingSetId, closeSetForm]);

  // Add extra set for an exercise
  const addExtraSet = useCallback(async (exerciseId: number, exerciseName: string) => {
    if (!session.id) return;

    setLoading(true);
    setActionError(null);

    try {
      // Get last used data for this exercise
      const lastUsed = lastUsedWeights[exerciseId];
      const exerciseInfo = getExerciseInfo(exerciseId, exercises);
      const isBodyweight = exerciseInfo?.bodyweight || false;

      // Count existing sets for this exercise (excluding warmup)
      const existingSets = setItems.filter(
        s => s.exerciseId === exerciseId && s.setType !== 'warmup'
      );
      const setNumber = existingSets.length + 1;

      // Determine set type
      const setType = isBodyweight ? 'bodyweight' : 'normal';

      // Create the set via API
      const response = await workoutsApi.addSet(session.id, {
        exerciseId,
        setType,
        weight: lastUsed?.weight,
        reps: lastUsed?.reps || 10,
        dropdownWeights: lastUsed?.subSets
      });

      // Add to local state
      const newItem = createSetItemFromBackend(
        response,
        exerciseName,
        setNumber,
        false,
        true // isExtra
      );
      setSetItems(prev => [...prev, newItem]);
    } catch (error) {
      console.error('Failed to add set:', error);
      setActionError(getActionErrorMessage(error, 'Unable to add the set. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, setItems, lastUsedWeights, exercises]);

  // Add new exercise to workout
  const addNewExercise = useCallback(async (exerciseId: number) => {
    if (!session.id) return;

    const exercise = getExerciseInfo(exerciseId, exercises);
    if (!exercise) return;

    setLoading(true);
    setActionError(null);

    try {
      const lastUsed = lastUsedWeights[exerciseId];
      const isBodyweight = exercise.bodyweight || false;
      const setType = isBodyweight ? 'bodyweight' : 'normal';

      const response = await workoutsApi.addSet(session.id, {
        exerciseId,
        setType,
        weight: lastUsed?.weight,
        reps: lastUsed?.reps || 10
      });

      const newItem = createSetItemFromBackend(
        response,
        exercise.name,
        1,
        false,
        false
      );
      setSetItems(prev => [...prev, newItem]);
      setShowAddExercise(false);
      setExerciseSearch('');
    } catch (error) {
      console.error('Failed to add exercise:', error);
      setActionError(getActionErrorMessage(error, 'Unable to add the exercise. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, exercises, lastUsedWeights]);

  // Finish workout
  const finishWorkout = useCallback(async () => {
    if (!session.id) return;

    setLoading(true);
    setActionError(null);

    try {
      const response = await workoutsApi.finish(session.id);
      onComplete(response);
    } catch (error) {
      console.error('Failed to finish workout:', error);
      setActionError(getActionErrorMessage(error, 'Unable to finish the workout. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, onComplete]);

  // Delete workout
  const deleteWorkout = useCallback(async () => {
    if (!session.id) return;
    if (!confirm('Are you sure you want to delete this workout?')) return;

    setLoading(true);
    setActionError(null);

    try {
      await workoutsApi.delete(session.id);
      onDelete(session.id);
    } catch (error) {
      console.error('Failed to delete workout:', error);
      setActionError(getActionErrorMessage(error, 'Unable to delete the workout. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [session.id, onDelete]);

  return (
    <div className="space-y-4" data-workout-id={session.id}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Active Workout: {session.name}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {completedCount}/{totalSets}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">sets</div>
          </div>
          <button
            onClick={deleteWorkout}
            className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title="Delete workout"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {actionError && (
        <div
          id="active-workout-error"
          role="alert"
          className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm"
        >
          <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Show more completed sets button */}
      {completedSets.length > 2 && (
        <button
          onClick={() => setShowAllCompleted(!showAllCompleted)}
          className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {showAllCompleted ? (
            <>
              <FontAwesomeIcon icon={faChevronDown} />
              Show less
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faChevronRight} />
              Show {completedSets.length - 2} more completed
            </>
          )}
        </button>
      )}

      {/* Set Rows */}
      <div className="space-y-2">
        {visibleSetRows.map((item) => {
          const isEditing = editingSetId === item.id;

          return (
            <SetRow
              key={item.id}
              item={item}
              isEditing={isEditing}
              setForm={setForm}
              onOpenSetForm={openSetForm}
              onSubmitSet={submitSet}
              onCloseSetForm={closeSetForm}
              onUncompleteSet={() => uncompleteSet()}
              onDeleteSet={() => deleteSet()}
              onSetFormChange={setSetForm}
            />
          );
        })}
      </div>

      {/* Show more incomplete sets button */}
      {incompleteSets.length > 3 && (
        <button
          onClick={() => setShowAllIncomplete(!showAllIncomplete)}
          className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {showAllIncomplete ? (
            <>
              <FontAwesomeIcon icon={faChevronDown} />
              Show less
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faChevronRight} />
              Show {incompleteSets.length - 3} more
            </>
          )}
        </button>
      )}

      {/* Add Set Buttons */}
      {exercisesInWorkout.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(exercisesInWorkout.entries()).map(([exerciseId, info]) => (
            <button
              key={exerciseId}
              onClick={() => addExtraSet(exerciseId, info.name)}
              className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-1"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              Set for {info.name}
            </button>
          ))}
        </div>
      )}

      {/* Add Exercise Button */}
      {exercises.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowAddExercise(!showAddExercise)}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            Add Exercise
          </button>

          {showAddExercise && (
            <ExercisePicker
              exercises={exercises}
              filteredExercises={filteredExercises}
              search={exerciseSearch}
              onSearchChange={setExerciseSearch}
              filterCategory="all"
              onFilterChange={() => {}}
              onExerciseClick={(exercise) => addNewExercise(exercise.id)}
              onClose={() => {
                setShowAddExercise(false);
                setExerciseSearch('');
              }}
              excludedIds={setItems.map(row => row.exerciseId)}
            />
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-lg font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={finishWorkout}
          disabled={loading || completedCount === 0}
          className="px-6 py-3 text-lg font-medium text-white bg-green-600 dark:bg-green-700 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : `Finish Workout (${completedCount}/${totalSets} sets)`}
        </button>
      </div>
    </div>
  );
}
