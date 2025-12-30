from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import (
    WorkoutPreset, WorkoutPresetExercise, Exercise,
    WorkoutPlan, WorkoutPlanPreset, SupersetExerciseItem
)
from users.models import User


class TestPresetTemplates(TestCase):
    """Test cases for preset templates (user=None, always copyable)."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1t", email="user1t@test.com", password="pass")
        self.user2 = User.objects.create_user(username="user2t", email="user2t@test.com", password="pass")

        # Create template preset (user=None)
        self.template_preset = WorkoutPreset.objects.create(
            user=None,
            name="Push Day Template",
            notes="Standard push workout"
        )
        # Add exercise to template
        self.exercise = Exercise.objects.create(name="Bench Press", user=None)
        WorkoutPresetExercise.objects.create(
            preset=self.template_preset,
            exercise=self.exercise,
            type="normal",
            sets=3,
            order=0
        )

    def test_template_preset_has_no_user(self):
        """Template presets have user=None."""
        preset = WorkoutPreset.objects.get(name="Push Day Template")
        self.assertIsNone(preset.user)

    def test_list_templates_returns_template_presets(self):
        """GET /presets/templates/ returns all template presets."""
        response = self.client.get(reverse("workoutpreset-templates"))
        self.assertEqual(response.status_code, 200)
        preset_ids = [p["id"] for p in response.data]
        self.assertIn(self.template_preset.id, preset_ids)

    def test_user_can_copy_template_preset(self):
        """User can create a preset from a template."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutpreset-create-from-template"),
            {"template_id": self.template_preset.id},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Push Day Template")
        self.assertEqual(response.data["user_id"], self.user1.id)

        # Verify the preset was copied with exercises
        new_preset = WorkoutPreset.objects.get(id=response.data["id"])
        self.assertEqual(new_preset.exercises.count(), 1)
        self.assertEqual(new_preset.exercises.first().exercise.name, "Bench Press")

    def test_template_preset_cannot_be_modified(self):
        """Template presets cannot be modified via PATCH."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("workoutpreset-detail", kwargs={"pk": self.template_preset.id})
        response = self.client.patch(url, {"name": "Hacked Template"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot modify template presets", response.data["error"])

    def test_template_preset_cannot_be_deleted(self):
        """Template presets cannot be deleted."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("workoutpreset-detail", kwargs={"pk": self.template_preset.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot delete template presets", response.data["error"])


class TestPublicAndPrivatePresets(TestCase):
    """Test cases for public vs private user presets."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1p", email="user1p@test.com", password="pass")
        self.user2 = User.objects.create_user(username="user2p", email="user2p@test.com", password="pass")

        # Create public preset
        self.public_preset = WorkoutPreset.objects.create(
            user=self.user1,
            name="Public Preset",
            is_public=True
        )
        ex = Exercise.objects.create(name="Squat", user=None)
        WorkoutPresetExercise.objects.create(
            preset=self.public_preset, exercise=ex, type="normal", sets=3, order=0
        )

        # Create private preset
        self.private_preset = WorkoutPreset.objects.create(
            user=self.user1,
            name="Private Preset",
            is_public=False
        )
        ex2 = Exercise.objects.create(name="Deadlift", user=None)
        WorkoutPresetExercise.objects.create(
            preset=self.private_preset, exercise=ex2, type="normal", sets=3, order=0
        )

    def test_templates_endpoint_includes_public_presets(self):
        """GET /presets/templates/ includes public user presets."""
        response = self.client.get(reverse("workoutpreset-templates"))
        self.assertEqual(response.status_code, 200)
        preset_ids = [p["id"] for p in response.data]
        self.assertIn(self.public_preset.id, preset_ids)

    def test_templates_endpoint_excludes_private_presets(self):
        """GET /presets/templates/ excludes private user presets."""
        response = self.client.get(reverse("workoutpreset-templates"))
        self.assertEqual(response.status_code, 200)
        preset_ids = [p["id"] for p in response.data]
        self.assertNotIn(self.private_preset.id, preset_ids)

    def test_can_copy_public_preset_from_another_user(self):
        """User can copy another user's public preset."""
        self.client.force_authenticate(user=self.user2)
        response = self.client.post(
            reverse("workoutpreset-create-from-template"),
            {"template_id": self.public_preset.id},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user_id"], self.user2.id)

    def test_cannot_copy_private_preset_from_another_user(self):
        """User cannot copy another user's private preset."""
        self.client.force_authenticate(user=self.user2)
        response = self.client.post(
            reverse("workoutpreset-create-from-template"),
            {"template_id": self.private_preset.id},
            format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot copy private preset", response.data["error"])

    def test_user_can_copy_own_private_preset(self):
        """User can copy their own private preset (for duplication)."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutpreset-create-from-template"),
            {"template_id": self.private_preset.id},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user_id"], self.user1.id)


class TestWorkoutPlans(TestCase):
    """Test cases for workout plans and 'use plan' functionality."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1w", email="user1w@test.com", password="pass")
        self.user2 = User.objects.create_user(username="user2w", email="user2w@test.com", password="pass")

        # Create template presets
        self.push_preset = WorkoutPreset.objects.create(
            user=None, name="Push Day", notes="Push workout"
        )
        self.pull_preset = WorkoutPreset.objects.create(
            user=None, name="Pull Day", notes="Pull workout"
        )
        self.legs_preset = WorkoutPreset.objects.create(
            user=None, name="Legs Day", notes="Legs workout"
        )

        # Add exercises to presets
        bench = Exercise.objects.create(name="Bench Press", user=None)
        rows = Exercise.objects.create(name="Rows", user=None)
        squat = Exercise.objects.create(name="Squat", user=None)

        WorkoutPresetExercise.objects.create(
            preset=self.push_preset, exercise=bench, type="normal", sets=3, order=0
        )
        WorkoutPresetExercise.objects.create(
            preset=self.pull_preset, exercise=rows, type="normal", sets=3, order=0
        )
        WorkoutPresetExercise.objects.create(
            preset=self.legs_preset, exercise=squat, type="normal", sets=3, order=0
        )

    def test_create_workout_plan(self):
        """User can create a workout plan with preset templates."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutplan-list"),
            {
                "name": "3-Day Split",
                "description": "Push/Pull/Legs split",
                "preset_ids": [self.push_preset.id, self.pull_preset.id, self.legs_preset.id]
            },
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "3-Day Split")
        self.assertEqual(response.data["user_id"], self.user1.id)

        # Verify presets were linked
        plan = WorkoutPlan.objects.get(id=response.data["id"])
        self.assertEqual(plan.plan_presets.count(), 3)

    def test_list_plans_returns_only_user_plans(self):
        """GET /plans/ returns only plans for the authenticated user."""
        # Create plan for user1
        WorkoutPlan.objects.create(user=self.user1, name="User1 Plan")

        # Create plan for user2
        WorkoutPlan.objects.create(user=self.user2, name="User2 Plan")

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("workoutplan-list"))
        self.assertEqual(response.status_code, 200)
        names = [p["name"] for p in response.data]
        self.assertIn("User1 Plan", names)
        self.assertNotIn("User2 Plan", names)

    def test_use_plan_copies_presets_to_user(self):
        """Using a plan copies all presets to the user's presets."""
        # Create a plan
        plan = WorkoutPlan.objects.create(user=self.user1, name="PPL Split")
        WorkoutPlanPreset.objects.create(plan=plan, preset=self.push_preset, order=0)
        WorkoutPlanPreset.objects.create(plan=plan, preset=self.pull_preset, order=1)
        WorkoutPlanPreset.objects.create(plan=plan, preset=self.legs_preset, order=2)

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutplan-use-plan", kwargs={"pk": plan.id})
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("Copied 3 presets", response.data["message"])

        # Verify presets were copied
        user_presets = WorkoutPreset.objects.filter(user=self.user1)
        self.assertEqual(user_presets.count(), 3)
        preset_names = list(user_presets.values_list("name", flat=True))
        self.assertIn("Push Day", preset_names)
        self.assertIn("Pull Day", preset_names)
        self.assertIn("Legs Day", preset_names)

    def test_use_plan_copies_exercises_and_supersets(self):
        """Using a plan copies all exercises including superset structures."""
        # Create a preset with superset
        preset = WorkoutPreset.objects.create(user=None, name="Upper Body")
        ex1 = Exercise.objects.create(name="Bench Press", user=None)
        ex2 = Exercise.objects.create(name="Rows", user=None)

        superset_ex = WorkoutPresetExercise.objects.create(
            preset=preset, type="superset", sets=3, order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex, exercise=ex1, type="normal", order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex, exercise=ex2, type="normal", order=1
        )

        # Create plan with this preset
        plan = WorkoutPlan.objects.create(user=self.user1, name="Upper Plan")
        WorkoutPlanPreset.objects.create(plan=plan, preset=preset, order=0)

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutplan-use-plan", kwargs={"pk": plan.id})
        )
        self.assertEqual(response.status_code, 201)

        # Verify superset was copied
        user_preset = WorkoutPreset.objects.filter(user=self.user1, name="Upper Body").first()
        self.assertIsNotNone(user_preset)
        self.assertEqual(user_preset.exercises.count(), 1)
        copied_ex = user_preset.exercises.first()
        self.assertEqual(copied_ex.type, "superset")
        self.assertEqual(copied_ex.superset_exercises.count(), 2)

    def test_cannot_use_another_users_plan(self):
        """User cannot use a plan created by another user."""
        plan = WorkoutPlan.objects.create(user=self.user1, name="User1 Plan")
        WorkoutPlanPreset.objects.create(plan=plan, preset=self.push_preset, order=0)

        self.client.force_authenticate(user=self.user2)
        response = self.client.post(
            reverse("workoutplan-use-plan", kwargs={"pk": plan.id})
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot use a plan created by another user", response.data["error"])

    def test_user_can_delete_own_plan(self):
        """User can delete their own plan."""
        plan = WorkoutPlan.objects.create(user=self.user1, name="My Plan")

        self.client.force_authenticate(user=self.user1)
        url = reverse("workoutplan-detail", kwargs={"pk": plan.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(WorkoutPlan.objects.filter(id=plan.id).exists())

    def test_copy_superset_with_dropdown_and_warmup(self):
        """Test complex preset copying with superset, dropdowns, and warmup."""
        # Create a complex preset
        preset = WorkoutPreset.objects.create(user=None, name="Complex Push")
        ex1 = Exercise.objects.create(name="Dips", user=None, is_bodyweight=True)
        ex2 = Exercise.objects.create(name="Overhead Press", user=None, is_bodyweight=False)

        superset_ex = WorkoutPresetExercise.objects.create(
            preset=preset, type="superset", sets=3, order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex, exercise=ex1, type="normal", include_warmup=True, order=0
        )
        SupersetExerciseItem.objects.create(
            superset=superset_ex, exercise=ex2, type="dropdown", dropdowns=2, include_warmup=True, order=1
        )

        # Use via plan
        plan = WorkoutPlan.objects.create(user=self.user1, name="Complex Plan")
        WorkoutPlanPreset.objects.create(plan=plan, preset=preset, order=0)

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("workoutplan-use-plan", kwargs={"pk": plan.id})
        )
        self.assertEqual(response.status_code, 201)

        # Verify complex structure was copied
        user_preset = WorkoutPreset.objects.filter(user=self.user1, name="Complex Push").first()
        self.assertIsNotNone(user_preset)
        copied_ex = user_preset.exercises.first()
        self.assertEqual(copied_ex.type, "superset")

        # Check superset items
        sup_items = list(copied_ex.superset_exercises.all().order_by("order"))
        self.assertEqual(len(sup_items), 2)
        self.assertEqual(sup_items[0].exercise.name, "Dips")
        self.assertTrue(sup_items[0].include_warmup)
        self.assertEqual(sup_items[1].exercise.name, "Overhead Press")
        self.assertEqual(sup_items[1].dropdowns, 2)
