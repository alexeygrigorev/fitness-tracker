import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { workoutsApi, exercisesApi } from '../lib/api';
import { ExercisePicker } from './ExerciseSelector';
import SetRow, { type SetForm } from './SetRow';
import { createSetItem, WarmupSetItem, NormalSetItem, BodyweightSetItem, DropdownSetItem } from '../lib/setItems';
import type { SetFormData, LastUsedData } from '../lib/setItems';
import type { SetItem } from '../lib/setItems';
import type { WorkoutPreset, WorkoutSession, Exercise, WorkoutSet } from '../lib/types';

interface ActiveWorkoutProps {
  preset: WorkoutPreset;
  onComplete: (workout: WorkoutSession) => void;
  onCancel: () => void;
  resumingWorkout?: WorkoutSession; // If provided, resume this workout instead of starting fresh
}

const isBodyweight = (exercise: Exercise) => {
  return exercise.bodyweight === true ||
    exercise.equipment.length === 0 ||
    (exercise.equipment.length === 1 && exercise.equipment[0].toLowerCase() === 'bodyweight');
};

// Storage key for active workout persistence
const ACTIVE_WORKOUT_STORAGE_KEY = 'activeWorkout';

interface StoredWorkoutState {
  preset: WorkoutPreset;
  setRows: any[]; // Plain objects for serialization
  startTime: string;
  workoutSessionId: string | null;
  lastUsed: Record<string, LastUsedData>;
}

export default function ActiveWorkout({ preset, onComplete, onCancel, resumingWorkout }: ActiveWorkoutProps) {
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

  // Filter exercises based on search and category
  useEffect(() => {
    let filtered = exercises;

    if (exerciseSearch) {
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        ex.muscleGroups.some(mg => mg.toLowerCase().includes(exerciseSearch.toLowerCase()))
      );
    }

    if (exerciseFilterCategory !== 'all') {
      if (exerciseFilterCategory === 'upper') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups.some(mg => ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps', 'lats', 'forearms'].includes(mg))
        );
      } else if (exerciseFilterCategory === 'lower') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups.some(mg => ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques'].includes(mg))
        );
      } else {
        filtered = filtered.filter(ex => ex.category === exerciseFilterCategory);
      }
    }

    setFilteredExercises(filtered);
  }, [exercises, exerciseSearch, exerciseFilterCategory]);

  // Restore workout state from localStorage on mount (only once)
  useEffect(() => {
    if (exercises.length === 0) return; // Wait for exercises to load

    try {
      const stored = localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
      if (stored) {
        const state: StoredWorkoutState = JSON.parse(stored);
        // Check if the stored workout is for the same preset and from today
        const storedDate = new Date(state.startTime);
        const today = new Date();
        const isSameDay = storedDate.toDateString() === today.toDateString();

        if (isSameDay && state.preset.id === preset.id) {
          // Restore the state - convert plain objects back to SetItem instances
          const restoredItems = state.setRows.map(row => {
            const exercise = exercises.find(e => e.id === row.exerciseId) || row.exercise;
            const plainRow = {
              ...row,
              completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
              exercise
            };
            return createSetItem(plainRow);
          });
          setSetRows(restoredItems);
          setStartTime(new Date(state.startTime));
          setWorkoutSessionId(state.workoutSessionId);
          setLastUsed(state.lastUsed);
          setIsRestored(true);
          return; // Don't build default rows
        }
      }
    } catch (e) {
      console.error('Failed to restore workout state:', e);
    }
    // No valid stored state or different preset - mark as restored and build default
    setIsRestored(true);
  }, [exercises, preset]); // Remove isRestored to prevent re-running

  // Resume an existing workout
  useEffect(() => {
    if (!resumingWorkout || exercises.length === 0) return;

    // Set the workout session ID so updates go to the existing workout
    setWorkoutSessionId(resumingWorkout.id);
    setStartTime(new Date(resumingWorkout.startedAt));

    // Restore sets from the workout session
    const restoredItems = resumingWorkout.sets.map((workoutSet, idx) => {
      const exercise = exercises.find(e => e.id === workoutSet.exerciseId);
      if (!exercise) return null;

      // Map WorkoutSet to appropriate SetItem based on setType
      const baseData = {
        id: `set-${Date.now()}-${idx}`, // New unique ID for internal use
        exerciseId: workoutSet.exerciseId,
        exerciseName: exercise.name,
        exercise,
        setNumber: Math.floor(idx / 3) + 1, // Rough estimate for set number
        weight: workoutSet.weight,
        reps: workoutSet.reps,
        completed: !!workoutSet.loggedAt,
        completedAt: workoutSet.loggedAt ? new Date(workoutSet.loggedAt) : undefined,
        isBodyweight: isBodyweight(exercise),
        suggestedWeight: workoutSet.weight,
        originalIndex: idx,
        originalWorkoutSetId: workoutSet.id, // Store original ID for saving
        alreadySaved: true // Mark as already saved so we don't duplicate
      };

      if (workoutSet.setType === 'warmup') {
        return new WarmupSetItem({ ...baseData, reps: workoutSet.reps || 10 });
      }

      return new NormalSetItem(baseData);
    }).filter((item): item is WarmupSetItem | NormalSetItem => item !== null);

    setSetRows(restoredItems);
    setIsRestored(true);
  }, [resumingWorkout, exercises]);

  // Build default set rows after restoration check
  useEffect(() => {
    if (exercises.length > 0 && isRestored && setRows.length === 0) {
      buildSetRows();
    }
  }, [exercises, preset, isRestored]); // setRows.length ensures this only runs when needed

  // Save workout state to localStorage whenever it changes
  useEffect(() => {
    if (!isRestored) return; // Don't save until we've tried to restore

    const hasProgress = setRows.some(r => r.completed) || setRows.some(r => r.isExtra);
    if (hasProgress) {
      try {
        const stateToStore: StoredWorkoutState = {
          preset,
          setRows,
          startTime: startTime.toISOString(),
          workoutSessionId,
          lastUsed
        };
        localStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (e) {
        console.error('Failed to save workout state:', e);
      }
    }
  }, [setRows, startTime, workoutSessionId, lastUsed, preset, isRestored]);

  // Clear stored state when workout is completed or cancelled
  const clearStoredState = () => {
    try {
      localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear workout state:', e);
    }
  };

  // Auto-save workout session as sets are completed
  useEffect(() => {
    if (setRows.length === 0) return;

    const hasCompletedSets = setRows.some(r => r.isFullyCompleted);
    if (!hasCompletedSets) return;

    const saveWorkout = async () => {
      try {
        // For new sessions: only send newly completed sets
        // For existing sessions (resuming): send ALL completed sets to replace the entire array
        let workoutSets: WorkoutSet[];
        if (workoutSessionId) {
          // Updating existing session - send ALL completed sets (including alreadySaved ones)
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

        if (workoutSessionId) {
          // Update existing session
          await workoutsApi.update(workoutSessionId, {
            sets: workoutSets,
            endedAt: undefined  // Don't end yet, still active
          });
        } else {
          // Create new session
          const workout = await workoutsApi.create({
            name: preset.name,
            startedAt: startTime,
            endedAt: undefined,  // Don't end yet, still active
            sets: workoutSets
          });
          setWorkoutSessionId(workout.id);
        }
      } catch (error: any) {
        // If workout not found (404), clear the session ID and try creating a new one next time
        if (error?.message?.includes('not found') || error?.message?.includes('404')) {
          setWorkoutSessionId(null);
        }
        console.error('Auto-save failed:', error);
      }
    };

    // Debounce save
    const timeoutId = setTimeout(saveWorkout, 500);
    return () => clearTimeout(timeoutId);
  }, [setRows, preset.name, startTime, workoutSessionId]);

  const buildSetRows = () => {
    if (preset.id === 'freestyle' || preset.exercises.length === 0) {
      setSetRows([]);
      return;
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
                suggestedWeight: weight,
                isSuperset: true
              }));
            }
          });
        }
        return;
      }

      // Handle normal exercise
      const exercise = exercises.find(e => e.id === presetEx.exerciseId);
      if (!exercise) return;

      const bodyweight = isBodyweight(exercise);
      const numberOfSets = presetEx.sets || 3;
      let baseWeight = 60;

      // Add warmup set first (if enabled)
      if (presetEx.warmup) {
        if (bodyweight) {
          // Bodyweight warmup - just click to complete
          items.push(new WarmupSetItem({
            id: `warmup-${presetEx.id}`,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            exercise,
            setNumber: 0,
            reps: 10,
            completed: false,
            isBodyweight: true
          }));
        } else {
          // Weighted warmup
          const warmupWeight = Math.floor(baseWeight * 0.5);
          items.push(new WarmupSetItem({
            id: `warmup-${presetEx.id}`,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            exercise,
            setNumber: 0,
            weight: warmupWeight,
            reps: 10,
            completed: false,
            isBodyweight: false,
            suggestedWeight: warmupWeight
          }));
        }
      }

      if (presetEx.type === 'dropdown' && presetEx.dropdowns && !bodyweight) {
        // For dropdown sets: create multiple items (one per set number), each with subSets array (working + drops)
        for (let i = 0; i < numberOfSets; i++) {
          const dropdownId = `dropdown-${presetEx.id}-${i}`;
          const subSets: Array<{ weight: number; reps: number; completed: boolean }> = [
            { weight: baseWeight, reps: 10, completed: false } // Working set
          ];
          for (let d = 1; d <= presetEx.dropdowns; d++) {
            const dropWeight = baseWeight - (d * 2.5);
            subSets.push({ weight: dropWeight, reps: 10, completed: false });
          }

          items.push(new DropdownSetItem({
            id: dropdownId,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            exercise,
            setNumber: i + 1,
            weight: baseWeight,
            reps: 10,
            completed: false,
            isBodyweight: false,
            suggestedWeight: baseWeight,
            subSets
          }));
        }
      } else {
        // Normal sets or bodyweight sets
        for (let i = 0; i < numberOfSets; i++) {
          const weight = bodyweight ? undefined : baseWeight;

          if (bodyweight) {
            items.push(new BodyweightSetItem({
              id: `set-${presetEx.id}-${i}`,
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              exercise,
              setNumber: i + 1,
              reps: 10,
              completed: false,
              isBodyweight: true
            }));
          } else {
            items.push(new NormalSetItem({
              id: `set-${presetEx.id}-${i}`,
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              exercise,
              setNumber: i + 1,
              weight,
              reps: 10,
              completed: false,
              isBodyweight: false,
              suggestedWeight: weight
            }));
          }
        }
      }
    });

    // Add originalIndex to each item for re-sorting when uncompleted
    const itemsWithIndex = items.map((item, idx) => {
      item.originalIndex = idx;
      return item;
    });
    setSetRows(itemsWithIndex);
  };

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

  const submitSet = () => {
    if (!editingSetId) return;

    setSetRows(prev => prev.map(item => {
      if (item.id !== editingSetId) return item;

      // Save last used data using polymorphic method
      const lastUsedData = item.getLastUsedData(setForm as SetFormData);
      setLastUsed(prevLast => ({
        ...prevLast,
        [item.exerciseId]: lastUsedData
      }));

      // Apply form and mark complete using polymorphic method
      return item.applyFormAndComplete(setForm as SetFormData);
    }));

    closeSetForm();
  };

  const uncompleteSet = (setId: string) => {
    if (confirm('Uncomplete this set?')) {
      setSetRows(prev => prev.map(item => {
        if (item.id !== setId) return item;
        return item.markUncompleted();
      }));
    }
  };

  const deleteSet = (setId: string) => {
    if (confirm('Delete this set?')) {
      setSetRows(prev => prev.filter(item => item.id !== setId));
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
    return setRows.reduce((count, item) => {
      if (item.setType === 'dropdown') {
        return count + (item as DropdownSetItem).completedSubSets;
      }
      return count + (item.completed ? 1 : 0);
    }, 0);
  };

  const calculateTotalSets = () => {
    return setRows.reduce((count, item) => {
      if (item.setType === 'dropdown') {
        return count + (item as DropdownSetItem).totalSubSets;
      }
      return count + 1;
    }, 0);
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
      // If we have an auto-saved session, delete it
      if (workoutSessionId) {
        workoutsApi.delete(workoutSessionId).catch(console.error);
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

  if (isFreestyle && setRows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Active Workout {preset.name !== 'Freestyle' && preset.name}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">{calculateCompletedSets()}/{calculateTotalSets()}</div>
              <div className="text-xs text-gray-500">sets</div>
            </div>
            <button
              onClick={handleDeleteWorkout}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              title="Delete workout"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Freestyle mode - coming soon</p>
          <p className="text-sm text-gray-400">Use a preset to start a workout</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Active Workout {preset.name !== 'Freestyle' && preset.name}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600">{calculateCompletedSets()}/{calculateTotalSets()}</div>
            <div className="text-xs text-gray-500">sets</div>
          </div>
          <button
            onClick={handleDeleteWorkout}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
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
          className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm"
        >
          {showAllCompleted ? 'Show less' : `Show ${completedSets.length - 2} more completed`}
        </button>
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
          className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
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
            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
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
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
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
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleFinishWorkout}
          disabled={loading || calculateCompletedSets() === 0}
          className="px-6 py-3 text-lg font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : `Finish Workout (${calculateCompletedSets()}/${calculateTotalSets()} sets)`}
        </button>
      </div>
    </div>
  );
}
