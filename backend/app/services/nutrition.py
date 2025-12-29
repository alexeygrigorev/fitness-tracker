"""
Nutrition calculation services moved from frontend.
All calorie, macro, and nutrition calculations are handled here.
"""
from typing import List, Optional, Literal
from app.schemas.food import (
    FoodItem, MealFoodItemBase, NutritionTotals,
    FoodCategory, MetabolismAttributes
)


def calculate_calories(protein: float, carbs: float, fat: float) -> int:
    """
    Calculate calories from macronutrients.
    Formula: protein * 4 + carbs * 4 + fat * 9
    """
    return round(protein * 4 + carbs * 4 + fat * 9)


def detect_category(protein: float, carbs: float, fat: float) -> FoodCategory:
    """
    Detect food category based on macro ratios (by calories, not grams).
    Returns 'protein', 'carb', 'fat', or 'mixed'.
    """
    # Calculate calories from each macro
    protein_cals = protein * 4
    carb_cals = carbs * 4
    fat_cals = fat * 9

    total_cals = protein_cals + carb_cals + fat_cals
    if total_cals == 0:
        return 'mixed'

    protein_ratio = protein_cals / total_cals
    carb_ratio = carb_cals / total_cals
    fat_ratio = fat_cals / total_cals

    if protein_ratio > 0.4:
        return 'protein'
    if carb_ratio > 0.4:
        return 'carb'
    if fat_ratio > 0.4:
        return 'fat'
    return 'mixed'


def infer_metabolism_attributes(
    name: str,
    fat: float,
    carbs: float,
    protein: float,
    fiber: float,
    sugar: Optional[float] = None
) -> MetabolismAttributes:
    """
    Infer metabolism attributes from food name and nutritional data.
    This implements the same logic that was in FoodItemForm.tsx.
    """
    food_name = name.lower()
    glycemic_index: Optional[int] = None
    absorption_speed: Literal['slow', 'moderate', 'fast'] = 'moderate'
    insulin_response: Optional[int] = None
    satiety_score: Optional[int] = None
    protein_quality: Optional[Literal[1, 2, 3]] = None

    # Common fruits for detection
    fruits = ['banana', 'apple', 'orange', 'pear', 'mango', 'grape', 'berry',
              'strawberry', 'blueberry', 'raspberry', 'watermelon', 'pineapple',
              'peach', 'plum', 'kiwi', 'fruit']

    # High fat foods -> slower absorption, lower GI
    if fat > 15 or food_name in ('oil', 'butter', 'cheese', 'nuts') or \
       any(x in food_name for x in ['oil', 'butter', 'cheese', 'nuts']):
        absorption_speed = 'slow'
        glycemic_index = None
        insulin_response = min(100, 20 + int(fat * 2))
        satiety_score = 7

    # High sugar foods -> fast absorption, high GI
    elif (sugar and sugar > 10) or food_name in ('candy', 'soda', 'cola', 'juice') or \
         any(x in food_name for x in ['candy', 'soda', 'cola', 'juice']):
        absorption_speed = 'fast'
        glycemic_index = 65 + 10  # Using fixed value instead of random
        insulin_response = min(100, 75 + 7)
        satiety_score = 2

    # High fiber foods -> slower absorption
    elif fiber > 5 or food_name in ('beans', 'lentils', 'oats', 'vegetable') or \
         any(x in food_name for x in ['beans', 'lentils', 'oats', 'vegetable']):
        absorption_speed = 'slow'
        glycemic_index = 50
        insulin_response = 47
        satiety_score = 7

    # Protein foods -> moderate absorption
    elif protein > 15 or food_name in ('chicken', 'beef', 'fish', 'egg') or \
         any(x in food_name for x in ['chicken', 'beef', 'fish', 'egg']):
        absorption_speed = 'moderate'
        glycemic_index = None
        insulin_response = 40
        satiety_score = 8

    # Carb foods
    elif carbs > 20:
        if any(x in food_name for x in ['rice', 'bread', 'pasta']):
            absorption_speed = 'moderate'
            glycemic_index = 62
            insulin_response = 65
            satiety_score = 5
        elif any(x in food_name for x in fruits):
            absorption_speed = 'fast'
            glycemic_index = 55
            insulin_response = 60
            satiety_score = 4
        else:
            absorption_speed = 'moderate'
            glycemic_index = 60
            insulin_response = 60
            satiety_score = 5

    # Infer protein quality based on food type
    complete_proteins = ['chicken', 'beef', 'turkey', 'fish', 'salmon', 'tuna',
                        'egg', 'whey', 'casein', 'yogurt', 'cheese', 'cottage']
    moderate_proteins = ['oat', 'bean', 'lentil', 'quinoa', 'soy', 'nuts',
                         'almond', 'bread', 'flour']

    if any(x in food_name for x in complete_proteins):
        protein_quality = 3  # Complete proteins, best for muscle building
    elif any(x in food_name for x in moderate_proteins):
        protein_quality = 2  # Moderate quality plant proteins
    elif protein > 5:
        protein_quality = 2  # Decent protein content
    else:
        protein_quality = 1  # Low/incomplete protein

    return MetabolismAttributes(
        glycemicIndex=glycemic_index,
        absorptionSpeed=absorption_speed,
        insulinResponse=insulin_response,
        satietyScore=satiety_score,
        proteinQuality=protein_quality
    )


def calculate_meal_nutrition(
    foods: List[MealFoodItemBase],
    food_database: List[FoodItem]
) -> NutritionTotals:
    """
    Calculate total nutrition for a meal from food items with amounts.
    foods: List of {foodId, grams} - can be Pydantic models or dicts
    food_database: Available FoodItem objects for lookup
    """
    totals = NutritionTotals()

    food_lookup = {food.id: food for food in food_database}

    for item in foods:
        # Handle both Pydantic models and dicts
        food_id = item.foodId if hasattr(item, 'foodId') else item.get('foodId')
        grams = item.grams if hasattr(item, 'grams') else item.get('grams')

        food = food_lookup.get(food_id)
        if not food:
            continue

        multiplier = grams / 100
        totals.calories += food.calories * multiplier
        totals.protein += food.protein * multiplier
        totals.carbs += food.carbs * multiplier
        totals.fat += food.fat * multiplier

    return totals


def calculate_template_nutrition(
    foods: List[MealFoodItemBase],
    food_database: List[FoodItem]
) -> NutritionTotals:
    """
    Calculate nutrition for a meal template.
    This is an alias for calculate_meal_nutrition for consistency.
    """
    return calculate_meal_nutrition(foods, food_database)


def calculate_calories_per_portion(
    calories_per_100g: int,
    serving_size: int
) -> int:
    """
    Calculate calories per portion (serving).
    Formula: calories per 100g * servingSize / 100
    """
    return round(calories_per_100g * serving_size / 100)


def calculate_macro_per_portion(
    macro_per_100g: float,
    serving_size: int
) -> float:
    """
    Calculate macro per portion (serving).
    Formula: macro per 100g * servingSize / 100
    """
    return round(macro_per_100g * serving_size / 100, 1)


def calculate_daily_totals(
    meals: List,  # List of Meal objects
) -> NutritionTotals:
    """
    Calculate total nutrition for all meals in a day.
    Each Meal should have: totalCalories, totalProtein, totalCarbs, totalFat
    """
    totals = NutritionTotals()

    for meal in meals:
        totals.calories += meal.totalCalories
        totals.protein += meal.totalProtein
        totals.carbs += meal.totalCarbs
        totals.fat += meal.totalFat

    return totals
