import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { exercisesApi, workoutsApi, workoutPresetsApi } from '../lib/api';
import Modal from '../components/Modal';
import WorkoutPresetForm from '../components/WorkoutPresetForm';
import LogWorkoutModal from '../components/LogWorkoutModal';
import type { Exercise, WorkoutSession, WorkoutPreset } from '../lib/types';

type Tab = 'workouts' | 'presets' | 'library';

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
  library: 'Library'
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
  const [showLogWorkout, setShowLogWorkout] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession>();

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

  const handleDeletePreset = async (id: string) => {
    await workoutPresetsApi.delete(id);
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteWorkout = async (id: string) => {
    await workoutsApi.delete(id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const handleWorkoutLogged = (workout: WorkoutSession) => {
    if (editingWorkout) {
      setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
      setEditingWorkout(undefined);
    } else {
      setWorkouts(prev => [workout, ...prev]);
    }
    setShowLogWorkout(false);
  };

  const handleEditWorkout = (workout: WorkoutSession) => {
    setEditingWorkout(workout);
    setShowLogWorkout(true);
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

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Workouts & Programs</h2>
        <button
          onClick={() => setShowLogWorkout(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Log Workout
        </button>
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
                  {workout.notes && (
                    <div className="mt-2 text-sm text-gray-600 italic">{workout.notes}</div>
                  )}
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
            {presets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No workout presets yet</p>
                <p className="text-sm mt-1">Create presets like "Upper Body A" or "Push Day" to quickly start workouts</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presets.map(preset => {
                  // Calculate total sets for the preset
                  const totalSets = preset.exercises.reduce((sum, ex) => sum + ex.sets, 0);

                  return (
                    <div key={preset.id} className={`bg-white rounded-lg shadow p-4 ${preset.status === 'archived' ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{preset.name}</span>
                            {preset.dayLabel && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                {preset.dayLabel}
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
                                  {exercise?.name || 'Unknown'} ({ex.sets} {ex.type === 'dropdown' ? 'drops' : 'sets'})
                                </span>
                              );
                            })}
                          </div>
                          {preset.notes && (
                            <div className="text-sm text-gray-500 mt-1">{preset.notes}</div>
                          )}
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

      {/* Library Tab - Exercise viewer */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercise Library</h3>
            <div className="space-y-2">
              {exercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => setSelectedExercise(exercise)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{exercise.name}</div>
                  <div className="text-sm text-gray-500 capitalize">{exercise.category} • {exercise.difficulty}</div>
                  <div className="text-xs text-gray-400">{exercise.muscleGroups.join(', ')}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedExercise ? selectedExercise.name : 'Select an exercise'}
            </h3>
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

      {/* Log Workout Modal */}
      {showLogWorkout && (
        <LogWorkoutModal
          isOpen={showLogWorkout}
          onClose={() => {
            setShowLogWorkout(false);
            setEditingWorkout(undefined);
          }}
          onWorkoutLogged={handleWorkoutLogged}
          editingWorkout={editingWorkout}
        />
      )}
    </div>
  );
}
