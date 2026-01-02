import { useState, useEffect, useMemo } from 'react';
import { foodApi } from '../api';
import type { FoodItem, MealFoodItem } from '../types';

interface FoodSelectorProps {
  selectedFoods: MealFoodItem[];
  onChange: (foods: MealFoodItem[]) => void;
}

interface AggregateMetabolism {
  glycemicIndex: number | null;
  absorptionSpeed: 'slow' | 'moderate' | 'fast';
  insulinResponse: number | null;
  satietyScore: number | null;
}

// Calculate aggregate metabolism for a list of foods
const calculateAggregateMetabolism = (foodItems: FoodItem[], selected: MealFoodItem[]): AggregateMetabolism => {
  let totalCarbs = 0;
  let totalGlycemicIndex = 0;
  let giWeight = 0;

  let totalInsulinResponse = 0;
  let totalSatietyScore = 0;
  let responseWeight = 0;
  let satietyWeight = 0;

  // Absorption speed: use the "dominant" speed (prioritize slow over moderate over fast)
  const speedPriority = { slow: 3, moderate: 2, fast: 1 };
  let maxSpeedPriority = 0;
  let dominantSpeed: 'slow' | 'moderate' | 'fast' = 'moderate';

  for (const sf of selected) {
    const food = foodItems.find(f => f.id === sf.foodId);
    if (!food) continue;

    // Handle migration from old 'servings' format to new 'grams' format
    // Ensure we always have a valid number
    let grams = sf.grams;
    if (grams === undefined || grams === null || isNaN(grams)) {
      if ('servings' in sf && typeof (sf as any).servings === 'number') {
        grams = (sf as any).servings * food.servingSize;
      } else {
        grams = food.servingSize;
      }
    }
    const safeGrams = Math.max(0, grams);

    // Calculate values based on grams (per 100g * grams / 100)
    const multiplier = safeGrams / 100;
    const carbs = food.carbs * multiplier;
    const calories = food.calories * multiplier;

    totalCarbs += carbs;

    // For GI: weight by carb content (only foods with meaningful carbs)
    if (food.glycemicIndex !== undefined && carbs > 0) {
      totalGlycemicIndex += food.glycemicIndex * carbs;
      giWeight += carbs;
    }

    // For insulin response: weight by total calories
    if (food.insulinResponse !== undefined) {
      totalInsulinResponse += food.insulinResponse * calories;
      responseWeight += calories;
    }

    // For satiety: weight by calories
    if (food.satietyScore !== undefined) {
      totalSatietyScore += food.satietyScore * calories;
      satietyWeight += calories;
    }

    // Absorption speed: find dominant
    if (food.absorptionSpeed) {
      const priority = speedPriority[food.absorptionSpeed];
      if (priority > maxSpeedPriority) {
        maxSpeedPriority = priority;
        dominantSpeed = food.absorptionSpeed;
      }
    }
  }

  return {
    glycemicIndex: giWeight > 0 ? Math.round(totalGlycemicIndex / giWeight) : null,
    absorptionSpeed: dominantSpeed,
    insulinResponse: responseWeight > 0 ? Math.round(totalInsulinResponse / responseWeight) : null,
    satietyScore: satietyWeight > 0 ? Math.round((totalSatietyScore / satietyWeight) * 10) / 10 : null
  };
};

export default function FoodSelector({ selectedFoods, onChange }: FoodSelectorProps) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    foodApi.getAll().then(data => {
      setFoods(data);
      setLoading(false);
    });
  }, []);

  // Filter foods based on search
  const filteredFoods = useMemo(
    () => search
      ? foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
      : foods,
    [foods, search]
  );

  // Calculate aggregate metabolism whenever selected foods change
  const aggregate = useMemo(
    () => calculateAggregateMetabolism(foods, selectedFoods),
    [foods, selectedFoods]
  );

  const addFood = (foodId: string) => {
    const food = foods.find(f => f.id === foodId);
    if (!food) return;

    const existing = selectedFoods.find(f => f.foodId === foodId);
    if (existing) {
      // Add one serving size worth of grams
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, grams: f.grams + food.servingSize } : f));
    } else {
      // Add with one serving size as initial grams
      setSearch('');
      onChange([...selectedFoods, { foodId, grams: food.servingSize }]);
    }
  };

  const removeFood = (foodId: string) => {
    onChange(selectedFoods.filter(f => f.foodId !== foodId));
  };

  const updatePortions = (foodId: string, portions: number) => {
    const food = foods.find(f => f.id === foodId);
    if (!food) return;

    if (portions <= 0) {
      onChange(selectedFoods.filter(f => f.foodId !== foodId));
    } else {
      // Convert portions to grams for storage
      const grams = portions * food.servingSize;
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, grams } : f));
    }
  };

  return (
    <div className="space-y-4">
      {selectedFoods.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Selected Food Items</h4>
          <div className="space-y-2">
            {selectedFoods.map(sf => {
              const food = foods.find(f => f.id === sf.foodId);
              if (!food) return null;

              // Handle migration from old 'servings' format to new 'grams' format
              // Ensure we always have a valid number
              let grams = sf.grams;
              if (grams === undefined || grams === null || isNaN(grams)) {
                if ('servings' in sf && typeof (sf as any).servings === 'number') {
                  grams = (sf as any).servings * food.servingSize;
                } else {
                  grams = food.servingSize;
                }
              }
              const safeGrams = Math.max(0, grams);
              const portions = safeGrams / food.servingSize;
              const multiplier = safeGrams / 100;
              const calories = Math.round(food.calories * multiplier);
              const protein = Math.round(food.protein * multiplier);
              const carbs = Math.round(food.carbs * multiplier);
              const fat = Math.round(food.fat * multiplier);

              return (
                <div key={sf.foodId} className="bg-white dark:bg-gray-700 p-3 rounded border dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm dark:text-gray-100">{food.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {calories} kcal • {protein}g protein • {carbs}g carbs • {fat}g fat • {Math.round(safeGrams)}g ({portions.toFixed(2)} × {food.servingType})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFood(sf.foodId)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Portions:</span>
                    <button
                      type="button"
                      onClick={() => updatePortions(sf.foodId, portions - 0.25)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={portions.toFixed(2)}
                      onChange={e => updatePortions(sf.foodId, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => updatePortions(sf.foodId, portions + 0.25)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({Math.round(safeGrams)}g / {food.servingSize}g per portion)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedFoods.length > 0 && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-md border border-purple-200 dark:border-purple-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Template Metabolism</h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Glycemic Index:</span>
              <span className="ml-1 font-medium dark:text-gray-100">{aggregate.glycemicIndex ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Absorption:</span>
              <span className="ml-1 font-medium dark:text-gray-100 capitalize">{aggregate.absorptionSpeed}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Insulin:</span>
              <span className="ml-1 font-medium dark:text-gray-100">{aggregate.insulinResponse ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Satiety:</span>
              <span className="ml-1 font-medium dark:text-gray-100">{aggregate.satietyScore ?? '-'}/10</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Add Food</label>
        <input
          type="text"
          placeholder="Search foods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 dark:bg-gray-700 dark:text-gray-100"
        />
        {loading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-1 dark:bg-gray-800/50">
            {filteredFoods.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                {search ? `No foods found matching "${search}"` : 'No foods available'}
              </div>
            ) : (
              filteredFoods.map(food => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => addFood(food.id)}
                  className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm dark:text-gray-100">{food.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        One serving equals {food.servingType} • {food.caloriesPerPortion ?? Math.round(food.calories * food.servingSize / 100)} kcal ({food.calories} kcal per 100g)
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
