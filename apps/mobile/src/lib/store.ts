import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WorkoutSession,
  SleepSession,
  Exercise,
} from '@fitness-tracker/shared';
import {
  MealCategory,
  EnergyLevel,
  GlycogenLevel,
  InsulinLevel,
  RecoveryLevel,
  FatigueLevel,
} from '@fitness-tracker/shared';

// ============================================
// User Store
// ============================================

interface UserState {
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  profile: {
    weight?: number;
    height?: number;
    birthdate?: Date | null;
    units: 'METRIC' | 'ENGLISH';
    garminConnected: boolean;
  } | null;
  setUserId: (id: string | null) => void;
  setEmail: (email: string | null) => void;
  setAuthenticated: (isAuth: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProfile: (profile: any) => void;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userId: null,
      email: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      profile: null,

      setUserId: (id) => set({ userId: id }),
      setEmail: (email) => set({ email }),
      setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setProfile: (profile) => set({ profile }),

      logout: () =>
        set({
          userId: null,
          email: null,
          isAuthenticated: false,
          profile: null,
          error: null,
        }),

      fetchProfile: async () => {
        const { userId } = get();
        if (!userId) return;

        set({ isLoading: true, error: null });
        try {
          // TODO: Uncomment when API is available
          // const result = await apiService.query(queries.getUser, { id: userId });
          // set({ profile: result.data.getUser.profile, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement mutation
          // await apiService.mutate(mutations.updateUserProfile, data);
          set({ profile: { ...get().profile, ...data }, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'fitness-user-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Use AsyncStorage for React Native
          try {
            const AsyncStorage = require('expo-secure-store').default;
            return AsyncStorage.getItem(name);
          } catch {
            // Fallback for web
            if (typeof localStorage !== 'undefined') {
              return localStorage.getItem(name);
            }
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const AsyncStorage = require('expo-secure-store').default;
            return AsyncStorage.setItem(name, value);
          } catch {
            // Fallback for web
            if (typeof localStorage !== 'undefined') {
              return localStorage.setItem(name, value);
            }
            return undefined;
          }
        },
        removeItem: (name) => {
          try {
            const AsyncStorage = require('expo-secure-store').default;
            return AsyncStorage.deleteItemAsync(name);
          } catch {
            // Fallback for web
            if (typeof localStorage !== 'undefined') {
              return localStorage.removeItem(name);
            }
            return undefined;
          }
        },
      })),
    }
  )
);

// ============================================
// Workout Store
// ============================================

interface ExerciseSetInput {
  weight?: number;
  reps?: number;
  setType?: 'WARM_UP' | 'WORKING' | 'DROP_SET' | 'FAILURE';
}

interface ExerciseInput {
  id: string;
  name: string;
  sets: ExerciseSetInput[];
}

interface CurrentWorkout {
  id: string;
  startTime: Date;
  exercises: ExerciseInput[];
  notes?: string;
}

interface WorkoutState {
  currentWorkout: CurrentWorkout | null;
  isWorkoutActive: boolean;
  recentWorkouts: WorkoutSession[];
  isLoading: boolean;
  error: string | null;
  startWorkout: () => void;
  endWorkout: (notes?: string) => Promise<void>;
  addExercise: (exercise: ExerciseInput) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, sets: ExerciseSetInput[]) => void;
  updateNotes: (notes: string) => void;
  fetchRecentWorkouts: () => Promise<void>;
  syncWorkout: (workout: CurrentWorkout) => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  currentWorkout: null,
  isWorkoutActive: false,
  recentWorkouts: [],
  isLoading: false,
  error: null,

  startWorkout: () =>
    set({
      currentWorkout: {
        id: `workout_${Date.now()}`,
        startTime: new Date(),
        exercises: [],
      },
      isWorkoutActive: true,
    }),

  endWorkout: async (notes) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    set({ isLoading: true, error: null });

    try {
      // Update notes and sync
      const workoutWithNotes = { ...currentWorkout, notes };
      await get().syncWorkout(workoutWithNotes);

      set({
        currentWorkout: null,
        isWorkoutActive: false,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  addExercise: (exercise) =>
    set((state) => ({
      currentWorkout: state.currentWorkout
        ? {
            ...state.currentWorkout,
            exercises: [...state.currentWorkout.exercises, exercise],
          }
        : null,
    })),

  removeExercise: (exerciseId) =>
    set((state) => ({
      currentWorkout: state.currentWorkout
        ? {
            ...state.currentWorkout,
            exercises: state.currentWorkout.exercises.filter((e) => e.id !== exerciseId),
          }
        : null,
    })),

  updateExercise: (exerciseId, sets) =>
    set((state) => ({
      currentWorkout: state.currentWorkout
        ? {
            ...state.currentWorkout,
            exercises: state.currentWorkout.exercises.map((e) =>
              e.id === exerciseId ? { ...e, sets } : e
            ),
          }
        : null,
    })),

  updateNotes: (notes) =>
    set((state) => ({
      currentWorkout: state.currentWorkout ? { ...state.currentWorkout, notes } : null,
    })),

  fetchRecentWorkouts: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = useUserStore.getState().userId;
      if (!userId) return;

      // TODO: Uncomment when API is available
      // const result = await apiService.query(queries.workoutSessionsByUser, {
      //   userId,
      //   limit: 10,
      // });
      // set({ recentWorkouts: result.data.workoutSessionsByUser.items, isLoading: false });
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  syncWorkout: async (workout) => {
    try {
      const userId = useUserStore.getState().userId;
      if (!userId) throw new Error('User not authenticated');

      // TODO: Implement actual sync
      // await apiService.mutate(mutations.createWorkoutSession, {
      //   userId,
      //   date: workout.startTime.toISOString(),
      //   startTimestamp: workout.startTime.toISOString(),
      //   endTimestamp: new Date().toISOString(),
      //   notes: workout.notes,
      //   source: 'MANUAL',
      // });
      console.log('Workout synced:', workout);
    } catch (error) {
      console.error('Error syncing workout:', error);
      throw error;
    }
  },
}));

// ============================================
// Food Store
// ============================================

interface MealInput {
  id: string;
  name: string;
  category: MealCategory;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: Date;
}

interface FoodState {
  todayMeals: MealInput[];
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  isLoading: boolean;
  error: string | null;
  addMeal: (meal: MealInput) => Promise<void>;
  removeMeal: (mealId: string) => void;
  resetDay: () => void;
  setGoals: (goals: { calories: number; protein: number; carbs: number; fat: number }) => void;
  fetchTodaysMeals: () => Promise<void>;
  syncMeal: (meal: MealInput) => Promise<void>;
}

export const useFoodStore = create<FoodState>()(
  persist(
    (set, get) => ({
      todayMeals: [],
      dailyCalories: 0,
      dailyProtein: 0,
      dailyCarbs: 0,
      dailyFat: 0,
      calorieGoal: 2000,
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
      isLoading: false,
      error: null,

      addMeal: async (meal) => {
        set((state) => ({
          todayMeals: [...state.todayMeals, meal],
          dailyCalories: state.dailyCalories + (meal.calories || 0),
          dailyProtein: state.dailyProtein + (meal.protein || 0),
          dailyCarbs: state.dailyCarbs + (meal.carbs || 0),
          dailyFat: state.dailyFat + (meal.fat || 0),
        }));

        // Sync to backend
        try {
          await get().syncMeal(meal);
        } catch (error) {
          console.error('Error syncing meal:', error);
        }
      },

      removeMeal: (mealId) =>
        set((state) => {
          const meal = state.todayMeals.find((m) => m.id === mealId);
          return {
            todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
            dailyCalories: state.dailyCalories - (meal?.calories || 0),
            dailyProtein: state.dailyProtein - (meal?.protein || 0),
            dailyCarbs: state.dailyCarbs - (meal?.carbs || 0),
            dailyFat: state.dailyFat - (meal?.fat || 0),
          };
        }),

      resetDay: () =>
        set({
          todayMeals: [],
          dailyCalories: 0,
          dailyProtein: 0,
          dailyCarbs: 0,
          dailyFat: 0,
        }),

      setGoals: (goals) =>
        set({
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
          carbsGoal: goals.carbs,
          fatGoal: goals.fat,
        }),

      fetchTodaysMeals: async () => {
        set({ isLoading: true, error: null });
        try {
          const userId = useUserStore.getState().userId;
          if (!userId) return;

          // TODO: Uncomment when API is available
          // const startOfDay = new Date();
          // startOfDay.setHours(0, 0, 0, 0);
          // const endOfDay = new Date();
          // endOfDay.setHours(23, 59, 59, 999);

          // const result = await apiService.query(queries.getTodaysMeals, {
          //   userId,
          //   startOfDay: startOfDay.toISOString(),
          //   endOfDay: endOfDay.toISOString(),
          // });

          // Process meals and calculate totals
          set({ isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      syncMeal: async (meal) => {
        try {
          const userId = useUserStore.getState().userId;
          if (!userId) throw new Error('User not authenticated');

          // TODO: Implement actual sync
          // await apiService.mutate(mutations.logMeal, {
          //   userId,
          //   timestamp: meal.timestamp.toISOString(),
          //   category: meal.category,
          //   ingredients: [],
          //   source: 'MANUAL',
          // });
          console.log('Meal synced:', meal);
        } catch (error) {
          console.error('Error syncing meal:', error);
          throw error;
        }
      },
    }),
    {
      name: 'fitness-food-storage',
      partialize: (state) => ({
        calorieGoal: state.calorieGoal,
        proteinGoal: state.proteinGoal,
        carbsGoal: state.carbsGoal,
        fatGoal: state.fatGoal,
      }),
    }
  )
);

// ============================================
// AI Chat Store
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your fitness assistant. You can tell me about your workouts, meals, or how you're feeling today. What would you like to log?",
      timestamp: new Date(),
      suggestions: ['Log a workout', 'Log a meal', 'How am I doing today?'],
    },
  ],
  isLoading: false,
  error: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearMessages: () =>
    set({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content:
            "Hi! I'm your fitness assistant. You can tell me about your workouts, meals, or how you're feeling today. What would you like to log?",
          timestamp: new Date(),
          suggestions: ['Log a workout', 'Log a meal', 'How am I doing today?'],
        },
      ],
      error: null,
    }),

  sendMessage: async (content) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    get().addMessage(userMessage);

    set({ isLoading: true, error: null });

    try {
      // Call AI service
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a helpful fitness and nutrition assistant. Help users log workouts and meals, provide advice, and answer questions.

When parsing user input, determine if they are:
1. Logging a workout - extract exercises, sets, reps, weight
2. Logging a meal - extract food items and estimate nutrition
3. Asking for advice - provide personalized recommendations
4. General question - answer helpfully

Respond in JSON format with:
{
  "type": "workout" | "meal" | "advice" | "general",
  "message": "Your response message",
  "data": { ...parsed data if applicable },
  "suggestions": ["suggestion 1", "suggestion 2"]
}`,
            },
            {
              role: 'user',
              content,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const result = await response.json();
      const parsed = JSON.parse(result.choices[0].message.content || '{}');

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: parsed.message || 'I understand. Let me help you with that.',
        timestamp: new Date(),
        suggestions: parsed.suggestions,
      };
      get().addMessage(assistantMessage);

      // Handle parsed data
      if (parsed.type === 'workout' && parsed.data) {
        // Add workout data to workout store
        console.log('Workout data:', parsed.data);
      } else if (parsed.type === 'meal' && parsed.data) {
        // Add meal data to food store
        console.log('Meal data:', parsed.data);
      }

      set({ isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      // Add error message
      get().addMessage({
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: new Date(),
      });
    }
  },
}));

// ============================================
// Sleep Store
// ============================================

interface SleepState {
  sleepSessions: SleepSession[];
  lastNight: {
    bedtime: Date | null;
    wakeTime: Date | null;
    duration: number;
    quality: number;
  } | null;
  weeklyAverage: number;
  isLoading: boolean;
  error: string | null;
  logSleep: (data: {
    bedtime: Date;
    wakeTime: Date;
    duration: number;
    quality: number;
  }) => Promise<void>;
  fetchSleepSessions: () => Promise<void>;
}

export const useSleepStore = create<SleepState>()((set, get) => ({
  sleepSessions: [],
  lastNight: null,
  weeklyAverage: 0,
  isLoading: false,
  error: null,

  logSleep: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const userId = useUserStore.getState().userId;
      if (!userId) throw new Error('User not authenticated');

      // TODO: Implement actual sync
      // await apiService.mutate(mutations.logSleep, {
      //   userId,
      //   bedtime: data.bedtime.toISOString(),
      //   wakeTime: data.wakeTime.toISOString(),
      //   duration: data.duration,
      //   qualityScore: data.quality,
      //   source: 'MANUAL',
      // });

      // Update local state
      const newSession: SleepSession = {
        id: `sleep_${Date.now()}`,
        userId,
        date: data.bedtime,
        bedtime: data.bedtime,
        wakeTime: data.wakeTime,
        duration: data.duration,
        qualityScore: data.quality,
        source: 'MANUAL' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state) => ({
        sleepSessions: [newSession, ...state.sleepSessions],
        lastNight: {
          bedtime: data.bedtime,
          wakeTime: data.wakeTime,
          duration: data.duration,
          quality: data.quality,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  fetchSleepSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = useUserStore.getState().userId;
      if (!userId) return;

      // TODO: Implement fetch
      // const result = await apiService.query(queries.sleepSessionsByUser, {
      //   userId,
      //   limit: 7,
      // });

      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));

// ============================================
// Metabolism Store
// ============================================

interface MetabolismState {
  current: {
    energyAvailability: EnergyLevel;
    glycogenStatus: GlycogenLevel;
    insulinActivity: InsulinLevel;
    recoveryState: RecoveryLevel;
    fatigueLevel: FatigueLevel;
    lastUpdated: Date | null;
  } | null;
  contributingFactors: {
    recentMeals: number;
    recentWorkouts: number;
    sleepQuality: number;
    stressLevel: number;
  };
  isLoading: boolean;
  error: string | null;
  calculateMetabolicState: () => Promise<void>;
}

export const useMetabolismStore = create<MetabolismState>()((set, get) => ({
  current: null,
  contributingFactors: {
    recentMeals: 0,
    recentWorkouts: 0,
    sleepQuality: 50,
    stressLevel: 50,
  },
  isLoading: false,
  error: null,

  calculateMetabolicState: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = useUserStore.getState().userId;
      if (!userId) return;

      // Get data from other stores
      const foodStore = useFoodStore.getState();
      const workoutStore = useWorkoutStore.getState();
      const sleepStore = useSleepStore.getState();

      // Calculate metabolic state based on various factors
      const now = new Date();
      const hoursSinceLastMeal = foodStore.todayMeals.length > 0
        ? (now.getTime() - new Date(foodStore.todayMeals[foodStore.todayMeals.length - 1].timestamp).getTime()) / (1000 * 60 * 60)
        : 24;

      // Energy availability based on recent food intake
      let energyAvailability: EnergyLevel;
      if (hoursSinceLastMeal < 1) energyAvailability = EnergyLevel.VERY_HIGH;
      else if (hoursSinceLastMeal < 3) energyAvailability = EnergyLevel.HIGH;
      else if (hoursSinceLastMeal < 6) energyAvailability = EnergyLevel.MODERATE;
      else if (hoursSinceLastMeal < 12) energyAvailability = EnergyLevel.LOW;
      else energyAvailability = EnergyLevel.VERY_LOW;

      // Glycogen status based on carb intake and workouts
      const todayCarbs = foodStore.dailyCarbs;
      const hasWorkedOut = workoutStore.isWorkoutActive || workoutStore.recentWorkouts.length > 0;
      let glycogenStatus: GlycogenLevel;
      if (todayCarbs > 200 && !hasWorkedOut) glycogenStatus = GlycogenLevel.FULL;
      else if (todayCarbs > 100) glycogenStatus = GlycogenLevel.MODERATE;
      else if (todayCarbs > 50) glycogenStatus = GlycogenLevel.LOW;
      else glycogenStatus = GlycogenLevel.DEPLETED;

      // Insulin activity based on recent meals
      const carbsPerMeal = foodStore.todayMeals.length > 0
        ? foodStore.dailyCarbs / foodStore.todayMeals.length
        : 0;
      let insulinActivity: InsulinLevel;
      if (hoursSinceLastMeal < 0.5 && carbsPerMeal > 50) insulinActivity = InsulinLevel.HIGH;
      else if (hoursSinceLastMeal < 2) insulinActivity = InsulinLevel.MODERATE;
      else insulinActivity = InsulinLevel.LOW;

      // Recovery state based on sleep and recent workouts
      const lastSleep = sleepStore.lastNight;
      let recoveryState: RecoveryLevel;
      if (lastSleep && lastSleep.quality > 80 && lastSleep.duration > 480) recoveryState = RecoveryLevel.EXCELLENT;
      else if (lastSleep && lastSleep.quality > 70) recoveryState = RecoveryLevel.GOOD;
      else if (lastSleep && lastSleep.quality > 50) recoveryState = RecoveryLevel.MODERATE;
      else if (lastSleep) recoveryState = RecoveryLevel.POOR;
      else recoveryState = RecoveryLevel.VERY_POOR;

      // Fatigue based on workouts and sleep
      let fatigueLevel: FatigueLevel;
      if (hasWorkedOut && lastSleep && lastSleep.duration < 420) fatigueLevel = FatigueLevel.VERY_HIGH;
      else if (hasWorkedOut) fatigueLevel = FatigueLevel.HIGH;
      else if (lastSleep && lastSleep.duration > 480) fatigueLevel = FatigueLevel.LOW;
      else fatigueLevel = FatigueLevel.MODERATE;

      set({
        current: {
          energyAvailability,
          glycogenStatus,
          insulinActivity,
          recoveryState,
          fatigueLevel,
          lastUpdated: now,
        },
        contributingFactors: {
          recentMeals: foodStore.todayMeals.length,
          recentWorkouts: workoutStore.recentWorkouts.length,
          sleepQuality: lastSleep?.quality || 50,
          stressLevel: 50, // TODO: Add stress tracking
        },
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));

// ============================================
// Settings Store
// ============================================

interface SettingsState {
  darkMode: boolean;
  notifications: boolean;
  reminderTime: string; // HH:MM format
  units: 'METRIC' | 'ENGLISH';
  weeklyGoal: {
    workouts: number;
    calories: number;
    protein: number;
  };
  toggleDarkMode: () => void;
  toggleNotifications: () => void;
  setReminderTime: (time: string) => void;
  setUnits: (units: 'METRIC' | 'ENGLISH') => void;
  setWeeklyGoal: (goal: { workouts?: number; calories?: number; protein?: number }) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      notifications: true,
      reminderTime: '09:00',
      units: 'METRIC',
      weeklyGoal: {
        workouts: 5,
        calories: 14000,
        protein: 1050,
      },

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      toggleNotifications: () => set((state) => ({ notifications: !state.notifications })),

      setReminderTime: (time) => set({ reminderTime: time }),

      setUnits: (units) => set({ units }),

      setWeeklyGoal: (goal) =>
        set((state) => ({
          weeklyGoal: { ...state.weeklyGoal, ...goal },
        })),
    }),
    {
      name: 'fitness-settings-storage',
    }
  )
);

// ============================================
// Exercise Library Store
// ============================================

interface ExerciseLibraryState {
  exercises: Exercise[];
  filteredExercises: Exercise[];
  searchQuery: string;
  selectedMuscleGroup: string | null;
  isLoading: boolean;
  error: string | null;
  fetchExercises: () => Promise<void>;
  searchExercises: (query: string) => void;
  filterByMuscleGroup: (muscleGroup: string | null) => void;
}

export const useExerciseLibraryStore = create<ExerciseLibraryState>()((set) => ({
  exercises: [],
  filteredExercises: [],
  searchQuery: '',
  selectedMuscleGroup: null,
  isLoading: false,
  error: null,

  fetchExercises: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement fetch from API
      // const result = await apiService.query(queries.listExercises, {
      //   filter: { isCanonical: { eq: true } },
      //   limit: 100,
      // });

      // Load sample exercises for now
      const sampleExercises: Exercise[] = [
        {
          id: 'ex_1',
          name: 'Bench Press',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: 'system',
          type: 'WEIGHT_BASED' as any,
          classification: 'UPPER_BODY' as any,
          primaryMuscles: ['CHEST' as any],
          secondaryMuscles: ['TRICEPS' as any, 'SHOULDERS' as any],
          isCanonical: true,
        },
        {
          id: 'ex_2',
          name: 'Squat',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: 'system',
          type: 'WEIGHT_BASED' as any,
          classification: 'LOWER_BODY' as any,
          primaryMuscles: ['QUADS' as any],
          secondaryMuscles: ['GLUTES' as any, 'HAMSTRINGS' as any],
          isCanonical: true,
        },
        {
          id: 'ex_3',
          name: 'Deadlift',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: 'system',
          type: 'WEIGHT_BASED' as any,
          classification: 'LOWER_BODY' as any,
          primaryMuscles: ['BACK' as any],
          secondaryMuscles: ['GLUTES' as any, 'HAMSTRINGS' as any],
          isCanonical: true,
        },
        {
          id: 'ex_4',
          name: 'Pull-up',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: 'system',
          type: 'BODYWEIGHT' as any,
          classification: 'UPPER_BODY' as any,
          primaryMuscles: ['BACK' as any],
          secondaryMuscles: ['BICEPS' as any],
          isCanonical: true,
        },
        {
          id: 'ex_5',
          name: 'Overhead Press',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: 'system',
          type: 'WEIGHT_BASED' as any,
          classification: 'UPPER_BODY' as any,
          primaryMuscles: ['SHOULDERS' as any],
          secondaryMuscles: ['TRICEPS' as any],
          isCanonical: true,
        },
      ];

      set({
        exercises: sampleExercises,
        filteredExercises: sampleExercises,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  searchExercises: (query) => {
    const { exercises } = get();
    const filtered = exercises.filter((ex) =>
      ex.name.toLowerCase().includes(query.toLowerCase())
    );
    set({ filteredExercises: filtered, searchQuery: query });
  },

  filterByMuscleGroup: (muscleGroup) => {
    const { exercises } = get();
    if (!muscleGroup) {
      set({ filteredExercises: exercises, selectedMuscleGroup: null });
      return;
    }
    const filtered = exercises.filter((ex) =>
      ex.primaryMuscles.includes(muscleGroup as any)
    );
    set({ filteredExercises: filtered, selectedMuscleGroup: muscleGroup });
  },
}));
