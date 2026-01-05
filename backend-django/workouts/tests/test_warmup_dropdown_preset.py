"""
Test that replicates preset id=4 from production:
- Bench Press: warmup + 4 dropdown sets (with 2 dropdowns each)
- Incline Dumbbell Press: 4 normal sets
- Overhead Press: 3 normal sets
- Lateral Raises: 3 normal sets
- Tricep Pushdowns: 3 normal sets

The bug was: warmup sets were created with setType="normal" instead of "warmup".
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise,
    WorkoutSession, WorkoutSet,
)
from users.models import User


class TestWarmupDropdownPreset(TestCase):
    """Test the Push Day preset structure (like preset id=4)."""

    def setUp(self):
        """Set up test client, user, and a preset matching id=4."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create the preset
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Push Day",
            notes="Weekly push workout for chest, shoulders, and triceps"
        )

        # Create exercises
        from workouts.models import Exercise
        self.bench_press = Exercise.objects.create(
            name="Bench Press",
            user=None,
            is_compound=True
        )
        self.incline_dumbbell = Exercise.objects.create(
            name="Incline Dumbbell Press",
            user=None,
            is_compound=True
        )
        self.overhead_press = Exercise.objects.create(
            name="Overhead Press",
            user=None,
            is_compound=True
        )
        self.lateral_raises = Exercise.objects.create(
            name="Lateral Raises",
            user=None,
            is_compound=False
        )
        self.tricep_pushdowns = Exercise.objects.create(
            name="Tricep Pushdowns",
            user=None,
            is_compound=False
        )

        # Bench Press - warmup + 4 dropdown sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.bench_press,
            type="dropdown",
            sets=4,
            dropdowns=2,
            include_warmup=True,
            order=0
        )

        # Incline Dumbbell Press - 4 normal sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.incline_dumbbell,
            type="normal",
            sets=4,
            order=1
        )

        # Overhead Press - 3 normal sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.overhead_press,
            type="normal",
            sets=3,
            order=2
        )

        # Lateral Raises - 3 normal sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.lateral_raises,
            type="normal",
            sets=3,
            order=3
        )

        # Tricep Pushdowns - 3 normal sets
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.tricep_pushdowns,
            type="normal",
            sets=3,
            order=4
        )

    def test_warmup_set_has_correct_type(self):
        """Test that warmup sets are created with setType='warmup', not 'normal'."""
        # Start workout from preset
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        sets = response.data["sets"]

        # Expected: 1 warmup + 4 dropdown + 4 + 3 + 3 + 3 = 18 sets
        self.assertEqual(len(sets), 18)

        # First set should be a warmup set
        first_set = sets[0]
        self.assertEqual(first_set["setType"], "warmup",
            f"First set should be warmup type, got {first_set['setType']}")
        self.assertIsNone(first_set["weight"],
            "Warmup set should have no weight")
        self.assertEqual(first_set["exerciseId"], self.bench_press.id,
            "First warmup should be Bench Press")

        # The next 4 should be dropdown sets
        bench_dropdowns = [s for s in sets if s["exerciseId"] == self.bench_press.id and s["setType"] == "dropdown"]
        self.assertEqual(len(bench_dropdowns), 4,
            "Should have 4 Bench Press dropdown sets")

        # Each dropdown set should have dropdown_weights with 3 items (main + 2 drops)
        for dropdown_set in bench_dropdowns:
            self.assertEqual(len(dropdown_set["dropdownWeights"]), 3,
                f"Dropdown set {dropdown_set['id']} should have 3 dropdown weights (main + 2 drops)")

    def test_warmup_set_serialization(self):
        """Test that warmup sets are properly serialized and returned by active endpoint."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        session_id = response.data["session"]["id"]

        # Get active sessions
        response = self.client.get(reverse("workoutsession-active"))
        self.assertEqual(response.status_code, 200)

        sessions = response.data
        self.assertEqual(len(sessions), 1)
        sets = sessions[0]["sets"]

        # Find the warmup set
        warmup_sets = [s for s in sets if s["setType"] == "warmup"]
        self.assertEqual(len(warmup_sets), 1,
            "Should have exactly 1 warmup set")

        warmup = warmup_sets[0]
        self.assertEqual(warmup["setType"], "warmup")
        self.assertIsNone(warmup["weight"])
        self.assertEqual(warmup["exerciseId"], self.bench_press.id)

    def test_frontend_warmup_detection(self):
        """
        Test that warmup sets can be detected by frontend logic.
        Frontend checks setType === 'warmup' to identify warmup sets.
        """
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        sets = response.data["sets"]

        # Simulate frontend logic from setItems.ts:
        # if (setType === 'warmup') { return new WarmupSetItem(...); }
        warmup_sets = [s for s in sets if s["setType"] == "warmup"]
        normal_sets = [s for s in sets if s["setType"] == "normal"]
        dropdown_sets = [s for s in sets if s["setType"] == "dropdown"]

        self.assertEqual(len(warmup_sets), 1,
            "Frontend should find exactly 1 warmup set")
        self.assertEqual(len(normal_sets), 13,
            "Frontend should find 13 normal sets (4+3+3+3)")
        self.assertEqual(len(dropdown_sets), 4,
            "Frontend should find 4 dropdown sets")

    def test_warmup_set_can_be_completed(self):
        """Test that warmup sets can be completed like other sets."""
        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        sets = response.data["sets"]
        warmup_id = sets[0]["id"]

        # Complete the warmup set
        response = self.client.post(
            reverse("workoutset-complete", kwargs={"pk": warmup_id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["loggedAt"])

        # Verify it's marked complete
        workout_set = WorkoutSet.objects.get(id=warmup_id)
        self.assertIsNotNone(workout_set.completed_at)


class TestBodyweightWarmup(TestCase):
    """Test that bodyweight exercises with warmup create warmup-type sets."""

    def setUp(self):
        """Set up test client, user, and a preset with bodyweight warmup."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@test.com", password="pass")
        self.client.force_authenticate(user=self.user)

        # Create the preset
        self.preset = WorkoutPreset.objects.create(
            user=None,
            name="Bodyweight Day",
            notes="Workout with bodyweight exercises"
        )

        # Create bodyweight exercise
        from workouts.models import Exercise
        self.dips = Exercise.objects.create(
            name="Dips",
            user=None,
            is_bodyweight=True
        )
        self.pullups = Exercise.objects.create(
            name="Pull-ups",
            user=None,
            is_bodyweight=True
        )

    def test_bodyweight_exercise_with_warmup_creates_warmup_type(self):
        """
        Test that a bodyweight exercise with include_warmup=True creates
        a warmup set (setType='warmup'), not a bodyweight set.

        Current bug: bodyweight warmup sets are created as type='bodyweight'.
        Expected: they should be type='warmup' so the frontend can identify them.
        """
        # Create a bodyweight preset exercise with warmup
        WorkoutPresetExercise.objects.create(
            preset=self.preset,
            exercise=self.dips,
            type="bodyweight",
            sets=3,
            include_warmup=True,
            order=0
        )

        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        sets = response.data["sets"]

        # Expected: 1 warmup + 3 bodyweight = 4 sets
        self.assertEqual(len(sets), 4)

        # First set should be a warmup set
        first_set = sets[0]
        self.assertEqual(first_set["setType"], "warmup",
            f"First set should be warmup type even for bodyweight exercise, got {first_set['setType']}")
        self.assertIsNone(first_set["weight"],
            "Warmup set should have no weight")
        self.assertEqual(first_set["exerciseId"], self.dips.id,
            "First warmup should be Dips")

        # The remaining sets should be bodyweight type
        bodyweight_sets = [s for s in sets if s["setType"] == "bodyweight"]
        self.assertEqual(len(bodyweight_sets), 3,
            "Should have 3 bodyweight working sets")

    def test_bodyweight_superset_with_warmup_creates_warmup_type(self):
        """
        Test that bodyweight exercises in a superset with warmup create
        warmup-type sets, not bodyweight-type sets.
        """
        # Create a superset with bodyweight exercises, both with warmup
        from workouts.models import SupersetExerciseItem
        superset = WorkoutPresetExercise.objects.create(
            preset=self.preset,
            type="superset",
            sets=3,
            order=0
        )

        SupersetExerciseItem.objects.create(
            superset=superset,
            exercise=self.dips,
            type="bodyweight",
            include_warmup=True,
            order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset,
            exercise=self.pullups,
            type="bodyweight",
            include_warmup=True,
            order=1
        )

        # Start workout
        response = self.client.post(
            reverse("workoutpreset-start-workout", kwargs={"pk": self.preset.id})
        )
        self.assertEqual(response.status_code, 201)

        sets = response.data["sets"]

        # Expected: 2 warmups + 3 rounds * 2 exercises = 8 sets
        self.assertEqual(len(sets), 8)

        # First two sets should be warmup sets
        warmup_sets = [s for s in sets if s["setType"] == "warmup"]
        self.assertEqual(len(warmup_sets), 2,
            "Should have 2 warmup sets (one for each bodyweight exercise)")

        # Verify warmup sets are type 'warmup', not 'bodyweight'
        dips_warmup = next((s for s in warmup_sets if s["exerciseId"] == self.dips.id), None)
        pullups_warmup = next((s for s in warmup_sets if s["exerciseId"] == self.pullups.id), None)

        self.assertIsNotNone(dips_warmup)
        self.assertIsNotNone(pullups_warmup)

        self.assertEqual(dips_warmup["setType"], "warmup")
        self.assertEqual(pullups_warmup["setType"], "warmup")
