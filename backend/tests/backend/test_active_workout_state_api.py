"""
Integration tests for active workout state API endpoints.

Tests the server-side persistence for active workout tracking.
"""
from datetime import datetime


class TestActiveWorkoutStatePersistence:
    """Tests for active workout state CRUD operations."""

    def test_save_and_get_active_workout_state(self, authenticated_client):
        """Test saving and retrieving active workout state."""
        # First, create some exercises
        authenticated_client.post(
            "/api/v1/workouts/exercises",
            json={
                "name": "Bench Press",
                "category": "compound",
                "muscleGroups": ["chest"],
                "equipment": ["barbell"],
                "instructions": ["Lift the weight"]
            }
        )

        # Save active workout state
        state_to_save = {
            "preset": {
                "id": "preset1",
                "name": "Upper Body",
                "exercises": [],
                "status": "active"
            },
            "setRows": [
                {
                    "id": "set1",
                    "exerciseId": "ex1",
                    "exerciseName": "Bench Press",
                    "setNumber": 1,
                    "setType": "normal",
                    "weight": 100,
                    "reps": 10,
                    "completed": True
                }
            ],
            "startTime": datetime.now().isoformat(),
            "workoutSessionId": None,
            "lastUsed": {}
        }

        save_response = authenticated_client.post(
            "/api/v1/workouts/active-state",
            json=state_to_save
        )
        assert save_response.status_code == 201
        saved_data = save_response.json()
        assert saved_data["preset"]["name"] == "Upper Body"

        # Get the state back
        get_response = authenticated_client.get("/api/v1/workouts/active-state")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["preset"]["name"] == "Upper Body"
        assert len(data["setRows"]) == 1

    def test_get_active_workout_when_none_exists(self, authenticated_client):
        """Test getting active workout state when none exists."""
        response = authenticated_client.get("/api/v1/workouts/active-state")
        assert response.status_code == 404

    def test_update_active_workout_state(self, authenticated_client):
        """Test updating active workout state."""
        # First save a state
        initial_state = {
            "preset": {
                "id": "preset1",
                "name": "Workout",
                "exercises": [],
                "status": "active"
            },
            "setRows": [],
            "startTime": datetime.now().isoformat(),
            "workoutSessionId": None,
            "lastUsed": {}
        }

        authenticated_client.post(
            "/api/v1/workouts/active-state",
            json=initial_state
        )

        # Update the state
        update_response = authenticated_client.patch(
            "/api/v1/workouts/active-state",
            json={
                "setRows": [
                    {
                        "id": "set1",
                        "exerciseId": "ex1",
                        "exerciseName": "Squats",
                        "setNumber": 1,
                        "setType": "normal",
                        "weight": 100,
                        "reps": 10,
                        "completed": True
                    }
                ]
            }
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert len(data["setRows"]) == 1

    def test_update_nonexistent_state_returns_404(self, authenticated_client):
        """Test updating when no state exists."""
        response = authenticated_client.patch(
            "/api/v1/workouts/active-state",
            json={"setRows": []}
        )
        assert response.status_code == 404

    def test_clear_active_workout_state(self, authenticated_client):
        """Test clearing/deleting active workout state."""
        # Save a state first
        initial_state = {
            "preset": {
                "id": "preset1",
                "name": "Workout",
                "exercises": [],
                "status": "active"
            },
            "setRows": [],
            "startTime": datetime.now().isoformat(),
            "workoutSessionId": None,
            "lastUsed": {}
        }

        authenticated_client.post(
            "/api/v1/workouts/active-state",
            json=initial_state
        )

        # Clear the state
        delete_response = authenticated_client.delete("/api/v1/workouts/active-state")
        assert delete_response.status_code == 204

        # Verify it's cleared
        get_response = authenticated_client.get("/api/v1/workouts/active-state")
        assert get_response.status_code == 404

    def test_active_workout_state_requires_authentication(self, client):
        """Test that authentication is required."""
        response = client.get("/api/v1/workouts/active-state")
        assert response.status_code == 401
