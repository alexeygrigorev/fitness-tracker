import type {
  FoodItem,
  WorkoutSession,
  WorkoutProgram,
  WorkoutPreset,
  Meal,
  MealFoodItem,
  WorkoutSet,
  DailySummary,
  MealTemplate,
  Exercise
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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
  return response.json();
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
      body: JSON.stringify({ email, username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(error.detail || 'Registration failed');
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

  // Store auth data
  setAuth: (token: string, user: any) => {
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
  getById: async (id: string) => {
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
  update: async (id: string, data: Partial<Exercise>) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/${id}/`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/workouts/exercises/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  analyzeWithAI: async (input: { images?: File[]; description?: string }) => {
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
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
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
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<WorkoutSession>) => {
    const response = await fetch(`${API_BASE}/api/workouts/sessions/${id}/`, {
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
    const response = await fetch(`${API_BASE}/api/workouts/presets/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
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
  update: async (id: string, updates: Partial<WorkoutPreset>) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  startWorkout: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/workouts/presets/${id}/start_workout/`, {
      method: 'POST',
      headers: await getHeaders(),
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

// Active Workout State API (client-side for now)
export const activeWorkoutStateApi = {
  get: async () => {
    const state = localStorage.getItem('activeWorkout');
    return state ? JSON.parse(state) : null;
  },
  save: async (state: any) => {
    localStorage.setItem('activeWorkout', JSON.stringify(state));
    return state;
  },
  update: async (updates: any) => {
    const current = await activeWorkoutStateApi.get();
    const updated = { ...current, ...updates };
    localStorage.setItem('activeWorkout', JSON.stringify(updated));
    return updated;
  },
  clear: async () => {
    localStorage.removeItem('activeWorkout');
    return true;
  }
};

// Food API
export const foodApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/food/foods/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
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
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<FoodItem>) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/foods/${id}/`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  analyzeWithAI: async (params: { images?: File[]; description: string }) => {
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
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/templates/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (template: Omit<MealTemplate, 'id'>) => {
    const response = await fetch(`${API_BASE}/api/food/templates/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(template),
    });
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<MealTemplate>) => {
    const response = await fetch(`${API_BASE}/api/food/templates/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
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
      body: JSON.stringify(request),
    });
    return handleResponse(response);
  }
};

// Meals API
export const mealsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/api/food/meals/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE}/api/food/meals/${id}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getByDate: async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`${API_BASE}/api/food/meals/date/${dateStr}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  getDailyTotals: async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`${API_BASE}/api/food/meals/daily/totals/${dateStr}/`, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
  create: async (meal: any) => {
    const response = await fetch(`${API_BASE}/api/food/meals/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(meal),
    });
    return handleResponse(response);
  },
  update: async (id: string, updates: Partial<Meal>) => {
    const response = await fetch(`${API_BASE}/api/food/meals/${id}/`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
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
      body: JSON.stringify({ protein, carbs, fat }),
    });
    return handleResponse(response);
  },
  detectCategory: async (protein: number, carbs: number, fat: number) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/detect-category/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ protein, carbs, fat }),
    });
    return handleResponse(response);
  },
  inferMetabolism: async (name: string, fat: number, carbs: number, protein: number, fiber: number, sugar?: number) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/infer-metabolism/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, fat, carbs, protein, fiber, sugar }),
    });
    return handleResponse(response);
  },
  calculateNutrition: async (foods: any[], foodDatabase: FoodItem[]) => {
    const response = await fetch(`${API_BASE}/api/food/calculations/calculate-nutrition/`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ foods, foodDatabase }),
    });
    return handleResponse(response);
  }
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
  getByDate: async (_date: Date) => null
};

// Workout Programs API (not implemented in backend yet)
export const workoutProgramsApi = {
  getAll: async () => [],
  getById: async (_id: string) => null,
  create: async (program: Omit<WorkoutProgram, 'id'>) => ({ ...program, id: 'wp' + Date.now() } as WorkoutProgram),
  update: async (_id: string, updates: Partial<WorkoutProgram>) => ({ ...updates, id: 'wp' + Date.now() } as WorkoutProgram),
  delete: async (_id: string) => true
};

// Advice API (not implemented in backend yet)
export const adviceApi = {
  getAll: async () => [],
  getActive: async () => [],
  acknowledge: async (id: string) => ({ id, acknowledged: true })
};

// AI Meal Analysis
export const analyzeMealWithAI = async (description: string) => {
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
