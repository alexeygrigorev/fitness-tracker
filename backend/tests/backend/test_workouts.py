"""
Tests for workout session endpoints.

These tests follow the Django-style pattern:
1. Prepare state (create users, workouts, sets)
2. Make actions (API calls)
3. Assert the results
4. Transactions are automatically rolled back
"""

from datetime import datetime
from fastapi.testclient import TestClient


class TestWorkoutSessions:
    """Tests for workout session CRUD operations."""

    def test_create_workout_session(self, authenticated_client: TestClient):
        """
        Test creating a new workout session.

        Pattern:
        1. Prepare state: Use authenticated_client
        2. Action: POST new workout
        3. Assert: Workout is created with correct data
        """
        # Action
        response = authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Morning Workout",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [
                    {
                        "id": "set-1",
                        "exerciseId": "squat",
                        "setType": "normal",
                        "weight": 100.0,
                        "reps": 10,
                        "loggedAt": "2025-01-15T08:05:00",
                    }
                ],
            },
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Morning Workout"
        assert data["totalVolume"] == 1000.0  # 100 * 10
        assert len(data["sets"]) == 1

    def test_list_workout_sessions_empty(self, authenticated_client: TestClient):
        """
        Test listing workouts when none exist.

        Pattern:
        1. Prepare state: New user (via authenticated_client)
        2. Action: GET workouts
        3. Assert: Empty list returned
        """
        # Action
        response = authenticated_client.get("/api/v1/workouts/sessions")

        # Assert
        assert response.status_code == 200
        assert response.json() == []

    def test_list_workout_sessions(self, authenticated_client: TestClient):
        """
        Test listing workouts after creating some.

        Pattern:
        1. Prepare state: Create multiple workouts
        2. Action: GET workouts
        3. Assert: All workouts returned
        """
        # Prepare state - create workouts
        authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Workout 1",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )
        authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Workout 2",
                "startedAt": "2025-01-16T08:00:00",
                "sets": [],
            },
        )

        # Action
        response = authenticated_client.get("/api/v1/workouts/sessions")

        # Assert
        assert response.status_code == 200
        workouts = response.json()
        assert len(workouts) == 2
        assert [w["name"] for w in workouts] == ["Workout 1", "Workout 2"]

    def test_get_single_workout(self, authenticated_client: TestClient):
        """
        Test getting a specific workout by ID.

        Pattern:
        1. Prepare state: Create a workout
        2. Action: GET specific workout
        3. Assert: Correct workout returned
        """
        # Prepare state
        create_response = authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Target Workout",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )
        workout_id = create_response.json()["id"]

        # Action
        response = authenticated_client.get(f"/api/v1/workouts/sessions/{workout_id}")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == workout_id
        assert data["name"] == "Target Workout"

    def test_get_nonexistent_workout(self, authenticated_client: TestClient):
        """
        Test getting a workout that doesn't exist.

        Pattern:
        1. No setup
        2. Action: GET non-existent workout
        3. Assert: Returns 404
        """
        response = authenticated_client.get("/api/v1/workouts/sessions/nonexistent")
        assert response.status_code == 404

    def test_update_workout(self, authenticated_client: TestClient):
        """
        Test updating an existing workout.

        Pattern:
        1. Prepare state: Create a workout
        2. Action: PATCH workout with new data
        3. Assert: Workout is updated
        """
        # Prepare state
        create_response = authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Original Name",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )
        workout_id = create_response.json()["id"]

        # Action
        response = authenticated_client.patch(
            f"/api/v1/workouts/sessions/{workout_id}",
            json={
                "name": "Updated Name",
                "endedAt": "2025-01-15T09:00:00",
            },
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["endedAt"] == "2025-01-15T09:00:00"

    def test_delete_workout(self, authenticated_client: TestClient):
        """
        Test deleting a workout.

        Pattern:
        1. Prepare state: Create a workout
        2. Action: DELETE workout
        3. Assert: Workout is deleted (204 response, not in list)
        """
        # Prepare state
        create_response = authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "To Delete",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )
        workout_id = create_response.json()["id"]

        # Action
        delete_response = authenticated_client.delete(f"/api/v1/workouts/sessions/{workout_id}")

        # Assert
        assert delete_response.status_code == 204

        # Verify it's gone
        list_response = authenticated_client.get("/api/v1/workouts/sessions")
        assert len(list_response.json()) == 0

    def test_workout_volume_calculation(self, authenticated_client: TestClient):
        """
        Test that workout volume is calculated correctly.

        Pattern:
        1. Prepare state: Create workout with multiple sets
        2. Action: Create workout
        3. Assert: Volume = sum(weight * reps) for all sets
        """
        # Action
        response = authenticated_client.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "Volume Test",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [
                    {"id": "set-1", "exerciseId": "squat", "setType": "normal", "weight": 100, "reps": 10},
                    {"id": "set-2", "exerciseId": "bench", "setType": "normal", "weight": 80, "reps": 8},
                    {"id": "set-3", "exerciseId": "deadlift", "setType": "normal", "weight": 120, "reps": 5},
                ],
            },
        )

        # Assert: (100*10) + (80*8) + (120*5) = 1000 + 640 + 600 = 2240
        assert response.status_code == 201
        assert response.json()["totalVolume"] == 2240

    def test_user_isolation(self, create_user_with_token):
        """
        Test that users can only see their own workouts.

        Pattern:
        1. Prepare state: Create two users with workouts
        2. Action: User A gets their workouts
        3. Assert: User A only sees their own workouts, not User B's
        """
        # Prepare state - User A creates a workout
        client_a = create_user_with_token(username="usera")
        client_a.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "User A Workout",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )

        # Prepare state - User B creates a workout
        client_b = create_user_with_token(username="userb")
        client_b.post(
            "/api/v1/workouts/sessions",
            json={
                "name": "User B Workout",
                "startedAt": "2025-01-15T08:00:00",
                "sets": [],
            },
        )

        # Action - User A lists workouts
        response = client_a.get("/api/v1/workouts/sessions")

        # Assert - User A only sees their own workout
        assert response.status_code == 200
        workouts = response.json()
        assert len(workouts) == 1
        assert workouts[0]["name"] == "User A Workout"
