import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WorkoutSession,
  SleepSession,
  Exercise,
  SessionItem,
  MealInstance,
  ExerciseSet,
  TrainingProgram,
  TrainingDay,
  FoodItem,
} from '@fitness-tracker/shared';
import {
  MealCategory,
  EnergyLevel,
  GlycogenLevel,
  InsulinLevel,
  RecoveryLevel,
  FatigueLevel,
  ExerciseType,
  MovementPattern,
  ExerciseClassification,
  MuscleGroup,
  ProgramStatus,
  SessionSource,
  SetType,
  FoodCategory,
  AbsorptionSpeed,
  InsulinResponse,
  FoodSource,
} from '@fitness-tracker/shared';

// ============================================
// User Store
// ============================================

interface UserState {
  userId: string | null;
  email: string | null;
  name: string | null;
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
  setName: (name: string | null) => void;
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
      name: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      profile: null,

      setUserId: (id) => set({ userId: id }),
      setEmail: (email) => set({ email }),
      setName: (name) => set({ name }),
      setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setProfile: (profile) => set({ profile }),

      logout: () =>
        set({
          userId: null,
          email: null,
          name: null,
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
            if (typeof globalThis.localStorage !== 'undefined') {
              return globalThis.localStorage.getItem(name);
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
            if (typeof globalThis.localStorage !== 'undefined') {
              return globalThis.localStorage.setItem(name, value);
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
            if (typeof globalThis.localStorage !== 'undefined') {
              return globalThis.localStorage.removeItem(name);
            }
            return undefined;
          }
        },
      })),
    }
  )
);

// ============================================
// Workout Session Store (with proper domain types)
// ============================================

interface WorkoutState {
  isActive: boolean;
  currentSession: WorkoutSession | null;
  sessionHistory: WorkoutSession[];
  sessionItems: SessionItem[];
  exerciseSets: ExerciseSet[];
  isLoading: boolean;
  error: string | null;

  // Session management
  startSession: (trainingDaySnapshotId?: string) => void;
  endSession: (notes?: string) => Promise<void>;

  // Session items
  addSessionItem: (item: Omit<SessionItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => void;

  // Exercise sets
  addSet: (set: Omit<ExerciseSet, 'id' | 'createdAt' | 'updatedAt' | 'startTimestamp' | 'isEstimated'>) => void;
  updateSet: (id: string, updates: Partial<ExerciseSet>) => void;
  deleteSet: (id: string) => void;

  // Drop sets
  addDropSet: (baseSetId: string, drops: Array<{ weight: number; reps: number }>) => void;

  // Queries
  getSessionById: (id: string) => WorkoutSession | undefined;
  getSetsForSession: (sessionId: string) => ExerciseSet[];
  getSessionSummary: (sessionId: string) => {
    totalDuration: number;
    activeTime: number;
    restTime: number;
    musclesWorked: MuscleGroup[];
    totalSets: number;
    totalVolume: number;
  } | null;

  // Legacy compatibility
  startWorkout: () => void;
  endWorkout: (notes?: string) => Promise<void>;
  addExercise: (exercise: { id: string; name: string; sets: Array<{ weight?: number; reps?: number }> }) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, sets: Array<{ weight?: number; reps?: number }>) => void;
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  isActive: false,
  currentSession: null,
  sessionHistory: [],
  sessionItems: [],
  exerciseSets: [],
  isLoading: false,
  error: null,

  startSession: (trainingDaySnapshotId) =>
    set(() => {
      const now = new Date();
      const newSession: WorkoutSession = {
        id: `ws_${Date.now()}`,
        userId: 'demo',
        date: now,
        startTimestamp: now,
        endTimestamp: undefined,
        isAutoClosed: false,
        trainingDaySnapshot: trainingDaySnapshotId ? {
          id: trainingDaySnapshotId,
          sessionId: `ws_${Date.now()}`,
          name: 'Snapshot',
          plannedExercisesSnapshot: [],
          capturedAt: now,
        } : undefined,
        sessionItems: [],
        notes: undefined,
        source: SessionSource.MANUAL,
        createdAt: now,
        updatedAt: now,
      };
      return {
        isActive: true,
        currentSession: newSession,
      };
    }),

  endSession: async (notes) =>
    set((state) => {
      if (!state.currentSession) return state;
      const now = new Date();
      const completedSession: WorkoutSession = {
        ...state.currentSession,
        endTimestamp: now,
        notes,
        updatedAt: now,
      };
      return {
        isActive: false,
        currentSession: null,
        sessionHistory: [...state.sessionHistory, completedSession],
      };
    }),

  addSessionItem: (item) =>
    set((state) => {
      const newItem: SessionItem = {
        ...item,
        id: `si_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: state.sessionItems.length,
      };
      return {
        sessionItems: [...state.sessionItems, newItem],
      };
    }),

  addSet: (setData) =>
    set((state) => {
      const now = new Date();
      const previousSets = get().exerciseSets.filter(s => !setData.sessionItemId || s.sessionItemId === setData.sessionItemId);
      const lastSet = previousSets.length > 0 ? previousSets[previousSets.length - 1] : null;
      const inferredStart = lastSet
        ? new Date(lastSet.endTimestamp.getTime() + 120000)
        : new Date(now.getTime() - 60000);

      const newSet: ExerciseSet = {
        ...setData,
        id: `es_${Date.now()}`,
        startTimestamp: inferredStart,
        endTimestamp: now,
        isEstimated: !lastSet,
        createdAt: now,
        updatedAt: now,
      };
      return {
        exerciseSets: [...state.exerciseSets, newSet],
      };
    }),

  updateSet: (id, updates) =>
    set((state) => ({
      exerciseSets: state.exerciseSets.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
      ),
    })),

  deleteSet: (id) =>
    set((state) => ({
      exerciseSets: state.exerciseSets.filter((s) => s.id !== id),
    })),

  addDropSet: (baseSetId, drops) =>
    set((state) => {
      const baseSet = state.exerciseSets.find(s => s.id === baseSetId);
      if (!baseSet) return state;

      const now = new Date();
      const lastEndTime = baseSet.endTimestamp;

      const newSets: ExerciseSet[] = drops.map((drop, index) => {
        const endTime = new Date(lastEndTime.getTime() + 45000);
        const startTime = new Date(endTime.getTime() - 30000);
        return {
          ...baseSet,
          id: `es_${Date.now()}_drop_${index}`,
          setType: SetType.DROP_SET,
          weight: drop.weight,
          reps: drop.reps,
          startTimestamp: startTime,
          endTimestamp: endTime,
          isEstimated: false,
          createdAt: now,
          updatedAt: now,
        };
      });

      return {
        exerciseSets: [...state.exerciseSets, ...newSets],
      };
    }),

  getSessionById: (id) => {
    return get().sessionHistory.find(s => s.id === id);
  },

  getSetsForSession: (sessionId) => {
    return get().exerciseSets.filter(s => s.sessionId === sessionId);
  },

  getSessionSummary: (sessionId) => {
    const session = get().getSessionById(sessionId);
    if (!session || !session.endTimestamp) return null;

    const sets = get().getSetsForSession(sessionId);
    const exerciseSets = sets.filter(s => s.setType === SetType.WORKING || s.setType === SetType.FAILURE);

    if (exerciseSets.length === 0) return null;

    const totalDuration = session.endTimestamp.getTime() - session.startTimestamp.getTime();
    let activeTime = 0;

    exerciseSets.forEach(set => {
      activeTime += set.endTimestamp.getTime() - set.startTimestamp.getTime();
    });

    const restTime = totalDuration - activeTime;

    const totalVolume = exerciseSets.reduce((sum, set) => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      return sum + (weight * reps);
    }, 0);

    return {
      totalDuration: Math.round(totalDuration / 60000),
      activeTime: Math.round(activeTime / 60000),
      restTime: Math.round(restTime / 60000),
      musclesWorked: [], // TODO: Calculate from exercise library
      totalSets: exerciseSets.length,
      totalVolume,
    };
  },

  // Legacy compatibility
  startWorkout: () => get().startSession(),

  endWorkout: async (notes) => {
    await get().endSession(notes);
  },

  addExercise: (exercise) => {
    const session = get().currentSession;
    if (!session) {
      get().startSession();
    }
    // Add sets for each exercise
    exercise.sets.forEach(setData => {
      get().addSet({
        sessionId: get().currentSession?.id || '',
        sessionItemId: '',
        exerciseId: exercise.id,
        setType: SetType.WORKING,
        weight: setData.weight,
        reps: setData.reps,
        endTimestamp: new Date(),
      });
    });
  },

  removeExercise: (exerciseId) => {
    set((state) => ({
      exerciseSets: state.exerciseSets.filter(s => s.exerciseId !== exerciseId),
    }));
  },

  updateExercise: (exerciseId, sets) => {
    // Remove old sets and add new ones
    get().removeExercise(exerciseId);
    sets.forEach(setData => {
      get().addSet({
        sessionId: get().currentSession?.id || '',
        sessionItemId: '',
        exerciseId,
        setType: SetType.WORKING,
        weight: setData.weight,
        reps: setData.reps,
        endTimestamp: new Date(),
      });
    });
  },
}));

// ============================================
// Exercise Library Store
// ============================================

interface ExerciseLibraryState {
  exercises: Exercise[];
  userExercises: Exercise[];
  filteredExercises: Exercise[];
  searchQuery: string;
  selectedMuscleGroup: MuscleGroup | null;
  isLoading: boolean;
  error: string | null;
  addExercise: (exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateExercise: (id: string, updates: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  fetchExercises: () => Promise<void>;
  searchExercises: (query: string) => void;
  filterByMuscleGroup: (muscleGroup: MuscleGroup | null) => void;
}

const CANONICAL_EXERCISES: Exercise[] = [
  {
    id: 'ex_1',
    name: 'Barbell Bench Press',
    owner: 'system',
    type: ExerciseType.WEIGHT_BASED,
    equipment: 'Barbell',
    movementPattern: MovementPattern.PUSH,
    classification: ExerciseClassification.UPPER_BODY,
    primaryMuscles: [MuscleGroup.CHEST],
    secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.SHOULDERS],
    stabilizerMuscles: [MuscleGroup.FOREARMS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_2',
    name: 'Barbell Squat',
    owner: 'system',
    type: ExerciseType.WEIGHT_BASED,
    equipment: 'Barbell',
    movementPattern: MovementPattern.SQUAT,
    classification: ExerciseClassification.LOWER_BODY,
    primaryMuscles: [MuscleGroup.QUADS],
    secondaryMuscles: [MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
    stabilizerMuscles: [MuscleGroup.ABS, MuscleGroup.LOWER_BACK],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_3',
    name: 'Deadlift',
    owner: 'system',
    type: ExerciseType.WEIGHT_BASED,
    equipment: 'Barbell',
    movementPattern: MovementPattern.HINGE,
    classification: ExerciseClassification.LOWER_BODY,
    primaryMuscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.LOWER_BACK],
    secondaryMuscles: [MuscleGroup.QUADS],
    stabilizerMuscles: [MuscleGroup.ABS, MuscleGroup.FOREARMS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_4',
    name: 'Pull-up',
    owner: 'system',
    type: ExerciseType.BODYWEIGHT,
    equipment: 'Pull-up Bar',
    movementPattern: MovementPattern.PULL,
    classification: ExerciseClassification.UPPER_BODY,
    primaryMuscles: [MuscleGroup.BACK],
    secondaryMuscles: [MuscleGroup.BICEPS, MuscleGroup.SHOULDERS],
    stabilizerMuscles: [MuscleGroup.FOREARMS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_5',
    name: 'Overhead Press',
    owner: 'system',
    type: ExerciseType.WEIGHT_BASED,
    equipment: 'Barbell',
    movementPattern: MovementPattern.PUSH,
    classification: ExerciseClassification.UPPER_BODY,
    primaryMuscles: [MuscleGroup.SHOULDERS],
    secondaryMuscles: [MuscleGroup.TRICEPS],
    stabilizerMuscles: [MuscleGroup.ABS, MuscleGroup.FOREARMS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_6',
    name: 'Barbell Row',
    owner: 'system',
    type: ExerciseType.WEIGHT_BASED,
    equipment: 'Barbell',
    movementPattern: MovementPattern.PULL,
    classification: ExerciseClassification.UPPER_BODY,
    primaryMuscles: [MuscleGroup.BACK],
    secondaryMuscles: [MuscleGroup.BICEPS, MuscleGroup.LOWER_BACK],
    stabilizerMuscles: [MuscleGroup.ABS, MuscleGroup.FOREARMS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_7',
    name: 'Plank',
    owner: 'system',
    type: ExerciseType.DURATION_BASED,
    equipment: 'Bodyweight',
    movementPattern: MovementPattern.ROTATE,
    classification: ExerciseClassification.CORE,
    primaryMuscles: [MuscleGroup.ABS],
    secondaryMuscles: [MuscleGroup.OBLIQUES, MuscleGroup.LOWER_BACK],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ex_8',
    name: 'Lunge',
    owner: 'system',
    type: ExerciseType.BODYWEIGHT,
    equipment: 'Bodyweight',
    movementPattern: MovementPattern.LUNGE,
    classification: ExerciseClassification.LOWER_BODY,
    primaryMuscles: [MuscleGroup.QUADS],
    secondaryMuscles: [MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
    stabilizerMuscles: [MuscleGroup.ABS],
    isCanonical: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const useExerciseLibraryStore = create<ExerciseLibraryState>()((set, get) => ({
  exercises: CANONICAL_EXERCISES,
  userExercises: [],
  filteredExercises: CANONICAL_EXERCISES,
  searchQuery: '',
  selectedMuscleGroup: null,
  isLoading: false,
  error: null,

  addExercise: (exercise) =>
    set((state) => {
      const newExercise: Exercise = {
        ...exercise,
        id: `ex_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        isCanonical: false,
        owner: 'user',
      };
      return {
        userExercises: [...state.userExercises, newExercise],
      };
    }),

  updateExercise: (id, updates) =>
    set((state) => ({
      userExercises: state.userExercises.map((ex) =>
        ex.id === id ? { ...ex, ...updates, updatedAt: new Date() } : ex
      ),
    })),

  deleteExercise: (id) =>
    set((state) => ({
      userExercises: state.userExercises.filter((ex) => ex.id !== id),
    })),

  fetchExercises: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement fetch from API
      set({
        exercises: CANONICAL_EXERCISES,
        filteredExercises: CANONICAL_EXERCISES,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  searchExercises: (query) => {
    const all = [...get().exercises, ...get().userExercises];
    const filtered = all.filter((ex) =>
      ex.name.toLowerCase().includes(query.toLowerCase())
    );
    set({ filteredExercises: filtered, searchQuery: query });
  },

  filterByMuscleGroup: (muscleGroup) => {
    const all = [...get().exercises, ...get().userExercises];
    if (!muscleGroup) {
      set({ filteredExercises: all, selectedMuscleGroup: null });
      return;
    }
    const filtered = all.filter((ex) =>
      ex.primaryMuscles.includes(muscleGroup) ||
      ex.secondaryMuscles?.includes(muscleGroup) ||
      ex.stabilizerMuscles?.includes(muscleGroup)
    );
    set({ filteredExercises: filtered, selectedMuscleGroup: muscleGroup });
  },
}));

// ============================================
// Training Programs Store
// ============================================

interface TrainingProgramsState {
  programs: TrainingProgram[];
  activeProgramId: string | null;
  trainingDays: TrainingDay[];
  addProgram: (program: Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProgram: (id: string, updates: Partial<TrainingProgram>) => void;
  deleteProgram: (id: string) => void;
  setActiveProgram: (id: string | null) => void;
  archiveProgram: (id: string) => void;
  addTrainingDay: (trainingDay: Omit<TrainingDay, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTrainingDay: (id: string, updates: Partial<TrainingDay>) => void;
  deleteTrainingDay: (id: string) => void;
  archiveTrainingDay: (id: string) => void;
  getActiveProgram: () => TrainingProgram | null;
  getTrainingDaysForProgram: (programId: string) => TrainingDay[];
}

export const useTrainingProgramsStore = create<TrainingProgramsState>()(
  persist(
    (set, get) => ({
      programs: [],
      activeProgramId: null,
      trainingDays: [],

      addProgram: (program) =>
        set((state) => {
          const newProgram: TrainingProgram = {
            ...program,
            id: `prog_${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return {
            programs: [...state.programs, newProgram],
          };
        }),

      updateProgram: (id, updates) =>
        set((state) => ({
          programs: state.programs.map((prog) =>
            prog.id === id ? { ...prog, ...updates, updatedAt: new Date() } : prog
          ),
        })),

      deleteProgram: (id) =>
        set((state) => ({
          programs: state.programs.filter((prog) => prog.id !== id),
          trainingDays: state.trainingDays.filter((day) => day.programId !== id),
          activeProgramId: state.activeProgramId === id ? null : state.activeProgramId,
        })),

      setActiveProgram: (id) => set({ activeProgramId: id }),

      archiveProgram: (id) =>
        set((state) => ({
          programs: state.programs.map((prog) =>
            prog.id === id ? { ...prog, status: ProgramStatus.ARCHIVED, updatedAt: new Date() } : prog
          ),
        })),

      addTrainingDay: (trainingDay) =>
        set((state) => {
          const newDay: TrainingDay = {
            ...trainingDay,
            id: `td_${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isArchived: false,
          };
          return {
            trainingDays: [...state.trainingDays, newDay],
          };
        }),

      updateTrainingDay: (id, updates) =>
        set((state) => ({
          trainingDays: state.trainingDays.map((day) =>
            day.id === id ? { ...day, ...updates, updatedAt: new Date() } : day
          ),
        })),

      deleteTrainingDay: (id) =>
        set((state) => ({
          trainingDays: state.trainingDays.filter((day) => day.id !== id),
        })),

      archiveTrainingDay: (id) =>
        set((state) => ({
          trainingDays: state.trainingDays.map((day) =>
            day.id === id ? { ...day, isArchived: true, updatedAt: new Date() } : day
          ),
        })),

      getActiveProgram: () => {
        const { programs, activeProgramId } = get();
        return programs.find((p) => p.id === activeProgramId) || null;
      },

      getTrainingDaysForProgram: (programId) => {
        return get().trainingDays.filter((day) => day.programId === programId && !day.isArchived);
      },
    }),
    {
      name: 'fitness-training-programs-storage',
    }
  )
);

// ============================================
// Food Store
// ============================================

interface FoodState {
  foodItems: FoodItem[];
  userFoodItems: FoodItem[];
  mealTemplates: any[];
  mealInstances: MealInstance[];
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  calorieGoal: number;
  proteinGoal: number;
  isLoading: boolean;
  error: string | null;
  addFoodItem: (item: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt' | 'owner'>) => void;
  updateFoodItem: (id: string, updates: Partial<FoodItem>) => void;
  deleteFoodItem: (id: string) => void;
  lookupBarcode: (barcode: string) => FoodItem | null;
  addMealTemplate: (template: any) => void;
  logMeal: (meal: Omit<MealInstance, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'isEstimated'>) => Promise<void>;
  logQuickMeal: (name: string, calories: number, protein: number, carbs: number, fat: number, category: MealCategory) => Promise<void>;
  removeMeal: (mealId: string) => void;
  resetDay: () => void;
  setGoals: (goals: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

const CANONICAL_FOOD_ITEMS: FoodItem[] = [
  {
    id: 'food_1',
    name: 'Chicken Breast',
    owner: 'system',
    category: FoodCategory.PROTEIN,
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    fiberPer100g: 0,
    glycemicIndex: 0,
    absorptionSpeed: AbsorptionSpeed.MODERATE,
    insulinResponse: InsulinResponse.LOW,
    satietyScore: 8,
    isCanonical: true,
    source: FoodSource.DATABASE_IMPORT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'food_2',
    name: 'Brown Rice',
    owner: 'system',
    category: FoodCategory.CARB,
    caloriesPer100g: 111,
    proteinPer100g: 2.6,
    carbsPer100g: 23,
    fatPer100g: 0.9,
    fiberPer100g: 1.8,
    glycemicIndex: 68,
    absorptionSpeed: AbsorptionSpeed.MODERATE,
    insulinResponse: InsulinResponse.MODERATE,
    satietyScore: 6,
    isCanonical: true,
    source: FoodSource.DATABASE_IMPORT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'food_3',
    name: 'Egg',
    owner: 'system',
    category: FoodCategory.PROTEIN,
    caloriesPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 11,
    fiberPer100g: 0,
    glycemicIndex: 0,
    absorptionSpeed: AbsorptionSpeed.MODERATE,
    insulinResponse: InsulinResponse.LOW,
    satietyScore: 7,
    isCanonical: true,
    source: FoodSource.DATABASE_IMPORT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const useFoodStore = create<FoodState>()(
  persist(
    (set, get) => ({
      foodItems: CANONICAL_FOOD_ITEMS,
      userFoodItems: [],
      mealTemplates: [],
      mealInstances: [],
      dailyCalories: 0,
      dailyProtein: 0,
      dailyCarbs: 0,
      dailyFat: 0,
      calorieGoal: 2000,
      proteinGoal: 150,
      isLoading: false,
      error: null,

      addFoodItem: (item) =>
        set((state) => {
          const newItem: FoodItem = {
            ...item,
            id: `food_${Date.now()}`,
            owner: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return {
            userFoodItems: [...state.userFoodItems, newItem],
          };
        }),

      updateFoodItem: (id, updates) =>
        set((state) => ({
          userFoodItems: state.userFoodItems.map((item) =>
            item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
          ),
        })),

      deleteFoodItem: (id) =>
        set((state) => ({
          userFoodItems: state.userFoodItems.filter((item) => item.id !== id),
        })),

      lookupBarcode: (barcode) => {
        const all = [...get().foodItems, ...get().userFoodItems];
        return all.find((item) => item.barcode === barcode) || null;
      },

      addMealTemplate: (template) =>
        set((state) => {
          const newTemplate = {
            ...template,
            id: `mt_${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return {
            mealTemplates: [...state.mealTemplates, newTemplate],
          };
        }),

      logMeal: async (meal) =>
        set((state) => {
          const now = new Date();
          const newMeal: MealInstance = {
            ...meal,
            id: `mi_${Date.now()}`,
            userId: 'demo',
            isEstimated: false,
            createdAt: now,
            updatedAt: now,
          };

          // Calculate nutrition from ingredients
          let calories = 0, protein = 0, carbs = 0, fat = 0;
          const allFood = [...state.foodItems, ...state.userFoodItems];

          newMeal.ingredients.forEach(ingredient => {
            const food = allFood.find(f => f.id === ingredient.foodItemId);
            if (food) {
              const multiplier = ingredient.quantity / 100;
              calories += food.caloriesPer100g * multiplier;
              protein += food.proteinPer100g * multiplier;
              carbs += food.carbsPer100g * multiplier;
              fat += food.fatPer100g * multiplier;
            }
          });

          return {
            mealInstances: [...state.mealInstances, newMeal],
            dailyCalories: state.dailyCalories + calories,
            dailyProtein: state.dailyProtein + protein,
            dailyCarbs: state.dailyCarbs + carbs,
            dailyFat: state.dailyFat + fat,
          };
        }),

      logQuickMeal: async (name, calories, protein, carbs, fat, category) =>
        set((state) => {
          const now = new Date();
          const newMeal: MealInstance = {
            id: `mi_${Date.now()}`,
            userId: 'demo',
            timestamp: now,
            isEstimated: true,
            category,
            ingredients: [],
            notes: name,
            source: SessionSource.MANUAL,
            createdAt: now,
            updatedAt: now,
          };

          return {
            mealInstances: [...state.mealInstances, newMeal],
            dailyCalories: state.dailyCalories + calories,
            dailyProtein: state.dailyProtein + protein,
            dailyCarbs: state.dailyCarbs + carbs,
            dailyFat: state.dailyFat + fat,
          };
        }),

      removeMeal: (mealId) =>
        set((state) => {
          const meal = state.mealInstances.find((m) => m.id === mealId);
          return {
            mealInstances: state.mealInstances.filter((m) => m.id !== mealId),
            dailyCalories: state.dailyCalories - (meal?.notes ? 0 : 0), // Simplified
            dailyProtein: state.dailyProtein - (meal?.notes ? 0 : 0),
            dailyCarbs: state.dailyCarbs - (meal?.notes ? 0 : 0),
            dailyFat: state.dailyFat - (meal?.notes ? 0 : 0),
          };
        }),

      resetDay: () =>
        set({
          mealInstances: [],
          dailyCalories: 0,
          dailyProtein: 0,
          dailyCarbs: 0,
          dailyFat: 0,
        }),

      setGoals: (goals) =>
        set({
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
        }),
    }),
    {
      name: 'fitness-food-storage',
      partialize: (state) => ({
        calorieGoal: state.calorieGoal,
        proteinGoal: state.proteinGoal,
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
      // Import apiService dynamically to avoid circular dependencies
      const { apiService } = await import('./amplify');

      // Try to parse as workout first
      let response = await apiService.mutate(
        `
          mutation FitnessAI($input: FitnessAIInput!) {
            fitnessAI(action: parseWorkout, input: $input) {
              success
              data
              error
              confidence
            }
          }
        `,
        {
          input: {
            action: 'parseWorkout',
            description: content,
            userId: 'local-user',
          },
        }
      );

      if (response.fitnessAI?.success && response.fitnessAI.data) {
        const workoutData = response.fitnessAI.data;
        let message = `I've logged your workout`;
        if (workoutData.exercises?.length > 0) {
          message = `Logged ${workoutData.exercises.length} exercise${workoutData.exercises.length > 1 ? 's' : ''}`;
          workoutData.exercises.forEach((ex: any) => {
            useWorkoutStore.getState().addExercise({
              id: Date.now().toString() + Math.random(),
              name: ex.name,
              sets: ex.sets || [],
            });
          });
          if (!useWorkoutStore.getState().isActive) {
            useWorkoutStore.getState().startWorkout();
          }
        }
        get().addMessage({
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          suggestions: ['Add more exercises', 'End workout', 'How am I doing?'],
        });
        set({ isLoading: false });
        return;
      }

      // Try to parse as food
      response = await apiService.mutate(
        `
          mutation FitnessAI($input: FitnessAIInput!) {
            fitnessAI(action: parseFood, input: $input) {
              success
              data
              error
              confidence
            }
          }
        `,
        {
          input: {
            action: 'parseFood',
            description: content,
            userId: 'local-user',
          },
        }
      );

      if (response.fitnessAI?.success && response.fitnessAI.data) {
        const foodData = response.fitnessAI.data;
        await useFoodStore.getState().logQuickMeal(
          foodData.foodName || 'Food',
          foodData.calories || 0,
          foodData.protein || 0,
          foodData.carbs || 0,
          foodData.fat || 0,
          MealCategory.SNACK
        );
        get().addMessage({
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: `Logged: ${foodData.foodName || 'Food'} - ${foodData.calories || 0} kcal`,
          timestamp: new Date(),
          suggestions: ['Log another meal', 'How am I doing today?', 'View macros'],
        });
        set({ isLoading: false });
        return;
      }

      // General chat response
      get().addMessage({
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: "I can help you log workouts and meals. Try saying something like 'Bench press 5x5 at 100kg' or 'I had chicken with rice for lunch'.",
        timestamp: new Date(),
        suggestions: ['Log a workout', 'Log a meal', 'How am I doing?'],
      });
      set({ isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      get().addMessage({
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'I had trouble processing that. Please make sure your backend is configured.',
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
    date?: Date;
    bedtime: Date;
    wakeTime: Date;
    duration: number;
    quality: number;
  }) => Promise<void>;
  fetchSleepSessions: () => Promise<void>;
}

export const useSleepStore = create<SleepState>()((set) => ({
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
      //   date: data.date?.toISOString() || data.bedtime.toISOString(),
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
        date: data.date || data.bedtime,
        bedtime: data.bedtime,
        wakeTime: data.wakeTime,
        duration: data.duration,
        qualityScore: data.quality,
        source: SessionSource.MANUAL,
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

export const useMetabolismStore = create<MetabolismState>()((set) => ({
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
      const hoursSinceLastMeal = foodStore.mealInstances.length > 0
        ? (now.getTime() - new Date(foodStore.mealInstances[foodStore.mealInstances.length - 1].timestamp).getTime()) / (1000 * 60 * 60)
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
      const hasWorkedOut = workoutStore.isActive || workoutStore.sessionHistory.length > 0;
      let glycogenStatus: GlycogenLevel;
      if (todayCarbs > 200 && !hasWorkedOut) glycogenStatus = GlycogenLevel.FULL;
      else if (todayCarbs > 100) glycogenStatus = GlycogenLevel.MODERATE;
      else if (todayCarbs > 50) glycogenStatus = GlycogenLevel.LOW;
      else glycogenStatus = GlycogenLevel.DEPLETED;

      // Insulin activity based on recent meals
      const carbsPerMeal = foodStore.mealInstances.length > 0
        ? foodStore.dailyCarbs / foodStore.mealInstances.length
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
          recentMeals: foodStore.mealInstances.length,
          recentWorkouts: workoutStore.sessionHistory.length,
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
