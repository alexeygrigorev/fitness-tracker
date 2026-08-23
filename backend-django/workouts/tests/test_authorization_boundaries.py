from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from rest_framework.test import APIClient

from users.models import User
from workouts.views import copy_preset_for_user
from workouts.models import (
    Exercise,
    WorkoutPlan,
    WorkoutPlanPreset,
    WorkoutPreset,
    WorkoutPresetExercise,
    WorkoutSession,
    WorkoutSet,
    SupersetExerciseItem,
)


class AuthorizationBoundaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(
            username="alice", email="alice@example.com", password="pass"
        )
        self.bob = User.objects.create_user(
            username="bob", email="bob@example.com", password="pass"
        )

    def test_cannot_create_preset_with_private_foreign_exercise(self):
        foreign_exercise = Exercise.objects.create(
            user=self.alice, name="Alice Secret Lift"
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            reverse("workoutpreset-list"),
            {
                "name": "Bob Preset",
                "exercises": [
                    {
                        "exerciseId": foreign_exercise.id,
                        "type": "normal",
                        "sets": 1,
                        "order": 0,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(WorkoutPreset.objects.filter(user=self.bob).exists())
        self.assertFalse(
            WorkoutPresetExercise.objects.filter(exercise=foreign_exercise).exists()
        )

    def test_cannot_update_preset_with_private_foreign_exercise(self):
        common_exercise = Exercise.objects.create(name="Common Lift", user=None)
        foreign_exercise = Exercise.objects.create(
            user=self.alice, name="Alice Secret Lift"
        )
        preset = WorkoutPreset.objects.create(user=self.bob, name="Bob Preset")
        preset_row = WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=common_exercise,
            type="normal",
            sets=3,
            order=0,
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.patch(
            reverse("workoutpreset-detail", args=[preset.id]),
            {
                "name": "Bob Preset Updated",
                "exercises": [
                    {
                        "id": preset_row.id,
                        "exerciseId": foreign_exercise.id,
                        "type": "normal",
                        "sets": 5,
                        "order": 0,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        preset_row.refresh_from_db()
        self.assertEqual(preset_row.exercise_id, common_exercise.id)
        self.assertEqual(preset_row.sets, 3)

    def test_cannot_start_public_preset_with_hidden_foreign_exercise(self):
        foreign_exercise = Exercise.objects.create(
            user=self.alice, name="Alice Secret Lift"
        )
        preset = WorkoutPreset.objects.create(
            user=self.alice, name="Shared But Unsafe", is_public=True
        )
        WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=foreign_exercise,
            type="normal",
            sets=1,
            order=0,
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            reverse("workoutpreset-start-workout", args=[preset.id])
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            WorkoutSession.objects.filter(user=self.bob, preset=preset).exists()
        )

    def test_cannot_start_private_foreign_preset(self):
        preset = WorkoutPreset.objects.create(
            user=self.alice, name="Alice Private Preset"
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            reverse("workoutpreset-start-workout", args=[preset.id])
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            WorkoutSession.objects.filter(user=self.bob, preset=preset).exists()
        )

    def test_malformed_sets_payload_returns_400_without_session(self):
        self.client.force_authenticate(user=self.alice)

        response = self.client.post(
            reverse("workoutsession-list"),
            {"name": "Malformed Sets", "sets": "bad"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            WorkoutSession.objects.filter(name="Malformed Sets").exists()
        )

    def test_use_plan_prevalidates_every_preset_before_copying(self):
        common_exercise = Exercise.objects.create(name="Common Lift", user=None)
        valid_preset = WorkoutPreset.objects.create(
            user=self.bob, name="Bob Valid Preset"
        )
        WorkoutPresetExercise.objects.create(
            preset=valid_preset,
            exercise=common_exercise,
            type="normal",
            sets=1,
            order=0,
        )
        foreign_private_preset = WorkoutPreset.objects.create(
            user=self.alice, name="Alice Private Plan"
        )
        plan = WorkoutPlan.objects.create(user=self.bob, name="Mixed Safety Plan")
        WorkoutPlanPreset.objects.create(
            plan=plan, preset=valid_preset, order=0
        )
        WorkoutPlanPreset.objects.create(
            plan=plan,
            preset=foreign_private_preset,
            order=1,
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            reverse("workoutplan-use-plan", args=[plan.id])
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            list(
                WorkoutPreset.objects.filter(user=self.bob)
                .order_by("id")
                .values_list("id", flat=True)
            ),
            [valid_preset.id],
        )

    def test_cannot_move_set_into_foreign_session(self):
        exercise = Exercise.objects.create(name="Bench Press", user=None)
        alice_session = WorkoutSession.objects.create(user=self.alice, name="Alice")
        alice_set = WorkoutSet.objects.create(
            session=alice_session,
            exercise=exercise,
            set_order=0,
        )
        bob_session = WorkoutSession.objects.create(user=self.bob, name="Bob")
        self.client.force_authenticate(user=self.alice)

        response = self.client.patch(
            reverse("workoutset-detail", args=[alice_set.id]),
            {"session": bob_session.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        alice_set.refresh_from_db()
        self.assertEqual(alice_set.session_id, alice_session.id)

    def test_first_added_set_order_starts_at_zero(self):
        exercise = Exercise.objects.create(name="Bench Press", user=None)
        session = WorkoutSession.objects.create(user=self.alice, name="Alice")
        self.client.force_authenticate(user=self.alice)

        response = self.client.post(
            reverse("workoutset-list"),
            {
                "session": session.id,
                "exerciseId": exercise.id,
                "setType": "normal",
                "reps": 8,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["set_order"], 0)

    def test_converting_superset_row_removes_stale_items(self):
        exercise = Exercise.objects.create(name="Bench Press", user=None)
        superset_exercise = Exercise.objects.create(name="Rows", user=None)
        preset = WorkoutPreset.objects.create(user=self.alice, name="Alice Preset")
        preset_row = WorkoutPresetExercise.objects.create(
            preset=preset,
            type="superset",
            sets=3,
            order=0,
        )
        SupersetExerciseItem.objects.create(
            superset=preset_row,
            exercise=exercise,
            order=0,
        )
        self.client.force_authenticate(user=self.alice)

        response = self.client.patch(
            reverse("workoutpreset-detail", args=[preset.id]),
            {
                "exercises": [
                    {
                        "id": preset_row.id,
                        "exerciseId": superset_exercise.id,
                        "type": "normal",
                        "sets": 2,
                        "order": 0,
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        preset_row.refresh_from_db()
        self.assertEqual(preset_row.exercise_id, superset_exercise.id)
        self.assertEqual(SupersetExerciseItem.objects.count(), 0)

    def test_invalid_nested_set_does_not_leave_orphan_session(self):
        self.client.force_authenticate(user=self.alice)

        response = self.client.post(
            reverse("workoutsession-list"),
            {"name": "Broken Workout", "sets": [{"exerciseId": 999999}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(WorkoutSession.objects.filter(name="Broken Workout").exists())

    def test_plan_creation_rejects_unavailable_presets_atomically(self):
        foreign_preset = WorkoutPreset.objects.create(
            user=self.alice, name="Alice Private Plan"
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            reverse("workoutplan-list"),
            {"name": "Leaky Plan", "preset_ids": [foreign_preset.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(WorkoutPlan.objects.filter(name="Leaky Plan").exists())
        self.assertFalse(
            WorkoutPlanPreset.objects.filter(preset=foreign_preset).exists()
        )

    def test_plan_creation_rejects_duplicate_preset_ids(self):
        preset = WorkoutPreset.objects.create(
            user=self.alice, name="Alice Private Plan"
        )
        self.client.force_authenticate(user=self.alice)

        response = self.client.post(
            reverse("workoutplan-list"),
            {"name": "Duplicate Plan", "preset_ids": [preset.id, str(preset.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(WorkoutPlan.objects.filter(name="Duplicate Plan").exists())

    def test_template_copy_rolls_back_on_nested_copy_failure(self):
        exercise = Exercise.objects.create(name="Bench Press", user=None)
        template = WorkoutPreset.objects.create(user=None, name="Atomic Template")
        normal_row = WorkoutPresetExercise.objects.create(
            preset=template,
            exercise=exercise,
            type="normal",
            sets=1,
            order=0,
        )
        superset_row = WorkoutPresetExercise.objects.create(
            preset=template,
            type="superset",
            sets=1,
            order=1,
        )
        SupersetExerciseItem.objects.create(
            superset=superset_row,
            exercise=exercise,
            order=0,
        )

        with self.assertRaises(RuntimeError), patch.object(
            SupersetExerciseItem.objects,
            "bulk_create",
            side_effect=RuntimeError("simulated copy failure"),
        ):
            copy_preset_for_user(template, self.alice)

        self.assertFalse(
            WorkoutPreset.objects.filter(
                user=self.alice, name="Atomic Template"
            ).exists()
        )
        normal_row.refresh_from_db()
        superset_row.refresh_from_db()
