import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase


class OpenApiContractTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        output = StringIO()
        call_command("spectacular", "--format", "openapi-json", stdout=output)
        cls.schema = json.loads(output.getvalue())

    def operation(self, path, method):
        return self.schema["paths"][path][method]

    def request_ref(self, path, method):
        return self.operation(path, method)["requestBody"]["content"]["application/json"]["schema"]

    def response_schema(self, path, method, status=200):
        return self.operation(path, method)["responses"][str(status)]["content"]["application/json"]["schema"]

    def test_documented_user_and_settings_contracts_match_responses(self):
        self.assertEqual(
            self.response_schema("/api/auth/login/", "post")["$ref"],
            "#/components/schemas/LoginResponse",
        )
        self.assertEqual(
            set(self.schema["components"]["schemas"]["LoginResponse"]["properties"]),
            {"access", "refresh", "user"},
        )
        self.assertEqual(
            self.request_ref("/api/auth/me/update/", "patch")["$ref"],
            "#/components/schemas/PatchedUserProfileUpdateRequestRequest",
        )
        settings_response = self.response_schema("/api/auth/exercise-settings/", "get")
        self.assertEqual(settings_response["type"], "object")
        self.assertEqual(
            settings_response["additionalProperties"]["$ref"],
            "#/components/schemas/ExerciseSettingsResponse",
        )
        self.assertEqual(
            self.request_ref("/api/auth/exercise-settings/{exercise_id}/", "post")["$ref"],
            "#/components/schemas/ExerciseSettingsRequestRequest",
        )
        self.assertEqual(
            self.response_schema("/api/auth/exercise-settings/{exercise_id}/", "post")["$ref"],
            "#/components/schemas/ExerciseSettingsResponse",
        )

    def test_documented_workout_lifecycle_contracts_match_responses(self):
        self.assertIsNone(self.operation("/api/workouts/sessions/{id}/finish/", "post").get("requestBody"))
        self.assertEqual(
            self.response_schema("/api/workouts/sessions/active/", "get"),
            {"type": "array", "items": {"$ref": "#/components/schemas/WorkoutSession"}},
        )
        self.assertEqual(
            self.request_ref("/api/workouts/sessions/{id}/sets/{set_id}/", "patch")["$ref"],
            "#/components/schemas/PatchedWorkoutSetUpdateRequest",
        )
        self.assertEqual(
            self.response_schema("/api/workouts/sessions/{id}/sets/{set_id}/", "patch")["$ref"],
            "#/components/schemas/WorkoutSet",
        )
        logged_at = self.schema["components"]["schemas"]["WorkoutSet"]["properties"]["loggedAt"]
        self.assertEqual(logged_at["type"], "string")
        self.assertTrue(logged_at["nullable"])
        uncomplete_response = self.response_schema(
            "/api/workouts/sessions/{id}/sets/{set_id}/completion/",
            "delete",
        )
        self.assertEqual(uncomplete_response["$ref"], "#/components/schemas/WorkoutSet")

    def test_documented_preset_template_contracts_match_responses(self):
        self.assertEqual(
            self.response_schema("/api/workouts/presets/templates/", "get"),
            {"type": "array", "items": {"$ref": "#/components/schemas/WorkoutPreset"}},
        )
        self.assertEqual(
            self.request_ref("/api/workouts/presets/create_from_template/", "post")["$ref"],
            "#/components/schemas/TemplateCopyRequestRequest",
        )
        self.assertEqual(
            self.response_schema("/api/workouts/presets/create_from_template/", "post", 201)["$ref"],
            "#/components/schemas/WorkoutPreset",
        )
        self.assertEqual(
            self.request_ref("/api/workouts/presets/{id}/start_workout/", "post")["$ref"],
            "#/components/schemas/StartedWorkoutRequestRequest",
        )
        self.assertEqual(
            self.response_schema("/api/workouts/presets/{id}/start_workout/", "post", 201)["$ref"],
            "#/components/schemas/StartedWorkoutResponse",
        )

    def test_documented_plan_use_contract_matches_response(self):
        operation = self.operation("/api/workouts/plans/{id}/use_plan/", "post")
        self.assertNotIn("requestBody", operation)
        self.assertEqual(
            self.response_schema("/api/workouts/plans/{id}/use_plan/", "post", 201)["$ref"],
            "#/components/schemas/PlanUseResponse",
        )

    def test_documented_nutrition_day_contracts_match_responses(self):
        self.assertEqual(
            self.response_schema("/api/food/meals/date/{date_str}/", "get"),
            {"type": "array", "items": {"$ref": "#/components/schemas/Meal"}},
        )
        self.assertEqual(
            self.response_schema("/api/food/meals/daily/totals/{date_str}/", "get")["$ref"],
            "#/components/schemas/MealDailyTotals",
        )
        expected_fields = {
            "date",
            "calories",
            "protein_g",
            "carbs_g",
            "fat_g",
            "fiber_g",
            "sugar_g",
            "sodium_mg",
        }
        self.assertEqual(set(self.schema["components"]["schemas"]["MealDailyTotals"]["properties"]), expected_fields)
        meal_properties = self.schema["components"]["schemas"]["Meal"]["properties"]
        for field in ("totalCalories", "totalProtein", "totalCarbs", "totalFat"):
            self.assertEqual(meal_properties[field]["type"], "number")

    def test_committed_typescript_contract_matches_python_export(self):
        with TemporaryDirectory() as temp_dir:
            exported = Path(temp_dir) / "openapi.json"
            call_command("export_openapi", f"--output={exported}")
            generated = exported.read_text(encoding="utf-8")

        committed_path = (
            Path(__file__).resolve().parents[2]
            / ".."
            / "backend-ts"
            / "openapi.json"
        )
        committed = committed_path.resolve().read_text(encoding="utf-8")
        self.assertEqual(generated, committed)
