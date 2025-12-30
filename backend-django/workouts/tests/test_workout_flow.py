import time
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
                self.assertIsNotNone(response.data["completed_at"])

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
            self.assertIsNotNone(response.data["finished_at"])

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

        # Get the first bench press set
        bench_sets = [s for s in sets if s["exercise_id"] == self.bench_press.id]
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
        self.assertIsNotNone(response.data["completed_at"])
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
                is_compound = Exercise.objects.get(id=set_data["exercise_id"]).is_compound
                is_bodyweight = Exercise.objects.get(id=set_data["exercise_id"]).is_bodyweight

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
