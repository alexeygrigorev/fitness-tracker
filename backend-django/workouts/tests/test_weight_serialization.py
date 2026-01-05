"""
Test that weight fields are serialized as numbers, not strings.
- Integer values like 60 should serialize as 60 (not "60" or 60.0)
- Decimal values like 60.5 should serialize as 60.5

Note: We check response.content (actual JSON) not response.data (Python dict)
because that's what the frontend receives.
"""
import json
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise, Exercise,
    WorkoutSession, WorkoutSet,
)
from users.models import User


class TestWeightSerialization(TestCase):
    """Test that weight serializes as a number, not a string."""

    def setUp(self):
        """Set up test client, user, and data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create exercise and preset
        self.exercise = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)
        self.preset = WorkoutPreset.objects.create(user=None, name="Test")

        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.exercise,
            type="normal",
            sets=3,
            order=0
        )

    def test_integer_weight_serializes_as_number(self):
        """
        Test that a weight of 60 (integer) serializes as 60, not "60".
        Create with Django model, then request via API.
        """
        # Start workout
        response = self.client.post(f"/api/workouts/presets/{self.preset.id}/start_workout/")
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get a set and update its weight to an integer value (60)
        set_id = sets[0]["id"]
        workout_set = WorkoutSet.objects.get(id=set_id)
        workout_set.weight = Decimal("60")
        workout_set.save()

        # Request via API and check the actual JSON response (what frontend receives)
        response = self.client.get(f"/api/workouts/sessions/{session_id}/")
        self.assertEqual(response.status_code, 200)

        # Parse JSON to get what the frontend actually receives
        json_data = json.loads(response.content)
        set_data = next(s for s in json_data["sets"] if s["id"] == set_id)

        # Weight should be a number, not a string
        self.assertIsInstance(set_data["weight"], (int, float),
            f"Weight should be a number, got {type(set_data['weight'])}: {set_data['weight']}")

        # For 60, we expect exactly 60
        self.assertEqual(set_data["weight"], 60)

    def test_decimal_weight_serializes_as_number(self):
        """
        Test that a weight of 60.5 serializes as 60.5, not "60.5".
        Create with Django model, then request via API.
        """
        # Start workout
        response = self.client.post(f"/api/workouts/presets/{self.preset.id}/start_workout/")
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get a set and update its weight to a decimal value (60.5)
        set_id = sets[0]["id"]
        workout_set = WorkoutSet.objects.get(id=set_id)
        workout_set.weight = Decimal("60.5")
        workout_set.save()

        # Request via API and check the actual JSON response
        response = self.client.get(f"/api/workouts/sessions/{session_id}/")
        self.assertEqual(response.status_code, 200)

        json_data = json.loads(response.content)
        set_data = next(s for s in json_data["sets"] if s["id"] == set_id)

        # Weight should be a number, not a string
        self.assertIsInstance(set_data["weight"], (int, float),
            f"Weight should be a number, got {type(set_data['weight'])}: {set_data['weight']}")

        # For 60.5, we expect exactly 60.5
        self.assertEqual(set_data["weight"], 60.5)

    def test_null_weight_serializes_as_null(self):
        """
        Test that a null weight serializes as null (not a string).
        Warmup sets have null weight.
        """
        # Create a preset with warmup
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.exercise,
            type="normal",
            sets=3,
            include_warmup=True,
            order=1
        )

        # Start workout
        response = self.client.post(f"/api/workouts/presets/{self.preset.id}/start_workout/")
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Find the warmup set (has null weight)
        warmup_set = next(s for s in sets if s["setType"] == "warmup")

        # Weight should be null, not "null" or a string
        self.assertIsNone(warmup_set["weight"],
            f"Warmup weight should be null, got {warmup_set['weight']}")

    def test_bodyweight_session_serializes_as_number(self):
        """
        Test that session bodyweight also serializes as a number.
        """
        # Create session with bodyweight
        session = WorkoutSession.objects.create(
            user=self.user,
            name="Test",
            bodyweight=Decimal("75.5")
        )

        # Request via API
        response = self.client.get(f"/api/workouts/sessions/{session.id}/")
        self.assertEqual(response.status_code, 200)

        # Check the actual JSON response
        json_data = json.loads(response.content)

        # Bodyweight should be a number, not a string
        self.assertIsInstance(json_data["bodyweight"], (int, float),
            f"Bodyweight should be a number, got {type(json_data['bodyweight'])}")

        self.assertEqual(json_data["bodyweight"], 75.5)

    def test_dropdown_weights_serialize_as_numbers(self):
        """
        Test that dropdownWeights serialize with numeric weights, not strings.
        """
        # Create a preset with dropdown sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.exercise,
            type="dropdown",
            sets=2,
            dropdowns=2,
            order=1
        )

        # Start workout
        response = self.client.post(f"/api/workouts/presets/{self.preset.id}/start_workout/")
        sets = response.data["sets"]

        # Find a dropdown set
        dropdown_set = next(s for s in sets if s["setType"] == "dropdown")

        # Check that all weights in dropdownWeights are numbers
        self.assertIsNotNone(dropdown_set["dropdownWeights"])
        for item in dropdown_set["dropdownWeights"]:
            self.assertIsInstance(item["weight"], (int, float),
                f"Dropdown weight should be a number, got {type(item['weight'])}: {item['weight']}")
