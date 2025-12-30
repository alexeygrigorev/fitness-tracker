import type {
  FoodItem,
  WorkoutSession,
  WorkoutProgram,
  WorkoutPreset,
  Meal,
  SleepEntry,
  WorkoutSet,
  DailySummary,
  MealTemplate,
  Exercise
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001';

async function getHeaders(): Promise<HeadersInit> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response: Response) {
  if (response.status === 401) {
    // Token expired or invalid - clear auth and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// Exercises API
export const exercisesApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/exercises`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/exercises/${id}`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (data: Omit<Exercise, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/exercises`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  update: async (id: string, data: Partial<Exercise>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/exercises/${id}`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/exercises/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  analyzeWithAI: async (input: { images?: File[]; description?: string }) => {
    // For now, mock this - could be connected to an AI service later
    return {
      name: input.description?.split(' ').slice(0, 3).join(' ') || 'New Exercise',
      category: 'compound' as const,
      muscleGroups: ['chest'] as const,
      equipment: ['barbell'] as const,
      instructions: ['Perform the exercise with proper form', 'Keep core engaged', 'Breathe steadily']
    };
  }
};

// Workouts API
export const workoutsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/sessions`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/sessions/${id}`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (session: Omit<WorkoutSession, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/sessions`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(session),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/sessions/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<WorkoutSession>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/sessions/${id}`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  }
};

// Workout Presets API
export const workoutPresetsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/presets`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/presets/${id}`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (preset: Omit<WorkoutPreset, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/presets`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(preset),
    });
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<WorkoutPreset>) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/presets/${id}`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/v1/workouts/presets/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  }
};

// Food API (backend doesn't have food endpoints yet - return empty arrays)
export const foodApi = {
  getAll: async () => [],
  getById: async (id: string) => null,
  search: async (query: string) => [],
  create: async (food: Omit<FoodItem, 'id'>) => {
    const newFood: FoodItem = { ...food, id: 'food' + Date.now(), source: food.source || 'user' };
    return newFood;
  },
  update: async (id: string, updates: Partial<FoodItem>) => {
    return { ...updates, id } as FoodItem;
  },
  delete: async (id: string) => true,
  analyzeWithAI: async (params: { images: File[]; description: string }) => ({
    name: params.description.split(' ').slice(0, 3).join(' ') || 'Food Item',
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 3,
    saturatedFat: 1,
    sugar: 2,
    fiber: 2,
    servingSize: 100,
    servingType: 'g',
    glycemicIndex: 50,
    absorptionSpeed: 'moderate' as const,
    insulinResponse: 50,
    satietyScore: 5
  })
};

// Meal Templates API (not implemented in backend yet)
export const mealTemplatesApi = {
  getAll: async () => [],
  getById: async (id: string) => null,
  create: async (template: Omit<MealTemplate, 'id'>) => ({ ...template, id: 'mt' + Date.now() } as MealTemplate),
  update: async (id: string, updates: Partial<MealTemplate>) => ({ ...updates, id } as MealTemplate),
  delete: async (id: string) => true,
  calculateNutrition: async (foods: any[]) => {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    for (const item of foods) {
      const multiplier = item.grams / 100;
      totalCalories += (item.calories || 0) * multiplier;
      totalProtein += (item.protein || 0) * multiplier;
      totalCarbs += (item.carbs || 0) * multiplier;
      totalFat += (item.fat || 0) * multiplier;
    }
    return { totalCalories, totalProtein, totalCarbs, totalFat };
  }
};

// Meals API (not implemented in backend yet)
export const mealsApi = {
  getAll: async () => [],
  getById: async (id: string) => null,
  getByDate: async (date: Date) => [],
  create: async (meal: any) => ({ ...meal, id: 'meal' + Date.now() } as Meal),
  update: async (id: string, updates: Partial<Meal>) => ({ ...updates, id } as Meal),
  delete: async (id: string) => true
};

// Sleep API (not implemented in backend yet)
export const sleepApi = {
  getAll: async () => [],
  getLatest: async () => null,
  create: async (entry: any) => ({ ...entry, id: 'sleep' + Date.now() })
};

// Metabolism API (not implemented in backend yet)
export const metabolismApi = {
  getCurrent: async () => null,
  getByDate: async (date: Date) => null
};

// Workout Programs API (not implemented in backend yet)
export const workoutProgramsApi = {
  getAll: async () => [],
  getById: async (id: string) => null,
  create: async (program: Omit<WorkoutProgram, 'id'>) => ({ ...program, id: 'wp' + Date.now() } as WorkoutProgram),
  update: async (id: string, updates: Partial<WorkoutProgram>) => ({ ...updates, id } as WorkoutProgram),
  delete: async (id: string) => true
};

// Advice API (not implemented in backend yet)
export const adviceApi = {
  getAll: async () => [],
  getActive: async () => [],
  acknowledge: async (id: string) => ({ id, acknowledged: true })
};

// AI Meal Analysis (not implemented in backend yet)
export const analyzeMealWithAI = async (description: string) => ({
  name: description.split(' ').slice(0, 4).join(' ') || 'Custom Meal',
  mealType: 'snack' as const,
  foods: [],
  confidence: 0.5
});

export const aiMealApi = {
  analyzeMeal: analyzeMealWithAI
};

// Daily Summary (not implemented in backend yet)
export const dailySummaryApi = {
  getSummary: async (date: Date): Promise<DailySummary> => ({
    date,
    workouts: [],
    meals: [],
    sleep: undefined,
    metabolism: null,
    totalCalories: 0,
    totalProtein: 0,
    totalVolume: 0
  })
};
