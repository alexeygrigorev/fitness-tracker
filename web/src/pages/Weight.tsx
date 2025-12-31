import { useState } from 'react';
import { faWeightScale, faPlus, faTrash, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface WeightEntry {
  id: string;
  weight: number;
  date: Date;
  notes?: string;
}

export default function Weight() {
  const [entries, setEntries] = useState<WeightEntry[]>([
    { id: '1', weight: 82, date: new Date('2024-12-01'), notes: 'Starting weight' },
    { id: '2', weight: 81, date: new Date('2024-12-08'), notes: '' },
    { id: '3', weight: 80.5, date: new Date('2024-12-15'), notes: '' },
    { id: '4', weight: 79.5, date: new Date('2024-12-22'), notes: '' },
    { id: '5', weight: 79.5, date: new Date(), notes: 'Today' },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const handleAddEntry = () => {
    if (!newWeight) return;

    const entry: WeightEntry = {
      id: Date.now().toString(),
      weight: Number(newWeight),
      date: new Date(),
      notes: newNotes,
    };

    setEntries([entry, ...entries].sort((a, b) => b.date.getTime() - a.date.getTime()));
    setNewWeight('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const latestWeight = entries[0]?.weight || 0;
  const firstWeight = entries[entries.length - 1]?.weight || latestWeight;
  const weightChange = latestWeight - firstWeight;
  const avgWeight = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.weight, 0) / entries.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Weight Tracking</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Log Weight
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{latestWeight} kg</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Change</div>
          <div className={`text-2xl font-bold ${weightChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {weightChange >= 0 ? '+' : ''}{weightChange.toFixed(1)} kg
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Average</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgWeight.toFixed(1)} kg</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Entries</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{entries.length}</div>
        </div>
      </div>

      {/* Add Weight Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Log New Weight</h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                placeholder="80"
                step="0.1"
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 w-32"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Any notes..."
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 w-full"
              />
            </div>
            <button
              onClick={handleAddEntry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Weight Chart Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <FontAwesomeIcon icon={faChartLine} className="mr-2 text-blue-600 dark:text-blue-400" />
          Weight Trend
        </h3>
        <div className="h-48 flex items-end justify-between gap-2">
          {entries.slice().reverse().map((entry) => {
            const maxWeight = Math.max(...entries.map(e => e.weight));
            const minWeight = Math.min(...entries.map(e => e.weight));
            const range = maxWeight - minWeight || 1;
            const height = ((entry.weight - minWeight) / range) * 100 + 20;

            return (
              <div key={entry.id} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full">
                  <div
                    className="bg-blue-500 dark:bg-blue-600 rounded-t transition-all group-hover:bg-blue-600 dark:group-hover:bg-blue-500"
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {entry.weight} kg
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weight History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <FontAwesomeIcon icon={faWeightScale} className="mr-2 text-blue-600 dark:text-blue-400" />
          History
        </h3>
        {entries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No weight entries yet. Log your first weight!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Weight</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Notes</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const prevWeight = entries[index + 1]?.weight;
                  const change = prevWeight ? entry.weight - prevWeight : 0;

                  return (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {entry.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{entry.weight} kg</span>
                        {change !== 0 && (
                          <span className={`ml-2 text-sm ${change > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{entry.notes || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
