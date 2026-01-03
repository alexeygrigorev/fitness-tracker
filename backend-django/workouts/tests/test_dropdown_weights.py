"""
Tests for dropdown set functionality with dropdown_weights JSONField.
"""
import time
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise,
    WorkoutSession, WorkoutSet,
)
from users.models import User


class TestDropdownWeights(TestCase):
    """Test storing and retrieving dropdown weights."""

    def setUp(self):
        """Set up test client, user, and a workout preset with dropdown sets."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create a preset with dropdown sets
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Dropdown Test",
            notes="Test preset for dropdown functionality"
        )

        # Create an exercise
        from workouts.models import Exercise
        self.exercise = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)

        # Create a dropdown preset exercise with 2 drop sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.exercise,
            type="dropdown",
            sets=3,  # 3 dropdown sets
            dropdowns=2,  # 2 drop sets per dropdown
            order=0
        )

    def test_start_workout_creates_dropdown_weights(self):
        """Test that start_workout creates sets with dropdown_weights populated."""
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        sets = response.data["sets"]
        session_id = response.data["session"]["id"]

        # Should have 3 dropdown sets
        dropdown_sets = [s for s in sets if s["setType"] == "dropdown"]
        self.assertEqual(len(dropdown_sets), 3)

        # Each dropdown set should have dropdown_weights with 3 items (main + 2 drops)
        for dropdown_set in dropdown_sets:
            self.assertIsNotNone(dropdown_set["dropdownWeights"])
            self.assertEqual(len(dropdown_set["dropdownWeights"]), 3)
            # Main set
            self.assertEqual(dropdown_set["dropdownWeights"][0]["weight"], 60.0)
            self.assertEqual(dropdown_set["dropdownWeights"][0]["reps"], 10)
            # First drop
            self.assertEqual(dropdown_set["dropdownWeights"][1]["weight"], 57.5)
            self.assertEqual(dropdown_set["dropdownWeights"][1]["reps"], 10)
            # Second drop
            self.assertEqual(dropdown_set["dropdownWeights"][2]["weight"], 55.0)
            self.assertEqual(dropdown_set["dropdownWeights"][2]["reps"], 10)

    def test_complete_dropdown_set_with_weights(self):
        """Test completing a dropdown set sends dropdown_weights to backend."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        sets = response.data["sets"]
        dropdown_set_id = [s["id"] for s in sets if s["setType"] == "dropdown"][0]

        # Complete the dropdown set with custom weights
        custom_weights = [
            {"weight": 70.0, "reps": 8},
            {"weight": 65.0, "reps": 8},
            {"weight": 60.0, "reps": 8}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": dropdown_set_id}),
            {"dropdownWeights": custom_weights},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["dropdownWeights"], custom_weights)

    def test_active_session_returns_dropdown_weights(self):
        """Test that the active endpoint returns dropdown_weights."""
        # Start workout
        self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )

        # Get active session
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        session = response.data
        self.assertIn("sets", session)

        # Check dropdown sets have dropdown_weights
        dropdown_sets = [s for s in session["sets"] if s["set_type"] == "dropdown"]
        self.assertGreater(len(dropdown_sets), 0)

        for dropdown_set in dropdown_sets:
            self.assertIsNotNone(dropdown_set.get("dropdownWeights"))

    def test_persist_dropdown_completion_across_pages(self):
        """
        Test completing a dropdown set on page1 and loading on page2.
        Simulates the E2E test scenario.
        """
        # Page 1: Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get the first dropdown set (Bench Press Set 1)
        dropdown_sets = [s for s in sets if s["setType"] == "dropdown"]
        self.assertGreater(len(dropdown_sets), 0)
        first_dropdown_id = dropdown_sets[0]["id"]

        # Page 1: Complete the first dropdown set with weights
        custom_weights = [
            {"weight": 60.0, "reps": 10},
            {"weight": 57.5, "reps": 10},
            {"weight": 55.0, "reps": 10}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": first_dropdown_id}),
            {"dropdownWeights": custom_weights},
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        # Mark as complete
        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": first_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Page 2: Load the active session (simulates new page load)
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        session = response.data
        sets = session["sets"]

        # Find the completed dropdown set
        completed_dropdown = next(
            (s for s in sets if s["id"] == first_dropdown_id and s.get("loggedAt")),
            None
        )
        self.assertIsNotNone(completed_dropdown, "Completed dropdown set should be in active session")

        self.assertEqual(completed_dropdown["dropdownWeights"], custom_weights)
        self.assertIsNotNone(completed_dropdown["loggedAt"])

    def test_multiple_dropdown_sets_completion(self):
        """Test completing multiple dropdown sets from different exercises."""
        # Add a normal exercise to the preset
        from workouts.models import Exercise
        incline_exercise = Exercise.objects.create(name="Incline Dumbbell Press", user=None)

        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=incline_exercise,
            type="normal",
            sets=3,
            order=1
        )

        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get first dropdown set and first normal set
        dropdown_set = next(s for s in sets if s["setType"] == "dropdown")
        normal_set = next(s for s in sets if s["setType"] == "normal" and s["exerciseId"] == incline_exercise.id)

        # Complete both sets
        self.client.post(reverse("workoutset-complete", kwargs={"pk": dropdown_set["id"]}))
        self.client.post(reverse("workoutset-complete", kwargs={"pk": normal_set["id"]}))

        # Verify both are marked complete
        response = self.client.get(reverse("workoutsession-active"))
        active_session = response.data

        completed_sets = [s for s in active_session["sets"] if s.get("loggedAt")]
        self.assertEqual(len(completed_sets), 2, "Should have 2 completed sets")

        exercise_ids = {s["exerciseId"] for s in completed_sets}
        self.assertIn(dropdown_set["exerciseId"], exercise_ids, "Dropdown exercise should be completed")
        self.assertIn(normal_set["exerciseId"], exercise_ids, "Normal exercise should be completed")
