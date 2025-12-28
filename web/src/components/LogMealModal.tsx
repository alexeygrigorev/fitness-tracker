import { useState, useEffect } from 'react';
import { mealsApi, mealTemplatesApi } from '../lib/api';
import FoodSelector from './FoodSelector';
import type { MealTemplate, Meal, MealCategory, MealFoodItem } from '../lib/types';

interface LogMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealLogged: (meal: Meal) => void;
  templateId?: string;
}

export default function LogMealModal({ isOpen, onClose, onMealLogged, templateId }: LogMealModalProps) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(templateId || null);
  const [customMode, setCustomMode] = useState(false);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealCategory>('snack');
  const [foods, setFoods] = useState<MealFoodItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      mealTemplatesApi.getAll().then(setTemplates);
      if (templateId) {
        const t = templates.find(tm => tm.id === templateId) || templates[0];
        if (t) {
          setSelectedTemplate(t.id);
          setName(t.name);
          setMealType(t.category);
          setFoods([...t.foods]);
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const t = templates.find(tm => tm.id === selectedTemplate);
    if (t && !customMode) {
      setName(t.name);
      setMealType(t.category);
      setFoods([...t.foods]);
    }
  }, [selectedTemplate, customMode]);

  const calculateTotals = async () => {
    return await mealTemplatesApi.calculateNutrition(foods);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || foods.length === 0) return;

    setLoading(true);
    try {
      const meal = await mealsApi.create({
        name: name.trim(),
        mealType,
        foods,
        loggedAt: new Date(),
        notes: notes.trim() || undefined,
        source: 'manual'
      });
      onMealLogged(meal);
      onClose();
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setMealType('snack');
    setFoods([]);
    setNotes('');
    setSelectedTemplate(null);
    setCustomMode(false);
  };

  const NutritionPreview = () => {
    const [totals, setTotals] = useState({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });

    useEffect(() => {
      calculateTotals().then(setTotals);
    }, [foods]);

    return (
      <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-md">
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalCalories)}</div>
          <div className="text-xs text-gray-500">kcal</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{Math.round(totals.totalProtein)}g</div>
          <div className="text-xs text-gray-500">protein</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalCarbs)}g</div>
          <div className="text-xs text-gray-500">carbs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{Math.round(totals.totalFat)}g</div>
          <div className="text-xs text-gray-500">fat</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Log Meal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {!customMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Add from Template</label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={"p-3 text-left border rounded-md transition-colors " + (selectedTemplate === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50')}
                  >
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{t.category.replace('_', ' ')}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setCustomMode(true); setSelectedTemplate(null); setName(''); setFoods([]); }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                + Create custom meal
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
            <select
              value={mealType}
              onChange={e => setMealType(e.target.value as MealCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
              <option value="post_workout">Post-Workout</option>
              <option value="beverage">Beverage</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foods</label>
            <FoodSelector selectedFoods={foods} onChange={setFoods} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <NutritionPreview />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || foods.length === 0}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Log Meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
