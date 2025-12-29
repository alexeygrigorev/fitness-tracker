"""
Integration tests for meals API endpoints.

Tests the meal CRUD and daily totals endpoints.
"""
from datetime import datetime, date


class TestMealCRUD:
    """Tests for meal CRUD operations."""

    def test_create_meal_calculates_nutrition(self, authenticated_client):
        """Test that creating a meal calculates total nutrition."""
        # First create a food
        food = authenticated_client.post(
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

        # Create a meal with this food
        response = authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Lunch",
                "mealType": "lunch",
                "loggedAt": datetime.now().isoformat(),
                "foods": [{"foodId": food["id"], "grams": 150}],
                "source": "manual"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Lunch"
        # 150g of chicken (200 cal per 100g) = 300 cal
        assert data["totalCalories"] == 300.0
        assert data["totalProtein"] == 45.0  # 30 * 1.5

    def test_get_all_meals(self, authenticated_client):
        """Test getting all meals."""
        food = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Eggs",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 155,
                "protein": 13,
                "carbs": 1,
                "fat": 11,
                "source": "user"
            }
        ).json()

        authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Breakfast",
                "mealType": "breakfast",
                "loggedAt": datetime.now().isoformat(),
                "foods": [{"foodId": food["id"], "grams": 100}],
                "source": "manual"
            }
        )

        response = authenticated_client.get("/api/v1/food/meals")
        assert response.status_code == 200
        meals = response.json()
        assert len(meals) == 1
        assert meals[0]["name"] == "Breakfast"

    def test_get_meal_by_id(self, authenticated_client):
        """Test getting a specific meal."""
        food = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Fish",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 140,
                "protein": 25,
                "carbs": 0,
                "fat": 5,
                "source": "user"
            }
        ).json()

        meal = authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Dinner",
                "mealType": "dinner",
                "loggedAt": datetime.now().isoformat(),
                "foods": [{"foodId": food["id"], "grams": 100}],
                "source": "manual"
            }
        ).json()

        response = authenticated_client.get(f"/api/v1/food/meals/{meal['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Dinner"

    def test_update_meal_recalculates_nutrition(self, authenticated_client):
        """Test that updating a meal recalculates nutrition."""
        food1 = authenticated_client.post(
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

        food2 = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Beans",
                "category": "protein",
                "servingSize": 100,
                "servingType": "g",
                "calories": 120,
                "protein": 10,
                "carbs": 20,
                "fat": 1,
                "source": "user"
            }
        ).json()

        meal = authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Lunch",
                "mealType": "lunch",
                "loggedAt": datetime.now().isoformat(),
                "foods": [{"foodId": food1["id"], "grams": 100}],
                "source": "manual"
            }
        ).json()

        # Update to add beans
        response = authenticated_client.patch(
            f"/api/v1/food/meals/{meal['id']}",
            json={
                "foods": [
                    {"foodId": food1["id"], "grams": 100},
                    {"foodId": food2["id"], "grams": 100}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        # 150 + 120 = 270
        assert data["totalCalories"] == 270

    def test_delete_meal(self, authenticated_client):
        """Test deleting a meal."""
        food = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Toast",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 265,
                "protein": 9,
                "carbs": 50,
                "fat": 3,
                "source": "user"
            }
        ).json()

        meal = authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Snack",
                "mealType": "snack",
                "loggedAt": datetime.now().isoformat(),
                "foods": [{"foodId": food["id"], "grams": 50}],
                "source": "manual"
            }
        ).json()

        response = authenticated_client.delete(f"/api/v1/food/meals/{meal['id']}")
        assert response.status_code == 204

    def test_meals_require_authentication(self, client):
        """Test that authentication is required."""
        response = client.get("/api/v1/food/meals")
        assert response.status_code == 401


class TestGetMealsByDate:
    """Tests for GET /api/v1/food/meals/date/{date_str}"""

    def test_get_meals_by_date(self, authenticated_client):
        """Test getting meals for a specific date."""
        food = authenticated_client.post(
            "/api/v1/food/foods",
            json={
                "name": "Oatmeal",
                "category": "carb",
                "servingSize": 100,
                "servingType": "g",
                "calories": 150,
                "protein": 5,
                "carbs": 30,
                "fat": 2,
                "source": "user"
            }
        ).json()

        today = datetime.now().isoformat()
        authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Breakfast",
                "mealType": "breakfast",
                "loggedAt": today,
                "foods": [{"foodId": food["id"], "grams": 100}],
                "source": "manual"
            }
        )

        date_str = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(f"/api/v1/food/meals/date/{date_str}")
        assert response.status_code == 200
        meals = response.json()
        assert len(meals) == 1

    def test_get_meals_by_different_date(self, authenticated_client):
        """Test getting meals for a different date returns empty."""
        date_str = "2024-01-01"
        response = authenticated_client.get(f"/api/v1/food/meals/date/{date_str}")
        assert response.status_code == 200
        assert response.json() == []


class TestDailyTotals:
    """Tests for GET /api/v1/food/meals/daily/totals/{date_str}"""

    def test_get_daily_totals(self, authenticated_client):
        """Test getting daily nutrition totals."""
        food = authenticated_client.post(
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

        today = datetime.now().isoformat()
        # Create multiple meals
        authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Lunch",
                "mealType": "lunch",
                "loggedAt": today,
                "foods": [{"foodId": food["id"], "grams": 100}],
                "source": "manual"
            }
        )
        authenticated_client.post(
            "/api/v1/food/meals",
            json={
                "name": "Dinner",
                "mealType": "dinner",
                "loggedAt": today,
                "foods": [{"foodId": food["id"], "grams": 100}],
                "source": "manual"
            }
        )

        date_str = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(f"/api/v1/food/meals/daily/totals/{date_str}")
        assert response.status_code == 200
        data = response.json()
        assert data["totals"]["calories"] == 400  # 200 * 2
        assert data["totals"]["protein"] == 60  # 30 * 2
        assert data["mealCount"] == 2

    def test_get_daily_totals_empty(self, authenticated_client):
        """Test daily totals when no meals exist."""
        date_str = "2024-01-01"
        response = authenticated_client.get(f"/api/v1/food/meals/daily/totals/{date_str}")
        assert response.status_code == 200
        data = response.json()
        assert data["totals"]["calories"] == 0
        assert data["mealCount"] == 0
