import { useEffect, useState } from 'react';
import { exercisesApi, workoutsApi } from '../lib/api';
import type { Exercise, WorkoutSession } from '../lib/types';

type Tab = 'library' | 'exercises' | 'workouts';

export default function Exercises() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([exercisesApi.getAll(), workoutsApi.getRecent(7)]).then(([exs, wks]) => {
      setExercises(exs);
      setWorkouts(wks);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Exercises & Workouts</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {(['library', 'exercises', 'workouts'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                'py-2 px-1 border-b-2 font-medium text-sm ' +
                (activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500')
              }
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

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

      {/* Exercises Tab - List view with filtering */}
      {activeTab === 'exercises' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Exercises</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map(exercise => (
              <div
                key={exercise.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{exercise.name}</div>
                <div className="text-sm text-gray-500 capitalize mt-1">{exercise.category}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
                    {exercise.difficulty}
                  </span>
                  {exercise.muscleGroups.slice(0, 2).map(mg => (
                    <span key={mg} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {mg}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {exercise.equipment.join(', ') || 'Bodyweight'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workouts Tab - Workout history */}
      {activeTab === 'workouts' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Workouts</h3>
          {workouts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No workouts logged yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map(workout => (
                <div key={workout.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{workout.name}</div>
                      <div className="text-sm text-gray-500">{new Date(workout.startedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{workout.totalVolume} kg</div>
                      <div className="text-sm text-gray-500">{workout.sets.length} sets</div>
                    </div>
                  </div>
                  {workout.estimatedRecovery && (
                    <div className="mt-2 text-sm text-orange-600">Estimated recovery: {workout.estimatedRecovery} hours</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
