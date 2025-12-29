"""
Food items CRUD endpoints.
All food item management with automatic calculations.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.food import (
    FoodItem, FoodItemCreate, FoodItemUpdate,
    CalculateNutritionRequest, TemplateNutritionResponse
)
from app.services.nutrition import (
    calculate_meal_nutrition, calculate_calories_per_portion
)

router = APIRouter()

# Mock data - replace with database later
MOCK_FOODS: Dict[int, List[FoodItem]] = {}
FOOD_ID_COUNTER = 1


def get_user_foods(user_id: int) -> List[FoodItem]:
    """Get foods for a specific user."""
    return MOCK_FOODS.get(user_id, [])


@router.get("", response_model=List[FoodItem])
async def get_foods(current_user: User = Depends(get_current_user)):
    """Get all food items for the current user."""
    return get_user_foods(current_user.id)


@router.get("/{food_id}", response_model=FoodItem)
async def get_food(food_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific food item by ID."""
    for food in get_user_foods(current_user.id):
        if food.id == food_id:
            return food
    raise HTTPException(status_code=404, detail="Food item not found")


@router.post("", response_model=FoodItem, status_code=201)
async def create_food(food: FoodItemCreate, current_user: User = Depends(get_current_user)):
    """Create a new food item."""
    global FOOD_ID_COUNTER

    # Calculate calories per portion
    calories_per_portion = calculate_calories_per_portion(
        food.calories,
        food.servingSize
    )

    new_food = FoodItem(
        id=f"food-{FOOD_ID_COUNTER}",
        name=food.name,
        category=food.category,
        servingSize=food.servingSize,
        servingType=food.servingType,
        calories=food.calories,
        protein=food.protein,
        carbs=food.carbs,
        fat=food.fat,
        saturatedFat=food.saturatedFat,
        sugar=food.sugar,
        fiber=food.fiber,
        sodium=food.sodium,
        brand=food.brand,
        barcode=food.barcode,
        source=food.source,
        caloriesPerPortion=calories_per_portion,
        metabolism=food.metabolism
    )
    FOOD_ID_COUNTER += 1

    # Add to user's foods
    if current_user.id not in MOCK_FOODS:
        MOCK_FOODS[current_user.id] = []
    MOCK_FOODS[current_user.id].append(new_food)
    return new_food


@router.patch("/{food_id}", response_model=FoodItem)
async def update_food(
    food_id: str,
    food: FoodItemUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing food item."""
    if current_user.id not in MOCK_FOODS:
        raise HTTPException(status_code=404, detail="Food item not found")

    for i, f in enumerate(MOCK_FOODS[current_user.id]):
        if f.id == food_id:
            # Get existing food
            existing = MOCK_FOODS[current_user.id][i]

            # Update only provided fields
            update_data = food.model_dump(exclude_unset=True)

            # Recalculate calories per portion if serving size or calories changed
            if 'servingSize' in update_data or 'calories' in update_data:
                new_serving_size = update_data.get('servingSize', existing.servingSize)
                new_calories = update_data.get('calories', existing.calories)
                update_data['caloriesPerPortion'] = calculate_calories_per_portion(
                    new_calories, new_serving_size
                )

            for field, value in update_data.items():
                setattr(MOCK_FOODS[current_user.id][i], field, value)

            return MOCK_FOODS[current_user.id][i]

    raise HTTPException(status_code=404, detail="Food item not found")


@router.delete("/{food_id}", status_code=204)
async def delete_food(food_id: str, current_user: User = Depends(get_current_user)):
    """Delete a food item."""
    if current_user.id not in MOCK_FOODS:
        raise HTTPException(status_code=404, detail="Food item not found")

    for i, f in enumerate(MOCK_FOODS[current_user.id]):
        if f.id == food_id:
            MOCK_FOODS[current_user.id].pop(i)
            return

    raise HTTPException(status_code=404, detail="Food item not found")


@router.post("/calculate-nutrition", response_model=TemplateNutritionResponse)
async def calculate_food_nutrition(
    request: CalculateNutritionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate total nutrition for a list of foods with amounts.
    Useful for meal templates and meal logging.
    """
    # Get user's foods as the database
    food_items = get_user_foods(current_user.id)

    totals = calculate_meal_nutrition(request.foods, food_items)
    return TemplateNutritionResponse(totals=totals)
