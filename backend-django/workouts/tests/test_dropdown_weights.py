"""
Tests for dropdown set functionality with dropdown_weights JSONField.
"""
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

        # Get active sessions (endpoint returns array of active sessions)
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        # Get the first (and only) active session
        sessions = response.data
        self.assertGreater(len(sessions), 0)
        session = sessions[0]
        self.assertIn("sets", session)

        # Check dropdown sets have dropdown_weights (using frontend field names)
        dropdown_sets = [s for s in session["sets"] if s["setType"] == "dropdown"]
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

        # Get the first (and only) active session
        sessions = response.data
        session = sessions[0]
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
        sessions = response.data
        active_session = sessions[0]

        completed_sets = [s for s in active_session["sets"] if s.get("loggedAt")]
        self.assertEqual(len(completed_sets), 2, "Should have 2 completed sets")

        exercise_ids = {s["exerciseId"] for s in completed_sets}
        self.assertIn(dropdown_set["exerciseId"], exercise_ids, "Dropdown exercise should be completed")
        self.assertIn(normal_set["exerciseId"], exercise_ids, "Normal exercise should be completed")


class TestMultipleActiveSessions(TestCase):
    """Test having multiple active workout sessions simultaneously."""

    def setUp(self):
        """Set up test client, user, and two workout presets."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create exercises
        from workouts.models import Exercise
        self.bench_press = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)
        self.squats = Exercise.objects.create(name="Squats", user=None, is_compound=True)

        # Create two workout presets
        self.preset1 = WorkoutPreset.objects.create(
            user=None,
            name="Push Day",
            notes="Test preset 1"
        )

        WorkoutPresetExercise.objects.create(
            preset=self.preset1,
            exercise=self.bench_press,
            type="normal",
            sets=3,
            order=0
        )

        self.preset2 = WorkoutPreset.objects.create(
            user=None,
            name="Leg Day",
            notes="Test preset 2"
        )

        WorkoutPresetExercise.objects.create(
            preset=self.preset2,
            exercise=self.squats,
            type="normal",
            sets=3,
            order=0
        )

    def test_multiple_active_sessions(self):
        """Test that multiple active workouts can exist and are all returned."""
        # Start first workout
        response1 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset1.id})
        )
        self.assertEqual(response1.status_code, 201)
        session1_id = response1.data["session"]["id"]

        # Start second workout (without finishing the first)
        response2 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset2.id})
        )
        self.assertEqual(response2.status_code, 201)
        session2_id = response2.data["session"]["id"]

        # Both sessions should be active (not finished)
        session1 = WorkoutSession.objects.get(id=session1_id)
        session2 = WorkoutSession.objects.get(id=session2_id)
        self.assertIsNone(session1.finished_at)
        self.assertIsNone(session2.finished_at)

        # Get all active sessions
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        active_sessions = response.data
        self.assertEqual(len(active_sessions), 2, "Should have 2 active sessions")

        # Verify both sessions are returned
        active_ids = {s["id"] for s in active_sessions}
        self.assertIn(session1_id, active_ids)
        self.assertIn(session2_id, active_ids)

    def test_finishing_one_workout_leaves_other_active(self):
        """Test that finishing one workout doesn't affect other active workouts."""
        # Start two workouts
        response1 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset1.id})
        )
        session1_id = response1.data["session"]["id"]
        sets1 = response1.data["sets"]

        response2 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset2.id})
        )
        session2_id = response2.data["session"]["id"]
        sets2 = response2.data["sets"]

        # Complete a few sets from the first workout
        for i in range(2):
            set_id = sets1[i]["id"]
            self.client.post(reverse("workoutset-complete", kwargs={"pk": set_id}))

        # Finish the first workout
        response = self.client.post(reverse("workoutsession-finish", kwargs={"pk": session1_id}))
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["endedAt"])

        # Only the second workout should be active now
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        active_sessions = response.data
        self.assertEqual(len(active_sessions), 1, "Should have 1 active session")
        self.assertEqual(active_sessions[0]["id"], session2_id)

    def test_finishing_all_workouts_returns_empty_list(self):
        """Test that finishing all workouts returns an empty list."""
        # Start two workouts
        response1 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset1.id})
        )
        session1_id = response1.data["session"]["id"]

        response2 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset2.id})
        )
        session2_id = response2.data["session"]["id"]

        # Finish both workouts
        self.client.post(reverse("workoutsession-finish", kwargs={"pk": session1_id}))
        self.client.post(reverse("workoutsession-finish", kwargs={"pk": session2_id}))

        # No active sessions should be returned (empty array)
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        active_sessions = response.data
        self.assertEqual(len(active_sessions), 0, "Should have 0 active sessions")

    def test_all_sessions_included_in_list_endpoint(self):
        """Test that the list endpoint returns all sessions, including finished ones."""
        # Start two workouts
        response1 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset1.id})
        )
        session1_id = response1.data["session"]["id"]

        response2 = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset2.id})
        )
        session2_id = response2.data["session"]["id"]

        # Finish the first workout
        self.client.post(reverse("workoutsession-finish", kwargs={"pk": session1_id}))

        # The list endpoint should return both sessions
        response = self.client.get(reverse("workoutsession-list"))
        self.assertEqual(response.status_code, 200)

        all_sessions = response.data
        self.assertEqual(len(all_sessions), 2, "List endpoint should return all 2 sessions")

        # Verify both sessions are present
        session_ids = {s["id"] for s in all_sessions}
        self.assertIn(session1_id, session_ids)
        self.assertIn(session2_id, session_ids)
