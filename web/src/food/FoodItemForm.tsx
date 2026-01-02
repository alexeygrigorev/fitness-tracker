import { useState, useEffect } from 'react';
import { foodApi, foodCalculationsApi } from '../api';
import type { FoodItem, FoodCategory } from '../types';

interface FoodItemFormProps {
  food?: FoodItem;
  onSave: (food: FoodItem) => void;
  onCancel: () => void;
}

// Helper to calculate calories locally for immediate feedback
const calculateCaloriesLocal = (protein: number, carbs: number, fat: number) => {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
};

const detectCategory = (protein: number, carbs: number, fat: number): FoodCategory => {
  const total = protein + carbs + fat;
  if (total === 0) return 'mixed';

  const proteinRatio = protein / total;
  const carbRatio = carbs / total;
  const fatRatio = fat / total;

  if (proteinRatio > 0.4) return 'protein';
  if (carbRatio > 0.4) return 'carb';
  if (fatRatio > 0.4) return 'fat';
  return 'mixed';
};

export default function FoodItemForm({ food, onSave, onCancel }: FoodItemFormProps) {
  const [name, setName] = useState(food?.name || '');
  const [fat, setFat] = useState(food?.fat || 0);
  const [saturatedFat, setSaturatedFat] = useState(food?.saturatedFat || 0);
  const [carbs, setCarbs] = useState(food?.carbs || 0);
  const [sugar, setSugar] = useState(food?.sugar || 0);
  const [fiber, setFiber] = useState(food?.fiber || 0);
  const [protein, setProtein] = useState(food?.protein || 0);
  const [servingSize, setServingSize] = useState(food?.servingSize || 100);
  const [servingSizeDisplay, setServingSizeDisplay] = useState(String(food?.servingSize || 100));
  const [servingType, setServingType] = useState(food?.servingType || 'g');
  const [calories, setCalories] = useState(food?.calories || 0);
  const [caloriesEdited, setCaloriesEdited] = useState(false);

  // Metabolism fields
  const [glycemicIndex, setGlycemicIndex] = useState<number | undefined>(food?.glycemicIndex);
  const [absorptionSpeed, setAbsorptionSpeed] = useState<'slow' | 'moderate' | 'fast'>(food?.absorptionSpeed || 'moderate');
  const [insulinResponse, setInsulinResponse] = useState<number | undefined>(food?.insulinResponse);
  const [satietyScore, setSatietyScore] = useState<number | undefined>(food?.satietyScore);
  const [proteinQuality, setProteinQuality] = useState<1 | 2 | 3 | undefined>(food?.proteinQuality);
  const [inferring, setInferring] = useState(false);

  // Auto-calculate calories when macros change
  useEffect(() => {
    if (!caloriesEdited) {
      setCalories(calculateCaloriesLocal(protein, carbs, fat));
    }
  }, [protein, carbs, fat, caloriesEdited]);

  // Calculate calories per portion (calories per 100g * servingSize / 100)
  const caloriesPerPortion = Math.round(calories * servingSize / 100);

  const handleInfer = async () => {
    if (!name.trim()) {
      alert('Please enter a food name first');
      return;
    }
    setInferring(true);
    try {
      // Use backend API for metabolism inference
      const inferred = await foodCalculationsApi.inferMetabolism(name, fat, carbs, protein, fiber, sugar);
      if (inferred.glycemicIndex !== undefined) setGlycemicIndex(inferred.glycemicIndex);
      setAbsorptionSpeed(inferred.absorptionSpeed);
      if (inferred.insulinResponse !== undefined) setInsulinResponse(inferred.insulinResponse);
      if (inferred.satietyScore !== undefined) setSatietyScore(inferred.satietyScore);
      if (inferred.proteinQuality !== undefined) setProteinQuality(inferred.proteinQuality);
    } catch (error) {
      console.error('Failed to infer metabolism:', error);
      alert('Failed to infer metabolism attributes. Please try again.');
    } finally {
      setInferring(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const baseData = {
      name: name.trim(),
      category: food?.category || detectCategory(protein, carbs, fat),
      servingSize,
      servingType,
      calories,
      caloriesPerPortion,
      protein,
      carbs,
      fat,
      saturatedFat,
      fiber,
      sugar,
      glycemicIndex,
      absorptionSpeed,
      insulinResponse,
      satietyScore,
      proteinQuality,
      source: 'user' as const
    };

    if (food) {
      const data: FoodItem = { ...baseData, id: food.id };
      const updated = await foodApi.update(food.id, data);
      onSave(updated);
    } else {
      const created = await foodApi.create(baseData);
      onSave(created);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Line 1: Food Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Food Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Chicken Breast, Cola, Brown Rice"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          required
          autoFocus
        />
      </div>

      {/* Lines 2-3: Nutrition per 100g */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nutrition per 100g</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* Fats */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Total Fat (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={fat}
              onChange={e => setFat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Saturated Fat (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={saturatedFat}
              onChange={e => setSaturatedFat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          {/* Carbs */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Total Carbs (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={carbs}
              onChange={e => setCarbs(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Sugars (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={sugar}
              onChange={e => setSugar(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          {/* Fiber */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Fiber (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={fiber}
              onChange={e => setFiber(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          {/* Protein */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Protein (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={protein}
              onChange={e => setProtein(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Line 4: Calories per 100g */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Calories (per 100g)</label>
        <input
          type="text"
          inputMode="decimal"
          value={calories}
          onChange={e => {
            setCalories(parseFloat(e.target.value) || 0);
            setCaloriesEdited(true);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />
        {!caloriesEdited && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Auto-calculated from macros (4×protein + 4×carbs + 9×fat)</p>
        )}
      </div>

      {/* Serving Size (always in grams) and Serving Type (description) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Serving Size (g)</label>
          <input
            type="text"
            inputMode="decimal"
            value={servingSizeDisplay}
            onChange={e => {
              const val = e.target.value;
              setServingSizeDisplay(val);
              const parsed = parseFloat(val);
              setServingSize(!isNaN(parsed) ? parsed : 0);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Serving Description</label>
          <input
            type="text"
            value={servingType}
            onChange={e => setServingType(e.target.value)}
            placeholder="e.g. 100g, 1 scoop, 2 slices, 4 pieces"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Metabolism Section */}
      <div className="border-t dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Metabolism</h4>
          <button
            type="button"
            onClick={handleInfer}
            disabled={inferring}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {inferring ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Inferring...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Infer
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Glycemic Index</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-100"
              value={glycemicIndex ?? ''}
              onChange={e => setGlycemicIndex(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Absorption Speed</label>
            <select
              value={absorptionSpeed}
              onChange={e => setAbsorptionSpeed(e.target.value as 'slow' | 'moderate' | 'fast')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="slow">Slow</option>
              <option value="moderate">Moderate</option>
              <option value="fast">Fast</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Insulin Response (0-100)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-100"
              value={insulinResponse ?? ''}
              onChange={e => setInsulinResponse(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Satiety Score (0-10)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-10"
              value={satietyScore ?? ''}
              onChange={e => setSatietyScore(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Protein Quality</label>
            <select
              value={proteinQuality ?? ''}
              onChange={e => setProteinQuality(e.target.value ? parseInt(e.target.value) as 1 | 2 | 3 : undefined)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Not set</option>
              <option value="1">1 - Low (incomplete)</option>
              <option value="2">2 - Moderate</option>
              <option value="3">3 - High (complete)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {food ? 'Update' : 'Add'} Food Item
        </button>
      </div>
    </form>
  );
}
