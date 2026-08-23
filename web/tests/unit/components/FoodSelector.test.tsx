import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FoodSelector from '@/food/FoodSelector';
import type { FoodItem } from '@/types';

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

  it('falls back to one serving when grams are invalid', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const invalidSelection = { foodId: food.id, grams: Number.NaN };

    render(
      <FoodSelector selectedFoods={[invalidSelection]} onChange={handleChange} foods={[food]} />,
    );

    await user.click(screen.getByRole('button', { name: `Add ${food.name}` }));

    expect(handleChange).toHaveBeenCalledWith([{ foodId: food.id, grams: 200 }]);
  });
});
