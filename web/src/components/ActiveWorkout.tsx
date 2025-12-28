import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faClock, faTrash } from '@fortawesome/free-solid-svg-icons';
import { workoutsApi, exercisesApi } from '../lib/api';
import type { WorkoutPreset, WorkoutSession, Exercise, WorkoutSet } from '../lib/types';

interface ActiveWorkoutProps {
  preset: WorkoutPreset;
  onComplete: (workout: WorkoutSession) => void;
  onCancel: () => void;
}

interface SetRow {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exercise: Exercise;
  setNumber: number;
  setType: 'normal' | 'warmup' | 'drop' | 'failure';
  weight?: number;
  reps: number;
  completed: boolean;
  completedAt?: Date;
  isBodyweight: boolean;
  suggestedWeight?: number;
  isExtra?: boolean;
  isSuperset?: boolean;
}

interface SetForm {
  weight?: number;
  reps: number;
}

const isBodyweight = (exercise: Exercise) => {
  return exercise.equipment.length === 0 ||
    (exercise.equipment.length === 1 && exercise.equipment[0].toLowerCase() === 'bodyweight');
};

// Storage key for active workout persistence
const ACTIVE_WORKOUT_STORAGE_KEY = 'activeWorkout';

interface StoredWorkoutState {
  preset: WorkoutPreset;
  setRows: SetRow[];
  startTime: string;
  workoutSessionId: string | null;
  lastUsed: Record<string, { weight?: number; reps: number }>;
}

export default function ActiveWorkout({ preset, onComplete, onCancel }: ActiveWorkoutProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [setRows, setSetRows] = useState<SetRow[]>([]);
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

  useEffect(() => {
    exercisesApi.getAll().then(setExercises);
  }, []);

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
          // Restore the state
          setSetRows(state.setRows.map(row => ({
            ...row,
            completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
            exercise: exercises.find(e => e.id === row.exerciseId) || row.exercise
          })));
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

    const hasCompletedSets = setRows.some(r => r.completed);
    if (!hasCompletedSets) return;

    const saveWorkout = async () => {
      try {
        const workoutSets: WorkoutSet[] = setRows
          .filter(row => row.completed)
          .map(row => ({
            id: row.id,
            exerciseId: row.exerciseId,
            setType: row.setType,
            weight: row.weight,
            reps: row.reps,
            loggedAt: row.completedAt || startTime
          }));

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
      } catch (error) {
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

    const rows: SetRow[] = [];

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

        // Round robin: for each set number, create a row for each exercise in superset
        for (let setNum = 0; setNum < numberOfSets; setNum++) {
          supersetExercises.forEach((supEx) => {
            const exercise = supEx.exercise!;
            const bodyweight = isBodyweight(exercise);
            const weight = bodyweight ? undefined : baseWeight;

            rows.push({
              id: `superset-${presetEx.id}-${supEx.exerciseId}-${setNum}`,
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              exercise,
              setNumber: setNum + 1,
              setType: (supEx.type === 'dropdown' ? 'drop' : supEx.type || 'normal') as 'normal' | 'warmup' | 'drop' | 'failure',
              weight,
              reps: 10,
              completed: false,
              isBodyweight: bodyweight,
              suggestedWeight: weight,
              isSuperset: true
            });
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

      for (let i = 0; i < numberOfSets; i++) {
        let weight: number | undefined;
        let setType: 'normal' | 'warmup' | 'drop' | 'failure' = 'normal';

        if (presetEx.type === 'dropdown' && presetEx.dropdowns && !bodyweight) {
          weight = baseWeight - (i * presetEx.dropdowns * 2.5);
          setType = i === 0 ? 'normal' : 'drop';
        } else if (!bodyweight) {
          weight = baseWeight;
        }

        rows.push({
          id: `set-${presetEx.id}-${i}`,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          exercise,
          setNumber: i + 1,
          setType,
          weight,
          reps: 10,
          completed: false,
          isBodyweight: bodyweight,
          suggestedWeight: weight
        });
      }
    });

    setSetRows(rows);
  };

  const openSetForm = (setRow: SetRow) => {
    setEditingSetId(setRow.id);
    // Use last used weight/reps for this exercise, or fall back to current values
    const lastForExercise = lastUsed[setRow.exerciseId];
    setSetForm({
      weight: lastForExercise?.weight ?? (setRow.weight ?? setRow.suggestedWeight),
      reps: lastForExercise?.reps ?? (setRow.reps || 10)
    });
  };

  const closeSetForm = () => {
    setEditingSetId(null);
    setSetForm({ reps: 10 });
  };

  const submitSet = () => {
    if (!editingSetId) return;

    setSetRows(prev => prev.map(row => {
      if (row.id === editingSetId) {
        // Remember this weight/reps for future sets of the same exercise
        setLastUsed(prevLast => ({
          ...prevLast,
          [row.exerciseId]: { weight: setForm.weight, reps: setForm.reps }
        }));

        return {
          ...row,
          weight: setForm.weight,
          reps: setForm.reps,
          completed: true,
          completedAt: new Date()
        };
      }
      return row;
    }));

    closeSetForm();
  };

  const uncompleteSet = (setId: string) => {
    if (confirm('Uncomplete this set?')) {
      setSetRows(prev => prev.map(row => {
        if (row.id === setId) {
          return { ...row, completed: false, completedAt: undefined };
        }
        return row;
      }));
    }
  };

  const deleteSet = (setId: string) => {
    if (confirm('Delete this set?')) {
      setSetRows(prev => prev.filter(row => row.id !== setId));
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

    setSetRows(prev => [...prev, {
      id: `extra-${Date.now()}`,
      exerciseId,
      exerciseName,
      exercise,
      setNumber: nextSetNumber,
      setType: 'normal',
      weight: lastForExercise?.weight ?? (lastSet?.weight),
      reps: lastForExercise?.reps ?? (lastSet?.reps || 10),
      completed: false,
      isBodyweight: bodyweight,
      isExtra: true
    }]);
  };

  // Add a completely new exercise
  const addNewExercise = (exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const bodyweight = isBodyweight(exercise);

    setSetRows(prev => [...prev, {
      id: `new-${Date.now()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exercise,
      setNumber: 1,
      setType: 'normal',
      weight: bodyweight ? undefined : 60,
      reps: 10,
      completed: false,
      isBodyweight: bodyweight,
      isExtra: true
    }]);

    setShowAddExercise(false);
  };

  const calculateTotalVolume = () => {
    return setRows.reduce((sum, row) => {
      if (row.completed && row.weight) {
        return sum + (row.weight * row.reps);
      }
      return sum;
    }, 0);
  };

  const calculateCompletedSets = () => {
    return setRows.filter(r => r.completed).length;
  };

  const calculateTotalSets = () => {
    return setRows.length;
  };

  const handleFinishWorkout = async () => {
    setLoading(true);
    try {
      const workoutSets: WorkoutSet[] = setRows
        .filter(row => row.completed)
        .map(row => ({
          id: row.id,
          exerciseId: row.exerciseId,
          setType: row.setType,
          weight: row.weight,
          reps: row.reps,
          loggedAt: row.completedAt || startTime
        }));

      let workout: WorkoutSession;

      if (workoutSessionId) {
        // Update existing session
        workout = await workoutsApi.update(workoutSessionId, {
          sets: workoutSets,
          endedAt: new Date()
        });
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
  const completedSets = setRows.filter(r => r.completed);
  const incompleteSets = setRows.filter(r => !r.completed);

  // Show completed sets based on showAllCompleted, incomplete based on showAllIncomplete
  const visibleSetRows = [
    // Completed sets - all or just last 2
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

  // Exercise picker for adding new exercises
  const availableExercises = exercises.filter(e =>
    !setRows.some(row => row.exerciseId === e.id)
  );

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

      {/* Set Rows - Flat list for round-robin superset support */}
      <div className="space-y-2">
        {visibleSetRows.map((row) => {
          const isEditing = editingSetId === row.id;

          return (
            <div
              key={row.id}
              className={`border rounded-lg transition-all ${
                row.completed
                  ? 'border-green-300 bg-green-50'
                  : isEditing
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-blue-300 cursor-pointer'
              }`}
            >
              {isEditing ? (
                // Edit Form
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900">{row.exerciseName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Set {row.setNumber}</span>
                    {row.isExtra && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Extra</span>
                    )}
                    {row.isSuperset && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Superset</span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitSet();
                      if (e.key === 'Escape') closeSetForm();
                    }}
                  >
                    {!row.isBodyweight && (
                      <>
                        <input
                          type="number"
                          value={setForm.weight ?? ''}
                          onChange={(e) => setSetForm(prev => ({ ...prev, weight: parseFloat(e.target.value) || undefined }))}
                          placeholder="kg"
                          className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <span className="text-gray-400 text-xs">kg</span>
                        <span className="text-gray-400 text-xs">×</span>
                      </>
                    )}

                    <input
                      type="number"
                      value={setForm.reps}
                      onChange={(e) => setSetForm(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                      placeholder="reps"
                      className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400 text-xs">reps</span>

                    <button
                      onClick={submitSet}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      ✓
                    </button>

                    <button
                      onClick={closeSetForm}
                      className="px-2 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm"
                    >
                      ✕
                    </button>

                    {row.isExtra && (
                      <button
                        onClick={() => deleteSet(row.id)}
                        className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm ml-2"
                        title="Delete set"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </div>

                  {row.suggestedWeight !== undefined && !row.isBodyweight && !row.completed && (
                    <div className="text-xs text-gray-400 mt-1">
                      Suggested: {row.suggestedWeight} kg
                    </div>
                  )}
                </div>
              ) : (
                // Display Row
                <button
                  onClick={() => !row.completed && openSetForm(row)}
                  className="w-full p-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Status Circle */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                      row.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {row.completed ? (
                        <FontAwesomeIcon icon={faCheck} className="text-sm" />
                      ) : (
                        <span>{row.setNumber}</span>
                      )}
                    </div>

                    {/* Exercise Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{row.exerciseName}</span>
                        {row.isSuperset && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Superset</span>
                        )}
                        {row.isExtra && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Extra</span>
                        )}
                        {row.isBodyweight && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">BW</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">Set {row.setNumber}</div>
                    </div>

                    {/* Completed Values */}
                    {row.completed && (
                      <div className="flex items-center gap-3 text-sm">
                        {!row.isBodyweight && (
                          <span className="font-medium text-gray-900">{row.weight} kg</span>
                        )}
                        <span className="text-gray-600">{row.reps} reps</span>
                        {row.completedAt && (
                          <span className="text-gray-400 flex items-center gap-1" title="Completed at">
                            <FontAwesomeIcon icon={faClock} className="text-xs" />
                            {row.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    {!row.completed ? (
                      <span className="text-sm text-gray-400 italic">Click to fill</span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); uncompleteSet(row.id); }}
                        className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Uncomplete this set"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </button>
              )}
            </div>
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
            <FontAwesomeIcon icon={faPlus} className="text-xs" /> + Set for {info.name}
          </button>
        ))}
      </div>

      {/* Add Exercise Button */}
      {availableExercises.length > 0 && (
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
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-900">Add Exercise</span>
                <button
                  onClick={() => setShowAddExercise(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {availableExercises.map(exercise => (
                  <button
                    key={exercise.id}
                    onClick={() => addNewExercise(exercise.id)}
                    className="text-left p-2 bg-white border border-gray-200 rounded hover:bg-blue-100 hover:border-blue-300 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">{exercise.name}</div>
                    <div className="text-xs text-gray-500">{exercise.category}</div>
                  </button>
                ))}
              </div>
            </div>
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
