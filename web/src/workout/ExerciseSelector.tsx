import { useState, useEffect } from 'react';
import { exercisesApi } from '../api';
import type { Exercise, WorkoutPresetExercise, PresetExerciseType, PresetExerciseItem } from '../types';

interface ExerciseSelectorProps {
  selectedExercises: WorkoutPresetExercise[];
  onChange: (exercises: WorkoutPresetExercise[]) => void;
}

// Category colors for badges
const CATEGORY_COLORS: Record<string, string> = {
  compound: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  isolation: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  cardio: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
};

// Exercise types for single exercises (includes superset option)
const SINGLE_EXERCISE_TYPES: { value: PresetExerciseType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'superset', label: 'Superset' },
];

// Exercise types within superset (no superset option)
const SUPERSET_EXERCISE_TYPES: { value: PresetExerciseType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'dropdown', label: 'Dropdown' },
];

// Check if exercise is bodyweight
const isBodyweight = (exercise: Exercise) => {
  return exercise.bodyweight === true;
};

// Reusable Exercise Picker Component
export interface ExercisePickerProps {
  exercises: Exercise[];
  filteredExercises: Exercise[];
  search: string;
  onSearchChange: (value: string) => void;
  filterCategory: string;
  onFilterChange: (value: string) => void;
  onExerciseClick: (exercise: Exercise) => void;
  onClose: () => void;
  excludedIds?: string[]; // Exercise IDs to exclude/disable
  title?: string;
}

export function ExercisePicker({
  filteredExercises,
  search,
  onSearchChange,
  filterCategory,
  onFilterChange,
  onExerciseClick,
  onClose,
  excludedIds = [],
  title = 'Add Exercise'
}: ExercisePickerProps) {
  const categories = ['all', 'compound', 'isolation', 'cardio'];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
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
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search exercises by name or muscle..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => onFilterChange(cat)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filterCategory === cat
                ? 'bg-blue-600 dark:bg-blue-700 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? 'All' : cat === 'upper' ? 'Upper Body' : cat === 'lower' ? 'Lower Body' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filteredExercises.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No exercises found. Try a different search.
          </div>
        ) : (
          filteredExercises.map(exercise => {
            const isExcluded = excludedIds.includes(exercise.id);
            return (
              <button
                key={exercise.id}
                type="button"
                onClick={() => !isExcluded && onExerciseClick(exercise)}
                disabled={isExcluded}
                className={`w-full text-left p-2 rounded-md transition-colors flex items-center justify-between ${
                  isExcluded
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {exercise.name}
                    {exercise.bodyweight && (
                      <span className="text-xs px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">BW</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {exercise.muscleGroups?.join(', ') || ''} • {exercise.equipment || 'None'}
                  </div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${CATEGORY_COLORS[exercise.category || 'compound'] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                  {exercise.category || 'Compound'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ExerciseSelector({ selectedExercises, onChange }: ExerciseSelectorProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [supersetAddIndex, setSupersetAddIndex] = useState<number | null>(null); // Which superset has add panel open
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [editingSuperset, setEditingSuperset] = useState<{ supersetIndex: number; itemIndex: number } | null>(null);

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
      id: `ex-${Date.now()}`,
      type: 'normal',
      exerciseId: exercise.id,
      sets: 3,
      warmup: false,
    };
    onChange([...selectedExercises, newExercise]);
  };

  const removeExercise = (index: number) => {
    onChange(selectedExercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof WorkoutPresetExercise, value: any) => {
    const updated = [...selectedExercises];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // For superset nested exercises
  const updateSupersetExercise = (
    supersetIndex: number,
    itemIndex: number,
    field: keyof PresetExerciseItem,
    value: any
  ) => {
    const updated = [...selectedExercises];
    const superset = updated[supersetIndex];
    if (superset.exercises) {
      const items = [...superset.exercises];
      if (field === 'sets' || field === 'dropdowns') {
        items[itemIndex] = { ...items[itemIndex], [field]: Number(value) || 0 };
      } else if (field === 'warmup') {
        items[itemIndex] = { ...items[itemIndex], warmup: value };
      } else {
        items[itemIndex] = { ...items[itemIndex], [field]: value };
        // Initialize dropdowns with default value when changing to dropdown type
        if (field === 'type' && value === 'dropdown' && !items[itemIndex].dropdowns) {
          items[itemIndex] = { ...items[itemIndex], dropdowns: 2 };
        }
      }
      updated[supersetIndex] = { ...superset, exercises: items };
      onChange(updated);
    }
  };

  const removeSupersetExercise = (supersetIndex: number, itemIndex: number) => {
    const updated = [...selectedExercises];
    const superset = updated[supersetIndex];
    if (superset.exercises && superset.exercises.length > 1) {
      updated[supersetIndex] = {
        ...superset,
        exercises: superset.exercises.filter((_, i) => i !== itemIndex)
      };
      onChange(updated);
    }
  };

  const addSupersetExercise = (supersetIndex: number) => {
    setSupersetAddIndex(supersetIndex);
  };

  const addExerciseToSuperset = (exercise: Exercise) => {
    if (supersetAddIndex === null) return;
    const updated = [...selectedExercises];
    const superset = updated[supersetAddIndex];
    if (superset.exercises) {
      updated[supersetAddIndex] = {
        ...superset,
        exercises: [
          ...superset.exercises,
          { exerciseId: exercise.id, type: 'normal', sets: 3, warmup: false }
        ]
      };
      onChange(updated);
    }
    setSupersetAddIndex(null);
    setSearch('');
    setFilterCategory('all');
  };

  const updateSupersetExerciseItem = (
    supersetIndex: number,
    itemIndex: number,
    newExerciseId: string
  ) => {
    const updated = [...selectedExercises];
    const superset = updated[supersetIndex];
    if (superset.exercises) {
      const items = [...superset.exercises];
      items[itemIndex] = { ...items[itemIndex], exerciseId: newExerciseId };
      updated[supersetIndex] = { ...superset, exercises: items };
      onChange(updated);
    }
  };

  const convertToSuperset = (index: number) => {
    const exercise = selectedExercises[index];
    if (exercise.exerciseId) {
      const updated = [...selectedExercises];
      updated[index] = {
        id: exercise.id,
        type: 'superset' as const,
        exercises: [
          { exerciseId: exercise.exerciseId, type: (exercise.type || 'normal') as 'normal' | 'dropdown', sets: exercise.sets || 3, dropdowns: exercise.dropdowns }
        ]
      };
      onChange(updated);
    }
  };

  const breakUpSuperset = (index: number) => {
    const superset = selectedExercises[index];
    if (superset.exercises) {
      const updated = [...selectedExercises];
      // Remove superset and add individual exercises
      updated.splice(index, 1);
      const individualExercises: WorkoutPresetExercise[] = superset.exercises.map((ex, i) => ({
        id: `${superset.id}-${i}`,
        type: ex.type,
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        dropdowns: ex.dropdowns,
        warmup: ex.warmup
      }));
      onChange([...updated.slice(0, index), ...individualExercises, ...updated.slice(index)]);
    }
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

  const getTypeColor = (type: PresetExerciseType) => {
    switch (type) {
      case 'normal': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'dropdown': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
      case 'superset': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected Exercises */}
      {selectedExercises.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Exercises ({selectedExercises.length})
          </label>
          <div className="space-y-2">
            {selectedExercises.map((ex, index) => {
              if (ex.type === 'superset' && ex.exercises) {
                // Superset rendering
                return (
                  <div
                    key={ex.id}
                    className="border-2 border-purple-200 dark:border-purple-800 rounded-md p-3 bg-purple-50 dark:bg-purple-900/20"
                  >
                    <div className="flex items-center gap-2 mb-2">
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

                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 font-medium">
                        Superset
                      </span>

                      <button
                        type="button"
                        onClick={() => breakUpSuperset(index)}
                        className="text-xs text-purple-600 hover:text-purple-800"
                        title="Break up into individual exercises"
                      >
                        Break up
                      </button>

                      <button
                        type="button"
                        onClick={() => addSupersetExercise(index)}
                        className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
                        title="Add exercise to superset"
                      >
                        + Add exercise
                      </button>

                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Remove superset"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Nested exercises in superset */}
                    <div className="space-y-2 pl-4">
                      {ex.exercises.map((item, itemIndex) => {
                        const exercise = getExercise(item.exerciseId);
                        if (!exercise) return null;

                        const bodyweight = exercise.bodyweight || isBodyweight(exercise);
                        const availableTypes = SUPERSET_EXERCISE_TYPES.filter(t =>
                          bodyweight ? t.value !== 'dropdown' : true
                        );

                        const isEditing = editingSuperset?.supersetIndex === index && editingSuperset?.itemIndex === itemIndex;

                        return (
                          <div key={item.exerciseId} className={`flex items-center gap-2 p-2 rounded border ${isEditing ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <span className="text-xs font-mono text-purple-600 dark:text-purple-400">
                              {String.fromCharCode(65 + itemIndex)}{/* A, B, C... */}
                            </span>

                            {isEditing ? (
                              <>
                                <select
                                  value={item.exerciseId}
                                  onChange={(e) => updateSupersetExerciseItem(index, itemIndex, e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded"
                                  autoFocus
                                >
                                  {exercises.filter(exc => {
                                    // Filter out exercises already in superset (except current one)
                                    const currentIds = ex.exercises?.map(e => e.exerciseId) || [];
                                    return exc.id === item.exerciseId || !currentIds.includes(exc.id);
                                  }).map(exc => (
                                    <option key={exc.id} value={exc.id}>{exc.name}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setEditingSuperset(null)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Done
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSuperset(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{exercise.name}</span>
                                <span className={`text-xs px-1 py-0.5 rounded ${CATEGORY_COLORS[exercise.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                  {exercise.category}
                                </span>
                                <span className={`text-xs px-1 py-0.5 rounded ${bodyweight ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                                  {bodyweight ? 'BW' : 'Wt'}
                                </span>
                              </>
                            )}

                            {!isEditing && (
                              <>
                                {/* Exercise type within superset */}
                                <select
                                  value={item.type}
                                  onChange={(e) => updateSupersetExercise(index, itemIndex, 'type', e.target.value)}
                                  className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded"
                                >
                                  {availableTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                  ))}
                                </select>

                                <input
                                  type="number"
                                  value={item.sets}
                                  onChange={(e) => updateSupersetExercise(index, itemIndex, 'sets', e.target.value)}
                                  min="1"
                                  className="w-10 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center"
                                />
                                <span className="text-gray-400 dark:text-gray-500 text-xs">sets</span>

                                {item.type === 'dropdown' && (
                                  <>
                                    <input
                                      type="number"
                                      value={item.dropdowns || 1}
                                      onChange={(e) => updateSupersetExercise(index, itemIndex, 'dropdowns', e.target.value)}
                                      min="1"
                                      className="w-10 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center"
                                    />
                                    <span className="text-gray-400 dark:text-gray-500 text-xs">drops/set</span>
                                  </>
                                )}

                                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer ml-2">
                                  <input
                                    type="checkbox"
                                    checked={item.warmup !== false}
                                    onChange={(e) => updateSupersetExercise(index, itemIndex, 'warmup', e.target.checked)}
                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                  />
                                  include warmup
                                </label>

                                <button
                                  type="button"
                                  onClick={() => setEditingSuperset({ supersetIndex: index, itemIndex })}
                                  className="text-blue-400 hover:text-blue-600 p-0.5"
                                  title="Change exercise"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeSupersetExercise(index, itemIndex)}
                                  className="text-red-400 hover:text-red-600 p-0.5"
                                  title="Remove exercise"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Exercise Picker within superset */}
                      {supersetAddIndex === index && (
                        <ExercisePicker
                          exercises={exercises}
                          filteredExercises={filteredExercises}
                          search={search}
                          onSearchChange={setSearch}
                          filterCategory={filterCategory}
                          onFilterChange={setFilterCategory}
                          onExerciseClick={addExerciseToSuperset}
                          onClose={() => {
                            setSupersetAddIndex(null);
                            setSearch('');
                            setFilterCategory('all');
                          }}
                          excludedIds={ex.exercises.map(e => e.exerciseId)}
                          title="Add Exercise to Superset"
                        />
                      )}
                    </div>
                  </div>
                );
              }

              // Single exercise rendering
              const exercise = ex.exerciseId ? getExercise(ex.exerciseId) : null;
              if (!exercise) return null;

              const bodyweight = exercise.bodyweight || isBodyweight(exercise);
              const availableTypes = SINGLE_EXERCISE_TYPES.filter(t =>
                bodyweight ? t.value !== 'dropdown' : true // No dropdown for bodyweight
              );

              const handleTypeChange = (newType: PresetExerciseType) => {
                if (newType === 'superset') {
                  convertToSuperset(index);
                } else {
                  updateExercise(index, 'type', newType);
                  // Initialize dropdowns with default value when changing to dropdown type
                  if (newType === 'dropdown' && !ex.dropdowns) {
                    updateExercise(index, 'dropdowns', 2);
                  }
                }
              };

              return (
                <div
                  key={ex.id}
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
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
                      <span className="font-medium text-gray-900 dark:text-gray-100">{exercise.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[exercise.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        {exercise.category}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(ex.type)}`}>
                        {ex.type === 'normal' ? 'Normal' : ex.type === 'dropdown' ? 'Drop' : ex.type}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${bodyweight ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        {bodyweight ? 'BW' : 'Weight'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {exercise.muscleGroups?.join(', ') || ''} • {bodyweight ? 'Bodyweight' : (exercise.equipment || 'Weight')}
                    </div>
                  </div>

                  {/* Exercise type selector */}
                  <select
                    value={ex.type}
                    onChange={(e) => handleTypeChange(e.target.value as PresetExerciseType)}
                    className="w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md"
                    title="Exercise type"
                  >
                    {availableTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>

                  {/* Sets input */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={ex.sets || 3}
                      onChange={(e) => updateExercise(index, 'sets', e.target.value)}
                      min="1"
                      className="w-12 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-center"
                      title="Sets"
                    />
                    <span className="text-gray-400 dark:text-gray-500 text-sm">sets</span>
                  </div>

                  {/* Dropdowns input (only for dropdown type) */}
                  {ex.type === 'dropdown' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={ex.dropdowns || 1}
                        onChange={(e) => updateExercise(index, 'dropdowns', e.target.value)}
                        min="1"
                        className="w-12 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-center"
                        title="Drops per set"
                      />
                      <span className="text-gray-400 dark:text-gray-500 text-sm">drops/set</span>
                    </div>
                  )}

                  {/* Warmup checkbox */}
                  <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ex.warmup !== false}
                      onChange={(e) => updateExercise(index, 'warmup', e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    include warmup
                  </label>

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
        <ExercisePicker
          exercises={exercises}
          filteredExercises={filteredExercises}
          search={search}
          onSearchChange={setSearch}
          filterCategory={filterCategory}
          onFilterChange={setFilterCategory}
          onExerciseClick={addExercise}
          onClose={() => {
            setShowAddPanel(false);
            setSearch('');
            setFilterCategory('all');
          }}
          excludedIds={selectedExercises.map(se => se.exerciseId).filter(Boolean) as string[]}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddPanel(true)}
          className="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exercise
        </button>
      )}

      {/* Empty state */}
      {selectedExercises.length === 0 && !showAddPanel && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-md">
          <p>No exercises added yet.</p>
          <p className="text-xs mt-1">Click "Add Exercise" to build your preset.</p>
        </div>
      )}
    </div>
  );
}
