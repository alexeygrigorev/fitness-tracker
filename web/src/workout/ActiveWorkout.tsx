import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { workoutsApi, exercisesApi, activeWorkoutStateApi } from '../api';
import { ExercisePicker } from './ExerciseSelector';
import SetRow, { type SetForm } from '../components/SetRow';
import { createSetItem, WarmupSetItem, NormalSetItem, BodyweightSetItem, DropdownSetItem } from './setItems';
import type { SetFormData, LastUsedData } from './setItems';
import type { SetItem } from './setItems';
import type { WorkoutPreset, WorkoutSession, Exercise, WorkoutSet } from '../types';

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

// Storage key for active workout persistence (legacy, for migration)
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

  // Restore workout state from server on mount (only once)
  useEffect(() => {
    if (exercises.length === 0) return; // Wait for exercises to load

    const restoreState = async () => {
      try {
        // First try server-side storage
        const serverState = await activeWorkoutStateApi.get();

        if (serverState) {
          const storedDate = new Date(serverState.startTime);
          const today = new Date();
          const isSameDay = storedDate.toDateString() === today.toDateString();

          if (isSameDay && serverState.preset.id === preset.id) {
            // Restore the state - convert plain objects back to SetItem instances
            const restoredItems = serverState.setRows.map((row: any) => {
              const exercise = exercises.find(e => e.id === row.exerciseId) || row.exercise;
              const plainRow = {
                ...row,
                completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
                exercise
              };
              return createSetItem(plainRow);
            });
            setSetRows(restoredItems);
            setStartTime(new Date(serverState.startTime));
            setWorkoutSessionId(serverState.workoutSessionId);
            setLastUsed(serverState.lastUsed);
            setIsRestored(true);
            return; // Don't build default rows
          }
        }
      } catch (e) {
        console.error('Failed to restore workout state from server:', e);
      }

      // Fallback to localStorage for migration
      try {
        const stored = localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
        if (stored) {
          const state: StoredWorkoutState = JSON.parse(stored);
          const storedDate = new Date(state.startTime);
          const today = new Date();
          const isSameDay = storedDate.toDateString() === today.toDateString();

          if (isSameDay && state.preset.id === preset.id) {
            // Restore and migrate to server
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

            // Migrate to server
            activeWorkoutStateApi.save({
              preset: state.preset,
              setRows: state.setRows,
              startTime: state.startTime,
              workoutSessionId: state.workoutSessionId,
              lastUsed: state.lastUsed
            }).catch(console.error);

            // Clear localStorage
            localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);

            setIsRestored(true);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to restore workout state from localStorage:', e);
      }

      // No valid stored state or different preset - mark as restored and build default
      setIsRestored(true);
    };

    restoreState();
  }, [exercises, preset]);

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
        let baseWeight = 60;

        // Create dropdown set containing W + D1 + D2
        items.push(new DropdownSetItem({
          id: `dropdown-${presetEx.id}`,
          exerciseId: presetEx.exerciseId,
          exerciseName: ex.name,
          exercise: ex,
          setNumber: 1,
          baseWeight,
          reps: 10,
          completed: false,
          isBodyweight: bodyweight,
          subSets: Array.from({ length: numberOfSets }, (_, i) => ({
            id: `dropdown-${presetEx.id}-${i}`,
            setType: i === 0 ? 'working' : 'drop',
            dropNumber: i === 0 ? undefined : i,
            weight: bodyweight ? undefined : baseWeight - (i * 2.5),
            reps: 10,
            completed: false
          }))
        }));

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
            exerciseId: presetEx.exerciseId,
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
            exerciseId: presetEx.exerciseId,
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
            exerciseId: presetEx.exerciseId,
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
            exerciseId: presetEx.exerciseId,
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
    if (!resumingWorkout || exercises.length === 0) return;

    // Set the workout session ID so updates go to the existing workout
    setWorkoutSessionId(resumingWorkout.id);
    setStartTime(new Date(resumingWorkout.startedAt));

    // Build ALL sets from the preset first (not just completed ones)
    let items = buildSetsFromPreset(preset, exercises);

    // Then overlay the completed status from saved sets
    if (resumingWorkout.sets && resumingWorkout.sets.length > 0) {
      // Create a map of saved sets by exerciseId and setType for quick lookup
      const savedSetsByExercise = new Map<string, WorkoutSet[]>();
      resumingWorkout.sets.forEach(savedSet => {
        const key = `${savedSet.exerciseId}-${savedSet.setType || 'normal'}`;
        if (!savedSetsByExercise.has(key)) {
          savedSetsByExercise.set(key, []);
        }
        savedSetsByExercise.get(key)!.push(savedSet);
      });

      // Match saved sets to built sets and update their status
      items = items.map(item => {
        // For dropdown sets, backend stores as 'normal' type
        const setTypeKey = item.setType === 'dropdown' ? 'normal' : item.setType;
        const key = `${item.exerciseId}-${setTypeKey}`;
        const savedSets = savedSetsByExercise.get(key);

        if (!savedSets || savedSets.length === 0) {
          return item; // No saved data for this set, leave as incomplete
        }

        // Try to find a matching saved set for this specific set
        const matchingSavedSet = savedSets.find((savedSet, idx) => {
          // For warmup sets, match by setType
          if (item.setType === 'warmup' && savedSet.setType === 'warmup') {
            return true;
          }
          // For dropdown sets, match by 'normal' type from backend
          if (item.setType === 'dropdown' && (savedSet.setType === 'normal' || !savedSet.setType)) {
            const savedIndex = savedSets.findIndex(s => !s._matched);
            if (savedIndex !== -1) {
              savedSets[savedIndex]._matched = true;
              return true;
            }
          }
          // For working sets, match by set number (approximate)
          if (item.setType === 'normal' || item.setType === 'bodyweight') {
            // Find a saved set that hasn't been matched yet
            const savedIndex = savedSets.findIndex(s => !s._matched);
            if (savedIndex !== -1) {
              savedSets[savedIndex]._matched = true;
              return true;
            }
          }
          return false;
        });

        if (matchingSavedSet && matchingSavedSet.loggedAt) {
          // Update this set with the saved data
          return {
            ...item,
            weight: matchingSavedSet.weight,
            reps: matchingSavedSet.reps,
            completed: true,
            completedAt: new Date(matchingSavedSet.loggedAt),
            originalWorkoutSetId: matchingSavedSet.id,
            alreadySaved: true
          };
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
  }, [resumingWorkout, exercises, preset]);

  // Build default set rows after restoration check
  useEffect(() => {
    if (exercises.length > 0 && isRestored && setRows.length === 0) {
      buildSetRows();
    }
  }, [exercises, preset, isRestored]); // setRows.length ensures this only runs when needed

  // Save workout state to server whenever it changes
  useEffect(() => {
    if (!isRestored) return; // Don't save until we've tried to restore

    const hasProgress = setRows.some(r => r.completed) || setRows.some(r => r.isExtra);
    if (hasProgress) {
      const stateToStore = {
        preset,
        setRows,
        startTime: startTime.toISOString(),
        workoutSessionId,
        lastUsed
      };
      // Save to server (fire and forget)
      activeWorkoutStateApi.save(stateToStore).catch(console.error);
    }
  }, [setRows, startTime, workoutSessionId, lastUsed, preset, isRestored]);

  // Clear stored state when workout is completed or cancelled
  const clearStoredState = async () => {
    try {
      // Clear from server
      await activeWorkoutStateApi.clear();
    } catch (e) {
      console.error('Failed to clear workout state:', e);
    }
    // Also clear localStorage as fallback
    try {
      localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
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

  // For freestyle mode with no sets, show a message prompting to add exercises
  const showFreestyleEmpty = isFreestyle && setRows.length === 0;

  return (
    <div className="space-y-4">
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
