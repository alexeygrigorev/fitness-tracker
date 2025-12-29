from app.schemas.auth import Token, TokenData, User, UserCreate, UserLogin
from app.schemas.workout import (
    WorkoutSet, WorkoutSession, WorkoutSessionCreate, WorkoutSessionUpdate,
    WorkoutPreset, WorkoutPresetExercise,
    ActiveWorkoutState, ActiveWorkoutUpdate,
    CalculateVolumeRequest, CalculateVolumeResponse,
    BuildWorkoutFromPresetRequest, BuildWorkoutResponse, SetRowItem,
    AnalyzeExerciseRequest, AnalyzeExerciseResponse
)
from app.schemas.food import (
    FoodItem, FoodItemCreate, FoodItemUpdate,
    Meal, MealCreate, MealUpdate,
    MealTemplate, MealTemplateCreate, MealTemplateUpdate,
    MealFoodItem, MealFoodItemBase,
    MetabolismAttributes, NutritionTotals,
    CalculateCaloriesRequest, CalculateCaloriesResponse,
    DetectCategoryRequest, DetectCategoryResponse,
    InferMetabolismRequest,
    CalculateNutritionRequest, TemplateNutritionResponse,
    DailyTotalsResponse,
    AnalyzeFoodRequest, AnalyzeFoodResponse,
    AnalyzeMealRequest, AnalyzeMealResponse
)
from app.schemas.exercise import Exercise, ExerciseCreate, ExerciseUpdate

__all__ = [
    # Auth
    "Token", "TokenData", "User", "UserCreate", "UserLogin",
    # Workouts
    "WorkoutSet", "WorkoutSession", "WorkoutSessionCreate", "WorkoutSessionUpdate",
    "WorkoutPreset", "WorkoutPresetExercise",
    "ActiveWorkoutState", "ActiveWorkoutUpdate",
    "CalculateVolumeRequest", "CalculateVolumeResponse",
    "BuildWorkoutFromPresetRequest", "BuildWorkoutResponse", "SetRowItem",
    "AnalyzeExerciseRequest", "AnalyzeExerciseResponse",
    # Food & Nutrition
    "FoodItem", "FoodItemCreate", "FoodItemUpdate",
    "Meal", "MealCreate", "MealUpdate",
    "MealTemplate", "MealTemplateCreate", "MealTemplateUpdate",
    "MealFoodItem", "MealFoodItemBase",
    "MetabolismAttributes", "NutritionTotals",
    "CalculateCaloriesRequest", "CalculateCaloriesResponse",
    "DetectCategoryRequest", "DetectCategoryResponse",
    "InferMetabolismRequest",
    "CalculateNutritionRequest", "TemplateNutritionResponse",
    "DailyTotalsResponse",
    "AnalyzeFoodRequest", "AnalyzeFoodResponse",
    "AnalyzeMealRequest", "AnalyzeMealResponse",
    # Exercises
    "Exercise", "ExerciseCreate", "ExerciseUpdate"
]
