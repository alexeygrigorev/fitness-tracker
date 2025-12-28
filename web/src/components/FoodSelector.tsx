import { useState, useEffect, useMemo } from 'react';
import { foodApi } from '../lib/api';
import type { FoodItem, MealFoodItem } from '../lib/types';

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

    const carbs = food.carbs * sf.servings;
    totalCarbs += carbs;

    // For GI: weight by carb content (only foods with meaningful carbs)
    if (food.glycemicIndex !== undefined && carbs > 0) {
      totalGlycemicIndex += food.glycemicIndex * carbs;
      giWeight += carbs;
    }

    // For insulin response: weight by total calories
    const calories = food.calories * sf.servings;
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
    const existing = selectedFoods.find(f => f.foodId === foodId);
    if (existing) {
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, servings: f.servings + 1 } : f));
    } else {
      onChange([...selectedFoods, { foodId, servings: 1 }]);
    }
  };

  const updatePortions = (foodId: string, portions: number) => {
    if (portions <= 0) {
      onChange(selectedFoods.filter(f => f.foodId !== foodId));
    } else {
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, servings: portions } : f));
    }
  };

  const updateGrams = (foodId: string, grams: number) => {
    const food = foods.find(f => f.id === foodId);
    if (!food) return;

    if (grams <= 0) {
      onChange(selectedFoods.filter(f => f.foodId !== foodId));
    } else {
      // Convert grams to servings (servings is based on servingSize)
      const servings = grams / food.servingSize;
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, servings } : f));
    }
  };

  const removeFood = (foodId: string) => {
    onChange(selectedFoods.filter(f => f.foodId !== foodId));
  };

  return (
    <div className="space-y-4">
      {selectedFoods.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Food Items</h4>
          <div className="space-y-2">
            {selectedFoods.map(sf => {
              const food = foods.find(f => f.id === sf.foodId);
              if (!food) return null;
              const totalGrams = Math.round(food.servingSize * sf.servings);
              const calories = Math.round(food.calories * sf.servings);
              const protein = Math.round(food.protein * sf.servings);

              return (
                <div key={sf.foodId} className="bg-white p-3 rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{food.name}</div>
                      <div className="text-xs text-gray-500">
                        {calories} kcal • {protein}g protein • {totalGrams}g
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFood(sf.foodId)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-gray-600">Portions:</span>
                      <button
                        type="button"
                        onClick={() => updatePortions(sf.foodId, sf.servings - 0.25)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-sm"
                      >
                        -
                      </button>
                      <span className="w-12 text-center text-sm">{sf.servings.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => updatePortions(sf.foodId, sf.servings + 0.25)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-gray-400">|</div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-gray-600">Grams:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={totalGrams}
                        onChange={e => updateGrams(sf.foodId, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedFoods.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Template Metabolism</h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Glycemic Index:</span>
              <span className="ml-1 font-medium">{aggregate.glycemicIndex ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Absorption:</span>
              <span className="ml-1 font-medium capitalize">{aggregate.absorptionSpeed}</span>
            </div>
            <div>
              <span className="text-gray-500">Insulin:</span>
              <span className="ml-1 font-medium">{aggregate.insulinResponse ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Satiety:</span>
              <span className="ml-1 font-medium">{aggregate.satietyScore ?? '-'}/10</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add Food</label>
        <input
          type="text"
          placeholder="Search foods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
            {filteredFoods.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                {search ? `No foods found matching "${search}"` : 'No foods available'}
              </div>
            ) : (
              filteredFoods.map(food => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => {
                    addFood(food.id);
                    setSearch('');
                  }}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{food.name}</div>
                      <div className="text-xs text-gray-500">
                        {food.calories} kcal • {food.protein}g protein • {food.carbs}g carbs • {food.fat}g fat
                      </div>
                      <div className="text-xs text-gray-400">
                        per {food.servingSize}{food.servingType}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
