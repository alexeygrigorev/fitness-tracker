import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '@/App';
import Modal from '@/components/Modal';
import SetRow from '@/components/SetRow';
import ExerciseForm from '@/workout/ExerciseForm';
import { ExercisePicker } from '@/workout/ExerciseSelector';
import ExercisesPage from '@/workout/ExercisesPage';
import WorkoutPresetForm from '@/workout/WorkoutPresetForm';
import { NormalSetItem } from '@/workout/setItems';
import AddExerciseWithAIModal from '@/workout/AddExerciseWithAIModal';
import NutritionPage from '@/food/NutritionPage';
import FoodItemForm from '@/food/FoodItemForm';
import FoodSelector from '@/food/FoodSelector';
import AddFoodWithAIModal from '@/food/AddFoodWithAIModal';
import RegisterPage from '@/auth/RegisterPage';
import Profile from '@/pages/Profile';
import Weight from '@/pages/Weight';
import type {
  Exercise,
  FoodItem,
  Meal,
  MealTemplate,
  WorkoutPreset,
  WorkoutPresetExercise,
  WorkoutSession,
} from '@/types';

const authMocks = vi.hoisted(() => ({
  register: vi.fn(),
  logout: vi.fn(),
  toggleDarkMode: vi.fn(),
  updateProfile: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  exercisesGetAll: vi.fn(),
  exercisesAnalyzeWithAI: vi.fn(),
  workoutsGetAll: vi.fn(),
  workoutsGetActive: vi.fn(),
  presetsGetAll: vi.fn(),
  presetsGetTemplates: vi.fn(),
  foodGetAll: vi.fn(),
  mealsGetByDate: vi.fn(),
  mealTemplatesGetAll: vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'alex@example.com',
      username: 'Alex',
      display_name: 'Alex Example',
      is_active: true,
    },
    token: 'test-token',
    login: vi.fn(),
    register: authMocks.register,
    logout: authMocks.logout,
    loading: false,
    darkMode: false,
    toggleDarkMode: authMocks.toggleDarkMode,
    updateProfile: authMocks.updateProfile,
  }),
}));

vi.mock('@/api', () => ({
  authApi: {
    getToken: vi.fn(() => null),
    getStoredUser: vi.fn(() => null),
  },
  exercisesApi: {
    getAll: apiMocks.exercisesGetAll,
    analyzeWithAI: apiMocks.exercisesAnalyzeWithAI,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  workoutsApi: {
    getAll: apiMocks.workoutsGetAll,
    getActive: apiMocks.workoutsGetActive,
    getById: vi.fn(),
    delete: vi.fn(),
    completeSet: vi.fn(),
    uncompleteSet: vi.fn(),
    deleteSet: vi.fn(),
    addSet: vi.fn(),
    finish: vi.fn(),
  },
  workoutPresetsApi: {
    getAll: apiMocks.presetsGetAll,
    getTemplates: apiMocks.presetsGetTemplates,
    startWorkout: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  foodApi: {
    getAll: apiMocks.foodGetAll,
    analyzeWithAI: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  foodCalculationsApi: {
    inferMetabolism: vi.fn(),
  },
  mealsApi: {
    getByDate: apiMocks.mealsGetByDate,
    delete: vi.fn(),
  },
  mealTemplatesApi: {
    getAll: apiMocks.mealTemplatesGetAll,
    delete: vi.fn(),
  },
  sleepApi: {
    getAll: vi.fn(),
  },
  dashboardApi: {
    getDailySummary: vi.fn(),
  },
}));

const exercise: Exercise = {
  id: 101,
  name: 'Bench Press',
  category: 'compound',
  muscleGroups: ['chest'],
  equipment: 'Barbell',
  instructions: ['Lower the bar with control.'],
  bodyweight: false,
};

const food: FoodItem = {
  id: 'food-1',
  name: 'Rice',
  category: 'carb',
  servingSize: 100,
  servingType: 'bowl',
  calories: 130,
  fat: 1,
  carbs: 28,
  protein: 3,
};

const meal: Meal = {
  id: 'meal-1',
  name: 'Recovery Meal',
  mealType: 'lunch',
  date: new Date().toISOString(),
  foods: [{ foodId: food.id, grams: 150 }],
  loggedAt: new Date(),
  totalCalories: 195,
  totalProtein: 5,
  totalCarbs: 42,
  totalFat: 2,
};

const mealTemplate: MealTemplate = {
  id: 'template-1',
  name: 'Rice Bowl',
  category: 'lunch',
  foods: [{ foodId: food.id, grams: 100 }],
};

const normalPresetExercise: WorkoutPresetExercise = {
  id: 201,
  exerciseId: exercise.id,
  type: 'normal',
  sets: 3,
  includeWarmup: true,
  order: 0,
};

const supersetPreset: WorkoutPreset = {
  id: 301,
  name: 'Upper Superset',
  status: 'active',
  dayLabel: 'Monday',
  tags: ['strength'],
  exercises: [{
    id: 302,
    exerciseId: 0,
    type: 'superset',
    sets: 3,
    includeWarmup: false,
    order: 0,
    supersetExercises: [{
      id: 303,
      exerciseId: exercise.id,
      type: 'normal',
      dropdowns: 0,
      includeWarmup: true,
      order: 0,
    }],
  }],
};

const workout: WorkoutSession = {
  id: 401,
  name: 'Monday Push',
  startedAt: new Date().toISOString(),
  endedAt: null,
  sets: [],
  totalVolume: 120,
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = '';

  apiMocks.exercisesGetAll.mockResolvedValue([exercise]);
  apiMocks.workoutsGetAll.mockResolvedValue([workout]);
  apiMocks.workoutsGetActive.mockResolvedValue([]);
  apiMocks.presetsGetAll.mockResolvedValue([]);
  apiMocks.presetsGetTemplates.mockResolvedValue([]);
  apiMocks.foodGetAll.mockResolvedValue([food]);
  apiMocks.mealsGetByDate.mockResolvedValue([meal]);
  apiMocks.mealTemplatesGetAll.mockResolvedValue([mealTemplate]);
});

describe('accessibility core suite v3', () => {
  describe('app shell and modal primitives', () => {
    it('exposes skip navigation, a focusable main landmark, and current-route navigation', async () => {
      render(
        <MemoryRouter initialEntries={['/workouts']}>
          <App />
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Workouts & Programs' })).toBeInTheDocument();

      const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
      expect(skipLink).toHaveAttribute('href', '#main-content');

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('tabindex', '-1');
      main.focus();
      expect(main).toHaveFocus();

      const primaryCurrent = within(screen.getByRole('navigation', { name: 'Primary' }))
        .getByRole('link', { name: /Workouts/ });
      const mobileCurrent = within(screen.getByRole('navigation', { name: 'Mobile' }))
        .getByRole('link', { name: 'Workouts' });
      expect(primaryCurrent).toHaveAttribute('aria-current', 'page');
      expect(mobileCurrent).toHaveAttribute('aria-current', 'page');
    });

    it('cycles focus, closes on Escape, restores focus, and locks scrolling', () => {
      const onClose = vi.fn();
      const clientRects = vi.spyOn(HTMLElement.prototype, 'getClientRects')
        .mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);

      try {
        const view = render(
          <>
            <button type="button">Open trigger</button>
            <Modal isOpen={false} onClose={onClose} title="Accessible dialog">
              <div>
                <button type="button">First action</button>
                <button type="button">Last action</button>
              </div>
            </Modal>
          </>,
        );

        const trigger = screen.getByText('Open trigger');
        trigger.focus();
        view.rerender(
          <>
            <button type="button">Open trigger</button>
            <Modal isOpen onClose={onClose} title="Accessible dialog">
              <div>
                <button type="button">First action</button>
                <button type="button">Last action</button>
              </div>
            </Modal>
          </>,
        );

        const dialog = screen.getByRole('dialog', { name: 'Accessible dialog' });
        const close = screen.getByRole('button', { name: 'Close' });
        expect(dialog).toHaveFocus();
        expect(document.body).toHaveStyle({ overflow: 'hidden' });

        fireEvent.keyDown(dialog, { key: 'Tab' });
        expect(close).toHaveFocus();

        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        view.rerender(
          <>
            <button type="button">Open trigger</button>
            <Modal isOpen={false} onClose={onClose} title="Accessible dialog">
              <div>
                <button type="button">First action</button>
                <button type="button">Last action</button>
              </div>
            </Modal>
          </>,
        );

        expect(trigger).toHaveFocus();
        expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
      } finally {
        clientRects.mockRestore();
      }
    });
  });

  describe('workout rows and forms', () => {
    it('activates SetRow from the keyboard and gives its repeated controls unique names', async () => {
      const user = userEvent.setup();
      const item = new NormalSetItem({
        id: 'set-1',
        exerciseId: exercise.id,
        exerciseName: 'Squat',
        setNumber: 1,
        weight: 100,
        reps: 8,
        completed: true,
        completedAt: new Date(),
      });
      const onOpenSetForm = vi.fn();

      render(
        <SetRow
          item={item}
          isEditing={false}
          setForm={{ weight: 100, reps: 8 }}
          onOpenSetForm={onOpenSetForm}
          onSubmitSet={vi.fn()}
          onCloseSetForm={vi.fn()}
          onUncompleteSet={vi.fn()}
          onDeleteSet={vi.fn()}
          onSetFormChange={vi.fn()}
        />,
      );

      const editRow = screen.getByRole('button', { name: 'Edit Squat set 1' });
      expect(screen.getByRole('button', { name: 'Uncomplete Squat set 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Squat set 1' })).toBeInTheDocument();

      await user.tab();
      expect(editRow).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onOpenSetForm).toHaveBeenCalledWith(item);
    });

    it('labels SetRow inputs uniquely while editing', () => {
      const item = new NormalSetItem({
        id: 'set-2',
        exerciseId: exercise.id,
        exerciseName: 'Squat',
        setNumber: 2,
        weight: 90,
        reps: 10,
        completed: false,
      });

      render(
        <SetRow
          item={item}
          isEditing
          setForm={{ weight: 90, reps: 10 }}
          onOpenSetForm={vi.fn()}
          onSubmitSet={vi.fn()}
          onCloseSetForm={vi.fn()}
          onUncompleteSet={vi.fn()}
          onDeleteSet={vi.fn()}
          onSetFormChange={vi.fn()}
        />,
      );

      expect(screen.getByLabelText('Squat set 2 weight')).toHaveValue(90);
      expect(screen.getByLabelText('Squat set 2 reps')).toHaveValue(10);
    });

    it('labels weight entry and profile edit fields', async () => {
      const user = userEvent.setup();
      render(<Weight />);
      await user.click(screen.getByRole('button', { name: /Log Weight/ }));
      expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();

      render(<Profile />);
      expect(screen.getByText('Alex Example')).toBeInTheDocument();
      expect(screen.getByText('alex@example.com')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Edit' }));
      ['Weight', 'Height', 'Age', 'Primary Goal', 'Weekly Workouts Target'].forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });
    });

    it('keeps food and exercise creation fields programmatically labeled', () => {
      render(<FoodItemForm onSave={vi.fn()} onCancel={vi.fn()} />);
      [
        'Food Name *',
        'Total Fat (g)',
        'Total Carbs (g)',
        'Protein (g)',
        'Calories (per 100g)',
        'Serving Size (g)',
        'Serving Description',
      ].forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });

      render(<ExerciseForm onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByLabelText(/Auto-fill with AI/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Exercise Name/)).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Equipment')).toBeInTheDocument();
      expect(screen.getByLabelText('Instructions')).toBeInTheDocument();

      const chest = screen.getByRole('button', { name: 'Chest' });
      expect(chest).toHaveAttribute('aria-pressed', 'false');
    });

    it('names every repeated control in a selected exercise', async () => {
      render(
        <WorkoutPresetForm
          preset={{
            id: 202,
            name: 'Push Day',
            status: 'active',
            exercises: [normalPresetExercise],
          }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(await screen.findByText(exercise.name)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Exercises (1)' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Exercises (1)' })).toBeInTheDocument();
      [
        `Move ${exercise.name} up`,
        `Move ${exercise.name} down`,
        `Exercise type for ${exercise.name}`,
        `Sets for ${exercise.name}`,
        `Include warmup for ${exercise.name}`,
        `Remove ${exercise.name}`,
      ].forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });
    });

    it('names superset-level and nested superset controls distinctly', async () => {
      render(
        <WorkoutPresetForm
          preset={supersetPreset}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(await screen.findByText(exercise.name)).toBeInTheDocument();
      [
        'Move Superset 1 up',
        'Move Superset 1 down',
        'Break up Superset 1 into individual exercises',
        'Add an exercise to Superset 1',
        'Remove Superset 1',
        'Exercise type for item A in Superset 1',
        'Include warmup for item A in Superset 1',
        `Change exercise ${exercise.name} in Superset 1`,
        `Remove exercise ${exercise.name} from Superset 1`,
      ].forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });
    });
  });

  describe('pickers and selectors', () => {
    it('communicates picker search, selection state, options, and dismissal', () => {
      render(
        <ExercisePicker
          exercises={[exercise]}
          filteredExercises={[exercise]}
          search=""
          onSearchChange={vi.fn()}
          filterCategory="all"
          onFilterChange={vi.fn()}
          onExerciseClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByLabelText('Search exercises')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Compound' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: /^Bench Press/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close Add Exercise' })).toBeInTheDocument();
    });

    it('gives food selection controls contextual names', () => {
      render(
        <FoodSelector
          foods={[food]}
          selectedFoods={[{ foodId: food.id, grams: 100 }]}
          onChange={vi.fn()}
        />,
      );

      [
        'Remove Rice',
        'Decrease portions for Rice',
        'Portions for Rice',
        'Increase portions for Rice',
        `Add ${food.name}`,
      ].forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Add Food')).toBeInTheDocument();
    });
  });

  describe('page-level semantics', () => {
    it('uses named dates, real tab state, and contextual workout actions', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/workouts']}>
          <ExercisesPage />
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Workouts & Programs' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to previous day' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Go to today' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to next day' })).toBeDisabled();

      expect(screen.getByRole('tab', { name: 'Workouts' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Workouts' })).toHaveAttribute(
        'aria-labelledby',
        'workouts-tab',
      );
      expect(screen.getByRole('button', { name: `Resume workout ${workout.name}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Delete workout ${workout.name}` })).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Exercises' }));
      const panel = await screen.findByRole('tabpanel', { name: 'Exercises' });
      expect(within(panel).getAllByRole('button', { name: 'Add exercise' }).length).toBeGreaterThan(0);
      expect(within(panel).getAllByRole('button', { name: 'Add exercise with AI' }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Show details for Bench Press' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'View details for Bench Press' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Edit exercise Bench Press' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Delete exercise Bench Press' }).length).toBeGreaterThan(0);
    });

    it('uses named dates, real tab state, and contextual nutrition actions', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/nutrition']}>
          <NutritionPage />
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Nutrition Tracking' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to previous day' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Go to today' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to next day' })).toBeDisabled();
      expect(screen.getByRole('tab', { name: 'Meals' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Meals' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Edit meal ${meal.name}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Delete meal ${meal.name}` })).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Items' }));
      const panel = await screen.findByRole('tabpanel', { name: 'Items' });
      expect(within(panel).getByRole('button', { name: `Edit food item ${food.name}` })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: `Delete food item ${food.name}` })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Add with AI' })).toBeInTheDocument();
    });
  });

  describe('AI inputs and validation messages', () => {
    it('associates food photo and description fields and names photo removal', async () => {
      const user = userEvent.setup();
      render(<AddFoodWithAIModal isOpen onClose={vi.fn()} onFoodCreated={vi.fn()} />);

      const photos = screen.getByLabelText('Photos');
      expect(photos).toHaveAttribute('id', 'food-ai-photos');
      expect(screen.getByLabelText(/^Description/)).toBeInTheDocument();

      await user.upload(photos, new File(['photo'], 'oats.png', { type: 'image/png' }));
      expect(await screen.findByRole('button', { name: 'Remove food photo 1' })).toBeInTheDocument();
    });

    it('associates exercise photo and description fields and names photo removal', async () => {
      const user = userEvent.setup();
      render(<AddExerciseWithAIModal isOpen onClose={vi.fn()} onExerciseCreated={vi.fn()} />);

      const photos = screen.getByLabelText('Photos');
      expect(photos).toHaveAttribute('id', 'exercise-ai-photos');
      expect(screen.getByLabelText(/Exercise Name or Description/)).toBeInTheDocument();

      await user.upload(photos, new File(['photo'], 'press.png', { type: 'image/png' }));
      expect(await screen.findByRole('button', { name: 'Remove exercise photo 1' })).toBeInTheDocument();
    });

    it('connects a short-password error only to the password field', () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
        </MemoryRouter>,
      );
      fireEvent.submit(screen.getByRole('button', { name: 'Sign up' }).closest('form')!);

      const password = screen.getByLabelText('Password');
      const confirmPassword = screen.getByLabelText('Confirm Password');
      expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters');
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password).toHaveAttribute('aria-describedby', 'register-error');
      expect(confirmPassword).not.toHaveAttribute('aria-invalid');
      expect(confirmPassword).not.toHaveAttribute('aria-describedby');
      expect(authMocks.register).not.toHaveBeenCalled();
    });
  });
});
