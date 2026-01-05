import random
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise, Exercise,
    WorkoutSession, WorkoutSet, SupersetExerciseItem
)
from users.models import User


class TestWorkoutFlow(TestCase):
    """Test simulating a real workout: start, complete sets one by one, finish."""

    def setUp(self):
        """Set up test client, user, and a workout preset."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="workoutuser", email="workout@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create exercises
        self.bench_press = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)
        self.rows = Exercise.objects.create(name="Barbell Rows", user=None, is_compound=True)
        self.dips = Exercise.objects.create(name="Dips", user=None, is_bodyweight=True)
        self.curls = Exercise.objects.create(name="Bicep Curls", user=None, is_compound=False)

        # Create a workout preset with various exercises
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Push Pull Day",
            notes="Upper body workout"
        )

        # Bench Press - 3 sets normal with warmup
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.bench_press,
            type="normal",
            sets=3,
            include_warmup=True,
            order=0
        )

        # Superset: Rows + Dips - 2 sets
        superset = WorkoutPresetExercise.objects.create(
            preset=self.preset,
            type="superset",
            sets=2,
            order=1
        )
        SupersetExerciseItem.objects.create(
            superset=superset,
            exercise=self.rows,
            type="normal",
            order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset,
            exercise=self.dips,
            type="normal",
            order=1
        )

        # Bicep Curls - 2 sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.curls,
            type="normal",
            sets=2,
            order=2
        )

    def test_workout_flow_complete_sets_one_by_one(self):
        """
        Simulate a real workout:
        1. Start workout from preset (creates all sets)
        2. Mark sets as completed one by one with random delays
        3. Mark workout as complete
        """
        # Step 1: Start workout from preset
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        session_data = response.data["session"]
        session_id = session_data["id"]
        sets = response.data["sets"]

        # Verify session was created
        session = WorkoutSession.objects.get(id=session_id)
        self.assertEqual(session.name, "Push Pull Day")
        self.assertEqual(session.user, self.user)
        self.assertIsNone(session.finished_at)  # Not finished yet

        # Expected sets:
        # - Bench warmup: 1
        # - Bench working: 3
        # - Rows superset: 2
        # - Dips superset: 2
        # - Curls: 2
        # Total: 10 sets
        self.assertEqual(len(sets), 10)
        self.assertEqual(session.sets.count(), 10)

        # All sets should initially be incomplete
        incomplete_sets = session.sets.filter(completed_at__isnull=True)
        self.assertEqual(incomplete_sets.count(), 10)

        # Step 2: Mark sets as completed one by one with simulated time delays
        set_ids = [s["id"] for s in sets]

        # Mock time to simulate realistic delays between sets
        # Each set takes between 30 seconds to 2 minutes
        base_time = "2024-01-15T10:00:00Z"

        completion_times = []
        current_time_offset = 0

        with patch("django.utils.timezone.now") as mock_now:
            from datetime import datetime, timedelta
            from django.utils import timezone

            # Set base time
            base_dt = timezone.make_aware(datetime(2024, 1, 15, 10, 0, 0))

            for i, set_id in enumerate(set_ids):
                # Random delay: 30-120 seconds between sets
                delay = random.randint(30, 120)
                current_time_offset += delay
                mock_now.return_value = base_dt + timedelta(seconds=current_time_offset)

                # Mark set as complete
                response = self.client.post(
                    reverse("workoutset-complete", kwargs={"pk": set_id})
                )
                self.assertEqual(response.status_code, 200)
                self.assertIsNotNone(response.data["loggedAt"])

                completion_times.append(current_time_offset)

        # Step 3: Verify all sets are now complete
        session.refresh_from_db()
        completed_sets = session.sets.filter(completed_at__isnull=False)
        self.assertEqual(completed_sets.count(), 10)

        # Verify completion times are in order (sets were completed sequentially)
        completed_sets_ordered = list(session.sets.filter(completed_at__isnull=False).order_by("completed_at"))
        for i in range(len(completed_sets_ordered) - 1):
            self.assertLess(
                completed_sets_ordered[i].completed_at,
                completed_sets_ordered[i + 1].completed_at,
                f"Set {i} should be completed before set {i+1}"
            )

        # Total workout duration should be reasonable (all delays summed)
        first_set_time = completed_sets_ordered[0].completed_at
        last_set_time = completed_sets_ordered[-1].completed_at
        total_duration = (last_set_time - first_set_time).total_seconds()

        # Should be at least the sum of minimum delays (9 intervals * 30 sec = 270 sec)
        # But less than sum of maximum delays (9 intervals * 120 sec = 1080 sec)
        self.assertGreater(total_duration, 270)
        self.assertLess(total_duration, 1200)

        # Step 4: Mark workout as complete
        with patch("django.utils.timezone.now") as mock_now:
            # Finish time is 60 seconds after last set
            mock_now.return_value = base_dt + timedelta(seconds=current_time_offset + 60)

            response = self.client.post(
                reverse("workoutsession-finish", kwargs={"pk": session_id})
            )
            self.assertEqual(response.status_code, 200)
            self.assertIsNotNone(response.data["endedAt"])

        # Verify session is marked as finished
        session.refresh_from_db()
        self.assertIsNotNone(session.finished_at)

        # Workout finish time should be after the last set completion
        self.assertGreater(session.finished_at, last_set_time)

    def test_workout_flow_update_set_values_before_completing(self):
        """Test updating weight/reps on a set before marking it complete."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get the first bench press set (using frontend field names)
        bench_sets = [s for s in sets if s["exerciseId"] == self.bench_press.id]
        first_set_id = bench_sets[0]["id"]

        # Update weight and reps before completing
        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": first_set_id}),
            {"weight": "135.00", "reps": 10},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(float(response.data["weight"]), 135.00)
        self.assertEqual(response.data["reps"], 10)

        # Now mark as complete
        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": first_set_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(float(response.data["weight"]), 135.00)
        self.assertEqual(response.data["reps"], 10)

    def test_workout_flow_partial_completion(self):
        """Test a workout where not all sets are completed."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Complete only first 5 sets
        set_ids = [s["id"] for s in sets[:5]]
        for set_id in set_ids:
            response = self.client.post(
                reverse("workoutset-complete", kwargs={"pk": set_id})
            )
            self.assertEqual(response.status_code, 200)

        # Finish the workout anyway
        response = self.client.post(
            reverse("workoutsession-finish", kwargs={"pk": session_id})
        )
        self.assertEqual(response.status_code, 200)

        # Verify session is finished
        session = WorkoutSession.objects.get(id=session_id)
        self.assertIsNotNone(session.finished_at)

        # Verify only 5 sets are complete
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 5)

    def test_workout_flow_user_can_only_see_own_sets(self):
        """Test that users can only see and modify their own workout sets."""
        # Create another user and their session
        other_user = User.objects.create_user(username="otheruser", email="other@test.com", password="pass")
        other_session = WorkoutSession.objects.create(user=other_user, name="Other's Workout")
        other_set = WorkoutSet.objects.create(
            session=other_session,
            set_order=0,
            exercise=self.bench_press
        )

        # Try to access other user's set
        response = self.client.get(reverse("workoutset-detail", kwargs={"pk": other_set.id}))
        self.assertEqual(response.status_code, 404)

        # Try to complete other user's set
        response = self.client.post(reverse("workoutset-complete", kwargs={"pk": other_set.id}))
        self.assertEqual(response.status_code, 404)

    def test_workout_flow_realistic_timing(self):
        """Test with more realistic timing: warmup, working sets with varying rest times."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        from datetime import datetime, timedelta
        from django.utils import timezone

        base_dt = timezone.make_aware(datetime(2024, 1, 15, 14, 0, 0))

        with patch("django.utils.timezone.now") as mock_now:
            current_offset = 0

            for i, set_data in enumerate(sets):
                set_id = set_data["id"]

                # Simulate realistic rest times:
                # - After warmup: 60 seconds
                # - After heavy compound: 120-180 seconds
                # - After isolation: 60-90 seconds
                # - After bodyweight: 60 seconds
                is_warmup = set_data.get("weight") is None
                is_compound = Exercise.objects.get(id=set_data["exerciseId"]).is_compound
                is_bodyweight = Exercise.objects.get(id=set_data["exerciseId"]).is_bodyweight

                if is_warmup:
                    rest_time = 60
                elif is_compound:
                    rest_time = random.randint(120, 180)
                elif is_bodyweight:
                    rest_time = 60
                else:
                    rest_time = random.randint(60, 90)

                current_offset += rest_time
                mock_now.return_value = base_dt + timedelta(seconds=current_offset)

                response = self.client.post(
                    reverse("workoutset-complete", kwargs={"pk": set_id})
                )
                self.assertEqual(response.status_code, 200)

            # Finish workout 2 minutes after last set
            current_offset += 120
            mock_now.return_value = base_dt + timedelta(seconds=current_offset)

            response = self.client.post(
                reverse("workoutsession-finish", kwargs={"pk": session_id})
            )
            self.assertEqual(response.status_code, 200)

        # Verify the workout took a realistic amount of time
        # Use the time between first set completion and finish (since created_at uses DB time)
        session = WorkoutSession.objects.get(id=session_id)
        first_set = session.sets.filter(completed_at__isnull=False).order_by("completed_at").first()
        workout_duration = (session.finished_at - first_set.completed_at).total_seconds()

        # Should be a reasonable workout duration (10 sets with warmups and compounds)
        # Minimum: ~10 minutes, Maximum: ~45 minutes
        self.assertGreater(workout_duration, 600)  # At least 10 minutes
        self.assertLess(workout_duration, 3600)  # Less than 1 hour

    def test_workout_flow_bodyweight_tracking(self):
        """Test tracking user's bodyweight at the workout session level."""
        # Start workout with bodyweight
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id}),
            {"bodyweight": "180.5"},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        session_id = response.data["session"]["id"]

        # Verify bodyweight is in the response
        self.assertEqual(float(response.data["session"]["bodyweight"]), 180.5)

        # Complete a dips set (bodyweight exercise)
        sets = response.data["sets"]
        dips_sets = [s for s in sets if s["exerciseId"] == self.dips.id]
        self.assertGreater(len(dips_sets), 0, "Should have at least one dips set")

        first_dips_set_id = dips_sets[0]["id"]

        # Update the set with reps before completing
        response = self.client.patch(
            reverse("workoutset-detail", kwargs={"pk": first_dips_set_id}),
            {"reps": 12},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reps"], 12)

        # Mark as complete
        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": first_dips_set_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(response.data["reps"], 12)

        # Verify the bodyweight is stored on the session, not the set
        session = WorkoutSession.objects.get(id=session_id)
        self.assertEqual(float(session.bodyweight), 180.5)

        workout_set = WorkoutSet.objects.get(id=first_dips_set_id)
        self.assertEqual(workout_set.reps, 12)

    def test_workout_session_create_with_bodyweight(self):
        """Test creating a workout session with bodyweight data."""
        from datetime import datetime
        from django.utils import timezone

        session_data = {
            "name": "Test Bodyweight Session",
            "startedAt": timezone.now().isoformat(),
            "bodyweight": 175.0,
            "sets": [
                {
                    "exerciseId": self.dips.id,
                    "setType": "normal",
                    "reps": 15
                }
            ]
        }

        response = self.client.post(
            reverse("workoutsession-list"),
            session_data,
            format="json"
        )
        self.assertEqual(response.status_code, 201)

        # Verify the session and set were created
        session_id = response.data["id"]
        session = WorkoutSession.objects.get(id=session_id)

        # Verify bodyweight is stored on the session
        self.assertEqual(float(session.bodyweight), 175.0)

        # Get the created set
        workout_set = session.sets.first()
        self.assertIsNotNone(workout_set)
        self.assertEqual(workout_set.exercise.id, self.dips.id)
        self.assertEqual(workout_set.reps, 15)

    def test_workout_set_uncomplete(self):
        """Test uncompleting a set using the uncomplete endpoint."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        sets = response.data["sets"]

        # Get the first bench press set (using frontend field names)
        bench_sets = [s for s in sets if s["exerciseId"] == self.bench_press.id]
        first_set_id = bench_sets[0]["id"]

        # Mark as complete
        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": first_set_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Verify it's complete in the database
        workout_set = WorkoutSet.objects.get(id=first_set_id)
        self.assertIsNotNone(workout_set.completed_at)

        # Now uncomplete it
        response = self.client.post(
            reverse("workoutset-uncomplete", kwargs={"pk": first_set_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["loggedAt"])

        # Verify it's uncomplete in the database
        workout_set.refresh_from_db()
        self.assertIsNone(workout_set.completed_at)


class TestSimplifiedSetAPI(TestCase):
    """Test the new simplified API for completing/uncompleting sets.

    New API:
    - PATCH /api/workouts/sessions/{session_id}/sets/{set_id}/ - Complete set (with optional weights)
    - DELETE /api/workouts/sessions/{session_id}/sets/{set_id}/completion/ - Uncomplete set
    """

    def setUp(self):
        """Set up test client, user, and a workout preset."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create exercises
        self.bench_press = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)
        self.dips = Exercise.objects.create(name="Dips", user=None, is_bodyweight=True)

        # Create a simple workout preset
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Test Day",
            day_label="Monday"
        )

        # Bench Press - 3 normal sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.bench_press,
            type="normal",
            sets=3,
            order=0
        )

        # Dips - 2 bodyweight sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.dips,
            type="bodyweight",
            sets=2,
            order=1
        )

    def test_complete_set_via_new_api(self):
        """Test completing a set via PATCH to session/sets endpoint."""
        # Start workout
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        self.assertEqual(response.status_code, 201)
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Get first set
        first_set_id = sets[0]["id"]

        # Complete the set with weight and reps
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {"weight": 100, "reps": 8},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(float(response.data["weight"]), 100)
        self.assertEqual(response.data["reps"], 8)

        # Verify in database
        workout_set = WorkoutSet.objects.get(id=first_set_id)
        self.assertIsNotNone(workout_set.completed_at)
        self.assertEqual(workout_set.weight, 100)
        self.assertEqual(workout_set.reps, 8)

    def test_complete_set_without_data(self):
        """Test completing a set without providing weight/reps."""
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        first_set_id = response.data["sets"][0]["id"]

        # Complete without data
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Verify in database
        workout_set = WorkoutSet.objects.get(id=first_set_id)
        self.assertIsNotNone(workout_set.completed_at)

    def test_uncomplete_set_via_new_api(self):
        """Test uncompleting a set via DELETE to session/sets/completion endpoint."""
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        first_set_id = response.data["sets"][0]["id"]

        # Complete the set
        self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {},
            format="json"
        )

        # Verify it's complete
        workout_set = WorkoutSet.objects.get(id=first_set_id)
        self.assertIsNotNone(workout_set.completed_at)

        # Uncomplete via DELETE
        response = self.client.delete(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/completion/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["loggedAt"])

        # Verify in database
        workout_set.refresh_from_db()
        self.assertIsNone(workout_set.completed_at)

    def test_cannot_complete_set_from_different_session(self):
        """Test that you can't complete a set from a different session."""
        # Create two users and their sessions
        other_user = User.objects.create_user(username="other", email="other@test.com", password="pass")
        other_session = WorkoutSession.objects.create(user=other_user, name="Other Workout")
        other_set = WorkoutSet.objects.create(
            session=other_session,
            exercise=self.bench_press,
            set_order=0
        )

        # Start our workout
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]

        # Try to complete other user's set using our session_id
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{other_set.id}/",
            {},
            format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_workout_flow_new_api(self):
        """Test full workout flow using new API: start, complete sets, finish."""
        # Start workout
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Expected: 3 bench + 2 dips = 5 sets
        self.assertEqual(len(sets), 5)

        # Complete first 2 sets with data
        for i in range(2):
            set_id = sets[i]["id"]
            response = self.client.patch(
                f"/api/workouts/sessions/{session_id}/sets/{set_id}/",
                {"weight": 80 + i * 5, "reps": 10},
                format="json"
            )
            self.assertEqual(response.status_code, 200)
            self.assertIsNotNone(response.data["loggedAt"])

        # Verify 2 sets complete
        session = WorkoutSession.objects.get(id=session_id)
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 2)

        # Finish workout
        response = self.client.post(f"/api/workouts/sessions/{session_id}/finish/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["endedAt"])

        # Verify session is finished
        session.refresh_from_db()
        self.assertIsNotNone(session.finished_at)

    def test_resume_and_complete_more_sets(self):
        """Test resuming a workout and completing remaining sets."""
        # Start and partially complete workout
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Complete first set
        first_set_id = sets[0]["id"]
        self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {"weight": 100, "reps": 8},
            format="json"
        )

        # Finish workout
        self.client.post(f"/api/workouts/sessions/{session_id}/finish/")

        # Fetch the session (simulating resume)
        response = self.client.get(f"/api/workouts/sessions/{session_id}/")
        self.assertEqual(response.status_code, 200)

        # Verify the completed set is still marked complete
        fetched_sets = response.data["sets"]
        completed_sets = [s for s in fetched_sets if s["loggedAt"] is not None]
        self.assertEqual(len(completed_sets), 1)

        # Complete another set
        second_set_id = sets[1]["id"]
        self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{second_set_id}/",
            {"weight": 100, "reps": 8},
            format="json"
        )

        # Verify 2 sets complete now
        session = WorkoutSession.objects.get(id=session_id)
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 2)

    def test_bodyweight_set_completion(self):
        """Test completing a bodyweight set via new API."""
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Find a dips set (bodyweight)
        dips_sets = [s for s in sets if s["exerciseId"] == self.dips.id]
        dips_set_id = dips_sets[0]["id"]

        # Complete with just reps (bodyweight is tracked separately)
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{dips_set_id}/",
            {"reps": 12},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(response.data["reps"], 12)

    def test_complete_and_uncomplete_cycle(self):
        """Test completing and uncompleting the same set multiple times."""
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        session_id = response.data["session"]["id"]
        first_set_id = response.data["sets"][0]["id"]

        # Complete
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {"weight": 100, "reps": 8},
            format="json"
        )
        self.assertIsNotNone(response.data["loggedAt"])

        # Uncomplete
        response = self.client.delete(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/completion/"
        )
        self.assertIsNone(response.data["loggedAt"])

        # Complete again
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_set_id}/",
            {"weight": 105, "reps": 8},
            format="json"
        )
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(float(response.data["weight"]), 105)


class TestE2ECompleteScenario(TestCase):
    """Single comprehensive backend test that covers E2E scenarios 1, 2, and 5.

    This test replicates the full E2E flow without the frontend:
    - Start workout from preset
    - Complete dropdown sets (with dropdownWeights)
    - Complete normal sets (with weight/reps)
    - Finish workout with partial sets
    - Resume workout and verify loggedAt is populated (checkmarks)
    - Complete more sets and finish again
    - Verify no duplication
    """

    def setUp(self):
        """Set up test client, user, and Push Day preset (matches E2E setup)."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create exercises from E2E Push Day preset
        self.bench_press = Exercise.objects.create(name="Bench Press", user=None, is_compound=True)
        self.incline_dumbbell = Exercise.objects.create(name="Incline Dumbbell Press", user=None, is_compound=True)
        self.overhead_press = Exercise.objects.create(name="Overhead Press", user=None, is_compound=True)
        self.lateral_raises = Exercise.objects.create(name="Lateral Raises", user=None, is_compound=False)
        self.tricep_pushdowns = Exercise.objects.create(name="Tricep Pushdowns", user=None, is_compound=False)

        # Create Push Day preset (matches E2E "Push Day" preset)
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Push Day",
            day_label="Monday"
        )

        # Bench Press - dropdown sets (4 sets with 2 dropdowns)
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.bench_press,
            type="dropdown",
            sets=4,
            dropdowns=2,
            order=0
        )

        # Incline Dumbbell Press - 4 sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.incline_dumbbell,
            type="normal",
            sets=4,
            order=1
        )

        # Overhead Press - 3 sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.overhead_press,
            type="normal",
            sets=3,
            order=2
        )

        # Lateral Raises - 3 sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.lateral_raises,
            type="normal",
            sets=3,
            order=3
        )

        # Tricep Pushdowns - 3 sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.tricep_pushdowns,
            type="normal",
            sets=3,
            order=4
        )

    def test_complete_e2e_scenario(self):
        """
        Complete E2E scenario covering tests 1, 2, and 5:
        1. Start workout from preset
        2. Complete dropdown sets with dropdownWeights
        3. Complete normal sets with weight/reps
        4. Finish workout (with partial sets)
        5. Fetch workout (simulate resume) - verify loggedAt populated
        6. Complete more sets after resume
        7. Finish again - verify no duplication
        """
        # ========== STEP 1: Start workout from preset ==========
        response = self.client.post(
            f"/api/workouts/presets/{self.preset.id}/start_workout/"
        )
        self.assertEqual(response.status_code, 201,
            "start_workout should return 201 Created")

        session_id = response.data["session"]["id"]
        sets = response.data["sets"]

        # Expected: 4 bench (dropdown) + 4 incline + 3 OHP + 3 lateral + 3 tricep = 17 sets
        self.assertEqual(len(sets), 17,
            "Push Day preset should create 17 sets total")

        # ========== STEP 2: Complete dropdown sets (Bench Press with dropdownWeights) ==========
        bench_sets = [s for s in sets if s["exerciseId"] == self.bench_press.id]
        self.assertEqual(len(bench_sets), 4,
            "Should have 4 Bench Press sets (dropdown type)")

        # Complete first dropdown set (W + D1 + D2)
        first_bench_id = bench_sets[0]["id"]
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_bench_id}/",
            {"dropdownWeights": [{"weight": 60, "reps": 10}, {"weight": 57.5, "reps": 10}, {"weight": 55, "reps": 10}]},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"],
            "After completing, loggedAt should be populated")

        # Complete second dropdown set
        second_bench_id = bench_sets[1]["id"]
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{second_bench_id}/",
            {"dropdownWeights": [{"weight": 60, "reps": 10}, {"weight": 57.5, "reps": 10}, {"weight": 55, "reps": 10}]},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # ========== STEP 3: Complete normal set (Overhead Press with weight/reps) ==========
        ohp_sets = [s for s in sets if s["exerciseId"] == self.overhead_press.id]
        first_ohp_id = ohp_sets[0]["id"]

        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_ohp_id}/",
            {"weight": 30, "reps": 8},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])
        self.assertEqual(float(response.data["weight"]), 30)
        self.assertEqual(response.data["reps"], 8)

        # Verify in database
        workout_set = WorkoutSet.objects.get(id=first_ohp_id)
        self.assertIsNotNone(workout_set.completed_at)
        self.assertEqual(workout_set.weight, 30)
        self.assertEqual(workout_set.reps, 8)

        # ========== STEP 4: Finish workout with partial sets (only 3 of 17 completed) ==========
        response = self.client.post(f"/api/workouts/sessions/{session_id}/finish/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["endedAt"],
            "After finish, endedAt should be populated")

        # Verify session is finished in database
        session = WorkoutSession.objects.get(id=session_id)
        self.assertIsNotNone(session.finished_at)

        # Verify partial completion (3 sets done, 14 incomplete)
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        incomplete_count = session.sets.filter(completed_at__isnull=True).count()
        self.assertEqual(completed_count, 3,
            "Should have 3 completed sets")
        self.assertEqual(incomplete_count, 14,
            "Should have 14 incomplete sets")

        # ========== STEP 5: Fetch workout (simulate resume) - verify loggedAt populated ==========
        # This is the CRITICAL test for E2E Test 5 - checkmarks should be visible after resume
        response = self.client.get(f"/api/workouts/sessions/{session_id}/")
        self.assertEqual(response.status_code, 200)

        fetched_sets = response.data["sets"]
        self.assertEqual(len(fetched_sets), 17,
            "Fetched workout should have all 17 sets")

        # CRITICAL: Verify completed sets have loggedAt populated
        # This is what the frontend uses to show checkmarks
        completed_sets = [s for s in fetched_sets if s["loggedAt"] is not None]
        self.assertEqual(len(completed_sets), 3,
            "Expected 3 completed sets with loggedAt populated for resume (checkmarks visible)")

        # Verify the specific sets are marked complete
        completed_ids = {s["id"] for s in completed_sets}
        self.assertIn(first_bench_id, completed_ids,
            "First Bench Press set should be marked complete")
        self.assertIn(second_bench_id, completed_ids,
            "Second Bench Press set should be marked complete")
        self.assertIn(first_ohp_id, completed_ids,
            "Overhead Press set should be marked complete")

        # ========== STEP 6: Complete more sets after "resume" ==========
        # Complete another Bench Press dropdown set
        third_bench_id = bench_sets[2]["id"]
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{third_bench_id}/",
            {"dropdownWeights": [{"weight": 62.5, "reps": 8}, {"weight": 60, "reps": 8}, {"weight": 57.5, "reps": 8}]},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        # Complete a Lateral Raises set (normal)
        lateral_sets = [s for s in sets if s["exerciseId"] == self.lateral_raises.id]
        first_lateral_id = lateral_sets[0]["id"]
        response = self.client.patch(
            f"/api/workouts/sessions/{session_id}/sets/{first_lateral_id}/",
            {"weight": 10, "reps": 12},
            format="json"
        )
        self.assertEqual(response.status_code, 200)

        # ========== STEP 7: Finish again - verify no duplication ==========
        response = self.client.post(f"/api/workouts/sessions/{session_id}/finish/")
        self.assertEqual(response.status_code, 200)

        # Verify 5 sets complete now
        session.refresh_from_db()
        completed_count = session.sets.filter(completed_at__isnull=False).count()
        self.assertEqual(completed_count, 5,
            "Should have 5 completed sets after resume")

        # Verify only 1 workout exists (not duplicated)
        response = self.client.get("/api/workouts/sessions/")
        self.assertEqual(response.status_code, 200)
        workouts = response.data

        our_workouts = [w for w in workouts if w["id"] == session_id]
        self.assertEqual(len(our_workouts), 1,
            "Expected exactly 1 workout with this ID (not duplicated)")

        # ========== STEP 8: Verify final state ==========
        # Fetch the workout one more time and verify all data
        response = self.client.get(f"/api/workouts/sessions/{session_id}/")
        self.assertEqual(response.status_code, 200)

        workout_data = response.data
        self.assertEqual(workout_data["name"], "Push Day")
        self.assertIsNotNone(workout_data["endedAt"])
        self.assertEqual(len(workout_data["sets"]), 17)

        # Count completed vs incomplete
        final_completed = [s for s in workout_data["sets"] if s["loggedAt"] is not None]
        self.assertEqual(len(final_completed), 5,
            "Final state: 5 sets should be complete")

        print(f"\n=== E2E Complete Scenario Test Summary ===")
        print(f"Session ID: {session_id}")
        print(f"Total sets: {len(workout_data['sets'])}")
        print(f"Completed sets: {len(final_completed)}")
        print(f"Incomplete sets: {len(workout_data['sets']) - len(final_completed)}")
        print(f"Workout name: {workout_data['name']}")
        print(f"Finished at: {workout_data['endedAt']}")
        print(f"=========================================\n")
