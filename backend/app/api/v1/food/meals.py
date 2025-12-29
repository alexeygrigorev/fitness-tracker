"""
Meals CRUD endpoints.
Meal logging with automatic nutrition calculations.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from datetime import datetime
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.food import (
    Meal, MealCreate, MealUpdate, MealFoodItemBase, NutritionTotals
)
from app.api.v1.food.foods import MOCK_FOODS, get_user_foods
from app.services.nutrition import calculate_meal_nutrition

router = APIRouter()

# Mock data - replace with database later
MOCK_MEALS: Dict[int, List[Meal]] = {}
MEAL_ID_COUNTER = 1


def get_user_meals(user_id: int) -> List[Meal]:
    """Get meals for a specific user."""
    return MOCK_MEALS.get(user_id, [])


@router.get("", response_model=List[Meal])
async def get_meals(current_user: User = Depends(get_current_user)):
    """Get all meals for the current user."""
    return get_user_meals(current_user.id)


@router.get("/{meal_id}", response_model=Meal)
async def get_meal(meal_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific meal by ID."""
    for meal in get_user_meals(current_user.id):
        if meal.id == meal_id:
            return meal
    raise HTTPException(status_code=404, detail="Meal not found")


@router.get("/date/{date_str}", response_model=List[Meal])
async def get_meals_by_date(date_str: str, current_user: User = Depends(get_current_user)):
    """Get meals for a specific date (format: YYYY-MM-DD)."""
    try:
        target_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    meals = get_user_meals(current_user.id)
    return [
        meal for meal in meals
        if meal.loggedAt.date() == target_date.date()
    ]


@router.post("", response_model=Meal, status_code=201)
async def create_meal(meal: MealCreate, current_user: User = Depends(get_current_user)):
    """Create a new meal with automatic nutrition calculation."""
    global MEAL_ID_COUNTER

    # Get user's foods for nutrition calculation
    food_items = get_user_foods(current_user.id)

    # Calculate nutrition
    totals = calculate_meal_nutrition(meal.foods, food_items)

    new_meal = Meal(
        id=f"meal-{MEAL_ID_COUNTER}",
        name=meal.name,
        mealType=meal.mealType,
        foods=meal.foods,
        loggedAt=meal.loggedAt,
        notes=meal.notes,
        source=meal.source,
        totalCalories=round(totals.calories, 1),
        totalProtein=round(totals.protein, 1),
        totalCarbs=round(totals.carbs, 1),
        totalFat=round(totals.fat, 1)
    )
    MEAL_ID_COUNTER += 1

    # Add to user's meals
    if current_user.id not in MOCK_MEALS:
        MOCK_MEALS[current_user.id] = []
    MOCK_MEALS[current_user.id].append(new_meal)
    return new_meal


@router.patch("/{meal_id}", response_model=Meal)
async def update_meal(
    meal_id: str,
    meal: MealUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing meal."""
    if current_user.id not in MOCK_MEALS:
        raise HTTPException(status_code=404, detail="Meal not found")

    for i, m in enumerate(MOCK_MEALS[current_user.id]):
        if m.id == meal_id:
            # Update only provided fields
            update_data = meal.model_dump(exclude_unset=True)

            # Recalculate nutrition if foods changed
            if 'foods' in update_data:
                food_items = get_user_foods(current_user.id)
                totals = calculate_meal_nutrition(update_data['foods'], food_items)
                update_data['totalCalories'] = round(totals.calories, 1)
                update_data['totalProtein'] = round(totals.protein, 1)
                update_data['totalCarbs'] = round(totals.carbs, 1)
                update_data['totalFat'] = round(totals.fat, 1)

            for field, value in update_data.items():
                setattr(MOCK_MEALS[current_user.id][i], field, value)

            return MOCK_MEALS[current_user.id][i]

    raise HTTPException(status_code=404, detail="Meal not found")


@router.delete("/{meal_id}", status_code=204)
async def delete_meal(meal_id: str, current_user: User = Depends(get_current_user)):
    """Delete a meal."""
    if current_user.id not in MOCK_MEALS:
        raise HTTPException(status_code=404, detail="Meal not found")

    for i, m in enumerate(MOCK_MEALS[current_user.id]):
        if m.id == meal_id:
            MOCK_MEALS[current_user.id].pop(i)
            return

    raise HTTPException(status_code=404, detail="Meal not found")


@router.get("/daily/totals/{date_str}")
async def get_daily_totals(date_str: str, current_user: User = Depends(get_current_user)):
    """
    Get daily nutrition totals for a specific date.
    Aggregates all meals for the day.
    """
    try:
        target_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    meals = get_user_meals(current_user.id)
    meals_for_date = [
        meal for meal in meals
        if meal.loggedAt.date() == target_date.date()
    ]

    totals = NutritionTotals(
        calories=round(sum(m.totalCalories for m in meals_for_date), 1),
        protein=round(sum(m.totalProtein for m in meals_for_date), 1),
        carbs=round(sum(m.totalCarbs for m in meals_for_date), 1),
        fat=round(sum(m.totalFat for m in meals_for_date), 1)
    )

    return {
        "date": date_str,
        "totals": totals,
        "mealCount": len(meals_for_date)
    }
