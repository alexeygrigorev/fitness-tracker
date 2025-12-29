"""
Integration tests for AI analysis API endpoints.

Tests the AI endpoints for food, meal, and exercise analysis.
"""
import pytest


class TestAnalyzeFoodEndpoint:
    """Tests for POST /api/v1/ai/analyze-food"""

    def test_analyze_food_returns_structured_data(self, authenticated_client):
        """Test that food analysis returns structured nutrition data."""
        response = authenticated_client.post(
            "/api/v1/ai/analyze-food",
            json={"description": "Chicken breast grilled"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "calories" in data
        assert "protein" in data
        assert "carbs" in data
        assert "fat" in data
        assert "category" in data
        assert "metabolism" in data
        assert "servingSize" in data
        assert "servingType" in data

    def test_analyze_food_includes_metabolism(self, authenticated_client):
        """Test that food analysis includes metabolism attributes."""
        response = authenticated_client.post(
            "/api/v1/ai/analyze-food",
            json={"description": "Salmon fillet"}
        )
        assert response.status_code == 200
        data = response.json()
        metabolism = data["metabolism"]
        assert metabolism is not None
        assert "absorptionSpeed" in metabolism
        assert metabolism["absorptionSpeed"] in ["slow", "moderate", "fast"]

    def test_analyze_food_requires_auth(self, client):
        """Test that authentication is required."""
        response = client.post(
            "/api/v1/ai/analyze-food",
            json={"description": "Chicken"}
        )
        assert response.status_code == 401


class TestAnalyzeMealEndpoint:
    """Tests for POST /api/v1/ai/analyze-meal"""

    def test_analyze_meal_returns_structured_data(self, authenticated_client):
        """Test that meal analysis returns structured meal data."""
        response = authenticated_client.post(
            "/api/v1/ai/analyze-meal",
            json={"description": "Grilled chicken with rice and vegetables"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "mealType" in data
        assert "foods" in data
        assert "confidence" in data

    def test_analyze_meal_requires_auth(self, client):
        """Test that authentication is required."""
        response = client.post(
            "/api/v1/ai/analyze-meal",
            json={"description": "Dinner"}
        )
        assert response.status_code == 401


class TestAnalyzeExerciseEndpoint:
    """Tests for POST /api/v1/ai/analyze-exercise"""

    def test_analyze_exercise_returns_structured_data(self, authenticated_client):
        """Test that exercise analysis returns structured exercise data."""
        response = authenticated_client.post(
            "/api/v1/ai/analyze-exercise",
            json={"description": "Barbell bench press 3 sets of 10 reps"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "category" in data
        assert data["category"] in ["compound", "isolation", "cardio"]
        assert "muscleGroups" in data
        assert isinstance(data["muscleGroups"], list)
        assert "equipment" in data
        assert isinstance(data["equipment"], list)
        assert "instructions" in data
        assert isinstance(data["instructions"], list)
        assert "confidence" in data

    def test_analyze_exercise_infers_bodyweight(self, authenticated_client):
        """Test that bodyweight exercises are detected."""
        response = authenticated_client.post(
            "/api/v1/ai/analyze-exercise",
            json={"description": "Pullups bodyweight"}
        )
        assert response.status_code == 200
        data = response.json()
        # Bodyweight exercises have empty equipment or "bodyweight" equipment
        equipment = data.get("equipment", [])
        assert len(equipment) == 0 or "bodyweight" in [e.lower() for e in equipment]

    def test_analyze_exercise_requires_auth(self, client):
        """Test that authentication is required."""
        response = client.post(
            "/api/v1/ai/analyze-exercise",
            json={"description": "Squats"}
        )
        assert response.status_code == 401
