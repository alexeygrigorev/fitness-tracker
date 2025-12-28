import { useState, useEffect } from 'react';
import { exercisesApi } from '../lib/api';
import type { Exercise, WorkoutPresetExercise, PresetExerciseType } from '../lib/types';

interface ExerciseSelectorProps {
  selectedExercises: WorkoutPresetExercise[];
  onChange: (exercises: WorkoutPresetExercise[]) => void;
}

// Category colors for badges
const CATEGORY_COLORS: Record<string, string> = {
  compound: 'bg-blue-100 text-blue-700',
  isolation: 'bg-green-100 text-green-700',
  cardio: 'bg-orange-100 text-orange-700',
};

// Exercise types
const EXERCISE_TYPES: { value: PresetExerciseType; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Standard sets' },
  { value: 'dropdown', label: 'Dropdown', description: 'Weight drops each set' },
];

export default function ExerciseSelector({ selectedExercises, onChange }: ExerciseSelectorProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    exercisesApi.getAll().then(setExercises);
  }, []);

  // Filter exercises based on search and category
  useEffect(() => {
    let filtered = exercises;

    if (search) {
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.muscleGroups.some(mg => mg.toLowerCase().includes(search.toLowerCase()))
      );
    }

    if (filterCategory !== 'all') {
      if (filterCategory === 'upper') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups.some(mg => ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps', 'lats', 'forearms'].includes(mg))
        );
      } else if (filterCategory === 'lower') {
        filtered = filtered.filter(ex =>
          ex.muscleGroups.some(mg => ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques'].includes(mg))
        );
      } else {
        filtered = filtered.filter(ex => ex.category === filterCategory);
      }
    }

    setFilteredExercises(filtered);
  }, [exercises, search, filterCategory]);

  const addExercise = (exercise: Exercise) => {
    const newExercise: WorkoutPresetExercise = {
      exerciseId: exercise.id,
      type: 'normal',
      sets: 3,
    };
    onChange([...selectedExercises, newExercise]);
  };

  const removeExercise = (index: number) => {
    onChange(selectedExercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof WorkoutPresetExercise, value: any) => {
    const updated = [...selectedExercises];
    if (field === 'sets') {
      updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    onChange(updated);
  };

  const moveExercise = (fromIndex: number, toIndex: number) => {
    const updated = [...selectedExercises];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  const getExercise = (exerciseId: string) => {
    return exercises.find(e => e.id === exerciseId);
  };

  // Get unique categories from exercises
  const categories = ['all', 'compound', 'isolation', 'cardio'];

  return (
    <div className="space-y-4">
      {/* Selected Exercises */}
      {selectedExercises.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Exercises ({selectedExercises.length})
          </label>
          <div className="space-y-2">
            {selectedExercises.map((ex, index) => {
              const exercise = getExercise(ex.exerciseId);
              if (!exercise) return null;

              return (
                <div
                  key={ex.exerciseId}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200"
                >
                  {/* Drag handle / Move buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveExercise(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(index, Math.min(selectedExercises.length - 1, index + 1))}
                      disabled={index === selectedExercises.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Exercise name and info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{exercise.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[exercise.category] || 'bg-gray-100 text-gray-700'}`}>
                        {exercise.category}
                      </span>
                      {/* Exercise type badge */}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ex.type === 'dropdown' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {ex.type === 'dropdown' ? 'Dropdown' : 'Normal'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {exercise.muscleGroups.join(', ')} • {exercise.equipment.join(', ') || 'Bodyweight'}
                    </div>
                  </div>

                  {/* Exercise type selector */}
                  <select
                    value={ex.type}
                    onChange={(e) => updateExercise(index, 'type', e.target.value as PresetExerciseType)}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                    title="Exercise type"
                  >
                    {EXERCISE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>

                  {/* Sets input */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={ex.sets}
                      onChange={(e) => updateExercise(index, 'sets', e.target.value)}
                      min="1"
                      className="w-12 px-2 py-1 text-sm border border-gray-300 rounded-md text-center"
                      title={ex.type === 'dropdown' ? 'Number of dropdowns' : 'Sets'}
                    />
                    <span className="text-gray-400 text-sm">{ex.type === 'dropdown' ? 'drops' : 'sets'}</span>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="text-red-400 hover:text-red-600 p-1"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Exercise Button */}
      {showAddPanel ? (
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Add Exercise</h4>
            <button
              type="button"
              onClick={() => {
                setShowAddPanel(false);
                setSearch('');
                setFilterCategory('all');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises by name or muscle..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filterCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'upper' ? 'Upper Body' : cat === 'lower' ? 'Lower Body' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredExercises.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No exercises found. Try a different search.
              </div>
            ) : (
              filteredExercises.map(exercise => {
                const isSelected = selectedExercises.some(se => se.exerciseId === exercise.id);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => !isSelected && addExercise(exercise)}
                    disabled={isSelected}
                    className={`w-full text-left p-2 rounded-md transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{exercise.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {exercise.muscleGroups.join(', ')} • {exercise.equipment.join(', ') || 'Bodyweight'}
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${CATEGORY_COLORS[exercise.category] || 'bg-gray-100 text-gray-700'}`}>
                      {exercise.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddPanel(true)}
          className="w-full px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exercise
        </button>
      )}

      {/* Empty state */}
      {selectedExercises.length === 0 && !showAddPanel && (
        <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-md">
          <p>No exercises added yet.</p>
          <p className="text-xs mt-1">Click "Add Exercise" to build your preset.</p>
        </div>
      )}
    </div>
  );
}
