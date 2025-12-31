import { useEffect, useState } from 'react';
import { dailySummaryApi } from '../api';
import type { DailySummary } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dailySummaryApi.getSummary(new Date()).then(data => {
      setSummary(data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Today's Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Calories</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalCalories}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">kcal</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Protein</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.totalProtein}g</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">goal: 130g</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Workout Volume</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalVolume}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">kg</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Sleep Quality</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.sleep?.quality || '-'}/5</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">last night</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Workouts</h3>
          {summary.workouts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No workouts logged today</p>
          ) : (
            <div className="space-y-3">
              {summary.workouts.map(workout => (
                <div key={workout.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{workout.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{workout.sets.length} sets • {workout.totalVolume} kg volume</div>
                  {workout.estimatedRecovery && (
                    <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">~{workout.estimatedRecovery}h recovery needed</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Today's Meals</h3>
          {summary.meals.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No meals logged today</p>
          ) : (
            <div className="space-y-3">
              {summary.meals.map(meal => (
                <div key={meal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{meal.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{meal.totalCalories} kcal • {meal.totalProtein}g protein</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Metabolism Status</h3>
        {!summary.metabolism ? (
          <p className="text-gray-500 dark:text-gray-400">No metabolism data available</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Energy Availability</div>
              <div className="font-medium capitalize text-gray-900 dark:text-gray-100">{summary.metabolism.energyAvailability.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Glycogen Status</div>
              <div className="font-medium capitalize text-gray-900 dark:text-gray-100">{summary.metabolism.glycogenStatus}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Insulin Activity</div>
              <div className="font-medium capitalize text-gray-900 dark:text-gray-100">{summary.metabolism.insulinActivity}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Recovery Status</div>
              <div className="font-medium capitalize text-gray-900 dark:text-gray-100">{summary.metabolism.recoveryStatus}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
