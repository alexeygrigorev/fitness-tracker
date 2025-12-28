import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface WorkoutSession {
  id: string;
  startTimestamp: Date;
  endTimestamp?: Date;
}

export interface MealInstance {
  id: string;
  timestamp: Date;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Chat Store
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Hi! I\'m your fitness assistant. Log your workouts, meals, or sleep here!',
          timestamp: new Date(),
        },
      ],
      isLoading: false,
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      setLoading: (isLoading) => set({ isLoading }),
      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'fitness-chat-storage' }
  )
);

// Food Store
interface FoodState {
  mealInstances: MealInstance[];
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  goals: { calories: number; protein: number; carbs: number; fat: number };
  addMeal: (meal: MealInstance) => void;
  logQuickMeal: (name: string, calories: number, protein: number, carbs: number, fat: number) => void;
  deleteMeal: (id: string) => void;
  setGoals: (goals: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

export const useFoodStore = create<FoodState>()(
  persist(
    (set) => ({
      mealInstances: [],
      dailyCalories: 1850,
      dailyProtein: 120,
      dailyCarbs: 180,
      dailyFat: 65,
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
      addMeal: (meal) => set((state) => ({ mealInstances: [...state.mealInstances, meal] })),
      logQuickMeal: (name, calories, protein, carbs, fat) =>
        set((state) => ({
          mealInstances: [
            ...state.mealInstances,
            {
              id: Date.now().toString(),
              timestamp: new Date(),
              calories,
              protein,
              carbs,
              fat,
            },
          ],
          dailyCalories: state.dailyCalories + calories,
          dailyProtein: state.dailyProtein + protein,
          dailyCarbs: state.dailyCarbs + carbs,
          dailyFat: state.dailyFat + fat,
        })),
      deleteMeal: (id) =>
        set((state) => ({
          mealInstances: state.mealInstances.filter((m) => m.id !== id),
        })),
      setGoals: (goals) => set({ goals }),
    }),
    { name: 'fitness-food-storage' }
  )
);

// Workout Store
interface WorkoutState {
  isActive: boolean;
  currentSession: WorkoutSession | null;
  sessionHistory: WorkoutSession[];
  startWorkout: () => void;
  endWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      isActive: false,
      currentSession: null,
      sessionHistory: [],
      startWorkout: () =>
        set({
          isActive: true,
          currentSession: {
            id: Date.now().toString(),
            startTimestamp: new Date(),
          },
        }),
      endWorkout: () =>
        set((state) => ({
          isActive: false,
          currentSession: null,
          sessionHistory: [
            ...(state.currentSession ? [state.currentSession] : []),
            ...state.sessionHistory,
          ],
        })),
    }),
    { name: 'fitness-workout-storage' }
  )
);

// Settings Store
interface SettingsState {
  darkMode: boolean;
  units: 'metric' | 'imperial';
  toggleDarkMode: () => void;
  setUnits: (units: 'metric' | 'imperial') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      units: 'metric' as const,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setUnits: (units) => set({ units }),
    }),
    { name: 'fitness-settings-storage' }
  )
);
