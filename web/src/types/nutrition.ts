// Nutrition-related types

export type FoodCategory = 'carb' | 'protein' | 'fat' | 'mixed' | 'beverage';

export type FoodSource = 'canonical' | 'user' | 'ai_generated';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'post_workout' | 'beverage';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  brand?: string;
  barcode?: string;
  source?: FoodSource;
  servingSize: number;
  servingType: string;
  calories: number;
  caloriesPerPortion?: number;
  fat: number;
  saturatedFat?: number;
  carbs: number;
  sugar?: number;
  fiber?: number;
  protein: number;
  sodium?: number;
  glycemicIndex?: number;
  absorptionSpeed?: 'slow' | 'moderate' | 'fast';
  insulinResponse?: number;
  satietyScore?: number;
  proteinQuality?: 1 | 2 | 3; // 1=low/incomplete, 2=moderate, 3=high/complete (best for muscle building)
}

export interface MealFoodItem {
  foodId: string;
  grams: number; // Store grams directly, not portions - so changing food serving size doesn't affect templates
}

export type AiAnalyzedFood = Omit<FoodItem, 'id' | 'source' | 'brand'> & {
  brand?: string | null;
  grams: number;
};

export type AiFoodAnalysis = Omit<FoodItem, 'id' | 'source' | 'brand'> & {
  brand?: string | null;
};

// The resolution endpoint accepts a fully analyzed meal food, including its
// portion weight, even though the persisted FoodItem itself has no grams.
export type AiMealIngredient = AiAnalyzedFood;

export interface AiMealAnalysis {
  name: string;
  mealType: MealCategory;
  foods: AiAnalyzedFood[];
}

export interface Meal {
  id: string;
  name: string;
  mealType: MealCategory;
  date: string;
  foods: MealFoodItem[];
  loggedAt: Date;
  eventTime?: Date;
  notes?: string;
  source?: 'manual' | 'ai_assisted';
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  category: MealCategory;
  foods: MealFoodItem[];
}
