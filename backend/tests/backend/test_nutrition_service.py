"""
Unit tests for nutrition calculation service.

Tests all calculation logic that was moved from frontend to backend:
- Calorie calculations
- Category detection
- Metabolism attribute inference
- Meal/template nutrition calculations
"""
import pytest

from app.services.nutrition import (
    calculate_calories,
    detect_category,
    infer_metabolism_attributes,
    calculate_meal_nutrition,
    calculate_template_nutrition,
    calculate_calories_per_portion,
    calculate_macro_per_portion,
    calculate_daily_totals,
)
from app.schemas.food import FoodItem, MealFoodItemBase, NutritionTotals


class TestCalculateCalories:
    """Tests for calorie calculation from macros."""

    def test_calculate_calories_all_macros(self):
        """Test calorie calculation with all macros present."""
        # Formula: protein * 4 + carbs * 4 + fat * 9
        # 25g protein * 4 = 100
        # 50g carbs * 4 = 200
        # 10g fat * 9 = 90
        # Total = 390
        assert calculate_calories(25, 50, 10) == 390

    def test_calculate_calories_protein_only(self):
        """Test with only protein."""
        assert calculate_calories(30, 0, 0) == 120  # 30 * 4

    def test_calculate_calories_carbs_only(self):
        """Test with only carbs."""
        assert calculate_calories(0, 50, 0) == 200  # 50 * 4

    def test_calculate_calories_fat_only(self):
        """Test with only fat."""
        assert calculate_calories(0, 0, 20) == 180  # 20 * 9

    def test_calculate_calories_zero(self):
        """Test with all zeros."""
        assert calculate_calories(0, 0, 0) == 0

    def test_calculate_calories_rounding(self):
        """Test that results are properly rounded."""
        # 25.3 * 4 = 101.2 -> 101
        # 25.6 * 4 = 102.4 -> 102
        # 25.5 * 4 = 102.0 -> 102
        assert calculate_calories(25.3, 0, 0) == 101
        assert calculate_calories(0, 25.6, 0) == 102
        assert calculate_calories(0, 0, 10.1) == 91  # 10.1 * 9 = 90.9 -> 91


class TestDetectCategory:
    """Tests for food category detection based on macro ratios."""

    def test_detect_category_protein(self):
        """Test protein-rich food (>40% of calories from protein)."""
        # 40g protein (160 cal), 10g carbs (40 cal), 5g fat (45 cal)
        # Total = 245 cal, protein ratio = 160/245 = 0.65 > 0.4
        assert detect_category(40, 10, 5) == "protein"

    def test_detect_category_carb(self):
        """Test carb-rich food (>40% of calories from carbs)."""
        # 5g protein (20 cal), 50g carbs (200 cal), 5g fat (45 cal)
        # Total = 265 cal, carb ratio = 200/265 = 0.75 > 0.4
        assert detect_category(5, 50, 5) == "carb"

    def test_detect_category_fat(self):
        """Test fat-rich food (>40% of calories from fat)."""
        # 5g protein (20 cal), 5g carbs (20 cal), 20g fat (180 cal)
        # Total = 220 cal, fat ratio = 180/220 = 0.82 > 0.4
        assert detect_category(5, 5, 20) == "fat"

    def test_detect_category_mixed(self):
        """Test mixed macros (no single macro >40%)."""
        # 20g protein (80 cal), 20g carbs (80 cal), 5g fat (45 cal)
        # Total = 205 cal, all ratios < 0.4
        assert detect_category(20, 20, 5) == "mixed"

    def test_detect_category_zero_total(self):
        """Test with all zeros returns mixed."""
        assert detect_category(0, 0, 0) == "mixed"

    def test_detect_category_equal_ratios(self):
        """Test with equal macro grams (fat dominates due to higher caloric density)."""
        # 10g each: protein=40cal, carbs=40cal, fat=90cal
        # Total = 170 cal, fat ratio = 90/170 = 53% > 40%
        assert detect_category(10, 10, 10) == "fat"


class TestInferMetabolismAttributes:
    """Tests for metabolism attribute inference from food data."""

    def test_high_fat_food_slow_absorption(self):
        """Test high fat foods get slow absorption."""
        result = infer_metabolism_attributes(
            name="Almonds",
            fat=50,
            carbs=10,
            protein=20,
            fiber=12
        )
        assert result.absorptionSpeed == 'slow'
        assert result.satietyScore == 7
        assert result.insulinResponse is not None

    def test_high_sugar_food_fast_absorption(self):
        """Test high sugar foods get fast absorption."""
        result = infer_metabolism_attributes(
            name="Candy",
            fat=0,
            carbs=80,
            protein=0,
            fiber=0,
            sugar=70
        )
        assert result.absorptionSpeed == 'fast'
        assert result.satietyScore == 2
        assert result.glycemicIndex is not None

    def test_high_fiber_food_slow_absorption(self):
        """Test high fiber foods get slow absorption."""
        result = infer_metabolism_attributes(
            name="Lentils",
            fat=1,
            carbs=40,
            protein=25,
            fiber=15
        )
        assert result.absorptionSpeed == 'slow'
        assert result.satietyScore == 7

    def test_protein_food_moderate_absorption(self):
        """Test protein foods get moderate absorption."""
        result = infer_metabolism_attributes(
            name="Chicken Breast",
            fat=3,
            carbs=0,
            protein=31,
            fiber=0
        )
        assert result.absorptionSpeed == 'moderate'
        assert result.satietyScore == 8

    def test_complete_protein_quality_3(self):
        """Test complete proteins get quality 3."""
        complete_proteins = [
            "Chicken", "Beef", "Salmon", "Tuna", "Egg", "Whey", "Casein", "Yogurt", "Cheese"
        ]
        for protein_name in complete_proteins:
            result = infer_metabolism_attributes(
                name=protein_name,
                fat=5,
                carbs=2,
                protein=20,
                fiber=0
            )
            assert result.proteinQuality == 3, f"{protein_name} should have quality 3"

    def test_moderate_protein_quality_2(self):
        """Test moderate protein sources get quality 2."""
        moderate_proteins = [
            "Oats", "Beans", "Lentils", "Quinoa", "Soy", "Almonds", "Peanut Butter"
        ]
        for protein_name in moderate_proteins:
            result = infer_metabolism_attributes(
                name=protein_name,
                fat=5,
                carbs=20,
                protein=10,
                fiber=5
            )
            assert result.proteinQuality == 2, f"{protein_name} should have quality 2"

    def test_low_protein_quality_1(self):
        """Test low protein sources get quality 1."""
        result = infer_metabolism_attributes(
            name="Broccoli",
            fat=0,
            carbs=7,
            protein=3,
            fiber=2
        )
        assert result.proteinQuality == 1

    def test_rice_carb_food(self):
        """Test rice gets moderate absorption."""
        result = infer_metabolism_attributes(
            name="Brown Rice",
            fat=1,
            carbs=45,
            protein=4,
            fiber=1
        )
        assert result.absorptionSpeed == 'moderate'
        assert result.satietyScore == 5

    def test_fruit_carb_food(self):
        """Test fruit gets fast absorption."""
        result = infer_metabolism_attributes(
            name="Banana",
            fat=0,
            carbs=27,
            protein=1,
            fiber=3
        )
        assert result.absorptionSpeed == 'fast'
        assert result.satietyScore == 4


class TestCalculateMealNutrition:
    """Tests for calculating nutrition from meal food items."""

    def test_calculate_meal_nutrition_single_food(self):
        """Test calculating nutrition for a single food item."""
        foods = [
            MealFoodItemBase(foodId="food1", grams=100)
        ]
        food_db = [
            FoodItem(
                id="food1",
                name="Chicken",
                category="protein",
                servingSize=100,
                servingType="g",
                calories=200,
                protein=30,
                carbs=0,
                fat=10,
                source="user"
            )
        ]
        result = calculate_meal_nutrition(foods, food_db)
        assert result.calories == 200
        assert result.protein == 30
        assert result.carbs == 0
        assert result.fat == 10

    def test_calculate_meal_nutrition_multiple_foods(self):
        """Test calculating nutrition for multiple food items."""
        foods = [
            MealFoodItemBase(foodId="food1", grams=100),
            MealFoodItemBase(foodId="food2", grams=50),
            MealFoodItemBase(foodId="food3", grams=150)
        ]
        food_db = [
            FoodItem(
                id="food1",
                name="Chicken",
                category="protein",
                servingSize=100,
                servingType="g",
                calories=200,
                protein=30,
                carbs=0,
                fat=10,
                source="user"
            ),
            FoodItem(
                id="food2",
                name="Rice",
                category="carb",
                servingSize=100,
                servingType="g",
                calories=150,
                protein=3,
                carbs=35,
                fat=1,
                source="user"
            ),
            FoodItem(
                id="food3",
                name="Broccoli",
                category="mixed",
                servingSize=100,
                servingType="g",
                calories=50,
                protein=3,
                carbs=10,
                fat=0,
                source="user"
            )
        ]
        # food1: 100g -> 200 cal, 30p, 0c, 10f
        # food2: 50g -> 75 cal, 1.5p, 17.5c, 0.5f
        # food3: 150g -> 75 cal, 4.5p, 15c, 0f
        # Total: 350 cal, 36p, 32.5c, 10.5f
        result = calculate_meal_nutrition(foods, food_db)
        assert result.calories == 350
        assert result.protein == 36
        assert result.carbs == 32.5
        assert result.fat == 10.5

    def test_calculate_meal_nutrition_missing_food(self):
        """Test that missing foods are skipped."""
        foods = [
            MealFoodItemBase(foodId="food1", grams=100),
            MealFoodItemBase(foodId="food_nonexistent", grams=50)
        ]
        food_db = [
            FoodItem(
                id="food1",
                name="Chicken",
                category="protein",
                servingSize=100,
                servingType="g",
                calories=200,
                protein=30,
                carbs=0,
                fat=10,
                source="user"
            )
        ]
        result = calculate_meal_nutrition(foods, food_db)
        # Only food1 should be counted
        assert result.calories == 200

    def test_calculate_meal_nutrition_empty_list(self):
        """Test with empty food list."""
        result = calculate_meal_nutrition([], [])
        assert result.calories == 0
        assert result.protein == 0
        assert result.carbs == 0
        assert result.fat == 0


class TestCalculateTemplateNutrition:
    """Tests for meal template nutrition calculation."""

    def test_calculate_template_nutrition(self):
        """Test template nutrition calculation."""
        foods = [
            MealFoodItemBase(foodId="food1", grams=50)
        ]
        food_db = [
            FoodItem(
                id="food1",
                name="Eggs",
                category="protein",
                servingSize=100,
                servingType="g",
                calories=150,
                protein=13,
                carbs=1,
                fat=11,
                source="user"
            )
        ]
        # 50g of eggs -> half the nutrition
        result = calculate_template_nutrition(foods, food_db)
        assert result.calories == 75
        assert result.protein == 6.5
        assert result.carbs == 0.5
        assert result.fat == 5.5


class TestCalculateCaloriesPerPortion:
    """Tests for calculating calories per portion."""

    def test_calculate_calories_per_portion_standard(self):
        """Test with standard 100g serving."""
        # 400 cal per 100g, serving size 100g
        assert calculate_calories_per_portion(400, 100) == 400

    def test_calculate_calories_per_portion_small_serving(self):
        """Test with smaller serving size."""
        # 400 cal per 100g, serving size 30g
        assert calculate_calories_per_portion(400, 30) == 120

    def test_calculate_calories_per_portion_large_serving(self):
        """Test with larger serving size."""
        # 400 cal per 100g, serving size 250g
        assert calculate_calories_per_portion(400, 250) == 1000

    def test_calculate_calories_per_portion_rounding(self):
        """Test proper rounding."""
        # 350 cal per 100g, serving size 33g
        # 350 * 33 / 100 = 115.5 -> 116
        assert calculate_calories_per_portion(350, 33) == 116


class TestCalculateMacroPerPortion:
    """Tests for calculating macros per portion."""

    def test_calculate_macro_per_portion_protein(self):
        """Test protein per portion calculation."""
        # 30g per 100g, serving size 50g -> 15g
        assert calculate_macro_per_portion(30, 50) == 15.0

    def test_calculate_macro_per_portion_carbs(self):
        """Test carbs per portion calculation."""
        # 50g per 100g, serving size 75g -> 37.5g
        assert calculate_macro_per_portion(50, 75) == 37.5

    def test_calculate_macro_per_portion_fat(self):
        """Test fat per portion calculation."""
        # 10g per 100g, serving size 200g -> 20g
        assert calculate_macro_per_portion(10, 200) == 20.0


class TestCalculateDailyTotals:
    """Tests for calculating daily nutrition totals."""

    def test_calculate_daily_totals_empty(self):
        """Test with no meals."""
        meals = []
        result = calculate_daily_totals(meals)
        assert result.calories == 0
        assert result.protein == 0
        assert result.carbs == 0
        assert result.fat == 0

    def test_calculate_daily_totals_single_meal(self):
        """Test with one meal."""
        meals = [
            type('Meal', (), {
                'totalCalories': 500,
                'totalProtein': 30,
                'totalCarbs': 50,
                'totalFat': 15
            })()
        ]
        result = calculate_daily_totals(meals)
        assert result.calories == 500
        assert result.protein == 30
        assert result.carbs == 50
        assert result.fat == 15

    def test_calculate_daily_totals_multiple_meals(self):
        """Test with multiple meals."""
        meals = [
            type('Meal', (), {
                'totalCalories': 300,
                'totalProtein': 20,
                'totalCarbs': 30,
                'totalFat': 10
            })(),
            type('Meal', (), {
                'totalCalories': 500,
                'totalProtein': 35,
                'totalCarbs': 60,
                'totalFat': 15
            })(),
            type('Meal', (), {
                'totalCalories': 700,
                'totalProtein': 50,
                'totalCarbs': 80,
                'totalFat': 20
            })()
        ]
        result = calculate_daily_totals(meals)
        assert result.calories == 1500
        assert result.protein == 105
        assert result.carbs == 170
        assert result.fat == 45
