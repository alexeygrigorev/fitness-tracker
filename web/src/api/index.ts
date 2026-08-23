import type {
  FoodItem,
  WorkoutSession,
  WorkoutPreset,
  Meal,
  MealFoodItem,
  MealCategory,
  WorkoutSet,
  SleepEntry,
  DailySummary,
  MealTemplate,
  User,
  Exercise,
  AiFoodAnalysis,
  AiMealAnalysis
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function getHeaders(json = true): Promise<HeadersInit> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
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
  // 204 No Content responses have no body (e.g., DELETE)
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface SerializedMealFood {
  foodId?: string | number;
  grams?: string | number;
}

interface SerializedMealRecord extends Omit<Meal, 'id' | 'foods'> {
  id?: string | number;
  category?: MealCategory;
  food_items?: SerializedMealFood[];
}

interface CreateMealRequest {
  name: string;
  mealType: MealCategory;
  foods: MealFoodItem[];
  loggedAt?: Date | string | number;
  date?: string;
  notes?: string;
  source?: Meal['source'];
}

interface DailyNutritionTotals {
  calories: number;
  protein_g: number;
}

function roundMeasurement(value: number): number {
  return Number(value.toFixed(2));
}

function calculateWorkoutVolume(workout: WorkoutSession): number {
  return workout.sets.reduce((total, workoutSet) => {
    if (workoutSet.setType === 'warmup' || workoutSet.loggedAt == null) {
      return total;
    }

    let setVolume =
      Number(workoutSet.weight ?? 0) * Number(workoutSet.reps ?? 0);

    if (workoutSet.setType === 'dropdown') {
      setVolume += (workoutSet.dropdownWeights ?? []).reduce(
        (dropdownTotal, dropdown) =>
          dropdownTotal +
          Number(dropdown.weight ?? 0) * Number(dropdown.reps ?? 0),
        0,
      );
    }

    return total + setVolume;
  }, 0);
}

function normalizeMealRecord(record: SerializedMealRecord): Meal {
  const { food_items: foodItems, ...frontendRecord } = record;
  const foods = (foodItems ?? []).map((item) => ({
    foodId: String(item.foodId),
    grams: Number(item.grams),
  }));
  return {
    ...frontendRecord,
    id: String(frontendRecord.id),
    foods,
  } as Meal;
}

function normalizeTemplateRecord(record: SerializedMealRecord): MealTemplate {
  const normalized = normalizeMealRecord(record);
  return {
    id: normalized.id,
    name: normalized.name,
    category: record.category ?? normalized.mealType,
    foods: normalized.foods,
  };
}

function normalizeFoodRecord(record: Record<string, unknown>): FoodItem {
  return {
    ...record,
    id: String(record.id),
  } as FoodItem;
}

function serializeFoodsPayload<T extends { foods?: MealFoodItem[] }>(payload: T) {
  const { foods, ...rest } = payload;
  if (!foods) {
    return rest;
  }
  return {
    ...rest,
    food_items: foods.map((food, index) => ({
      foodId: Number(food.foodId),
      grams: Number(food.grams),
      order: index,
    })),
  };
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE}/api/auth/login/`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    return data.access;
  },

  register: async (email: string, username: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/register/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ email, username, password, password_confirm: password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(error.detail || error.error || 'Registration failed');
    }

    return response.json();
  },

  getMe: async () => {
    const response = await fetch(`${API_BASE}/api/auth/me/`, {
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  },

  updateProfile: async (updates: { dark_mode?: boolean }) => {
    const response = await fetch(`${API_BASE}/api/auth/me/update/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    return response.json();
  },

  // Store auth data
  setAuth: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Clear auth data
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get stored token
  getToken: () => localStorage.getItem('token'),

  // Store token (used before we have user data)
  setToken: (token: string) => {
    localStorage.setItem('token', token);
  },

  // Get stored user
  getStoredUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

// Exercises API
export const exercisesApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (data: Omit<Exercise, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  update: async (id: number, data: Partial<Exercise>) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/${id}/`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  analyzeWithAI: async (input: { images?: File[]; description?: string }): Promise<Partial<Exercise>> => {
    const response = await fetch(`${API_BASE}/api/ai/analyze-exercise/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ description: input.description || '' }),
    });
    return handleResponse(response);
  }
};

// Workouts API
export const workoutsApi = {
  getAll: async (): Promise<WorkoutSession[]> => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (session: Omit<WorkoutSession, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(session),
    });
    return handleResponse(response);
  },
  delete: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  update: async (id: number, updates: Partial<WorkoutSession>) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },
  finish: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/finish/`, {
      method: 'POST',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  completeSet: async (sessionId: number, setId: number, data?: { weight?: number; reps?: number; dropdownWeights?: Array<{ weight: number; reps: number }> }) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${sessionId}/sets/${setId}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: data ? JSON.stringify(data) : JSON.stringify({}),
    });
    return handleResponse(response);
  },
  uncompleteSet: async (sessionId: number, setId: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${sessionId}/sets/${setId}/completion/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  // Add a new set to an active workout session
  addSet: async (sessionId: number, setData: { exerciseId: number; setType: string; weight?: number; reps: number; dropdownWeights?: Array<{ weight: number; reps: number }> }) => {
    const response = await fetch(`${API_BASE}/api/workouts/sets/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        session: sessionId,
        exerciseId: setData.exerciseId,
        setType: setData.setType,
        weight: setData.weight,
        reps: setData.reps,
        dropdownWeights: setData.dropdownWeights,
      }),
    });
    return handleResponse(response);
  },
  deleteSet: async (setId: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/sets/${setId}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getActive: async () => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/active/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  }
};

// Workout Presets API
export const workoutPresetsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getTemplates: async () => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/templates/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (preset: Omit<WorkoutPreset, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(preset),
    });
    return handleResponse(response);
  },
  update: async (id: number, updates: Partial<WorkoutPreset>) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },
  delete: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  startWorkout: async (id: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/start_workout/`, {
      method: 'POST',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  createFromTemplate: async (templateId: number) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/create_from_template/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ template_id: templateId }),
    });
    return handleResponse(response);
  }
};

// Workout Calculations API
export const workoutCalculationsApi = {
  calculateVolume: async (sets: WorkoutSet[]) => {
    const response = await fetch(`${API_BASE}/api/workouts/calculations/calculate-volume/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ sets }),
    });
    return handleResponse(response);
  }
};

// Active Workout State API - now server-side for cross-device persistence
export const activeWorkoutStateApi = {
  // TODO update
};

// Food API
export const foodApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/food/foods/`, {
      headers: await getHeaders(),
    });
    const foods = await handleResponse(response);
    return foods.map(normalizeFoodRecord);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      headers: await getHeaders(),
    });
    const food = await handleResponse(response);
    return normalizeFoodRecord(food);
  },
  search: async (query: string) => {
    // Search is done client-side for now
    const foods = await foodApi.getAll();
    return foods.filter((f: FoodItem) =>
      f.name.toLowerCase().includes(query.toLowerCase())
    );
  },
  create: async (food: Omit<FoodItem, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/food/foods/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(food),
    });
    const created = await handleResponse(response);
    return normalizeFoodRecord(created);
  },
  update: async (id: string, updates: Partial<FoodItem>) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    const updated = await handleResponse(response);
    return normalizeFoodRecord(updated);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  analyzeWithAI: async (params: { images?: File[]; description: string }): Promise<AiFoodAnalysis> => {
    const response = await fetch(`${API_BASE}/api/ai/analyze-food/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ description: params.description }),
    });
    return handleResponse(response);
  }
};

// Meal Templates API
export const mealTemplatesApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/food/templates/`, {
      headers: await getHeaders(),
    });
    const templates = await handleResponse(response);
    return templates.map(normalizeTemplateRecord);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/templates/${id}/`, {
      headers: await getHeaders(),
    });
    const template = await handleResponse(response);
    return normalizeTemplateRecord(template);
  },
  create: async (template: Omit<MealTemplate, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/food/templates/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(serializeFoodsPayload(template)),
    });
    const created = await handleResponse(response);
    return normalizeTemplateRecord(created);
  },
  update: async (id: string, updates: Partial<MealTemplate>) => {
    const response = await fetch(`${API_BASE}/api/food/templates/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(serializeFoodsPayload(updates)),
    });
    const updated = await handleResponse(response);
    return normalizeTemplateRecord(updated);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/templates/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  calculateNutrition: async (request: { foods: MealFoodItem[] }) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/calculate-nutrition/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        food_items: request.foods.map((food) => ({
          food_id: Number(food.foodId),
          grams: Number(food.grams),
        })),
      }),
    });
    const totals = await handleResponse(response);
    return {
      totalCalories: Number(totals.total_calories),
      totalProtein: Number(totals.total_protein_g),
      totalCarbs: Number(totals.total_carbs_g),
      totalFat: Number(totals.total_fat_g),
    };
  }
};

// Meals API
export const mealsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/food/meals/`, {
      headers: await getHeaders(),
    });
    const meals = await handleResponse(response);
    return meals.map(normalizeMealRecord);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/meals/${id}/`, {
      headers: await getHeaders(),
    });
    const meal = await handleResponse(response);
    return normalizeMealRecord(meal);
  },
  getByDate: async (date: Date): Promise<Meal[]> => {
    const dateStr = toDateKey(date);
    const response = await fetch(`${API_BASE}/api/food/meals/date/${dateStr}/`, {
      headers: await getHeaders(),
    });
    const meals = await handleResponse(response);
    return meals.map(normalizeMealRecord);
  },
  getDailyTotals: async (date: Date): Promise<DailyNutritionTotals> => {
    const dateStr = toDateKey(date);
    const response = await fetch(`${API_BASE}/api/food/meals/daily/totals/${dateStr}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (meal: CreateMealRequest) => {
    // A Date represents the user's selected local day; an ISO instant would
    // let a UTC-only backend assign it to the neighboring calendar day.
    const { loggedAt, ...mealData } = meal;
    const serializedMeal = {
      ...mealData,
      date: mealData.date ?? toDateKey(new Date(loggedAt ?? Date.now())),
    };
    const response = await fetch(`${API_BASE}/api/food/meals/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(serializeFoodsPayload(serializedMeal)),
    });
    const created = await handleResponse(response);
    return normalizeMealRecord(created);
  },
  update: async (id: string, updates: Partial<Meal>) => {
    const response = await fetch(`${API_BASE}/api/food/meals/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(serializeFoodsPayload(updates)),
    });
    const updated = await handleResponse(response);
    return normalizeMealRecord(updated);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/meals/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  }
};

// Food Calculations API
export const foodCalculationsApi = {
  calculateCalories: async (protein: number, carbs: number, fat: number) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/calculate-calories/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ protein_g: protein, carbs_g: carbs, fat_g: fat }),
    });
    return handleResponse(response);
  },
  detectCategory: async (protein: number, carbs: number, fat: number) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/detect-category/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ protein_g: protein, carbs_g: carbs, fat_g: fat }),
    });
    return handleResponse(response);
  },
  inferMetabolism: async (name: string, fat: number, carbs: number, protein: number, fiber: number, sugar?: number) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/infer-metabolism/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ food_type: name, fat_g: fat, carbs_g: carbs, protein_g: protein, fiber_g: fiber, sugar_g: sugar }),
    });
    return handleResponse(response);
  },
};

// Sleep API (not implemented in backend yet)
export const sleepApi = {
  getAll: async () => [],
  getLatest: async () => null,
  create: async (entry: Omit<SleepEntry, 'id'>): Promise<SleepEntry> => ({
    ...entry,
    id: `sleep${Date.now()}`,
  })
};

// Metabolism API (not implemented in backend yet)
export const metabolismApi = {
  getCurrent: async () => null,
  getByDate: async () => null
};

// Workout Plans API
export const workoutPlansApi = {
  // TODO
};

// Advice API (not implemented in backend yet)
export const adviceApi = {
  getAll: async () => [],
  getActive: async () => [],
  acknowledge: async (id: string) => ({ id, acknowledged: true })
};

// AI Meal Analysis
export const analyzeMealWithAI = async (description: string): Promise<AiMealAnalysis> => {
  const response = await fetch(`${API_BASE}/api/ai/analyze-meal/`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ description }),
  });
  return handleResponse(response);
};

export const aiMealApi = {
  analyzeMeal: analyzeMealWithAI
};

// Last Used Weights API (backend for cross-device sync)
export const lastUsedWeightsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/auth/exercise-settings/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  set: async (exerciseId: string, data: { weight?: number; reps: number; subSets?: Array<{ weight: number; reps: number }> }) => {
    const response = await fetch(`${API_BASE}/api/auth/exercise-settings/${exerciseId}/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// Sleep and metabolism still have frontend-only APIs, so those summary fields
// remain empty until corresponding backend records exist.
export const dailySummaryApi = {
  getSummary: async (date: Date): Promise<DailySummary> => {
    const [meals, dailyTotals, allWorkouts] = await Promise.all([
      mealsApi.getByDate(date),
      mealsApi.getDailyTotals(date),
      workoutsApi.getAll(),
    ]);
    const workouts = allWorkouts
      .filter((workout) => {
        const startedAt = new Date(workout.startedAt);
        return (
          startedAt.getFullYear() === date.getFullYear() &&
          startedAt.getMonth() === date.getMonth() &&
          startedAt.getDate() === date.getDate()
        );
      })
      .sort((first, second) =>
        new Date(second.startedAt).getTime() -
        new Date(first.startedAt).getTime(),
      )
      .map((workout) => {
        const totalVolume = roundMeasurement(calculateWorkoutVolume(workout));
        return { ...workout, totalVolume };
      });

    return {
      date,
      workouts,
      meals,
      sleep: undefined,
      metabolism: null,
      totalCalories: Number(dailyTotals.calories),
      totalProtein: Number(dailyTotals.protein_g),
      totalVolume: roundMeasurement(
        workouts.reduce(
          (total, workout) => total + (workout.totalVolume ?? 0),
          0,
        ),
      ),
    };
  },
};
