"""
Integration tests for workout calculations API endpoints.

Tests the endpoints for volume calculation and preset building.
"""
from datetime import datetime


class TestCalculateVolumeEndpoint:
    """Tests for POST /api/v1/workouts/calculations/volume"""

    def test_calculate_volume_normal_sets(self, authenticated_client):
        """Test volume calculation for normal weighted sets."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/volume",
            json={
                "sets": [
                    {
                        "id": "set1",
                        "exerciseId": "ex1",
                        "setType": "normal",
                        "weight": 100,
                        "reps": 10,
                        "loggedAt": datetime.now().isoformat()
                    },
                    {
                        "id": "set2",
                        "exerciseId": "ex1",
                        "setType": "normal",
                        "weight": 80,
                        "reps": 12,
                        "loggedAt": datetime.now().isoformat()
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totalVolume"] == 1960
        assert data["completedSets"] == 2
        assert data["totalSets"] == 2

    def test_calculate_volume_with_bodyweight_sets(self, authenticated_client):
        """Test volume calculation includes bodyweight sets in count."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/volume",
            json={
                "sets": [
                    {
                        "id": "set1",
                        "exerciseId": "ex1",
                        "setType": "normal",
                        "weight": 100,
                        "reps": 10,
                        "loggedAt": datetime.now().isoformat()
                    },
                    {
                        "id": "set2",
                        "exerciseId": "ex2",
                        "setType": "bodyweight",
                        "weight": None,
                        "reps": 15,
                        "loggedAt": datetime.now().isoformat()
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totalVolume"] == 1000
        assert data["completedSets"] == 2

    def test_calculate_volume_empty(self, authenticated_client):
        """Test volume calculation with no sets."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/volume",
            json={"sets": []}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["totalVolume"] == 0
        assert data["completedSets"] == 0
        assert data["totalSets"] == 0


class TestBuildWorkoutFromPresetEndpoint:
    """Tests for POST /api/v1/workouts/calculations/build-from-preset"""

    def test_build_simple_preset(self, authenticated_client):
        """Test building a simple workout preset."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/build-from-preset",
            json={
                "preset": {
                    "id": "preset1",
                    "name": "Upper Body",
                    "exercises": [
                        {
                            "id": "ex1",
                            "exerciseId": "ex1",
                            "type": "normal",
                            "sets": 3
                        }
                    ],
                    "status": "active"
                },
                "exercises": [
                    {
                        "id": "ex1",
                        "name": "Bench Press",
                        "bodyweight": False,
                        "equipment": ["barbell"]
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        set_rows = data["setRows"]
        assert len(set_rows) == 3
        assert all(row["setType"] == "normal" for row in set_rows)

    def test_build_preset_with_warmup(self, authenticated_client):
        """Test building preset with warmup sets."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/build-from-preset",
            json={
                "preset": {
                    "id": "preset1",
                    "name": "Legs",
                    "exercises": [
                        {
                            "id": "ex1",
                            "exerciseId": "ex1",
                            "type": "normal",
                            "sets": 3,
                            "warmup": True
                        }
                    ],
                    "status": "active"
                },
                "exercises": [
                    {
                        "id": "ex1",
                        "name": "Squats",
                        "bodyweight": False,
                        "equipment": ["barbell"]
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        set_rows = data["setRows"]
        assert len(set_rows) == 4
        assert set_rows[0]["setType"] == "warmup"

    def test_build_bodyweight_preset(self, authenticated_client):
        """Test building bodyweight exercise preset."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/build-from-preset",
            json={
                "preset": {
                    "id": "preset1",
                    "name": "Bodyweight",
                    "exercises": [
                        {
                            "id": "ex1",
                            "exerciseId": "ex1",
                            "type": "normal",
                            "sets": 3
                        }
                    ],
                    "status": "active"
                },
                "exercises": [
                    {
                        "id": "ex1",
                        "name": "Pullups",
                        "bodyweight": True,
                        "equipment": []
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        set_rows = data["setRows"]
        assert len(set_rows) == 3
        assert all(row["setType"] == "bodyweight" for row in set_rows)
        assert all(row["isBodyweight"] is True for row in set_rows)

    def test_build_dropdown_preset(self, authenticated_client):
        """Test building dropdown set preset."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/build-from-preset",
            json={
                "preset": {
                    "id": "preset1",
                    "name": "Drop Sets",
                    "exercises": [
                        {
                            "id": "ex1",
                            "exerciseId": "ex1",
                            "type": "dropdown",
                            "sets": 2,
                            "dropdowns": 2
                        }
                    ],
                    "status": "active"
                },
                "exercises": [
                    {
                        "id": "ex1",
                        "name": "Press",
                        "bodyweight": False,
                        "equipment": ["dumbbell"]
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        set_rows = data["setRows"]
        assert len(set_rows) == 2
        assert all(row["setType"] == "dropdown" for row in set_rows)
        assert all(len(row["subSets"]) == 3 for row in set_rows)

    def test_build_superset_preset(self, authenticated_client):
        """Test building superset preset."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/build-from-preset",
            json={
                "preset": {
                    "id": "preset1",
                    "name": "Superset",
                    "exercises": [
                        {
                            "id": "super1",
                            "type": "superset",
                            "exercises": [
                                {
                                    "exerciseId": "ex1",
                                    "type": "normal",
                                    "sets": 2
                                },
                                {
                                    "exerciseId": "ex2",
                                    "type": "normal",
                                    "sets": 2
                                }
                            ]
                        }
                    ],
                    "status": "active"
                },
                "exercises": [
                    {"id": "ex1", "name": "Bench", "bodyweight": False, "equipment": ["barbell"]},
                    {"id": "ex2", "name": "Rows", "bodyweight": False, "equipment": ["barbell"]}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        set_rows = data["setRows"]
        assert len(set_rows) == 4
        assert set_rows[0]["exerciseId"] == "ex1"
        assert set_rows[1]["exerciseId"] == "ex2"
        assert set_rows[2]["exerciseId"] == "ex1"
        assert set_rows[3]["exerciseId"] == "ex2"
        assert all(row["isSuperset"] for row in set_rows)


class TestSortPresetsEndpoint:
    """Tests for POST /api/v1/workouts/calculations/sort-presets"""

    def test_sort_presets_by_current_day(self, authenticated_client):
        """Test that presets are sorted by current day."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/sort-presets",
            json=[
                {"id": "p1", "name": "Tuesday", "dayLabel": "tuesday", "exercises": [], "status": "active"},
                {"id": "p2", "name": "Monday", "dayLabel": "monday", "exercises": [], "status": "active"},
                {"id": "p3", "name": "Wednesday", "dayLabel": "wednesday", "exercises": [], "status": "active"},
            ]
        )
        assert response.status_code == 200
        presets = response.json()
        day_labels = [p["dayLabel"] for p in presets]
        assert day_labels.index("monday") < day_labels.index("tuesday")
        assert day_labels.index("tuesday") < day_labels.index("wednesday")

    def test_sort_presets_no_day_label_last(self, authenticated_client):
        """Test that presets without day labels go last."""
        response = authenticated_client.post(
            "/api/v1/workouts/calculations/sort-presets",
            json=[
                {"id": "p1", "name": "No Day", "dayLabel": None, "exercises": [], "status": "active"},
                {"id": "p2", "name": "Monday", "dayLabel": "monday", "exercises": [], "status": "active"},
            ]
        )
        assert response.status_code == 200
        presets = response.json()
        assert presets[0]["dayLabel"] == "monday"
        assert presets[1]["dayLabel"] is None
