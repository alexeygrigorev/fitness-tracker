import { useEffect, useState } from 'react';
import { foodApi, mealsApi } from '../lib/api';
import type { FoodItem, Meal } from '../lib/types';

export default function Nutrition() {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([foodApi.getAll(), mealsApi.getAll()]).then(([foods, mls]) => {
      setFoodItems(foods);
      setMeals(mls);
      setLoading(false);
    });
  }, []);

  const filteredFoods = foodItems.filter(food =>
    food.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.totalCalories,
    protein: acc.protein + meal.totalProtein,
    carbs: acc.carbs + meal.totalCarbs,
    fat: acc.fat + meal.totalFat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Nutrition Tracking</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Calories</div>
          <div className="text-xl font-bold text-gray-900">{totals.calories}</div>
          <div className="text-xs text-gray-400">/ 2500 goal</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Protein</div>
          <div className="text-xl font-bold text-blue-600">{totals.protein}g</div>
          <div className="text-xs text-gray-400">/ 130g goal</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Carbs</div>
          <div className="text-xl font-bold text-gray-900">{totals.carbs}g</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Fat</div>
          <div className="text-xl font-bold text-gray-900">{totals.fat}g</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Food Database</h3>
          <input
            type="text"
            placeholder="Search foods..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredFoods.map(food => (
              <div key={food.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="font-medium text-gray-900">{food.name}</div>
                <div className="text-sm text-gray-500">{food.calories} kcal per {food.servingSize}{food.servingUnit}</div>
                <div className="text-xs text-gray-400">P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Meals</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {meals.map(meal => (
              <div key={meal.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{meal.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{meal.mealType}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{meal.totalCalories} kcal</div>
                    <div className="text-gray-500">{meal.totalProtein}g protein</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
