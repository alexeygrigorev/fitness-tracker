import { useState } from 'react';
import { workoutPresetsApi } from '../api';
import ExerciseSelector from './ExerciseSelector';
import type { WorkoutPreset, WorkoutPresetExercise, WorkoutTag } from '../types';

const WORKOUT_TYPES: { value: WorkoutTag; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mixed', label: 'Mixed' },
];

const DAYS_OF_WEEK = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

interface WorkoutPresetFormProps {
  preset?: WorkoutPreset;
  onSave: (preset: WorkoutPreset) => void;
  onCancel: () => void;
}

export default function WorkoutPresetForm({ preset, onSave, onCancel }: WorkoutPresetFormProps) {
  const [name, setName] = useState(preset?.name || '');
  const [dayLabel, setDayLabel] = useState(preset?.dayLabel || '');
  const [workoutType, setWorkoutType] = useState<WorkoutTag | ''>(preset?.tags?.[0] || '');
  const [status] = useState<'active' | 'archived'>(preset?.status || 'active');

  const [exerciseList, setExerciseList] = useState<WorkoutPresetExercise[]>(
    preset?.exercises || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (exerciseList.length === 0) {
      alert('Please add at least one exercise');
      return;
    }

    const baseData = {
      name: name.trim(),
      dayLabel: dayLabel.trim() || undefined,
      tags: workoutType ? [workoutType] : undefined,
      status,
      exercises: exerciseList
    };

    if (preset) {
      const updated = await workoutPresetsApi.update(preset.id, baseData);
      onSave(updated);
    } else {
      const created = await workoutPresetsApi.create(baseData);
      onSave(created);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {preset ? 'Edit Workout Preset' : 'New Workout Preset'}
      </h3>

      {/* Name and Day Label */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preset Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Upper Body A, Push Day"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Week</label>
          <select
            value={dayLabel}
            onChange={e => setDayLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100"
          >
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day || 'None'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
        <select
          value={workoutType}
          onChange={e => setWorkoutType(e.target.value as WorkoutTag | '')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">None</option>
          {WORKOUT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Exercises */}
      <ExerciseSelector
        selectedExercises={exerciseList}
        onChange={setExerciseList}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {preset ? 'Save Changes' : 'Create Preset'}
        </button>
      </div>
    </form>
  );
}
