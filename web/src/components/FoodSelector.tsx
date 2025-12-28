import { useState, useEffect } from 'react';
import { foodApi } from '../lib/api';
import type { FoodItem, MealFoodItem } from '../lib/types';

interface FoodSelectorProps {
  selectedFoods: MealFoodItem[];
  onChange: (foods: MealFoodItem[]) => void;
}

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

  const filteredFoods = search
    ? foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : foods;

  const addFood = (foodId: string) => {
    const existing = selectedFoods.find(f => f.foodId === foodId);
    if (existing) {
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, servings: f.servings + 1 } : f));
    } else {
      onChange([...selectedFoods, { foodId, servings: 1 }]);
    }
  };

  const updateServings = (foodId: string, servings: number) => {
    if (servings <= 0) {
      onChange(selectedFoods.filter(f => f.foodId \!== foodId));
    } else {
      onChange(selectedFoods.map(f => f.foodId === foodId ? { ...f, servings } : f));
    }
  };

  const removeFood = (foodId: string) => {
    onChange(selectedFoods.filter(f => f.foodId \!== foodId));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'protein': return 'bg-red-100 text-red-700';
      case 'carb': return 'bg-yellow-100 text-yellow-700';
      case 'fat': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Search foods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {selectedFoods.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Foods</h4>
          <div className="space-y-2">
            {selectedFoods.map(sf => {
              const food = foods.find(f => f.id === sf.foodId);
              if (\!food) return null;
              return (
                <div key={sf.foodId} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{food.name}</div>
                    <div className="text-xs text-gray-500">
                      {Math.round(food.calories * sf.servings)} kcal • {Math.round(food.protein * sf.servings)}g protein
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateServings(sf.foodId, sf.servings - 0.5)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300"
                    >
                      -
                    </button>
                    <span className="w-16 text-center text-sm">{sf.servings}x</span>
                    <button
                      onClick={() => updateServings(sf.foodId, sf.servings + 0.5)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFood(sf.foodId)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
