from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import User


class MealSerializationPerformanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="meal-user",
            email="meal-user@example.com",
            password="password123",
        )
        self.food = self.user.food_items.create(
            name="Chicken",
            serving_size=Decimal("100.00"),
            serving_unit="g",
            calories=Decimal("165.00"),
            protein=Decimal("31.00"),
            carbs=Decimal("0.00"),
            fat=Decimal("3.60"),
        )
        self.client.force_authenticate(user=self.user)

    def test_meal_list_loads_and_calculates_nested_foods_in_batches(self):
        for meal_index in range(8):
            meal = self.user.meals.create(
                name=f"Meal {meal_index}",
                meal_type="lunch",
                date="2026-08-23",
            )
            meal.food_items.create(
                food=self.food,
                grams=Decimal("150.00"),
                order=0,
            )

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse("meal-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 8)
        # Meals and their joined food rows are loaded in two batched queries.
        self.assertLessEqual(len(queries), 4)
        self.assertEqual(response.data[0]["totalCalories"], 247.5)
        self.assertEqual(response.data[0]["totalProtein"], 46.5)
