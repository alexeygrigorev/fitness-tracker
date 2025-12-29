"""
Nutrition calculation endpoints.
All nutrition-related calculations that were previously done in frontend.
"""
from fastapi import APIRouter, Depends
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.food import (
    CalculateCaloriesRequest, CalculateCaloriesResponse,
    DetectCategoryRequest, DetectCategoryResponse,
    InferMetabolismRequest, MetabolismAttributes,
    CalculateNutritionRequest, TemplateNutritionResponse
)
from app.services.nutrition import (
    calculate_calories, detect_category, infer_metabolism_attributes,
    calculate_meal_nutrition
)

router = APIRouter()


@router.post("/calories", response_model=CalculateCaloriesResponse)
async def calculate_calories_endpoint(
    request: CalculateCaloriesRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate calories from macronutrients.
    Formula: protein * 4 + carbs * 4 + fat * 9
    """
    calories = calculate_calories(request.protein, request.carbs, request.fat)
    return CalculateCaloriesResponse(calories=calories)


@router.post("/category", response_model=DetectCategoryResponse)
async def detect_category_endpoint(
    request: DetectCategoryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Detect food category based on macro ratios.
    Returns 'protein', 'carb', 'fat', or 'mixed'.
    """
    category = detect_category(request.protein, request.carbs, request.fat)
    return DetectCategoryResponse(category=category)


@router.post("/metabolism", response_model=MetabolismAttributes)
async def infer_metabolism_endpoint(
    request: InferMetabolismRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Infer metabolism attributes from food name and nutritional data.
    Returns glycemic index, absorption speed, insulin response, satiety score, and protein quality.
    """
    return infer_metabolism_attributes(
        request.name,
        request.fat,
        request.carbs,
        request.protein,
        request.fiber,
        request.sugar
    )


@router.post("/nutrition", response_model=TemplateNutritionResponse)
async def calculate_nutrition_endpoint(
    request: CalculateNutritionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate total nutrition for a list of foods with amounts.
    Used for meal templates and meal logging.
    """
    # Pydantic already validates foodDatabase as List[FoodItem]
    totals = calculate_meal_nutrition(request.foods, request.foodDatabase)
    return TemplateNutritionResponse(totals=totals)
