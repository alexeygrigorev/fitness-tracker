import { useState, useEffect } from 'react';
import { workoutsApi, workoutPresetsApi, exercisesApi } from '../lib/api';
import type { WorkoutPreset, WorkoutSession, WorkoutSet, Exercise } from '../lib/types';

interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutLogged: (workout: WorkoutSession) => void;
  editingWorkout?: WorkoutSession;
}

interface WorkingSet {
  id: string;
  exerciseId: string;
  setType: 'normal' | 'warmup' | 'drop' | 'failure';
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
  completed: boolean;
}

export default function LogWorkoutModal({ isOpen, onClose, onWorkoutLogged, editingWorkout }: LogWorkoutModalProps) {
  const [presets, setPresets] = useState<WorkoutPreset[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sets, setSets] = useState<WorkingSet[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState<Date>(new Date());

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        workoutPresetsApi.getAll(),
        exercisesApi.getAll()
      ]).then(([presetsData, exercisesData]) => {
        setPresets(presetsData);
        setExercises(exercisesData);

        if (editingWorkout) {
          setName(editingWorkout.name);
          setNotes(editingWorkout.notes || '');
          setSets(editingWorkout.sets.map(s => ({
            id: s.id,
            exerciseId: s.exerciseId,
            setType: s.setType,
            weight: s.weight || 0,
            reps: s.reps,
            rpe: s.rpe,
            notes: s.notes,
            completed: true
          })));
          setSelectedPreset(null);
          setStartTime(editingWorkout.startedAt);
        } else {
          resetFormInternal();
        }
      });
    }
  }, [isOpen, editingWorkout]);

  const resetFormInternal = () => {
    setName('');
    setSets([]);
    setNotes('');
    setSelectedPreset(null);
    setStartTime(new Date());
  };

  const resetForm = () => {
    resetFormInternal();
    onClose();
  };

  const loadPreset = (preset: WorkoutPreset) => {
    setName(preset.name);
    setNotes(preset.notes || '');

    // Convert preset exercises to working sets
    const newSets: WorkingSet[] = [];
    preset.exercises.forEach((ex, exIdx) => {
      for (let i = 0; i < ex.sets; i++) {
        newSets.push({
          id: `set-${Date.now()}-${exIdx}-${i}`,
          exerciseId: ex.exerciseId,
          setType: 'normal',
          weight: ex.weight || 0,
          reps: ex.reps,
          rpe: undefined,
          notes: ex.notes,
          completed: false
        });
      }
    });
    setSets(newSets);
  };

  // When a preset is selected, load its data
  useEffect(() => {
    if (selectedPreset) {
      const preset = presets.find(p => p.id === selectedPreset);
      if (preset) {
        loadPreset(preset);
      }
    }
  }, [selectedPreset, presets]);

  const handleClearPreset = () => {
    setSelectedPreset(null);
  };

  const toggleSetCompleted = (setId: string) => {
    setSets(prev => prev.map(s =>
      s.id === setId ? { ...s, completed: !s.completed } : s
    ));
  };

  const updateSet = (setId: string, field: keyof WorkingSet, value: any) => {
    setSets(prev => prev.map(s =>
      s.id === setId ? { ...s, [field]: value } : s
    ));
  };

  const removeSet = (setId: string) => {
    setSets(prev => prev.filter(s => s.id !== setId));
  };

  const addSet = (exerciseId: string) => {
    const lastSet = sets.filter(s => s.exerciseId === exerciseId).pop();
    const newSet: WorkingSet = {
      id: `set-${Date.now()}`,
      exerciseId,
      setType: lastSet?.setType || 'normal',
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 10,
      completed: false
    };
    setSets(prev => [...prev, newSet]);
  };

  const getExerciseName = (exerciseId: string) => {
    const ex = exercises.find(e => e.id === exerciseId);
    return ex?.name || 'Unknown Exercise';
  };

  const calculateTotalVolume = () => {
    return sets.reduce((sum, set) => {
      if (set.completed) {
        return sum + (set.weight * set.reps);
      }
      return sum;
    }, 0);
  };

  // Group sets by exercise
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) {
      acc[set.exerciseId] = [];
    }
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<string, WorkingSet[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || sets.length === 0) return;

    setLoading(true);
    try {
      const workoutSets: WorkoutSet[] = sets.map(s => ({
        id: s.id,
        exerciseId: s.exerciseId,
        setType: s.setType,
        weight: s.weight || undefined,
        reps: s.reps,
        rpe: s.rpe,
        notes: s.notes,
        loggedAt: startTime
      }));

      const totalVolume = calculateTotalVolume();

      let workout: WorkoutSession;

      if (editingWorkout) {
        workout = await workoutsApi.update(editingWorkout.id, {
          name: name.trim(),
          startedAt: startTime,
          endedAt: new Date(),
          sets: workoutSets,
          notes: notes.trim() || undefined,
        });
        workout.totalVolume = totalVolume;
      } else {
        workout = await workoutsApi.create({
          name: name.trim(),
          startedAt: startTime,
          endedAt: new Date(),
          sets: workoutSets,
          notes: notes.trim() || undefined,
        });
        workout.totalVolume = totalVolume;
      }

      onWorkoutLogged(workout);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{editingWorkout ? 'Edit Workout' : 'Log Workout'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Quick Preset Selection */}
          {!editingWorkout && (
            <div>
              {presets.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Quick start from preset</label>
                    {selectedPreset && (
                      <button
                        type="button"
                        onClick={handleClearPreset}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presets.filter(p => p.status === 'active').map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPreset(p.id)}
                        className={"px-3 py-2 text-sm rounded-md border transition-colors " + (selectedPreset === p.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700')}
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.exercises.length} exercises</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="text-xs text-gray-500 text-center">Or fill in the form below</p>
              </div>
            </div>
          )}

          {/* Selected preset indicator */}
          {selectedPreset && !editingWorkout && (
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md">
              <span className="text-sm text-blue-700">
                Using preset: <strong>{presets.find(p => p.id === selectedPreset)?.name}</strong>
              </span>
              <button
                type="button"
                onClick={handleClearPreset}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Change
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workout Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Upper Body A"
              required
            />
          </div>

          {/* Sets by exercise */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Sets</label>
              <button
                type="button"
                onClick={() => {
                  if (exercises.length > 0) {
                    addSet(exercises[0].id);
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Set
              </button>
            </div>

            {Object.keys(groupedSets).length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-md">
                <p>No sets yet. Select a preset above or add sets manually.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => (
                  <div key={exerciseId} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{getExerciseName(exerciseId)}</h4>
                      <button
                        type="button"
                        onClick={() => addSet(exerciseId)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Set
                      </button>
                    </div>
                    <div className="space-y-2">
                      {exerciseSets.map(set => (
                        <div key={set.id} className="flex gap-2 items-center">
                          <input
                            type="checkbox"
                            checked={set.completed}
                            onChange={() => toggleSetCompleted(set.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <select
                            value={set.setType}
                            onChange={e => updateSet(set.id, 'setType', e.target.value as WorkingSet['setType'])}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="normal">Normal</option>
                            <option value="warmup">Warmup</option>
                            <option value="drop">Drop</option>
                            <option value="failure">Failure</option>
                          </select>
                          <input
                            type="number"
                            value={set.weight}
                            onChange={e => updateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                            placeholder="kg"
                            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
                          />
                          <span className="text-gray-400 text-sm">×</span>
                          <input
                            type="number"
                            value={set.reps}
                            onChange={e => updateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                            placeholder="reps"
                            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
                          />
                          <input
                            type="number"
                            value={set.rpe ?? ''}
                            onChange={e => updateSet(set.id, 'rpe', parseFloat(e.target.value) || undefined)}
                            placeholder="RPE"
                            min="1"
                            max="10"
                            className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
                          />
                          <button
                            type="button"
                            onClick={() => removeSet(set.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="How did the workout feel?"
            />
          </div>

          {/* Volume Preview */}
          {sets.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{calculateTotalVolume()}</div>
                  <div className="text-xs text-gray-500">Total Volume (kg)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{sets.filter(s => s.completed).length} / {sets.length}</div>
                  <div className="text-xs text-gray-500">Sets Completed</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || sets.length === 0}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : (editingWorkout ? 'Update Workout' : 'Log Workout')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
