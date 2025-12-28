import { useState, useEffect } from 'react';
import { foodApi } from '../lib/api';
import type { FoodItem, FoodCategory } from '../lib/types';

interface FoodItemFormProps {
  food?: FoodItem;
  onSave: (food: FoodItem) => void;
  onCancel: () => void;
}

const calculateCalories = (protein: number, carbs: number, fat: number) => {
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

// Mock AI inference for metabolism attributes
const inferMetabolism = async (name: string, fat: number, carbs: number, protein: number, fiber: number, sugar?: number) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const foodName = name.toLowerCase();
  let glycemicIndex: number | undefined;
  let absorptionSpeed: 'slow' | 'moderate' | 'fast' = 'moderate';
  let insulinResponse: number | undefined;
  let satietyScore: number | undefined;

  // High fat foods -> slower absorption, lower GI
  if (fat > 15 || foodName.includes('oil') || foodName.includes('butter') || foodName.includes('cheese') || foodName.includes('nuts')) {
    absorptionSpeed = 'slow';
    glycemicIndex = undefined;
    insulinResponse = 20 + Math.floor(fat * 2);
    satietyScore = 7;
  }
  // High sugar foods -> fast absorption, high GI
  else if ((sugar && sugar > 10) || foodName.includes('candy') || foodName.includes('soda') || foodName.includes('cola') || foodName.includes('juice')) {
    absorptionSpeed = 'fast';
    glycemicIndex = 65 + Math.floor(Math.random() * 20);
    insulinResponse = 75 + Math.floor(Math.random() * 15);
    satietyScore = 2;
  }
  // High fiber foods -> slower absorption
  else if (fiber > 5 || foodName.includes('beans') || foodName.includes('lentils') || foodName.includes('oats') || foodName.includes('vegetable')) {
    absorptionSpeed = 'slow';
    glycemicIndex = 40 + Math.floor(Math.random() * 20);
    insulinResponse = 40 + Math.floor(Math.random() * 15);
    satietyScore = 7;
  }
  // Protein foods -> moderate absorption
  else if (protein > 15 || foodName.includes('chicken') || foodName.includes('beef') || foodName.includes('fish') || foodName.includes('egg')) {
    absorptionSpeed = 'moderate';
    glycemicIndex = undefined;
    insulinResponse = 30 + Math.floor(Math.random() * 20);
    satietyScore = 8;
  }
  // Carb foods
  else if (carbs > 20) {
    if (foodName.includes('rice') || foodName.includes('bread') || foodName.includes('pasta')) {
      absorptionSpeed = 'moderate';
      glycemicIndex = 50 + Math.floor(Math.random() * 25);
      insulinResponse = 55 + Math.floor(Math.random() * 20);
      satietyScore = 5;
    } else if (foodName.includes('fruit')) {
      absorptionSpeed = 'fast';
      glycemicIndex = 40 + Math.floor(Math.random() * 30);
      insulinResponse = 50 + Math.floor(Math.random() * 20);
      satietyScore = 4;
    } else {
      absorptionSpeed = 'moderate';
      glycemicIndex = 50 + Math.floor(Math.random() * 20);
      insulinResponse = 50 + Math.floor(Math.random() * 20);
      satietyScore = 5;
    }
  }

  return { glycemicIndex, absorptionSpeed, insulinResponse, satietyScore };
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
  const [inferring, setInferring] = useState(false);

  // Auto-calculate calories when macros change
  useEffect(() => {
    if (!caloriesEdited) {
      setCalories(calculateCalories(protein, carbs, fat));
    }
  }, [protein, carbs, fat, caloriesEdited]);

  const handleInfer = async () => {
    if (!name.trim()) {
      alert('Please enter a food name first');
      return;
    }
    setInferring(true);
    try {
      const inferred = await inferMetabolism(name, fat, carbs, protein, fiber, sugar);
      if (inferred.glycemicIndex !== undefined) setGlycemicIndex(inferred.glycemicIndex);
      setAbsorptionSpeed(inferred.absorptionSpeed);
      if (inferred.insulinResponse !== undefined) setInsulinResponse(inferred.insulinResponse);
      if (inferred.satietyScore !== undefined) setSatietyScore(inferred.satietyScore);
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Food Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Chicken Breast, Cola, Brown Rice"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoFocus
        />
      </div>

      {/* Lines 2-3: Nutrition per 100g */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Nutrition per 100g</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* Fats */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Total Fat (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={fat}
              onChange={e => setFat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Saturated Fat (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={saturatedFat}
              onChange={e => setSaturatedFat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Carbs */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Total Carbs (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={carbs}
              onChange={e => setCarbs(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sugars (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={sugar}
              onChange={e => setSugar(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Fiber */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fiber (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={fiber}
              onChange={e => setFiber(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Protein */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Protein (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={protein}
              onChange={e => setProtein(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Line 4: Calories per 100g */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Calories (per 100g)</label>
        <input
          type="text"
          inputMode="decimal"
          value={calories}
          onChange={e => {
            setCalories(parseFloat(e.target.value) || 0);
            setCaloriesEdited(true);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {!caloriesEdited && (
          <p className="text-xs text-gray-500 mt-1">Auto-calculated from macros (4×protein + 4×carbs + 9×fat)</p>
        )}
      </div>

      {/* Line 5: Average Serving Size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serving Size</label>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serving Type</label>
          <input
            type="text"
            value={servingType}
            onChange={e => setServingType(e.target.value)}
            placeholder="e.g., g, scoop, piece, slice"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Metabolism Section */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Metabolism</h4>
          <button
            type="button"
            onClick={handleInfer}
            disabled={inferring}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
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
            <label className="block text-sm text-gray-600 mb-1">Glycemic Index</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-100"
              value={glycemicIndex ?? ''}
              onChange={e => setGlycemicIndex(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Absorption Speed</label>
            <select
              value={absorptionSpeed}
              onChange={e => setAbsorptionSpeed(e.target.value as 'slow' | 'moderate' | 'fast')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="slow">Slow</option>
              <option value="moderate">Moderate</option>
              <option value="fast">Fast</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Insulin Response (0-100)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-100"
              value={insulinResponse ?? ''}
              onChange={e => setInsulinResponse(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Satiety Score (0-10)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0-10"
              value={satietyScore ?? ''}
              onChange={e => setSatietyScore(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
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
          {food ? 'Update' : 'Add'} Food Item
        </button>
      </div>
    </form>
  );
}
