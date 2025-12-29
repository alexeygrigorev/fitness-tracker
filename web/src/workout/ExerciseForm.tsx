import { useState } from 'react';
import { exercisesApi } from '../api';
import type { Exercise, MuscleGroup } from '../types';

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves', 'traps', 'lats'
];

const CATEGORIES: Array<Exercise['category']> = ['compound', 'isolation', 'cardio'];

interface ExerciseFormProps {
  exercise?: Exercise;
  onSave: (exercise: Exercise) => void;
  onCancel: () => void;
}

export default function ExerciseForm({ exercise, onSave, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState(exercise?.name || '');
  const [category, setCategory] = useState<Exercise['category']>(exercise?.category || 'compound');
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>(exercise?.muscleGroups || []);
  const [equipment, setEquipment] = useState<string[]>(exercise?.equipment || []);
  const [equipmentInput, setEquipmentInput] = useState('');
  const [instructions, setInstructions] = useState<string[]>(exercise?.instructions || []);
  const [instructionInput, setInstructionInput] = useState('');
  const [bodyweight, setBodyweight] = useState(exercise?.bodyweight || false);

  // AI auto-fill state
  const [aiDescription, setAiDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const toggleMuscleGroup = (mg: MuscleGroup) => {
    setMuscleGroups(prev =>
      prev.includes(mg)
        ? prev.filter(g => g !== mg)
        : [...prev, mg]
    );
  };

  const addEquipment = () => {
    if (equipmentInput.trim()) {
      setEquipment([...equipment, equipmentInput.trim()]);
      setEquipmentInput('');
    }
  };

  const removeEquipment = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const addInstruction = () => {
    if (instructionInput.trim()) {
      setInstructions([...instructions, instructionInput.trim()]);
      setInstructionInput('');
    }
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const moveInstruction = (fromIndex: number, toIndex: number) => {
    const updated = [...instructions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setInstructions(updated);
  };

  const handleAIAutoFill = async () => {
    if (!aiDescription.trim()) {
      alert('Please enter an exercise name or description');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await exercisesApi.analyzeWithAI({ description: aiDescription });
      // Fill form with AI results
      if (result.name) setName(result.name);
      if (result.category) setCategory(result.category);
      if (result.muscleGroups) setMuscleGroups(result.muscleGroups);
      if (result.equipment) setEquipment(result.equipment);
      if (result.instructions) setInstructions(result.instructions);
      setAiDescription('');
    } catch (error) {
      alert('Failed to analyze exercise. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const baseData = {
      name: name.trim(),
      category,
      muscleGroups,
      equipment,
      instructions,
      bodyweight
    };

    if (exercise) {
      const updated = await exercisesApi.update(exercise.id, baseData);
      onSave(updated);
    } else {
      const created = await exercisesApi.create(baseData);
      onSave(created);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {exercise ? 'Edit Exercise' : 'New Exercise'}
      </h3>

      {/* AI Auto-fill */}
      {!exercise && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-fill with AI
            <span className="text-gray-400 font-normal"> (optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              placeholder="e.g., Barbell Bench Press, Goblet Squat..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              disabled={analyzing}
            />
            <button
              type="button"
              onClick={handleAIAutoFill}
              disabled={analyzing || !aiDescription.trim()}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {analyzing ? 'Analyzing...' : 'Auto-fill'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Enter an exercise name and AI will fill in the details below</p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Barbell Bench Press"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoFocus
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as Exercise['category'])}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Muscle Groups */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Muscle Groups</label>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map(mg => (
            <button
              key={mg}
              type="button"
              onClick={() => toggleMuscleGroup(mg)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                muscleGroups.includes(mg)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mg.charAt(0).toUpperCase() + mg.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={equipmentInput}
            onChange={e => setEquipmentInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addEquipment())}
            placeholder="e.g., barbell, dumbbells"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addEquipment}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {equipment.map((eq, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
              {eq}
              <button
                type="button"
                onClick={() => removeEquipment(i)}
                className="text-gray-500 hover:text-red-600"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">Leave empty for bodyweight exercises</p>
      </div>

      {/* Bodyweight Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="bodyweight"
          checked={bodyweight}
          onChange={e => setBodyweight(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="bodyweight" className="text-sm font-medium text-gray-700">
          Bodyweight exercise (e.g., pull-ups, dips, push-ups)
        </label>
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={instructionInput}
            onChange={e => setInstructionInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addInstruction())}
            placeholder="e.g., Lie flat on bench"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addInstruction}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Add
          </button>
        </div>
        <ol className="space-y-1">
          {instructions.map((inst, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{i + 1}.</span>
              <span className="flex-1">{inst}</span>
              <button
                type="button"
                onClick={() => moveInstruction(i, Math.max(0, i - 1))}
                disabled={i === 0}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveInstruction(i, Math.min(instructions.length - 1, i + 1))}
                disabled={i === instructions.length - 1}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeInstruction(i)}
                className="text-gray-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {exercise ? 'Save Changes' : 'Create Exercise'}
        </button>
      </div>
    </form>
  );
}
