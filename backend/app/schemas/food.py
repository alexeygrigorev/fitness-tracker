from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class FoodCategory(str):
    """Food category types"""
    pass


FoodCategory = Literal['carb', 'protein', 'fat', 'mixed', 'beverage']


class FoodSource(str):
    """Source of the food data"""
    pass


FoodSource = Literal['canonical', 'user', 'ai_generated']


class MealCategory(str):
    """Meal category types"""
    pass


MealCategory = Literal['breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'beverage']


# Helper types for food calculations
class MetabolismAttributes(BaseModel):
    """Metabolism-related attributes for food items"""
    glycemicIndex: Optional[int] = Field(None, ge=0, le=100, description="Glycemic index (0-100)")
    absorptionSpeed: Optional[Literal['slow', 'moderate', 'fast']] = Field(None, description="Speed of absorption")
    insulinResponse: Optional[int] = Field(None, ge=0, le=100, description="Insulin response score (0-100)")
    satietyScore: Optional[int] = Field(None, ge=0, le=10, description="Satiety score (0-10)")
    proteinQuality: Optional[Literal[1, 2, 3]] = Field(None, description="Protein quality: 1=low/incomplete, 2=moderate, 3=high/complete")


class NutritionTotals(BaseModel):
    """Aggregated nutrition totals"""
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0


# Food Item schemas
class FoodItemBase(BaseModel):
    name: str
    category: FoodCategory
    servingSize: int = Field(default=100, description="Serving size in grams")
    servingType: str = Field(default="g", description="Serving type description")
    calories: int
    protein: float
    carbs: float
    fat: float
    saturatedFat: Optional[float] = None
    sugar: Optional[float] = None
    fiber: Optional[float] = None
    sodium: Optional[float] = None


class FoodItemCreate(FoodItemBase):
    brand: Optional[str] = None
    barcode: Optional[str] = None
    source: FoodSource = 'user'
    metabolism: Optional[MetabolismAttributes] = None


class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[FoodCategory] = None
    servingSize: Optional[int] = None
    servingType: Optional[str] = None
    calories: Optional[int] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    saturatedFat: Optional[float] = None
    sugar: Optional[float] = None
    fiber: Optional[float] = None
    sodium: Optional[float] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    metabolism: Optional[MetabolismAttributes] = None


class FoodItem(FoodItemBase):
    id: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    source: FoodSource
    caloriesPerPortion: Optional[int] = None
    metabolism: Optional[MetabolismAttributes] = None

    model_config = {"from_attributes": True}


# Meal Food Item (for meals and templates)
class MealFoodItemBase(BaseModel):
    foodId: str
    grams: float = Field(description="Amount in grams")


class MealFoodItem(MealFoodItemBase):
    id: Optional[str] = None
    food: Optional[FoodItem] = None

    model_config = {"from_attributes": True}


# Meal schemas
class MealBase(BaseModel):
    name: str
    mealType: MealCategory
    foods: List[MealFoodItemBase]
    loggedAt: datetime
    notes: Optional[str] = None


class MealCreate(MealBase):
    source: Literal['manual', 'ai_assisted'] = 'manual'


class MealUpdate(BaseModel):
    name: Optional[str] = None
    mealType: Optional[MealCategory] = None
    foods: Optional[List[MealFoodItemBase]] = None
    loggedAt: Optional[datetime] = None
    notes: Optional[str] = None


class Meal(MealBase):
    id: str
    source: Literal['manual', 'ai_assisted']
    totalCalories: float
    totalProtein: float
    totalCarbs: float
    totalFat: float

    model_config = {"from_attributes": True}


# Meal Template schemas
class MealTemplateBase(BaseModel):
    name: str
    category: MealCategory
    foods: List[MealFoodItemBase]


class MealTemplateCreate(MealTemplateBase):
    pass


class MealTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[MealCategory] = None
    foods: Optional[List[MealFoodItemBase]] = None


class MealTemplate(MealTemplateBase):
    id: str

    model_config = {"from_attributes": True}


# Calculation request/response schemas
class CalculateCaloriesRequest(BaseModel):
    protein: float
    carbs: float
    fat: float


class CalculateCaloriesResponse(BaseModel):
    calories: int


class DetectCategoryRequest(BaseModel):
    protein: float
    carbs: float
    fat: float


class DetectCategoryResponse(BaseModel):
    category: FoodCategory


class InferMetabolismRequest(BaseModel):
    name: str
    fat: float
    carbs: float
    protein: float
    fiber: float
    sugar: Optional[float] = None


class CalculateNutritionRequest(BaseModel):
    """Request to calculate nutrition for a list of foods with amounts"""
    foods: List[MealFoodItemBase]
    foodDatabase: List[FoodItem] = Field(default_factory=list, description="Available food items for lookup")


class TemplateNutritionResponse(BaseModel):
    """Nutrition totals for a template or meal"""
    totals: NutritionTotals


class DailyTotalsResponse(BaseModel):
    """Daily nutrition totals"""
    date: str
    totals: NutritionTotals
    mealCount: int


# AI Analysis schemas
class AnalyzeFoodRequest(BaseModel):
    description: str


class AnalyzeFoodResponse(BaseModel):
    name: str
    calories: int
    protein: float
    carbs: float
    fat: float
    saturatedFat: Optional[float] = None
    sugar: Optional[float] = None
    fiber: Optional[float] = None
    servingSize: int
    servingType: str
    category: FoodCategory
    metabolism: Optional[MetabolismAttributes] = None
    confidence: float = Field(default=0.5, ge=0, le=1)


class AnalyzeMealRequest(BaseModel):
    description: str


class AnalyzeMealResponse(BaseModel):
    name: str
    mealType: MealCategory
    foods: List[MealFoodItemBase]
    confidence: float
