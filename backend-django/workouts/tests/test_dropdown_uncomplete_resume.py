"""
Integration test for dropdown set uncomplete -> reload -> complete flow.

Scenario:
1. Start workout from preset with dropdown sets
2. Complete some dropdown sets as we progress
3. Mark one as incomplete (uncomplete)
4. "Reload the page" (request the active workout again)
5. The uncompleted set should still be a dropdown set
6. Complete the dropdown set again

This tests the scenario where a user:
- Starts a workout from a pre-set with dropdown sets
- Marks the set items completed as they progress through the workout
- Then marks one of them as incomplete
- Reloads the page (requests the active workout again)
- The one that was uncompleted should still be a dropdown set
- Now complete it
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise,
    WorkoutSession, WorkoutSet,
)
from users.models import User


class TestDropdownUncompleteResumeComplete(TestCase):
    """Test the complete flow: complete -> uncomplete -> reload -> complete for dropdown sets."""

    def setUp(self):
        """Set up test client, user, and a workout preset with dropdown sets."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create a preset with dropdown sets (using plain Django code)
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Push Day",
            notes="Test preset for dropdown uncomplete/resume scenario"
        )

        # Create an exercise
        from workouts.models import Exercise
        self.bench_press = Exercise.objects.create(
            name="Bench Press",
            user=None,
            is_compound=True
        )

        # Create a dropdown preset exercise with 3 dropdown sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.bench_press,
            type="dropdown",
            sets=3,  # 3 dropdown sets
            dropdowns=2,  # 2 drop sets per dropdown
            order=0
        )

    def test_dropdown_uncomplete_reload_complete(self):
        """
        Test the full scenario:
        1. Start workout from preset with dropdown sets
        2. Complete some dropdown sets
        3. Mark one as incomplete (uncomplete)
        4. Reload (request active workout)
        5. Verify the uncompleted set is still a dropdown set
        6. Complete it again
        """
        # ========== STEP 1: Start workout from preset ==========
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Should have 3 dropdown sets
        dropdown_sets = [s for s in sets if s["setType"] == "dropdown"]
        self.assertEqual(len(dropdown_sets), 3)

        # Get set IDs for testing
        first_dropdown_id = dropdown_sets[0]["id"]
        second_dropdown_id = dropdown_sets[1]["id"]
        third_dropdown_id = dropdown_sets[2]["id"]

        # ========== STEP 2: Complete dropdown sets as we progress ==========
        # Complete first dropdown set
        custom_weights_1 = [
            {"weight": 60.0, "reps": 10},
            {"weight": 57.5, "reps": 10},
            {"weight": 55.0, "reps": 10}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": first_dropdown_id}),
            {"dropdownWeights": custom_weights_1},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": first_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Complete second dropdown set
        custom_weights_2 = [
            {"weight": 60.0, "reps": 10},
            {"weight": 57.5, "reps": 10},
            {"weight": 55.0, "reps": 10}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": second_dropdown_id}),
            {"dropdownWeights": custom_weights_2},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": second_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Complete third dropdown set
        custom_weights_3 = [
            {"weight": 62.5, "reps": 8},
            {"weight": 60.0, "reps": 8},
            {"weight": 57.5, "reps": 8}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": third_dropdown_id}),
            {"dropdownWeights": custom_weights_3},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": third_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Verify all 3 are complete
        session = WorkoutSession.objects.get(id=session_id)
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 3)

        # ========== STEP 3: Mark one as incomplete (uncomplete) ==========
        response = self.client.post(
            reverse("workoutset-uncomplete", kwargs={"pk": second_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["loggedAt"])

        # Verify in database
        workout_set = WorkoutSet.objects.get(id=second_dropdown_id)
        self.assertIsNone(workout_set.completed_at)

        # But the dropdown weights should still be preserved
        self.assertEqual(workout_set.dropdown_weights, custom_weights_2)

        # ========== STEP 4: Reload the page (request the active workout again) ==========
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        sessions = response.data
        self.assertEqual(len(sessions), 1)
        session_data = sessions[0]
        sets_after_reload = session_data["sets"]

        # ========== STEP 5: The one that we uncompleted should still be a dropdown set ==========
        second_set_after_reload = next(
            (s for s in sets_after_reload if s["id"] == second_dropdown_id),
            None
        )
        self.assertIsNotNone(second_set_after_reload)

        # Verify it's still a dropdown set
        self.assertEqual(second_set_after_reload["setType"], "dropdown")

        # Verify it's not completed
        self.assertIsNone(second_set_after_reload.get("loggedAt"))

        # Verify dropdown weights are preserved
        self.assertEqual(second_set_after_reload["dropdownWeights"], custom_weights_2)

        # Verify the other two sets are still completed
        first_set_after_reload = next(
            (s for s in sets_after_reload if s["id"] == first_dropdown_id),
            None
        )
        self.assertIsNotNone(first_set_after_reload.get("loggedAt"))

        third_set_after_reload = next(
            (s for s in sets_after_reload if s["id"] == third_dropdown_id),
            None
        )
        self.assertIsNotNone(third_set_after_reload.get("loggedAt"))

        # ========== STEP 6: Now complete the uncompleted set ==========
        # Update with different weights before completing
        new_weights = [
            {"weight": 65.0, "reps": 8},
            {"weight": 62.5, "reps": 8},
            {"weight": 60.0, "reps": 8}
        ]

        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": second_dropdown_id}),
            {"dropdownWeights": new_weights},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": second_dropdown_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Verify the dropdown weights were updated
        self.assertEqual(response.data["dropdownWeights"], new_weights)

        # Verify in database
        workout_set.refresh_from_db()
        self.assertIsNotNone(workout_set.completed_at)
        self.assertEqual(workout_set.dropdown_weights, new_weights)

        # ========== STEP 7: Final verification ==========
        # All 3 sets should be complete now
        session.refresh_from_db()
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 3)

        # Fetch the session one more time to verify
        response = self.client.get(reverse("workoutsession-active"))
        sessions = response.data
        sets_final = sessions[0]["sets"]

        completed_sets = [s for s in sets_final if s.get("loggedAt") is not None]
        self.assertEqual(len(completed_sets), 3)

        # Verify the set we re-completed has the new weights
        recompleted_set = next(
            (s for s in sets_final if s["id"] == second_dropdown_id),
            None
        )
        self.assertIsNotNone(recompleted_set)
        self.assertEqual(recompleted_set["dropdownWeights"], new_weights)
        self.assertIsNotNone(recompleted_set["loggedAt"])

    def test_dropdown_uncomplete_via_new_api(self):
        """
        Test the same scenario using the new API:
        - PATCH to complete
        - DELETE to uncomplete
        """
        # Start workout
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]
        first_dropdown_id = sets[0]["id"]

        # Complete with dropdown weights
        custom_weights = [
            {"weight": 70.0, "reps": 8},
            {"weight": 65.0, "reps": 8},
            {"weight": 60.0, "reps": 8}
        ]

        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_dropdown_id}/",
            {"dropdownWeights": custom_weights},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Uncomplete via DELETE
        response = self.client.delete(
            f"/api/workouts/sessions/{session_id}/sets/{first_dropdown_id}/completion/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["loggedAt"])

        # Reload (get active session)
        response = self.client.get(reverse("workoutsession-active"))
        sessions = response.data
        sets_after_reload = sessions[0]["sets"]

        # Find the set
        reloaded_set = next(
            (s for s in sets_after_reload if s["id"] == first_dropdown_id),
            None
        )

        # Should still be a dropdown set
        self.assertEqual(reloaded_set["setType"], "dropdown")
        self.assertIsNone(reloaded_set.get("loggedAt"))
        self.assertEqual(reloaded_set["dropdownWeights"], custom_weights)

        # Complete again
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_dropdown_id}/",
            {"dropdownWeights": custom_weights},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
