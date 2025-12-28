import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faChevronLeft, faChevronRight, faPlus, faPlay } from '@fortawesome/free-solid-svg-icons';
import { exercisesApi, workoutsApi, workoutPresetsApi } from '../lib/api';
import Modal from '../components/Modal';
import WorkoutPresetForm from '../components/WorkoutPresetForm';
import ActiveWorkout from '../components/ActiveWorkout';
import ExerciseForm from '../components/ExerciseForm';
import AddExerciseWithAIModal from '../components/AddExerciseWithAIModal';
import type { Exercise, WorkoutSession, WorkoutPreset } from '../lib/types';

type Tab = 'workouts' | 'presets' | 'library';

// Get day of week number from a day label
const getDayOfWeek = (dayLabel?: string): number | null => {
  if (!dayLabel) return null;
  const days: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  return days[dayLabel.toLowerCase()] ?? null;
};

// Helper to check if dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Format date for display
const formatDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const tabLabels: Record<Tab, string> = {
  workouts: 'Workouts',
  presets: 'Presets',
  library: 'Exercises'
};

export default function Exercises() {
  const [activeTab, setActiveTab] = useState<Tab>('workouts');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [presets, setPresets] = useState<WorkoutPreset[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal state
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<WorkoutPreset>();
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise>();
  const [showExerciseAIModal, setShowExerciseAIModal] = useState(false);

  // Active workout mode
  const [activePreset, setActivePreset] = useState<WorkoutPreset | null>(null);
  const [hasRestoredWorkout, setHasRestoredWorkout] = useState(false);

  // Restore active workout from localStorage on mount
  useEffect(() => {
    if (hasRestoredWorkout) return;

    try {
      const stored = localStorage.getItem('activeWorkout');
      if (stored) {
        const state = JSON.parse(stored);
        const storedDate = new Date(state.startTime);
        const today = new Date();

        // Only restore if from today
        if (storedDate.toDateString() === today.toDateString()) {
          setActivePreset(state.preset);
        } else {
          // Clear old workout
          localStorage.removeItem('activeWorkout');
        }
      }
    } catch (e) {
      console.error('Failed to restore active workout:', e);
    }
    setHasRestoredWorkout(true);
  }, [hasRestoredWorkout]);

  useEffect(() => {
    Promise.all([
      exercisesApi.getAll(),
      workoutsApi.getAll(),
      workoutPresetsApi.getAll()
    ]).then(([exs, wks, prsts]) => {
      setExercises(exs);
      setWorkouts(wks);
      setPresets(prsts);
      setLoading(false);
    });
  }, []);

  // Filter workouts by selected date
  const workoutsForDate = workouts.filter(workout =>
    isSameDay(new Date(workout.startedAt), selectedDate)
  );

  // Calculate totals for selected date
  const totals = workoutsForDate.reduce((acc, workout) => ({
    volume: acc.volume + (workout.totalVolume || 0),
    sets: acc.sets + workout.sets.length
  }), { volume: 0, sets: 0 });

  // Date navigation handlers
  const goToDate = (daysOffset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + daysOffset);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Check if selected date is today (to disable forward button)
  const isToday = isSameDay(selectedDate, new Date());

  // Get current day of week for preset sorting
  const currentDayOfWeek = new Date().getDay();

  // Sort presets: ones matching today's day first, then others
  const sortedPresets = [...presets].sort((a, b) => {
    const aDay = getDayOfWeek(a.dayLabel);
    const bDay = getDayOfWeek(b.dayLabel);

    // Both match today - maintain original order
    if (aDay === currentDayOfWeek && bDay === currentDayOfWeek) return 0;
    // A matches today, B doesn't - A comes first
    if (aDay === currentDayOfWeek) return -1;
    // B matches today, A doesn't - B comes first
    if (bDay === currentDayOfWeek) return 1;
    // Neither matches - sort by day of week
    if (aDay !== null && bDay !== null) return aDay - bDay;
    // One or both have no day label - put them at the end
    return 0;
  });

  const handleDeletePreset = async (id: string) => {
    await workoutPresetsApi.delete(id);
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteWorkout = async (id: string) => {
    await workoutsApi.delete(id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const handleWorkoutComplete = (workout: WorkoutSession) => {
    setWorkouts(prev => [workout, ...prev]);
    setActivePreset(null);
  };

  const startWorkout = (preset: WorkoutPreset) => {
    setActivePreset(preset);
  };

  const cancelWorkout = () => {
    setActivePreset(null);
  };

  const handleEditWorkout = (workout: WorkoutSession) => {
    // For now, just view the workout - editing not implemented in active workout mode
    console.log('Edit workout:', workout);
  };

  const handlePresetSaved = (preset: WorkoutPreset) => {
    setShowPresetForm(false);
    setEditingPreset(undefined);
    setPresets(prev => {
      const existing = prev.find(p => p.id === preset.id);
      return existing
        ? prev.map(p => p.id === preset.id ? preset : p)
        : [...prev, preset];
    });
  };

  const openAddPreset = () => {
    setEditingPreset(undefined);
    setShowPresetForm(true);
  };

  const openEditPreset = (preset: WorkoutPreset) => {
    setEditingPreset(preset);
    setShowPresetForm(true);
  };

  const handleDeleteExercise = async (id: string) => {
    if (confirm('Are you sure you want to delete this exercise?')) {
      await exercisesApi.delete(id);
      setExercises(prev => prev.filter(e => e.id !== id));
      if (selectedExercise?.id === id) {
        setSelectedExercise(null);
      }
    }
  };

  const handleExerciseSaved = (exercise: Exercise) => {
    setShowExerciseForm(false);
    setEditingExercise(undefined);
    setExercises(prev => {
      const existing = prev.find(e => e.id === exercise.id);
      return existing
        ? prev.map(e => e.id === exercise.id ? exercise : e)
        : [...prev, exercise];
    });
    setSelectedExercise(exercise);
  };

  const openAddExercise = () => {
    setEditingExercise(undefined);
    setShowExerciseForm(true);
  };

  const openEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setShowExerciseForm(true);
  };

  const handleExerciseAICreated = (exercise: Exercise) => {
    setExercises(prev => [...prev, exercise]);
    setSelectedExercise(exercise);
    // Open edit form immediately after AI creation for adjustments
    setEditingExercise(exercise);
    setShowExerciseAIModal(false);
    setShowExerciseForm(true);
  };

  const startFreestyleWorkout = () => {
    // Create a freestyle preset (empty, user adds exercises as they go)
    const freestylePreset: WorkoutPreset = {
      id: 'freestyle',
      name: 'Freestyle',
      exercises: [],
      status: 'active'
    };
    setActivePreset(freestylePreset);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Workouts & Programs</h2>
      </div>

      {/* Daily stats - only show on workouts tab */}
      {activeTab === 'workouts' && (
        <>
          {/* Date navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => goToDate(-1)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <div className="text-center">
              <button
                onClick={goToToday}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {formatDate(selectedDate)}
              </button>
              <div className="text-xs text-gray-500">
                {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => goToDate(1)}
              disabled={isToday}
              className={"p-2 rounded-md transition-colors " + (isToday
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Workouts</div>
              <div className="text-2xl font-bold text-gray-900">{workoutsForDate.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Volume</div>
              <div className="text-2xl font-bold text-blue-600">{totals.volume} kg</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Sets</div>
              <div className="text-2xl font-bold text-gray-900">{totals.sets}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Active Presets</div>
              <div className="text-2xl font-bold text-purple-600">{presets.filter(p => p.status === 'active').length}</div>
            </div>
          </div>
        </>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {(['workouts', 'presets', 'library'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                'py-2 px-1 border-b-2 font-medium text-sm ' +
                (activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500')
              }
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* Workouts Tab */}
      {activeTab === 'workouts' && (
        <div className="space-y-6">
          {/* Active Workout Session - shown at top when a workout is in progress */}
          {activePreset && (
            <div className="bg-blue-50 rounded-lg shadow p-6 border-2 border-blue-400">
              <ActiveWorkout
                preset={activePreset}
                onComplete={handleWorkoutComplete}
                onCancel={cancelWorkout}
              />
            </div>
          )}

          {/* Quick Start - Today's Presets */}
          {sortedPresets.filter(p => p.status === 'active').length > 0 && !activePreset && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Start Workout</h3>
              </div>

              {/* Today's Presets */}
              {sortedPresets.filter(p => p.status === 'active' && getDayOfWeek(p.dayLabel) === currentDayOfWeek).length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-green-700 mb-2">Today</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {sortedPresets.filter(p => p.status === 'active' && getDayOfWeek(p.dayLabel) === currentDayOfWeek).map(preset => {
                      const totalSets = preset.exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);

                      return (
                        <button
                          key={preset.id}
                          onClick={() => startWorkout(preset)}
                          className="text-left p-4 rounded-lg border-2 border-green-400 bg-green-50 hover:bg-green-100 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-gray-900">{preset.name}</span>
                                {preset.dayLabel && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                                    {preset.dayLabel}
                                  </span>
                                )}
                                {preset.tags?.map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize shrink-0">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="text-sm text-gray-500">
                                {preset.exercises.length} exercises • {totalSets} sets
                              </div>
                            </div>
                            <FontAwesomeIcon icon={faPlay} className="text-green-600 ml-2 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                    {/* Freestyle - always last in the row */}
                    <button
                      onClick={startFreestyleWorkout}
                      className="text-left p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-gray-900">Freestyle</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">
                              Any exercises
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Add exercises as you go
                          </div>
                        </div>
                        <FontAwesomeIcon icon={faPlay} className="text-gray-500 ml-2 shrink-0" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Other Days - Collapsible */}
              {sortedPresets.filter(p => p.status === 'active' && getDayOfWeek(p.dayLabel) !== currentDayOfWeek).length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 mb-2 list-none flex items-center gap-2">
                    <FontAwesomeIcon icon={faChevronRight} className="transition-transform group-open:rotate-90" />
                    Other days
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    {sortedPresets.filter(p => p.status === 'active' && getDayOfWeek(p.dayLabel) !== currentDayOfWeek).map(preset => {
                      const totalSets = preset.exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);

                      return (
                        <button
                          key={preset.id}
                          onClick={() => startWorkout(preset)}
                          className="text-left p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-gray-900">{preset.name}</span>
                                {preset.dayLabel && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                                    {preset.dayLabel}
                                  </span>
                                )}
                                {preset.tags?.map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize shrink-0">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="text-sm text-gray-500">
                                {preset.exercises.length} exercises • {totalSets} sets
                              </div>
                            </div>
                            <FontAwesomeIcon icon={faPlay} className="text-gray-400 ml-2 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* If no today's presets, show freestyle alone */}
              {sortedPresets.filter(p => p.status === 'active' && getDayOfWeek(p.dayLabel) === currentDayOfWeek).length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={startFreestyleWorkout}
                    className="text-left p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-gray-900">Freestyle</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">
                            Any exercises
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Add exercises as you go
                        </div>
                      </div>
                      <FontAwesomeIcon icon={faPlay} className="text-gray-500 ml-2 shrink-0" />
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Logged Workouts */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Workouts for {formatDate(selectedDate).toLowerCase()}
            </h3>
            {workoutsForDate.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No workouts logged for {formatDate(selectedDate).toLowerCase()}</p>
              </div>
            ) : (
            <div className="space-y-3">
              {workoutsForDate.map(workout => (
                <div key={workout.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{workout.name}</div>
                      <div className="text-sm text-gray-500">
                        {workout.startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {workout.endedAt && ` - ${workout.endedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{workout.sets.length} sets</div>
                    </div>
                    <div className="text-right mr-4">
                      <div className="font-medium text-gray-900">{workout.totalVolume} kg</div>
                      {workout.estimatedRecovery && (
                        <div className="text-sm text-orange-600">~{workout.estimatedRecovery}h recovery</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditWorkout(workout)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        onClick={() => handleDeleteWorkout(workout.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                  {/* Notes removed */}
                  {workout.sets.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700">
                        View sets
                      </summary>
                      <div className="mt-2 space-y-1 text-sm">
                        {workout.sets.map(set => {
                          const exercise = exercises.find(e => e.id === set.exerciseId);
                          return (
                            <div key={set.id} className="text-gray-600">
                              {exercise?.name || 'Unknown'}: {set.setType} - {set.weight || '-'} kg × {set.reps} reps
                              {set.rpe && ` @ RPE ${set.rpe}`}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Presets Tab */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Workout Presets</h3>
              <button
                onClick={openAddPreset}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                + New Preset
              </button>
            </div>
            {sortedPresets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No workout presets yet</p>
                <p className="text-sm mt-1">Create presets like "Upper Body A" or "Push Day" to quickly start workouts</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedPresets.map(preset => {
                  // Calculate total sets for the preset
                  const totalSets = preset.exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
                  const isTodaysPreset = getDayOfWeek(preset.dayLabel) === currentDayOfWeek;

                  return (
                    <div key={preset.id} className={`bg-white rounded-lg shadow p-4 ${preset.status === 'archived' ? 'opacity-60' : ''} ${isTodaysPreset ? 'ring-2 ring-blue-400' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{preset.name}</span>
                            {preset.dayLabel && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${isTodaysPreset ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                {preset.dayLabel}
                              </span>
                            )}
                            {isTodaysPreset && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Today
                              </span>
                            )}
                            {preset.status === 'archived' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                Archived
                              </span>
                            )}
                            {preset.tags?.map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {preset.exercises.map((ex) => {
                              const exercise = exercises.find(e => e.id === ex.exerciseId);
                              return (
                                <span key={ex.exerciseId} className="inline mr-2">
                                  {exercise?.name || 'Unknown'} ({ex.sets || 3} {ex.type === 'dropdown' ? 'drops' : 'sets'})
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-right mr-4">
                          <div className="text-sm font-medium text-gray-900">{totalSets} sets</div>
                          <div className="text-xs text-gray-500">{preset.exercises.length} exercises</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditPreset(preset)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Edit"
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exercises Tab - Exercise viewer */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Exercises</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExerciseAIModal(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faPlay} className="text-xs" />
                  Add with AI
                </button>
                <button
                  onClick={openAddExercise}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  Add Exercise
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {exercises.map(exercise => (
                <div
                  key={exercise.id}
                  onClick={() => setSelectedExercise(exercise)}
                  className={`p-3 rounded-lg border transition-colors flex items-center justify-between ${
                    selectedExercise?.id === exercise.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{exercise.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{exercise.category}</div>
                    <div className="text-xs text-gray-400">{exercise.muscleGroups.join(', ')}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditExercise(exercise); }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Edit"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteExercise(exercise.id); }}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedExercise ? selectedExercise.name : 'Select an exercise'}
              </h3>
              {selectedExercise && (
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditExercise(selectedExercise)}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    onClick={() => handleDeleteExercise(selectedExercise.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              )}
            </div>
            {selectedExercise ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="capitalize">{selectedExercise.category}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Muscle Groups</div>
                  <div className="capitalize">{selectedExercise.muscleGroups.join(', ')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Equipment</div>
                  <div>{selectedExercise.equipment.join(', ') || 'Bodyweight'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Instructions</div>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {selectedExercise.instructions.map((inst, i) => (
                      <li key={i}>{inst}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Click on an exercise to see details</p>
            )}
          </div>
        </div>
      )}

      {/* Preset Form Modal */}
      {showPresetForm && (
        <Modal
          isOpen={showPresetForm}
          onClose={() => setShowPresetForm(false)}
          title={editingPreset ? 'Edit Preset' : 'New Preset'}
        >
          <WorkoutPresetForm
            preset={editingPreset}
            onSave={handlePresetSaved}
            onCancel={() => setShowPresetForm(false)}
          />
        </Modal>
      )}

      {/* Exercise Form Modal */}
      {showExerciseForm && (
        <Modal
          isOpen={showExerciseForm}
          onClose={() => setShowExerciseForm(false)}
          title={editingExercise ? 'Edit Exercise' : 'New Exercise'}
        >
          <ExerciseForm
            exercise={editingExercise}
            onSave={handleExerciseSaved}
            onCancel={() => setShowExerciseForm(false)}
          />
        </Modal>
      )}

      {/* Add Exercise with AI Modal */}
      <AddExerciseWithAIModal
        isOpen={showExerciseAIModal}
        onClose={() => setShowExerciseAIModal(false)}
        onExerciseCreated={handleExerciseAICreated}
      />
    </div>
  );
}
