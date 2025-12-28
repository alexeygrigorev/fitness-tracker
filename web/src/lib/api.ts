import {
  mockExercises,
  mockFoodItems,
  mockWorkoutSessions,
  mockMeals,
  mockSleepEntries,
  mockMetabolismStates,
  mockAdvice,
  mockMealTemplates
} from './mockData';
import type {
  FoodItem,
  WorkoutSession,
  Meal,
  SleepEntry,
  WorkoutSet,
  DailySummary,
  MealTemplate,
  MealFoodItem
} from './types';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

let exercises = [...mockExercises];
let foodItems = [...mockFoodItems] as FoodItem[];
let workoutSessions = [...mockWorkoutSessions] as WorkoutSession[];
let meals = [...mockMeals] as Meal[];
let sleepEntries = [...mockSleepEntries] as SleepEntry[];
let metabolismStates = [...mockMetabolismStates];
let advice = [...mockAdvice];
let mealTemplates = [...mockMealTemplates] as MealTemplate[];

export const exercisesApi = {
  getAll: async () => {
    await delay();
    return [...exercises];
  },
  getById: async (id: string) => {
    await delay();
    return exercises.find(e => e.id === id);
  },
  getByMuscleGroup: async (muscleGroup: string) => {
    await delay();
    return exercises.filter(e => e.muscleGroups.includes(muscleGroup as any));
  }
};

export const foodApi = {
  getAll: async () => {
    await delay();
    return [...foodItems];
  },
  getById: async (id: string) => {
    await delay();
    return foodItems.find(f => f.id === id);
  },
  search: async (query: string) => {
    await delay(100);
    const q = query.toLowerCase();
    return foodItems.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q))
    );
  },
  getByCategory: async (category: string) => {
    await delay();
    return foodItems.filter(f => f.category === category);
  },
  create: async (food: Omit<FoodItem, 'id'>) => {
    await delay();
    const newFood: FoodItem = { ...food, id: 'food' + Date.now(), source: food.source || 'user' };
    foodItems.push(newFood);
    return newFood;
  },
  update: async (id: string, updates: Partial<FoodItem>) => {
    await delay();
    const index = foodItems.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Food not found');
    foodItems[index] = { ...foodItems[index], ...updates };
    return foodItems[index];
  },
  delete: async (id: string) => {
    await delay();
    const index = foodItems.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Food not found');
    foodItems.splice(index, 1);
    return true;
  }
};

export const mealTemplatesApi = {
  getAll: async () => {
    await delay();
    return [...mealTemplates];
  },
  getById: async (id: string) => {
    await delay();
    return mealTemplates.find(t => t.id === id);
  },
  getByCategory: async (category: string) => {
    await delay();
    return mealTemplates.filter(t => t.category === category);
  },
  create: async (template: Omit<MealTemplate, 'id'>) => {
    await delay();
    const newTemplate: MealTemplate = { ...template, id: 'mt' + Date.now() };
    mealTemplates.push(newTemplate);
    return newTemplate;
  },
  update: async (id: string, updates: Partial<MealTemplate>) => {
    await delay();
    const index = mealTemplates.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Template not found');
    mealTemplates[index] = { ...mealTemplates[index], ...updates };
    return mealTemplates[index];
  },
  delete: async (id: string) => {
    await delay();
    const index = mealTemplates.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Template not found');
    mealTemplates.splice(index, 1);
    return true;
  },
  calculateNutrition: async (foods: MealFoodItem[]) => {
    await delay(100);
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    for (const item of foods) {
      const food = foodItems.find(f => f.id === item.foodId);
      if (food) {
        const s = item.servings;
        totalCalories += food.calories * s;
        totalProtein += food.protein * s;
        totalCarbs += food.carbs * s;
        totalFat += food.fat * s;
      }
    }
    return { totalCalories, totalProtein, totalCarbs, totalFat };
  }
};

export const workoutsApi = {
  getAll: async () => {
    await delay();
    return [...workoutSessions];
  },
  getById: async (id: string) => {
    await delay();
    return workoutSessions.find(w => w.id === id);
  },
  getRecent: async (days = 7) => {
    await delay();
    const cutoff = new Date(Date.now() - days * 86400000);
    return workoutSessions.filter(w => w.startedAt >= cutoff);
  },
  create: async (session: Omit<WorkoutSession, 'id'>) => {
    await delay();
    const newSession: WorkoutSession = { ...session, id: 'ws' + Date.now() };
    workoutSessions.push(newSession);
    return newSession;
  },
  addSet: async (sessionId: string, set: Omit<WorkoutSet, 'id'>) => {
    await delay();
    const session = workoutSessions.find(w => w.id === sessionId);
    if (!session) throw new Error('Session not found');
    const newSet: WorkoutSet = { ...set, id: 'set' + Date.now() };
    session.sets.push(newSet);
    return newSet;
  },
  endSession: async (sessionId: string, notes?: string) => {
    await delay();
    const session = workoutSessions.find(w => w.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.endedAt = new Date();
    session.notes = notes;
    let totalVolume = 0;
    for (const set of session.sets) {
      const weight = set.weight || 0;
      totalVolume += weight * set.reps;
    }
    session.totalVolume = totalVolume;
    const setsWithRpe = session.sets.filter(s => s.rpe);
    const avgRpe = setsWithRpe.length > 0
      ? setsWithRpe.reduce((sum, s) => sum + (s.rpe || 0), 0) / setsWithRpe.length
      : 7;
    session.estimatedRecovery = Math.round(24 + (totalVolume / 1000) * 12 + (avgRpe - 5) * 6);
    return session;
  }
};

export const mealsApi = {
  getAll: async () => {
    await delay();
    return [...meals];
  },
  getById: async (id: string) => {
    await delay();
    return meals.find(m => m.id === id);
  },
  getByDate: async (date: Date) => {
    await delay();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    return meals.filter(m => m.loggedAt >= startOfDay && m.loggedAt <= endOfDay);
  },
  create: async (meal: Omit<Meal, 'id' | 'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat'>) => {
    await delay();
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    for (const food of meal.foods) {
      const item = foodItems.find(f => f.id === food.foodId);
      if (item) {
        totalCalories += item.calories * food.servings;
        totalProtein += item.protein * food.servings;
        totalCarbs += item.carbs * food.servings;
        totalFat += item.fat * food.servings;
      }
    }
    const newMeal: Meal = { ...meal, id: 'meal' + Date.now(), totalCalories, totalProtein, totalCarbs, totalFat, source: meal.source || 'manual' };
    meals.push(newMeal);
    return newMeal;
  },
  update: async (id: string, updates: Partial<Meal>) => {
    await delay();
    const index = meals.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Meal not found');
    meals[index] = { ...meals[index], ...updates };
    return meals[index];
  },
  delete: async (id: string) => {
    await delay();
    const index = meals.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Meal not found');
    meals.splice(index, 1);
    return true;
  }
};

export const sleepApi = {
  getAll: async () => {
    await delay();
    return [...sleepEntries];
  },
  getLatest: async () => {
    await delay();
    return [...sleepEntries].sort((a, b) => b.bedTime.getTime() - a.bedTime.getTime())[0];
  },
  create: async (entry: Omit<SleepEntry, 'id'>) => {
    await delay();
    const newEntry: SleepEntry = { ...entry, id: 'sleep' + Date.now() };
    sleepEntries.push(newEntry);
    return newEntry;
  }
};

export const metabolismApi = {
  getCurrent: async () => {
    await delay();
    return [...metabolismStates].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  },
  getByDate: async (date: Date) => {
    await delay();
    return metabolismStates.find(m => m.date.toDateString() === date.toDateString());
  }
};

export const adviceApi = {
  getAll: async () => {
    await delay();
    return [...advice];
  },
  getActive: async () => {
    await delay();
    return advice.filter(a => !a.acknowledged);
  },
  acknowledge: async (id: string) => {
    await delay();
    const item = advice.find(a => a.id === id);
    if (item) item.acknowledged = true;
    return item;
  }
};

export const dailySummaryApi = {
  getSummary: async (date: Date): Promise<DailySummary> => {
    await delay();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    const daysWorkouts = workoutSessions.filter(w => w.startedAt >= startOfDay && w.startedAt <= endOfDay);
    const daysMeals = meals.filter(m => m.loggedAt >= startOfDay && m.loggedAt <= endOfDay);
    const daysSleep = sleepEntries.find(s => s.bedTime >= startOfDay && s.bedTime <= endOfDay);
    const metabolism = await metabolismApi.getByDate(date) || metabolismStates[0];
    const totalCalories = daysMeals.reduce((sum, m) => sum + m.totalCalories, 0);
    const totalProtein = daysMeals.reduce((sum, m) => sum + m.totalProtein, 0);
    const totalVolume = daysWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    return { date, workouts: daysWorkouts, meals: daysMeals, sleep: daysSleep, metabolism, totalCalories, totalProtein, totalVolume };
  }
};
