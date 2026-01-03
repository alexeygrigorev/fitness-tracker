import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { workoutsApi, exercisesApi, activeWorkoutStateApi, lastUsedWeightsApi } from '../api';
import { ExercisePicker } from './ExerciseSelector';
import SetRow, { type SetForm } from '../components/SetRow';
import { WarmupSetItem, NormalSetItem, BodyweightSetItem, DropdownSetItem } from './setItems';
import type { SetFormData, LastUsedData } from './setItems';
import type { SetItem } from './setItems';
import type { WorkoutPreset, WorkoutSession, Exercise, WorkoutSet } from '../types';

interface ActiveWorkoutProps {
  preset: WorkoutPreset;
  onComplete: (workout: WorkoutSession) => void;
  onCancel: () => void;
  onDelete?: (workoutId: string) => void; // Called when a workout is deleted
  resumingWorkout?: WorkoutSession; // If provided, resume this workout instead of starting fresh
}

const isBodyweight = (exercise: Exercise) => {
  return exercise.bodyweight === true ||
    !exercise.equipment || exercise.equipment.length === 0 ||
    (exercise.equipment.length === 1 && exercise.equipment[0].toLowerCase() === 'bodyweight');
};

export default function ActiveWorkout({ preset, onComplete, onCancel, onDelete, resumingWorkout }: ActiveWorkoutProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [setRows, setSetRows] = useState<SetItem[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setForm, setSetForm] = useState<SetForm>({ reps: 10 });
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [workoutSessionId, setWorkoutSessionId] = useState<string | null>(null);
  const [showAllIncomplete, setShowAllIncomplete] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  // Remember last weight/reps for each exercise
  const [lastUsed, setLastUsed] = useState<Record<string, { weight?: number; reps: number }>>({});

  // Exercise picker state
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseFilterCategory, setExerciseFilterCategory] = useState<string>('all');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    exercisesApi.getAll().then(setExercises);
  }, []);

  // Load last used weights from preset (included in preset response from backend)
  useEffect(() => {
    // Skip if we're restoring an active session (which already has lastUsed data)
    if (isRestored) return;

    // Use lastUsedWeights from preset if available
    if (preset && 'lastUsedWeights' in preset && preset.lastUsedWeights) {
      setLastUsed(preset.lastUsedWeights as Record<string, LastUsedData>);
    }
  }, [preset, isRestored]);

  // Filter exercises based on search and category
  useEffect(() => {
    let filtered = exercises;

    if (exerciseSearch) {
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscleGroups?.some(mg => mg.toLowerCase().includes(exerciseSearch.toLowerCase()))
      );
    }

    if (exerciseFilterCategory !== 'all') {
      if (exerciseFilterCategory === 'upper') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups?.some(mg => ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps', 'lats', 'forearms'].includes(mg))
        );
      } else if (exerciseFilterCategory === 'lower') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups?.some(mg => ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques'].includes(mg))
        );
      } else {
        filtered = filtered.filter(ex => ex.category === exerciseFilterCategory);
      }
    }

    setFilteredExercises(filtered);
  }, [exercises, exerciseSearch, exerciseFilterCategory]);

  // Restore workout state from server on mount (only once)
  useEffect(() => {
    if (exercises.length === 0) return; // Wait for exercises to load

    // Server restoration is handled via resumingWorkout prop
    // Just mark as restored so we can build default sets
    setIsRestored(true);
  }, [exercises]);

  // Helper function to build sets from preset (extracted for reuse)
  const buildSetsFromPreset = (preset: WorkoutPreset, exercises: Exercise[]): SetItem[] => {
    if (preset.id === 'freestyle' || preset.exercises.length === 0) {
      return [];
    }

    const items: SetItem[] = [];

    preset.exercises.forEach(presetEx => {
      // Handle superset - round robin order
      if (presetEx.type === 'superset' && presetEx.exercises) {
        const supersetExercises = presetEx.exercises.map(exDef => {
          const ex = exercises.find(e => e.id === exDef.exerciseId);
          return { ...exDef, exercise: ex };
        }).filter(e => e.exercise);

        if (supersetExercises.length === 0) return;

        const numberOfSets = supersetExercises[0]?.sets || 3;
        let baseWeight = 60;

        // Add warmup sets for each exercise in superset (if enabled)
        supersetExercises.forEach((supEx) => {
          if (supEx.warmup) {
            const bodyweight = isBodyweight(supEx.exercise!);
            if (bodyweight) {
              // Bodyweight warmup
              items.push(new WarmupSetItem({
                id: `warmup-superset-${presetEx.id}-${supEx.exerciseId}`,
                exerciseId: supEx.exercise!.id,
                exerciseName: supEx.exercise!.name,
                exercise: supEx.exercise!,
                setNumber: 0,
                reps: 10,
                completed: false,
                isBodyweight: true,
                isSuperset: true
              }));
            } else {
              // Weighted warmup
              const warmupWeight = Math.floor(baseWeight * 0.5);
              items.push(new WarmupSetItem({
                id: `warmup-superset-${presetEx.id}-${supEx.exerciseId}`,
                exerciseId: supEx.exercise!.id,
                exerciseName: supEx.exercise!.name,
                exercise: supEx.exercise!,
                setNumber: 0,
                weight: warmupWeight,
                reps: 10,
                completed: false,
                isBodyweight: false,
                suggestedWeight: warmupWeight,
                isSuperset: true
              }));
            }
          }
        });

        // Round robin: for each set number, create a row for each exercise in superset
        for (let setNum = 0; setNum < numberOfSets; setNum++) {
          supersetExercises.forEach((supEx) => {
            const exercise = supEx.exercise!;
            const bodyweight = isBodyweight(exercise);
            const weight = bodyweight ? undefined : baseWeight;

            if (bodyweight) {
              items.push(new BodyweightSetItem({
                id: `superset-${presetEx.id}-${supEx.exerciseId}-${setNum}`,
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                exercise,
                setNumber: setNum + 1,
                reps: 10,
                completed: false,
                isBodyweight: true,
                isSuperset: true
              }));
            } else {
              items.push(new NormalSetItem({
                id: `superset-${presetEx.id}-${supEx.exerciseId}-${setNum}`,
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                exercise,
                setNumber: setNum + 1,
                weight,
                reps: 10,
                completed: false,
                isBodyweight: false,
                isSuperset: true
              }));
            }
          });
        }

        return;
      }

      // Handle dropdown sets (working + drop sets in one row)
      if (presetEx.type === 'dropdown') {
        const ex = exercises.find(e => e.id === presetEx.exerciseId);
        if (!ex) return;

        const bodyweight = isBodyweight(ex);
        const numberOfSets = presetEx.sets || 3;
        const numberOfDropdowns = presetEx.dropdowns || 2;
        let baseWeight = 60;

        // Create multiple dropdown set rows (one per set number)
        for (let i = 0; i < numberOfSets; i++) {
          const subSets: Array<{ weight: number; reps: number; completed: boolean; completedAt?: Date }> = [
            { weight: baseWeight, reps: 10, completed: false } // Working set
          ];
          for (let d = 1; d <= numberOfDropdowns; d++) {
            const dropWeight = baseWeight - (d * 2.5);
            subSets.push({ weight: dropWeight, reps: 10, completed: false });
          }

          items.push(new DropdownSetItem({
            id: `dropdown-${presetEx.id}-${i}`,
            exerciseId: presetEx.exerciseId!,
            exerciseName: ex.name,
            exercise: ex,
            setNumber: i + 1,
            weight: baseWeight,
            reps: 10,
            completed: false,
            isBodyweight: bodyweight,
            suggestedWeight: baseWeight,
            subSets
          }));
        }

        return;
      }

      // Handle normal exercise
      const ex = exercises.find(e => e.id === presetEx.exerciseId);
      if (!ex) return;

      const bodyweight = isBodyweight(ex);
      const numberOfSets = presetEx.sets || 3;
      let baseWeight = 60;

      // Add warmup set if enabled
      if (presetEx.warmup) {
        if (bodyweight) {
          items.push(new WarmupSetItem({
            id: `warmup-${presetEx.id}`,
            exerciseId: presetEx.exerciseId!,
            exerciseName: ex.name,
            exercise: ex,
            setNumber: 0,
            reps: 10,
            completed: false,
            isBodyweight: true
          }));
        } else {
          const warmupWeight = Math.floor(baseWeight * 0.5);
          items.push(new WarmupSetItem({
            id: `warmup-${presetEx.id}`,
            exerciseId: presetEx.exerciseId!,
            exerciseName: ex.name,
            exercise: ex,
            setNumber: 0,
            weight: warmupWeight,
            reps: 10,
            completed: false,
            isBodyweight: false,
            suggestedWeight: warmupWeight
          }));
        }
      }

      // Add working sets
      for (let i = 0; i < numberOfSets; i++) {
        const weight = bodyweight ? undefined : baseWeight;

        if (bodyweight) {
          items.push(new BodyweightSetItem({
            id: `${presetEx.id}-${i}`,
            exerciseId: presetEx.exerciseId!,
            exerciseName: ex.name,
            exercise: ex,
            setNumber: i + 1,
            reps: 10,
            completed: false,
            isBodyweight: true
          }));
        } else {
          items.push(new NormalSetItem({
            id: `${presetEx.id}-${i}`,
            exerciseId: presetEx.exerciseId!,
            exerciseName: ex.name,
            exercise: ex,
            setNumber: i + 1,
            weight,
            reps: 10,
            completed: false,
            isBodyweight: false
          }));
        }
      }
    });

    return items;
  };

  const buildSetRows = () => {
    const items = buildSetsFromPreset(preset, exercises);
    // Add originalIndex to each item for re-sorting when uncompleted
    const itemsWithIndex = items.map((item, idx) => {
      item.originalIndex = idx;
      return item;
    });
    setSetRows(itemsWithIndex);
  };

  // Resume an existing workout
  useEffect(() => {
    if (!resumingWorkout) return;

    // Only run once per resumingWorkout to avoid re-processing
    if (isRestored) return;

    // Always set the workout session ID immediately, before exercises load
    // This ensures the data-workout-id attribute is set for E2E testing
    setWorkoutSessionId(resumingWorkout.id);
    setStartTime(new Date(resumingWorkout.startedAt));

    // Wait for exercises to load before processing sets
    if (exercises.length === 0) return;

    // Build ALL sets from the preset first (not just completed ones)
    let items = buildSetsFromPreset(preset, exercises);

    // Then overlay the completed status from saved sets
    if (resumingWorkout.sets && resumingWorkout.sets.length > 0) {
      // Group saved sets by exerciseId for easier matching
      const savedSetsByExercise = new Map<string, WorkoutSet[]>();
      resumingWorkout.sets.forEach(savedSet => {
        if (!savedSetsByExercise.has(savedSet.exerciseId)) {
          savedSetsByExercise.set(savedSet.exerciseId, []);
        }
        savedSetsByExercise.get(savedSet.exerciseId)!.push(savedSet);
      });

      // Track used indices locally (not mutating saved sets)
      const usedIndices = new Set<string>();

      // For each item, try to find a matching saved set
      items = items.map(item => {
        const savedSetsForExercise = savedSetsByExercise.get(item.exerciseId);
        if (!savedSetsForExercise || savedSetsForExercise.length === 0) {
          return item; // No saved sets for this exercise
        }

        // Find an unused saved set that matches this item's type
        const matchingIndex = savedSetsForExercise.findIndex((savedSet, idx) => {
          const usedKey = `${item.exerciseId}-${idx}`;
          if (usedIndices.has(usedKey)) return false;

          // For dropdown sets, backend saves as 'dropdown' or 'normal' type (for compatibility)
          if (item.setType === 'dropdown') {
            return savedSet.setType === 'dropdown' || savedSet.setType === 'normal' || !savedSet.setType;
          }
          // For warmup sets
          if (item.setType === 'warmup') {
            return savedSet.setType === 'warmup';
          }
          // For bodyweight sets
          if (item.setType === 'bodyweight') {
            return savedSet.setType === 'bodyweight' || !savedSet.setType;
          }
          // For normal sets
          if (item.setType === 'normal') {
            return savedSet.setType === 'normal' || !savedSet.setType;
          }
          return false;
        });

        if (matchingIndex !== -1) {
          const savedSet = savedSetsForExercise[matchingIndex];
          // Mark as used locally
          usedIndices.add(`${item.exerciseId}-${matchingIndex}`);

          // For dropdown sets
          if (item.setType === 'dropdown' && 'subSets' in item) {
            const isCompleted = !!savedSet.loggedAt;
            // Use withChanges to preserve class methods
            const ddItem = item as DropdownSetItem;
            const now = isCompleted ? new Date(savedSet.loggedAt!) : undefined;
            return ddItem.withChanges({
              weight: savedSet.weight,
              reps: savedSet.reps,
              subSets: ddItem.subSets.map((ss, idx) => ({
                ...ss,
                weight: idx === 0 ? savedSet.weight : ss.weight,
                reps: savedSet.reps,
                completed: isCompleted,
                completedAt: now
              })),
              completed: isCompleted,
              completedAt: now,
              originalWorkoutSetId: savedSet.id,
              alreadySaved: isCompleted
            } as any);
          }

          // Return the item with completed status (only if loggedAt is set)
          const isCompleted = !!savedSet.loggedAt;
          // Use withChanges to preserve class methods
          return item.withChanges({
            weight: savedSet.weight,
            reps: savedSet.reps,
            completed: isCompleted,
            completedAt: isCompleted ? new Date(savedSet.loggedAt!) : undefined,
            originalWorkoutSetId: savedSet.id,
            alreadySaved: isCompleted
          } as any);
        }

        return item;
      });
    }

    // Add originalIndex to each item for proper sorting
    const itemsWithIndex = items.map((item, idx) => {
      item.originalIndex = idx;
      return item;
    });
    setSetRows(itemsWithIndex);
    setIsRestored(true);
  }, [resumingWorkout, exercises, preset, isRestored]);

  // Build default set rows after restoration check
  useEffect(() => {
    if (exercises.length > 0 && isRestored && setRows.length === 0) {
      buildSetRows();
    }
  }, [exercises, preset, isRestored]); // setRows.length ensures this only runs when needed

  // Clear stored state when workout is completed or cancelled
  const clearStoredState = async () => {
    try {
      // Clear from server
      await activeWorkoutStateApi.clear();
    } catch (e) {
      console.error('Failed to clear workout state:', e);
    }
  };

  // Note: Auto-save removed - all saves are now explicit (on finish workout only)

  const openSetForm = (item: SetItem) => {
    setEditingSetId(item.id);
    const lastForExercise = lastUsed[item.exerciseId];
    // Use polymorphic method - each SetItem type knows how to get its initial form data
    const formData = item.getInitialForm(lastForExercise);
    setSetForm(formData as SetForm); // SetForm is compatible with SetFormData
  };

  const closeSetForm = () => {
    setEditingSetId(null);
    setSetForm({ reps: 10 });
  };

  const submitSet = async () => {
    if (!editingSetId) return;

    // Update local state and capture the new state for persistence
    const newSetRows = await new Promise<SetItem[]>(resolve => {
      setSetRows(prev => {
        const newRows = prev.map(item => {
          if (item.id !== editingSetId) {
            return item;
          }

          // Save last used data using polymorphic method
          const lastUsedData = item.getLastUsedData(setForm as SetFormData);
          setLastUsed(prevLast => ({
            ...prevLast,
            [item.exerciseId]: lastUsedData
          }));

          // Also save to backend for cross-device sync
          lastUsedWeightsApi.set(item.exerciseId, lastUsedData).catch(console.error);

          // Apply form and mark complete using polymorphic method
          return item.applyFormAndComplete(setForm as SetFormData);
        });
        resolve(newRows);
        return newRows;
      });
    });

    // Collect all completed sets to persist
    const completedSets = newSetRows
      .filter(row => row.completed || (row.setType === 'dropdown' && (row as DropdownSetItem).allSubSetsCompleted))
      .flatMap(row => row.toWorkoutSets(startTime));

    // Persist workout session to server for cross-device sync
    if (workoutSessionId) {
      // Update existing session
      workoutsApi.update(workoutSessionId, { sets: completedSets }).catch(console.error);
    } else if (completedSets.length > 0) {
      // Create new session on first completed set
      try {
        const session = await workoutsApi.create({
          name: preset.name,
          startedAt: startTime,
          sets: completedSets
        });
        setWorkoutSessionId(session.id);
      } catch (error) {
        console.error('Failed to create workout session:', error);
      }
    }

    closeSetForm();
  };

  const uncompleteSet = (setId: string) => {
    if (confirm('Uncomplete this set?')) {
      setSetRows(prev => {
        const newRows = prev.map(item => {
          if (item.id !== setId) return item;
          return item.markUncompleted();
        });
        // Persist workout session to server after uncompleting
        if (workoutSessionId) {
          const completedSets = newRows
            .filter(row => row.completed || (row.setType === 'dropdown' && (row as DropdownSetItem).allSubSetsCompleted))
            .flatMap(row => row.toWorkoutSets(startTime));
          workoutsApi.update(workoutSessionId, { sets: completedSets }).catch(console.error);
        }
        return newRows;
      });
    }
  };

  const deleteSet = (setId: string) => {
    if (confirm('Delete this set?')) {
      setSetRows(prev => {
        const newRows = prev.filter(item => item.id !== setId);
        // Persist workout session to server after deleting
        if (workoutSessionId) {
          const completedSets = newRows
            .filter(row => row.completed || (row.setType === 'dropdown' && (row as DropdownSetItem).allSubSetsCompleted))
            .flatMap(row => row.toWorkoutSets(startTime));
          workoutsApi.update(workoutSessionId, { sets: completedSets }).catch(console.error);
        }
        return newRows;
      });
    }
  };

  // Add an extra set to an existing exercise
  const addExtraSet = (exerciseId: string, exerciseName: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const bodyweight = isBodyweight(exercise);
    const existingSetsForExercise = setRows.filter(r => r.exerciseId === exerciseId);
    const nextSetNumber = existingSetsForExercise.length + 1;
    const lastForExercise = lastUsed[exerciseId];
    const lastSet = existingSetsForExercise[existingSetsForExercise.length - 1];

    setSetRows(prev => {
      const newItem = new NormalSetItem({
        id: `extra-${Date.now()}`,
        exerciseId,
        exerciseName,
        exercise,
        setNumber: nextSetNumber,
        weight: lastForExercise?.weight ?? ('weight' in lastSet ? lastSet.weight : undefined),
        reps: lastForExercise?.reps ?? ('reps' in lastSet ? lastSet.reps : 10),
        completed: false,
        isBodyweight: bodyweight,
        isExtra: true
      });
      newItem.originalIndex = prev.length;
      return [...prev, newItem];
    });
  };

  // Add a completely new exercise
  const addNewExercise = (exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const bodyweight = isBodyweight(exercise);

    setSetRows(prev => {
      const newItem = new NormalSetItem({
        id: `new-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exercise,
        setNumber: 1,
      weight: bodyweight ? undefined : 60,
      reps: 10,
      completed: false,
      isBodyweight: bodyweight,
      isExtra: true
    });
    newItem.originalIndex = prev.length;
    return [...prev, newItem];
    });

    setShowAddExercise(false);
    setExerciseSearch('');
    setExerciseFilterCategory('all');
  };

  const calculateTotalVolume = () => {
    return setRows.reduce((sum, item) => {
      if (item.setType === 'dropdown') {
        const ddItem = item as DropdownSetItem;
        ddItem.subSets.forEach(subSet => {
          if (subSet.completed && subSet.weight) {
            sum += subSet.weight * subSet.reps;
          }
        });
      } else if (item.completed && item.weight) {
        sum += item.weight * item.reps;
      }
      return sum;
    }, 0);
  };

  const calculateCompletedSets = () => {
    const count = setRows.reduce((count, item) => {
      if (item.setType === 'dropdown') {
        // Count dropdown as 1 if all sub-sets are completed, otherwise 0
        return count + ((item as DropdownSetItem).allSubSetsCompleted ? 1 : 0);
      }
      return count + (item.completed ? 1 : 0);
    }, 0);
    return count;
  };

  const calculateTotalSets = () => {
    // Count each row as 1 set (dropdown rows count as 1, not by sub-sets)
    return setRows.length;
  };

  const handleFinishWorkout = async () => {
    setLoading(true);
    try {
      // For new sessions: only send newly completed sets
      // For existing sessions (resuming): send ALL completed sets to replace the entire array
      let workoutSets: WorkoutSet[];
      if (workoutSessionId) {
        // Updating existing session - send ALL completed sets
        workoutSets = setRows
          .filter(item => item.completed)
          .map(item => ({
            id: (item as any).originalWorkoutSetId || item.id,
            exerciseId: item.exerciseId,
            setType: item.setType === 'warmup' ? 'warmup' : 'normal',
            weight: item.weight,
            reps: item.reps,
            loggedAt: item.completedAt || startTime
          }));
      } else {
        // New session - only send newly completed sets
        workoutSets = setRows.flatMap(item => item.toWorkoutSets(startTime));
      }

      let workout: WorkoutSession;

      if (workoutSessionId) {
        // Update existing session
        try {
          workout = await workoutsApi.update(workoutSessionId, {
            sets: workoutSets,
            endedAt: new Date()
          });
        } catch (error: any) {
          // If workout not found (404), create a new session instead
          if (error?.message?.includes('not found') || error?.message?.includes('404')) {
            setWorkoutSessionId(null);
            workout = await workoutsApi.create({
              name: preset.name,
              startedAt: startTime,
              endedAt: new Date(),
              sets: workoutSets
            });
          } else {
            throw error;
          }
        }
      } else {
        // Create new session
        workout = await workoutsApi.create({
          name: preset.name,
          startedAt: startTime,
          endedAt: new Date(),
          sets: workoutSets
        });
      }
      workout.totalVolume = calculateTotalVolume();

      clearStoredState();
      onComplete(workout);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkout = () => {
    if (confirm('Cancel and delete this workout? All progress will be lost.')) {
      // If we have an auto-saved session, delete it and notify parent
      if (workoutSessionId) {
        workoutsApi.delete(workoutSessionId)
          .then(() => {
            // Notify parent to remove from list
            onDelete?.(workoutSessionId);
          })
          .catch(console.error);
      }
      clearStoredState();
      onCancel();
    }
  };

  const isFreestyle = preset.id === 'freestyle' || preset.exercises.length === 0;

  // Completed sets sorted by completion time (oldest first)
  const completedSets = setRows
    .filter(row => row.isFullyCompleted)
    .sort((a, b) => {
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      return aTime - bTime; // Oldest first
    });

  // Incomplete sets sorted by original order
  const incompleteSets = setRows
    .filter(row => !row.isFullyCompleted)
    .sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));

  // Show completed sets based on showAllCompleted, incomplete based on showAllIncomplete
  const visibleSetRows: SetItem[] = [
    // Completed sets - all or just last 2 (by completion time)
    ...(showAllCompleted ? completedSets : completedSets.slice(-2)),
    // Incomplete sets - all or just next 3
    ...(showAllIncomplete ? incompleteSets : incompleteSets.slice(0, 3))
  ];

  // For freestyle mode with no sets, show a message prompting to add exercises
  const showFreestyleEmpty = isFreestyle && setRows.length === 0;

  return (
    <div className="space-y-4" data-workout-id={workoutSessionId}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Active Workout {preset.name !== 'Freestyle' && preset.name}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{calculateCompletedSets()}/{calculateTotalSets()}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">sets</div>
          </div>
          <button
            onClick={handleDeleteWorkout}
            className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title="Delete workout"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {/* Show more completed sets button (at top) */}
      {completedSets.length > 2 && (
        <button
          onClick={() => setShowAllCompleted(!showAllCompleted)}
          className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm"
        >
          {showAllCompleted ? 'Show less' : `Show ${completedSets.length - 2} more completed`}
        </button>
      )}

      {/* Freestyle empty state message */}
      {showFreestyleEmpty && (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-300 mb-1">Freestyle mode - add exercises as you go</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Use the button below to add your first exercise</p>
        </div>
      )}

      {/* Set Rows - using shared SetRow component */}
      <div className="space-y-2">
        {visibleSetRows.map((item) => {
          const isEditing = editingSetId === item.id;

          return (
            <SetRow
              key={item.id}
              item={item}
              isEditing={isEditing}
              setForm={setForm}
              onOpenSetForm={() => openSetForm(item)}
              onSubmitSet={submitSet}
              onCloseSetForm={closeSetForm}
              onUncompleteSet={() => uncompleteSet(item.id)}
              onDeleteSet={() => deleteSet(item.id)}
              onSetFormChange={setSetForm}
            />
          );
        })}
      </div>

      {/* Show more incomplete sets button (at bottom) */}
      {incompleteSets.length > 3 && (
        <button
          onClick={() => setShowAllIncomplete(!showAllIncomplete)}
          className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {showAllIncomplete ? 'Show less' : `Show ${incompleteSets.length - 3} more`}
        </button>
      )}

      {/* Add Exercise/Section Buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(
          setRows.reduce((acc, row) => {
            acc[row.exerciseId] = acc[row.exerciseId] || { name: row.exerciseName, exercise: row.exercise };
            return acc;
          }, {} as Record<string, { name: string; exercise: Exercise }>)
        ).map(([exerciseId, info]) => (
          <button
            key={exerciseId}
            onClick={() => addExtraSet(exerciseId, info.name)}
            className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-1"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" /> Set for {info.name}
          </button>
        ))}
      </div>

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

          {/* Exercise Picker - shown below button when adding */}
          {showAddExercise && (
            <ExercisePicker
              exercises={exercises}
              filteredExercises={filteredExercises}
              search={exerciseSearch}
              onSearchChange={setExerciseSearch}
              filterCategory={exerciseFilterCategory}
              onFilterChange={setExerciseFilterCategory}
              onExerciseClick={(exercise) => addNewExercise(exercise.id)}
              onClose={() => {
                setShowAddExercise(false);
                setExerciseSearch('');
                setExerciseFilterCategory('all');
              }}
              excludedIds={setRows.map(row => row.exerciseId)}
            />
          )}
        </div>
      )}

      {/* Finish Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleFinishWorkout}
          disabled={loading || calculateCompletedSets() === 0}
          className="px-6 py-3 text-lg font-medium text-white bg-green-600 dark:bg-green-700 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : `Finish Workout (${calculateCompletedSets()}/${calculateTotalSets()} sets)`}
        </button>
      </div>
    </div>
  );
}
