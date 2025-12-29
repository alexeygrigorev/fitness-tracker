"""
Integration tests for food calculation API endpoints.

Tests the endpoints that were added when moving nutrition logic from frontend:
- POST /api/v1/food/calculations/calories
- POST /api/v1/food/calculations/category
- POST /api/v1/food/calculations/metabolism
- POST /api/v1/food/calculations/nutrition
"""
import pytest


class TestCalculateCaloriesEndpoint:
    """Tests for POST /api/v1/food/calculations/calories"""

    def test_calculate_calories_all_macros(self, authenticated_client):
        """Test calorie calculation with all macros present."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/calories",
            json={"protein": 25, "carbs": 50, "fat": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["calories"] == 390  # 25*4 + 50*4 + 10*9

    def test_calculate_calores_partial_macros(self, authenticated_client):
        """Test with only some macros."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/calories",
            json={"protein": 30, "carbs": 0, "fat": 0}
        )
        assert response.status_code == 200
        assert response.json()["calories"] == 120

    def test_calculate_calories_requires_auth(self, client):
        """Test that authentication is required."""
        response = client.post(
            "/api/v1/food/calculations/calories",
            json={"protein": 25, "carbs": 50, "fat": 10}
        )
        assert response.status_code == 401


class TestDetectCategoryEndpoint:
    """Tests for POST /api/v1/food/calculations/category"""

    def test_detect_category_protein(self, authenticated_client):
        """Test protein category detection."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/category",
            json={"protein": 40, "carbs": 10, "fat": 5}
        )
        assert response.status_code == 200
        assert response.json()["category"] == "protein"

    def test_detect_category_carb(self, authenticated_client):
        """Test carb category detection."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/category",
            json={"protein": 5, "carbs": 50, "fat": 5}
        )
        assert response.status_code == 200
        assert response.json()["category"] == "carb"

    def test_detect_category_fat(self, authenticated_client):
        """Test fat category detection."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/category",
            json={"protein": 5, "carbs": 5, "fat": 20}
        )
        assert response.status_code == 200
        assert response.json()["category"] == "fat"

    def test_detect_category_mixed(self, authenticated_client):
        """Test mixed category detection."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/category",
            json={"protein": 20, "carbs": 20, "fat": 5}
        )
        assert response.status_code == 200
        assert response.json()["category"] == "mixed"


class TestInferMetabolismEndpoint:
    """Tests for POST /api/v1/food/calculations/metabolism"""

    def test_infer_metabolism_high_fat(self, authenticated_client):
        """Test metabolism inference for high fat food."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/metabolism",
            json={
                "name": "Almonds",
                "fat": 50,
                "carbs": 10,
                "protein": 20,
                "fiber": 12
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["absorptionSpeed"] == "slow"
        assert data["satietyScore"] == 7

    def test_infer_metabolism_high_sugar(self, authenticated_client):
        """Test metabolism inference for high sugar food."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/metabolism",
            json={
                "name": "Candy",
                "fat": 0,
                "carbs": 80,
                "protein": 0,
                "fiber": 0,
                "sugar": 70
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["absorptionSpeed"] == "fast"
        assert data["satietyScore"] == 2

    def test_infer_metabolism_complete_protein(self, authenticated_client):
        """Test that complete proteins get quality 3."""
        response = authenticated_client.post(
            "/api/v1/food/calculations/metabolism",
            json={
                "name": "Chicken Breast",
                "fat": 3,
                "carbs": 0,
                "protein": 31,
                "fiber": 0
            }
        )
        assert response.status_code == 200
        assert response.json()["proteinQuality"] == 3


class TestCalculateNutritionEndpoint:
    """Tests for POST /api/v1/food/calculations/nutrition"""

    def test_calculate_nutrition_single_food(self, authenticated_client):
        """Test calculating nutrition for a single food item."""
        # First create a food
        food_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Chicken",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 200,
                "protein": 30,
                "carbs": 0,
                "fat": 10
            }
        )
        created_food = food_response.json()

        # Then calculate nutrition - include the created food in foodDatabase
        response = authenticated_client.post(
            "/api/v1/food/calculations/nutrition",
            json={
                "foods": [{"foodId": created_food["id"], "grams": 100}],
                "foodDatabase": [created_food]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totals"]["calories"] == 200
        assert data["totals"]["protein"] == 30

    def test_calculate_nutrition_multiple_foods(self, authenticated_client):
        """Test calculating nutrition for multiple food items."""
        # Create multiple foods
        food1_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Rice",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 150,
                "protein": 3,
                "carbs": 35,
                "fat": 1
            }
        )
        food1 = food1_response.json()

        food2_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Beans",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 120,
                "protein": 10,
                "carbs": 20,
                "fat": 1
            }
        )
        food2 = food2_response.json()

        response = authenticated_client.post(
            "/api/v1/food/calculations/nutrition",
            json={
                "foods": [
                    {"foodId": food1["id"], "grams": 100},
                    {"foodId": food2["id"], "grams": 50}
                ],
                "foodDatabase": [food1, food2]
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Rice: 150 cal + Beans (50g): 60 cal = 210
        assert data["totals"]["calories"] == 210
