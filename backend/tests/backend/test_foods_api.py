"""
Integration tests for foods API endpoints.

Tests the food CRUD endpoints with real database operations.
"""
from datetime import datetime


class TestFoodCRUD:
    """Tests for food CRUD operations."""

    def test_create_food(self, authenticated_client):
        """Test creating a new food item."""
        response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Chicken Breast",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 165,
                "protein": 31,
                "carbs": 0,
                "fat": 3.6,
                "saturatedFat": 1,
                "sugar": 0,
                "fiber": 0,
                "sodium": 74,
                "source": "user"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Chicken Breast"
        assert data["category"] == "protein"
        assert data["calories"] == 165
        assert data["id"] is not None

    def test_create_food_calculates_calories_per_portion(self, authenticated_client):
        """Test that calories per portion are auto-calculated."""
        response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Rice",
                "category": "carb",
                "servingSize": 75,
                "servingType": "g",
                "calories": 130,
                "protein": 2.7,
                "carbs": 28,
                "fat": 0.3,
                "source": "user"
            }
        )
        assert response.status_code == 201
        data = response.json()
        # 130 cal per 100g, serving size 75g -> 97.5 cal
        assert data["caloriesPerPortion"] == 98  # Rounded

    def test_get_all_foods_empty(self, authenticated_client):
        """Test getting all foods when none exist."""
        response = authenticated_client.get("/api/v1/food/foods")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_all_foods(self, authenticated_client):
        """Test getting all foods."""
        # Create multiple foods
        authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Chicken",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 200,
                "protein": 30,
                "carbs": 0,
                "fat": 10,
                "source": "user"
            }
        )
        authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Rice",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 150,
                "protein": 3,
                "carbs": 35,
                "fat": 1,
                "source": "user"
            }
        )

        response = authenticated_client.get("/api/v1/food/foods")
        assert response.status_code == 200
        foods = response.json()
        assert len(foods) == 2
        food_names = [f["name"] for f in foods]
        assert "Chicken" in food_names
        assert "Rice" in food_names

    def test_get_food_by_id(self, authenticated_client):
        """Test getting a specific food by ID."""
        create_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Eggs",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 155,
                "protein": 13,
                "carbs": 1.1,
                "fat": 11,
                "source": "user"
            }
        )
        food_id = create_response.json()["id"]

        response = authenticated_client.get(f"/api/v1/food/foods/{food_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Eggs"
        assert data["id"] == food_id

    def test_get_food_by_id_not_found(self, authenticated_client):
        """Test getting a non-existent food."""
        response = authenticated_client.get("/api/v1/food/foods/nonexistent")
        assert response.status_code == 404

    def test_update_food(self, authenticated_client):
        """Test updating a food item."""
        create_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Chicken",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 200,
                "protein": 30,
                "carbs": 0,
                "fat": 10,
                "source": "user"
            }
        )
        food_id = create_response.json()["id"]

        response = authenticated_client.patch(
            f"/api/v1/food/foods/{food_id}",
            json={"name": "Chicken Breast", "protein": 31}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Chicken Breast"
        assert data["protein"] == 31

    def test_update_food_recalculates_calories_per_portion(self, authenticated_client):
        """Test that updating serving size recalculates calories per portion."""
        create_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Bread",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 250,
                "protein": 9,
                "carbs": 50,
                "fat": 3,
                "source": "user"
            }
        )
        food_id = create_response.json()["id"]

        response = authenticated_client.patch(
            f"/api/v1/food/foods/{food_id}",
            json={"servingSize": 50}  # Change to 50g
        )
        assert response.status_code == 200
        data = response.json()
        # 250 cal per 100g, 50g serving -> 125 cal
        assert data["caloriesPerPortion"] == 125

    def test_delete_food(self, authenticated_client):
        """Test deleting a food item."""
        create_response = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Test Food",
                "category": "mixed",
                "servingSize": 100,
                "servingType": "g",
                "calories": 100,
                "protein": 5,
                "carbs": 10,
                "fat": 3,
                "source": "user"
            }
        )
        food_id = create_response.json()["id"]

        delete_response = authenticated_client.delete(f"/api/v1/food/foods/{food_id}")
        assert delete_response.status_code == 204

        # Verify it's deleted
        get_response = authenticated_client.get(f"/api/v1/food/foods/{food_id}")
        assert get_response.status_code == 404

    def test_foods_require_authentication(self, client):
        """Test that authentication is required for food endpoints."""
        response = client.get("/api/v1/food/foods")
        assert response.status_code == 401


class TestFoodCalculateNutrition:
    """Tests for POST /api/v1/food/foods/calculate-nutrition"""

    def test_calculate_nutrition_for_foods(self, authenticated_client):
        """Test calculating nutrition for a list of foods with amounts."""
        # Create test foods
        food1 = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Chicken",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 200,
                "protein": 30,
                "carbs": 0,
                "fat": 10,
                "source": "user"
            }
        ).json()

        food2 = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Rice",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 150,
                "protein": 3,
                "carbs": 35,
                "fat": 1,
                "source": "user"
            }
        ).json()

        response = authenticated_client.post(
            "/api/v1/food/foods/calculate-nutrition",
            json={
                "foods": [
                    {"foodId": food1["id"], "grams": 100},
                    {"foodId": food2["id"], "grams": 50}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Chicken: 200 cal + Rice (50g): 75 cal = 275
        assert data["totals"]["calories"] == 275
