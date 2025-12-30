import { useState, useEffect } from 'react';
import { mealTemplatesApi } from '../lib/api';
import FoodSelector from './FoodSelector';
import type { MealTemplate, MealCategory } from '../lib/types';

interface MealTemplateFormProps {
  template?: MealTemplate;
  onSave: (template: MealTemplate) => void;
  onCancel: () => void;
}

export default function MealTemplateForm({ template, onSave, onCancel }: MealTemplateFormProps) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState<MealCategory>(template?.category || 'snack');
  const [foods, setFoods] = useState(template?.foods || []);

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setFoods(template.foods || []);
    } else {
      setName('');
      setCategory('snack');
      setFoods([]);
    }
  }, [template?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      category,
      foods
    };

    if (template) {
      const updated = await mealTemplatesApi.update(template.id, data);
      onSave(updated);
    } else {
      const created = await mealTemplatesApi.create(data);
      onSave(created);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as MealCategory)}
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Food Items</label>
        <FoodSelector selectedFoods={foods} onChange={setFoods} />
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
          {template ? 'Update' : 'Create'} Template
        </button>
      </div>
    </form>
  );
}
