import { useState } from 'react';
import { foodApi } from '../lib/api';
import type { FoodItem, FoodCategory } from '../lib/types';

interface FoodItemFormProps {
  food?: FoodItem;
  onSave: (food: FoodItem) => void;
  onCancel: () => void;
}

export default function FoodItemForm({ food, onSave, onCancel }: FoodItemFormProps) {
  const [formData, setFormData] = useState<Partial<FoodItem>>(
    food || {
      name: '',
      category: 'mixed' as FoodCategory,
      servingSize: 100,
      servingUnit: 'g',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      glycemicIndex: 50,
      absorptionSpeed: 'moderate',
      insulinResponse: 50,
      satietyScore: 5
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const data = {
      ...formData,
      category: formData.category as FoodCategory
    } as FoodItem;

    if (food) {
      const updated = await foodApi.update(food.id, data);
      onSave(updated);
    } else {
      const created = await foodApi.create(data);
      onSave(created);
    }
  };

  const handleChange = (field: keyof FoodItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => handleChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={e => handleChange('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="protein">Protein</option>
            <option value="carb">Carb</option>
            <option value="fat">Fat</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          <input
            type="text"
            value={formData.brand || ''}
            onChange={e => handleChange('brand', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serving Size</label>
          <input
            type="number"
            value={formData.servingSize}
            onChange={e => handleChange('servingSize', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <input
            type="text"
            value={formData.servingUnit}
            onChange={e => handleChange('servingUnit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
          <input
            type="number"
            value={formData.calories}
            onChange={e => handleChange('calories', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
          <input
            type="number"
            value={formData.protein}
            onChange={e => handleChange('protein', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
          <input
            type="number"
            value={formData.carbs}
            onChange={e => handleChange('carbs', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
          <input
            type="number"
            value={formData.fat}
            onChange={e => handleChange('fat', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fiber (g)</label>
        <input
          type="number"
          value={formData.fiber || 0}
          onChange={e => handleChange('fiber', parseFloat(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Metabolism Attributes (Optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Glycemic Index</label>
            <input
              type="number"
              value={formData.glycemicIndex || ''}
              onChange={e => handleChange('glycemicIndex', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Absorption Speed</label>
            <select
              value={formData.absorptionSpeed || 'moderate'}
              onChange={e => handleChange('absorptionSpeed', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="slow">Slow</option>
              <option value="moderate">Moderate</option>
              <option value="fast">Fast</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Insulin Response (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.insulinResponse || ''}
              onChange={e => handleChange('insulinResponse', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Satiety Score (0-10)</label>
            <input
              type="number"
              min="0"
              max="10"
              value={formData.satietyScore || ''}
              onChange={e => handleChange('satietyScore', parseFloat(e.target.value))}
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
          {food ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
