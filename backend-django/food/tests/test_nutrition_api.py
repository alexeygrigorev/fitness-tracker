from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from food.models import FoodItem, Meal, MealFoodItem, MealTemplate
from users.models import User


class NutritionApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="password123",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="password123",
        )

    def make_food(self, name="Chicken", **overrides):
        values = {
            "source": "canonical",
            "serving_size": Decimal("100.00"),
            "serving_unit": "g",
            "calories": Decimal("300.00"),
            "protein": Decimal("20.00"),
            "carbs": Decimal("50.00"),
            "fat": Decimal("10.00"),
            "fiber": Decimal("8.00"),
            "sugar": Decimal("12.00"),
            "sodium": Decimal("240.00"),
        }
        values.update(overrides)
        return FoodItem.objects.create(name=name, **values)

    def make_meal_payload(self, food, **overrides):
        payload = {
            "name": "Lunch",
            "mealType": "lunch",
            "date": "2026-08-22",
            "eventTime": "12:30",
            "notes": "Home cooked",
            "source": "manual",
            "food_items": [{"foodId": food.id, "grams": 150}],
        }
        payload.update(overrides)
        return payload

    def assert_nutrition_totals(self, data):
        self.assertEqual(data["calories"], 300)
        self.assertEqual(data["protein_g"], 20)
        self.assertEqual(data["carbs_g"], 50)
        self.assertEqual(data["fat_g"], 10)
        self.assertEqual(data["fiber_g"], 8)
        self.assertEqual(data["sugar_g"], 12)
        self.assertEqual(data["sodium_mg"], 240)

    def assert_calculated_nutrition_totals(self, data):
        self.assertEqual(data["total_calories"], 300)
        self.assertEqual(data["total_protein_g"], 20)
        self.assertEqual(data["total_carbs_g"], 50)
        self.assertEqual(data["total_fat_g"], 10)
        self.assertEqual(data["total_fiber_g"], 8)
        self.assertEqual(data["total_sugar_g"], 12)
        self.assertEqual(data["total_sodium_mg"], 240)

    def test_food_catalog_ownership_and_crud(self):
        canonical = self.make_food(name="Canonical Rice")
        private = self.make_food(
            name="Owner Secret",
            user=self.owner,
            source="user",
        )

        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(reverse("fooditem-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["name"] for item in response.json()], ["Canonical Rice"])

        hidden = self.client.get(reverse("fooditem-detail", args=[private.id]))
        self.assertEqual(hidden.status_code, 404)

        created = self.client.post(
            reverse("fooditem-list"),
            {
                "name": "Bob Yogurt",
                "brand": "Dairy Co",
                "category": "protein",
                "servingSize": 150,
                "servingType": "g",
                "calories": 180,
                "protein": 24,
                "carbs": 8,
                "fat": 4,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["user"], self.other_user.id)
        self.assertEqual(created.json()["source"], "user")

        forbidden = self.client.put(
            reverse("fooditem-detail", args=[canonical.id]),
            {
                "name": "Vandalized",
                "servingSize": 1,
                "servingType": "g",
                "calories": 1,
            },
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

        updated = self.client.patch(
            reverse("fooditem-detail", args=[created.json()["id"]]),
            {"protein": 26},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["protein"], 26)

        deleted = self.client.delete(
            reverse("fooditem-detail", args=[created.json()["id"]])
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(FoodItem.objects.filter(id=created.json()["id"]).exists())

    def test_create_meal_persists_nested_items_and_derived_date(self):
        self.client.force_authenticate(user=self.owner)
        food = self.make_food()
        local_time = datetime(
            2026, 8, 23, 2, 30, tzinfo=ZoneInfo("America/New_York")
        )

        with override_settings(TIME_ZONE="America/New_York"):
            response = self.client.post(
                reverse("meal-list"),
                self.make_meal_payload(food, loggedAt=local_time),
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        meal = Meal.objects.get(pk=response.json()["id"])
        self.assertEqual(meal.user, self.owner)
        self.assertEqual(meal.date.isoformat(), "2026-08-22")
        item = MealFoodItem.objects.get(meal=meal)
        self.assertEqual(item.food, food)
        self.assertEqual(item.grams, Decimal("150"))
        self.assertEqual(item.order, 0)

    def test_meal_date_filtering_and_daily_totals_are_isolated(self):
        owner_food = self.make_food(user=self.owner, source="user")
        other_food = self.make_food(name="Other Food", user=self.other_user)
        owner_meal = Meal.objects.create(
            user=self.owner,
            name="Owner Lunch",
            meal_type="lunch",
            date=datetime.fromisoformat("2026-08-22").date(),
        )
        other_meal = Meal.objects.create(
            user=self.other_user,
            name="Other Lunch",
            meal_type="lunch",
            date=datetime.fromisoformat("2026-08-22").date(),
        )
        MealFoodItem.objects.create(
            meal=owner_meal,
            food=owner_food,
            grams=Decimal("100"),
            order=0,
        )
        # Invalid serving size must not contribute a division error or totals.
        bad_serving = self.make_food(
            name="Bad Serving",
            serving_size=Decimal("0"),
        )
        MealFoodItem.objects.create(
            meal=owner_meal,
            food=bad_serving,
            grams=Decimal("100"),
            order=1,
        )
        MealFoodItem.objects.create(
            meal=other_meal,
            food=other_food,
            grams=Decimal("500"),
            order=0,
        )
        self.client.force_authenticate(user=self.owner)

        by_date = self.client.get(reverse("meal-by-date", args=["2026-08-22"]))
        self.assertEqual(by_date.status_code, 200)
        self.assertEqual([meal["name"] for meal in by_date.json()], ["Owner Lunch"])

        totals = self.client.get(reverse("meal-daily-totals", args=["2026-08-22"]))
        self.assertEqual(totals.status_code, 200)
        self.assert_nutrition_totals(totals.json())

        empty = self.client.get(reverse("meal-daily-totals", args=["2026-08-23"]))
        self.assertEqual(empty.json()["calories"], 0)

        invalid_date = self.client.get(reverse("meal-daily-totals", args=["not-a-date"]))
        self.assertEqual(invalid_date.status_code, 400)

    def test_meal_partial_update_replaces_items_only_when_provided(self):
        food = self.make_food(user=self.owner, source="user")
        replacement = self.make_food(name="Salmon", user=self.owner, source="user")
        meal = Meal.objects.create(
            user=self.owner,
            name="Original",
            meal_type="dinner",
            date=datetime.fromisoformat("2026-08-22").date(),
        )
        MealFoodItem.objects.create(meal=meal, food=food, grams=100, order=0)
        self.client.force_authenticate(user=self.owner)

        scalar_update = self.client.patch(
            reverse("meal-detail", args=[meal.id]),
            {"name": "Renamed"},
            format="json",
        )
        self.assertEqual(scalar_update.status_code, 200)
        self.assertEqual(scalar_update.json()["name"], "Renamed")
        self.assertTrue(MealFoodItem.objects.filter(food=food).exists())

        nested_update = self.client.patch(
            reverse("meal-detail", args=[meal.id]),
            {"food_items": []},
            format="json",
        )
        self.assertEqual(nested_update.status_code, 200)
        self.assertFalse(MealFoodItem.objects.filter(meal=meal).exists())

        add_item = self.client.patch(
            reverse("meal-detail", args=[meal.id]),
            {"food_items": [{"foodId": replacement.id, "grams": 200}]},
            format="json",
        )
        self.assertEqual(add_item.status_code, 200)
        item = meal.food_items.get()
        self.assertEqual(item.food, replacement)
        self.assertEqual(item.grams, Decimal("200"))
        self.assertDictEqual(
            {key: add_item.json()[key] for key in ("totalCalories", "totalProtein")},
            {"totalCalories": 600, "totalProtein": 40},
        )

    def test_meals_and_templates_are_owner_scoped(self):
        food = self.make_food()
        meal = Meal.objects.create(
            user=self.owner,
            name="Private Meal",
            meal_type="snack",
            date=datetime.fromisoformat("2026-08-22").date(),
        )
        template = MealTemplate.objects.create(
            user=self.owner,
            name="Private Template",
            category="snack",
        )
        self.client.force_authenticate(user=self.other_user)

        for view_name, instance in (("meal", meal), ("mealtemplate", template)):
            with self.subTest(view_name=view_name):
                listed = self.client.get(reverse(f"{view_name}-list"))
                self.assertEqual(listed.json(), [])
                retrieved = self.client.get(
                    reverse(f"{view_name}-detail", args=[instance.id])
                )
                self.assertEqual(retrieved.status_code, 404)
                updated = self.client.patch(
                    reverse(f"{view_name}-detail", args=[instance.id]),
                    {"name": "Stolen"},
                    format="json",
                )
                self.assertEqual(updated.status_code, 404)
                deleted = self.client.delete(
                    reverse(f"{view_name}-detail", args=[instance.id])
                )
                self.assertEqual(deleted.status_code, 404)

        self.assertFalse(MealFoodItem.objects.exists())

    def test_create_template_persists_nested_items(self):
        food = self.make_food()
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            reverse("mealtemplate-list"),
            {
                "name": "Protein Oats",
                "category": "breakfast",
                "notes": "Morning staple",
                "food_items": [{"foodId": food.id, "grams": 80}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        template = MealTemplate.objects.get(pk=response.json()["id"])
        self.assertEqual(template.user, self.owner)
        self.assertEqual(template.notes, "Morning staple")
        item = template.food_items.get()
        self.assertEqual(item.food, food)
        self.assertEqual(item.grams, Decimal("80"))
        self.assertEqual(item.order, 0)

    def test_template_scalar_update_preserves_nested_items(self):
        food = self.make_food(user=self.owner, source="user")
        template = MealTemplate.objects.create(
            user=self.owner,
            name="Original Template",
            category="lunch",
        )
        template.food_items.create(food=food, grams=120, order=0)
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(
            reverse("mealtemplate-detail", args=[template.id]),
            {"name": "Updated Template"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        template.refresh_from_db()
        item = template.food_items.get()
        self.assertEqual(template.name, "Updated Template")
        self.assertEqual(item.food, food)
        self.assertEqual(item.grams, Decimal("120"))

    def test_nested_writes_reject_inaccessible_private_food_atomically(self):
        private_food = self.make_food(user=self.owner, source="user")
        self.client.force_authenticate(user=self.other_user)

        meal_response = self.client.post(
            reverse("meal-list"),
            self.make_meal_payload(private_food),
            format="json",
        )
        template_response = self.client.post(
            reverse("mealtemplate-list"),
            {
                "name": "Unauthorized Template",
                "category": "snack",
                "food_items": [{"foodId": private_food.id, "grams": 100}],
            },
            format="json",
        )

        self.assertEqual(meal_response.status_code, 400)
        self.assertEqual(template_response.status_code, 400)
        self.assertFalse(Meal.objects.filter(user=self.other_user).exists())
        self.assertFalse(MealTemplate.objects.filter(user=self.other_user).exists())

    def test_calculation_endpoints_return_expected_values(self):
        response = self.client.post(
            reverse("calculate-calories"),
            {"protein_g": 10, "carbs_g": 20, "fat_g": 5},
            format="json",
        )
        category_response = self.client.post(
            reverse("detect-category"),
            {"protein_g": 10, "carbs_g": 10, "fat_g": 10},
            format="json",
        )
        metabolism_response = self.client.post(
            reverse("infer-metabolism"),
            {"protein_g": 30, "carbs_g": 40, "fat_g": 10, "fiber_g": 6},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["calories"], 165)
        self.assertEqual(category_response.json()["category"], "balanced")
        self.assertEqual(metabolism_response.json(), {
            "glycemic_index": "low",
            "absorption_speed": "slow",
            "thermic_effect": "high",
            "satiety_level": "very_high",
        })

    def test_calculate_nutrition_only_uses_accessible_valid_foods(self):
        accessible = self.make_food(user=self.owner, source="user")
        foreign = self.make_food(
            name="Foreign Food",
            calories=Decimal("999"),
            protein=Decimal("99"),
            carbs=Decimal("99"),
            fat=Decimal("99"),
        )
        foreign.user = self.other_user
        foreign.source = "user"
        foreign.save(update_fields=["user", "source"])
        invalid_serving = self.make_food(
            name="Invalid Serving",
            serving_size=Decimal("0"),
            calories=Decimal("999"),
        )
        missing_id = FoodItem.objects.order_by("-id").first().id + 1000
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            reverse("calculate-nutrition"),
            {
                "food_items": [
                    {"food_id": accessible.id, "grams": 100},
                    {"food_id": foreign.id, "grams": 100},
                    {"food_id": invalid_serving.id, "grams": 100},
                    {"food_id": missing_id, "grams": 100},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assert_calculated_nutrition_totals(response.json())

    def test_calculate_nutrition_requires_authentication(self):
        response = self.client.post(
            reverse("calculate-nutrition"),
            {"food_items": []},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
