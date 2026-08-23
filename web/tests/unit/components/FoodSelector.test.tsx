import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FoodSelector from '@/food/FoodSelector';
import type { FoodItem, MealFoodItem } from '@/types';

const food: FoodItem = {
  id: '1',
  name: 'Rice',
  category: 'carb',
  servingSize: 100,
  servingType: 'bowl',
  calories: 130,
  fat: 1,
  carbs: 28,
  protein: 3,
};

describe('FoodSelector', () => {
  it('accepts intermediate decimal input before committing grams on blur', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <FoodSelector
        selectedFoods={[{ foodId: food.id, grams: 100 }]}
        onChange={handleChange}
        foods={[food]}
      />,
    );

    const portions = screen.getByLabelText('Portions for Rice');
    await user.clear(portions);
    await user.type(portions, '1.');

    expect(portions).toHaveValue('1.');
    expect(handleChange).not.toHaveBeenCalled();

    await user.type(portions, '5');
    await user.tab();

    expect(handleChange).toHaveBeenCalledWith([{ foodId: food.id, grams: 150 }]);
  });

  it('adds a serving to legacy portion records without producing NaN grams', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const legacySelection = { foodId: food.id, servings: 2 } as unknown as MealFoodItem;

    render(
      <FoodSelector selectedFoods={[legacySelection]} onChange={handleChange} foods={[food]} />,
    );

    await user.click(screen.getByRole('button', { name: `Add ${food.name}` }));

    expect(handleChange).toHaveBeenCalledWith([{ foodId: food.id, grams: 300 }]);
  });
});
