from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.services import generate_sets_from_preset
from workouts.models import (
    Exercise,
    WorkoutPreset,
    WorkoutPresetExercise,
    SupersetExerciseItem,
    WorkoutSession,
    WorkoutSet,
)
from users.models import User


class TestGenerateSets(TestCase):
    def test_normal_exercise_creates_correct_sets(self):
        exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(
            exercise=exercise, type="normal", sets=3, order=0
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 3)

    def test_normal_exercise_with_warmup(self):
        exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(
            exercise=exercise, type="normal", sets=3, include_warmup=True, order=0
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 4)
        self.assertIsNone(sets[0].weight)  # warmup has no weight

    def test_bodyweight_exercise_creates_correct_sets(self):
        exercise = Exercise(id=1, name="Push-ups", is_bodyweight=True)
        preset_ex = WorkoutPresetExercise(
            exercise=exercise, type="normal", sets=3, order=0
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 3)

    def test_dropdown_exercise_creates_working_and_drop_sets(self):
        exercise = Exercise(id=1, name="Bench Press", is_bodyweight=False)
        preset_ex = WorkoutPresetExercise(
            exercise=exercise, type="dropdown", sets=2, dropdowns=2, order=0
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)
        self.assertEqual(sets[0].weight, 60)
        self.assertEqual(sets[1].weight, 57.5)

    def test_superset_creates_round_robin_sets(self):
        user = User.objects.create_user(username="test", password="test")
        preset = WorkoutPreset.objects.create(user=user, name="Test Preset")
        ex1 = Exercise.objects.create(name="Bench Press", is_bodyweight=False)
        ex2 = Exercise.objects.create(name="Rows", is_bodyweight=False)
        preset_ex = WorkoutPresetExercise.objects.create(
            type="superset", sets=3, preset=preset, order=0
        )
        sup1 = SupersetExerciseItem.objects.create(
            exercise=ex1, superset=preset_ex, order=0
        )
        sup2 = SupersetExerciseItem.objects.create(
            exercise=ex2, superset=preset_ex, order=1
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)

    def test_superset_with_warmup(self):
        user = User.objects.create_user(username="test", password="test")
        preset = WorkoutPreset.objects.create(user=user, name="Test Preset")
        ex1 = Exercise.objects.create(name="Bench Press", is_bodyweight=False)
        ex2 = Exercise.objects.create(name="Rows", is_bodyweight=False)
        preset_ex = WorkoutPresetExercise.objects.create(
            type="superset", sets=2, preset=preset, order=0
        )
        sup1 = SupersetExerciseItem.objects.create(
            exercise=ex1, superset=preset_ex, include_warmup=True, order=0
        )
        sup2 = SupersetExerciseItem.objects.create(
            exercise=ex2, superset=preset_ex, include_warmup=True, order=1
        )
        session = WorkoutSession(id=1, name="Test")
        sets = generate_sets_from_preset([preset_ex], session)
        self.assertEqual(len(sets), 6)
        self.assertIsNone(sets[0].weight)
        self.assertIsNone(sets[1].weight)


class TestComprehensiveScenarios(TestCase):
    def test_bench_press_with_warmup_and_dropdown_sets(self):
        bench_press = Exercise.objects.create(name="Bench Press", is_bodyweight=False)
        bp_exercise = WorkoutPresetExercise(
            exercise=bench_press,
            type="dropdown",
            sets=3,
            dropdowns=2,
            include_warmup=True,
            order=0,
        )
        session = WorkoutSession(id=1, name="Push Day")
        sets = generate_sets_from_preset([bp_exercise], session)
        self.assertEqual(len(sets), 10)
        self.assertIsNone(sets[0].weight)
        self.assertEqual(sets[1].weight, 60)

    def test_superset_dips_and_bend_over_rows(self):
        user = User.objects.create_user(username="test", password="test")
        preset = WorkoutPreset.objects.create(user=user, name="Test Preset")
        dips = Exercise.objects.create(name="Dips", is_bodyweight=True)
        rows = Exercise.objects.create(name="Bend Over Rows", is_bodyweight=False)
        superset = WorkoutPresetExercise.objects.create(
            type="superset", sets=4, preset=preset, order=0
        )
        dips_item = SupersetExerciseItem.objects.create(
            exercise=dips, superset=superset, include_warmup=False, order=0
        )
        rows_item = SupersetExerciseItem.objects.create(
            exercise=rows, superset=superset, include_warmup=True, order=1
        )
        session = WorkoutSession(id=1, name="Push Day")
        sets = generate_sets_from_preset([superset], session)
        self.assertEqual(len(sets), 9)
        self.assertIsNone(sets[0].weight)

    def test_full_push_day_scenario(self):
        user = User.objects.create_user(username="test", password="test")
        preset = WorkoutPreset.objects.create(user=user, name="Test Preset")
        bench_press = Exercise.objects.create(name="Bench Press", is_bodyweight=False)
        dips = Exercise.objects.create(name="Dips", is_bodyweight=True)
        overhead_press = Exercise.objects.create(
            name="Overhead Press", is_bodyweight=False
        )
        lateral_raises = Exercise.objects.create(
            name="Lateral Raises", is_bodyweight=False
        )
        bp = WorkoutPresetExercise(
            exercise=bench_press,
            type="dropdown",
            sets=4,
            dropdowns=2,
            include_warmup=True,
            order=0,
        )
        superset = WorkoutPresetExercise.objects.create(
            type="superset", sets=3, preset=preset, order=1
        )
        dips_item = SupersetExerciseItem.objects.create(
            exercise=dips, superset=superset, include_warmup=True, order=0
        )
        ohp_item = SupersetExerciseItem.objects.create(
            exercise=overhead_press, superset=superset, include_warmup=True, order=1
        )
        laterals = WorkoutPresetExercise(
            exercise=lateral_raises,
            type="normal",
            sets=3,
            include_warmup=False,
            order=2,
        )
        session = WorkoutSession(id=1, name="Push Day")
        sets = generate_sets_from_preset([bp, superset, laterals], session)
        self.assertEqual(len(sets), 24)


class TestStartWorkoutIntegration(TestCase):
    """Integration test for creating a preset and starting a workout via API."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client.force_authenticate(user=self.user)

    def test_full_push_day_workout_via_api(self):
        """
        Full integration test:
        1. Create exercises
        2. Create a workout preset with normal, dropdown, and superset exercises
        3. Start workout from preset via API
        4. Verify session and sets are created correctly
        """
        # Step 1: Create exercises via API
        exercises_data = [
            {"name": "Bench Press", "is_bodyweight": False},
            {"name": "Dips", "is_bodyweight": True},
            {"name": "Overhead Press", "is_bodyweight": False},
            {"name": "Lateral Raises", "is_bodyweight": False},
        ]

        created_exercises = {}
        for ex_data in exercises_data:
            response = self.client.post(reverse("exercise-list"), ex_data, format="json")
            self.assertEqual(response.status_code, 201)
            created_exercises[ex_data["name"]] = response.data["id"]

        # Step 2: Create a workout preset
        preset_data = {
            "name": "Push Day",
            "notes": "Weekly push workout"
        }
        response = self.client.post(reverse("workoutpreset-list"), preset_data, format="json")
        self.assertEqual(response.status_code, 201)
        preset_id = response.data["id"]

        # Step 3: Add exercises to the preset
        # Bench Press - dropdown with warmup
        WorkoutPresetExercise.objects.create(
            preset_id=preset_id,
            exercise_id=created_exercises["Bench Press"],
            type="dropdown",
            sets=3,
            dropdowns=2,
            include_warmup=True,
            order=0
        )

        # Superset: Dips + Overhead Press
        superset_ex = WorkoutPresetExercise.objects.create(
            preset_id=preset_id,
            type="superset",
            sets=3,
            order=1
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex,
            exercise_id=created_exercises["Dips"],
            include_warmup=True,
            order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex,
            exercise_id=created_exercises["Overhead Press"],
            include_warmup=True,
            order=1
        )

        # Lateral Raises - normal sets
        WorkoutPresetExercise.objects.create(
            preset_id=preset_id,
            exercise_id=created_exercises["Lateral Raises"],
            type="normal",
            sets=3,
            include_warmup=False,
            order=2
        )

        # Step 4: Start workout from preset via API
        response = self.client.post(reverse("workoutpreset-start-workout", kwargs={"pk": preset_id}))
        self.assertEqual(response.status_code, 201)

        # Step 5: Verify the response
        self.assertIn("session", response.data)
        self.assertIn("sets", response.data)

        session_data = response.data["session"]
        self.assertEqual(session_data["name"], "Push Day")
        self.assertEqual(session_data["notes"], "Weekly push workout")
        self.assertEqual(session_data["user_id"], self.user.id)
        self.assertEqual(session_data["preset_id"], preset_id)

        sets = response.data["sets"]
        # Expected:
        # - Bench Press: 1 warmup + 3 working (with 2 drops each) = 1 + 3*3 = 10 sets
        # - Superset warmups: 2 (one for each exercise) = 2 sets
        # - Superset working: 3 rounds * 2 exercises = 6 sets
        # - Lateral Raises: 3 sets
        # Total = 10 + 2 + 6 + 3 = 21 sets
        self.assertEqual(len(sets), 21)

        # Verify warmup sets have no weight
        warmup_sets = [s for s in sets if s["weight"] is None]
        self.assertGreaterEqual(len(warmup_sets), 3)  # At least 3 warmups

        # Verify bench press dropdown structure
        bench_sets = [s for s in sets if s["exercise_id"] == created_exercises["Bench Press"]]
        self.assertEqual(len(bench_sets), 10)
        # First is warmup
        self.assertIsNone(bench_sets[0]["weight"])
        # Then working + dropdowns (3 rounds of 1 working + 2 drops)
        for i in range(1, 10):
            self.assertIsNotNone(bench_sets[i]["weight"])

        # Verify superset round-robin order
        # After warmups, we should have: Dips, OHP, Dips, OHP, Dips, OHP
        dip_sets = [s for s in sets if s["exercise_id"] == created_exercises["Dips"]]
        ohp_sets = [s for s in sets if s["exercise_id"] == created_exercises["Overhead Press"]]

        # Dips: 1 warmup + 3 working = 4
        # OHP: 1 warmup + 3 working = 4
        self.assertEqual(len(dip_sets), 4)
        self.assertEqual(len(ohp_sets), 4)

        # Verify sets were persisted to database
        session = WorkoutSession.objects.get(id=session_data["id"])
        db_sets = list(session.sets.all().order_by("set_order"))
        self.assertEqual(len(db_sets), 21)

        # Verify set order is sequential
        for i, s in enumerate(db_sets):
            self.assertEqual(s.set_order, i)


class TestPresetExercisesInAPI(TestCase):
    """Test that presets include exercises in API responses."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data once for the entire class."""
        cls.user = User.objects.create_user(username="preset_api_user", password="testpass")
        cls.exercise1 = Exercise.objects.create(name="Bench Press", is_bodyweight=False)
        cls.exercise2 = Exercise.objects.create(name="Squats", is_bodyweight=False)

    def setUp(self):
        """Set up test client for each test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_presets_includes_exercises(self):
        """Test that listing presets returns exercises array."""
        # Create a preset with an exercise
        preset = WorkoutPreset.objects.create(user=self.user, name="Push Day")
        WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=self.exercise1,
            type="normal",
            sets=3,
            order=0
        )

        # List presets
        response = self.client.get(reverse("workoutpreset-list"))
        self.assertEqual(response.status_code, 200)

        # Verify exercises are included
        self.assertEqual(len(response.data), 1)
        preset_data = response.data[0]
        self.assertIn("exercises", preset_data)
        self.assertIsInstance(preset_data["exercises"], list)
        self.assertEqual(len(preset_data["exercises"]), 1)

        # Verify exercise data structure
        exercise_data = preset_data["exercises"][0]
        self.assertEqual(exercise_data["type"], "normal")
        self.assertEqual(exercise_data["sets"], 3)
        self.assertEqual(exercise_data["exerciseId"], self.exercise1.id)

    def test_get_preset_detail_includes_exercises(self):
        """Test that getting a preset detail returns exercises array."""
        # Create a preset with multiple exercises
        preset = WorkoutPreset.objects.create(user=self.user, name="Full Body")
        WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=self.exercise1,
            type="normal",
            sets=3,
            order=0
        )
        WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=self.exercise2,
            type="dropdown",
            sets=4,
            dropdowns=2,
            order=1
        )

        # Get preset detail
        response = self.client.get(reverse("workoutpreset-detail", kwargs={"pk": preset.id}))
        self.assertEqual(response.status_code, 200)

        # Verify exercises are included
        preset_data = response.data
        self.assertIn("exercises", preset_data)
        self.assertEqual(len(preset_data["exercises"]), 2)

        # Verify exercises are in correct order
        self.assertEqual(preset_data["exercises"][0]["exerciseId"], self.exercise1.id)
        self.assertEqual(preset_data["exercises"][1]["exerciseId"], self.exercise2.id)

    def test_create_preset_then_get_includes_exercises(self):
        """Test that creating a preset and then fetching it includes exercises."""
        # Create a preset via API
        preset_data = {"name": "Push Day", "notes": "Chest focused"}
        response = self.client.post(reverse("workoutpreset-list"), preset_data, format="json")
        self.assertEqual(response.status_code, 201)
        preset_id = response.data["id"]

        # Add an exercise to the preset
        WorkoutPresetExercise.objects.create(
            preset_id=preset_id,
            exercise=self.exercise1,
            type="normal",
            sets=3,
            order=0
        )

        # Fetch the preset
        response = self.client.get(reverse("workoutpreset-detail", kwargs={"pk": preset_id}))
        self.assertEqual(response.status_code, 200)

        # Verify exercises are included
        self.assertIn("exercises", response.data)
        self.assertEqual(len(response.data["exercises"]), 1)

    def test_superset_exercise_includes_superset_exercises(self):
        """Test that superset exercises include nested superset_exercises array."""
        # Create a preset with a superset
        preset = WorkoutPreset.objects.create(user=self.user, name="Upper Body")
        superset_ex = WorkoutPresetExercise.objects.create(
            preset=preset,
            type="superset",
            sets=3,
            order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex,
            exercise=self.exercise1,
            type="normal",
            order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex,
            exercise=self.exercise2,
            type="normal",
            order=1
        )

        # Get the preset
        response = self.client.get(reverse("workoutpreset-detail", kwargs={"pk": preset.id}))
        self.assertEqual(response.status_code, 200)

        # Verify superset_exercises are included
        exercises = response.data["exercises"]
        self.assertEqual(len(exercises), 1)
        superset_data = exercises[0]
        self.assertEqual(superset_data["type"], "superset")
        self.assertIn("supersetExercises", superset_data)
        self.assertEqual(len(superset_data["supersetExercises"]), 2)

        # Verify superset items have correct exercise IDs
        superset_ids = [item["exerciseId"] for item in superset_data["supersetExercises"]]
        self.assertIn(self.exercise1.id, superset_ids)
        self.assertIn(self.exercise2.id, superset_ids)
