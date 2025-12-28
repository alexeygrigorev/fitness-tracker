import { useState, useEffect } from 'react';
import { workoutPresetsApi } from '../lib/api';
import ExerciseSelector from './ExerciseSelector';
import type { WorkoutPreset, WorkoutPresetExercise, WorkoutTag } from '../lib/types';

const WORKOUT_TAGS: { value: WorkoutTag; label: string; color: string }[] = [
  { value: 'strength', label: 'Strength', color: 'bg-red-100 text-red-700' },
  { value: 'cardio', label: 'Cardio', color: 'bg-blue-100 text-blue-700' },
  { value: 'mixed', label: 'Mixed', color: 'bg-purple-100 text-purple-700' },
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
  const [notes, setNotes] = useState(preset?.notes || '');
  const [tags, setTags] = useState<WorkoutTag[]>(preset?.tags || []);
  const [status] = useState<'active' | 'archived'>(preset?.status || 'active');

  const [exerciseList, setExerciseList] = useState<WorkoutPresetExercise[]>(
    preset?.exercises || []
  );

  const toggleTag = (tag: WorkoutTag) => {
    setTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

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
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
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
      <h3 className="text-lg font-semibold text-gray-900">
        {preset ? 'Edit Workout Preset' : 'New Workout Preset'}
      </h3>

      {/* Name and Day Label */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Preset Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Upper Body A, Push Day"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
          <select
            value={dayLabel}
            onChange={e => setDayLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day || 'None'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes for this preset..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_TAGS.map(tag => (
            <button
              key={tag.value}
              type="button"
              onClick={() => toggleTag(tag.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                tags.includes(tag.value)
                  ? tag.color
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises */}
      <ExerciseSelector
        selectedExercises={exerciseList}
        onChange={setExerciseList}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
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
