import json
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ai.serializers import (
    AiExerciseAnalysisSerializer,
    AiFoodAnalysisSerializer,
    AiMealAnalysisSerializer,
)
from food.models import FoodItem
from users.models import User


def analyzed_meal_ingredient(name):
    return {
        "name": name,
        "brand": None,
        "category": "mixed",
        "servingSize": 100,
        "servingType": "g",
        "grams": 100,
        "calories": 50,
        "protein": 2,
        "carbs": 10,
        "fat": 0,
        "saturatedFat": 0,
        "sugar": 4,
        "fiber": 3,
        "sodium": 30,
        "glycemicIndex": 35,
        "absorptionSpeed": "moderate",
        "insulinResponse": 25,
        "satietyScore": 5,
        "proteinQuality": 1,
    }


class AiContractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="password123",
        )

    def analyze(self, endpoint):
        return self.client.post(
            reverse(endpoint),
            {"description": "grilled chicken salad"},
            format="json",
        )

    def test_anonymous_requests_are_unauthorized(self):
        for endpoint in [
            "analyze-food",
            "analyze-meal",
            "analyze-exercise",
            "meal-foods",
        ]:
            with self.subTest(endpoint=endpoint):
                response = self.analyze(endpoint)
                self.assertEqual(response.status_code, 401)

    def test_food_response_matches_serializer_contract(self):
        self.client.force_authenticate(user=self.user)

        response = self.analyze("analyze-food")

        self.assertEqual(response.status_code, 200)
        serializer = AiFoodAnalysisSerializer(data=response.json())
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_meal_response_matches_nested_serializer_contract(self):
        self.client.force_authenticate(user=self.user)

        response = self.analyze("analyze-meal")

        self.assertEqual(response.status_code, 200)
        serializer = AiMealAnalysisSerializer(data=response.json())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(len(serializer.validated_data["foods"]), 2)

    def test_exercise_response_matches_serializer_contract(self):
        self.client.force_authenticate(user=self.user)

        response = self.analyze("analyze-exercise")

        self.assertEqual(response.status_code, 200)
        serializer = AiExerciseAnalysisSerializer(data=response.json())
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_created_food_preserves_ai_nutrition_fields(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "name": "AI Chicken",
            "brand": None,
            "category": "protein",
            "servingSize": 100,
            "servingType": "g",
            "calories": 165,
            "protein": 31,
            "carbs": 0,
            "fat": 4,
            "saturatedFat": 1.25,
            "sugar": 0,
            "fiber": 0,
            "sodium": 300.5,
            "glycemicIndex": 0,
            "absorptionSpeed": "slow",
            "insulinResponse": 20,
            "satietyScore": 8,
            "proteinQuality": 3,
            "source": "ai_generated",
        }

        response = self.client.post(
            reverse("fooditem-list"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["saturatedFat"], 1.25)
        self.assertEqual(response.json()["sodium"], 300.5)
        food = FoodItem.objects.get(pk=response.json()["id"])
        self.assertEqual(food.saturated_fat, Decimal("1.25"))
        self.assertEqual(food.sodium, Decimal("300.50"))

    def test_meal_ingredients_are_reused_and_created_atomically(self):
        self.client.force_authenticate(user=self.user)
        canonical = FoodItem.objects.create(
            source="canonical",
            name="protein source",
            serving_size=100,
            serving_unit="g",
            calories=100,
        )
        owned_duplicate = FoodItem.objects.create(
            user=self.user,
            source="user",
            name="PROTEIN SOURCE",
            serving_size=100,
            serving_unit="g",
            calories=165,
        )

        response = self.client.post(
            reverse("meal-foods"),
            {
                "foods": [
                    analyzed_meal_ingredient("Protein Source"),
                    analyzed_meal_ingredient("Roasted Vegetable"),
                    analyzed_meal_ingredient("Roasted Vegetable"),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        vegetable = FoodItem.objects.get(name="Roasted Vegetable")
        self.assertEqual([food["id"] for food in response.json()], [
            owned_duplicate.id,
            vegetable.id,
            vegetable.id,
        ])
        self.assertEqual(FoodItem.objects.count(), 3)
        self.assertEqual(vegetable.user, self.user)
        self.assertEqual(vegetable.source, "user")
        self.assertEqual(vegetable.saturated_fat, Decimal("0"))
        self.assertEqual(vegetable.sodium, Decimal("30.00"))

    def test_failed_ingredient_creation_rolls_back_the_entire_batch(self):
        self.client.force_authenticate(user=self.user)
        ingredients = [
            analyzed_meal_ingredient("First Ingredient"),
            analyzed_meal_ingredient("Second Ingredient"),
        ]
        real_create = FoodItem.objects.create

        def fail_on_second_creation(**kwargs):
            if kwargs["name"] == "Second Ingredient":
                raise RuntimeError("simulated persistence failure")
            return real_create(**kwargs)

        with patch.object(
            FoodItem.objects,
            "create",
            side_effect=fail_on_second_creation,
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    reverse("meal-foods"),
                    {"foods": ingredients},
                    format="json",
                )

        self.assertFalse(FoodItem.objects.filter(user=self.user).exists())

    def test_openapi_documents_authenticated_camel_case_contracts(self):
        output = StringIO()
        call_command("spectacular", "--format", "openapi-json", stdout=output)
        schema = json.loads(output.getvalue())
        operations = {
            "/api/ai/analyze-food/": ("ai_analyze_food", "AiFoodAnalysis"),
            "/api/ai/analyze-meal/": ("ai_analyze_meal", "AiMealAnalysis"),
            "/api/ai/analyze-exercise/": (
                "ai_analyze_exercise",
                "AiExerciseAnalysis",
            ),
        }

        schemas = schema["components"]["schemas"]
        for path, (operation_id, response_schema) in operations.items():
            with self.subTest(path=path):
                operation = schema["paths"][path]["post"]
                self.assertEqual(operation["operationId"], operation_id)
                self.assertEqual(
                    operation["requestBody"]["content"]["application/json"]["schema"]["$ref"],
                    "#/components/schemas/AiAnalysisRequestRequest",
                )
                self.assertEqual(
                    operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
                    f"#/components/schemas/{response_schema}",
                )
                self.assertIn("jwtAuth", operation["security"][0])

        self.assertEqual(set(schemas["AiAnalysisRequestRequest"]["properties"]), {"description"})
        self.assertEqual(
            set(schemas["AiFoodAnalysis"]["properties"]),
            {
                "name",
                "brand",
                "category",
                "servingSize",
                "servingType",
                "calories",
                "protein",
                "carbs",
                "fat",
                "saturatedFat",
                "sugar",
                "fiber",
                "sodium",
                "glycemicIndex",
                "absorptionSpeed",
                "insulinResponse",
                "satietyScore",
                "proteinQuality",
            },
        )
        self.assertIn("grams", schemas["AiMealFood"]["properties"])
        self.assertIn("grams", schemas["AiMealIngredientRequest"]["properties"])
        self.assertEqual(
            set(schemas["AiMealAnalysis"]["properties"]),
            {"name", "mealType", "foods"},
        )
        self.assertEqual(
            set(schemas["AiExerciseAnalysis"]["properties"]),
            {"name", "category", "muscleGroups", "equipment", "instructions", "bodyweight"},
        )

        meal_food_operation = schema["paths"]["/api/ai/meal-foods/"]["post"]
        self.assertEqual(meal_food_operation["operationId"], "ai_resolve_meal_foods")
        self.assertEqual(
            meal_food_operation["requestBody"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/AiMealIngredientResolutionRequestRequest",
        )
        self.assertEqual(
            meal_food_operation["responses"]["200"]["content"]["application/json"]["schema"],
            {
                "type": "array",
                "items": {"$ref": "#/components/schemas/FoodItem"},
            },
        )
        self.assertIn("jwtAuth", meal_food_operation["security"][0])
