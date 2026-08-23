from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import User


class FoodItemAuthorizationTests(TestCase):
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
        self.food = self.owner.food_items.create(
            name="Owner Food",
            serving_size=100,
            serving_unit="g",
            calories=100,
        )

    def test_anonymous_users_can_read_but_not_write(self):
        response = self.client.patch(
            reverse("fooditem-detail", args=[self.food.id]),
            {"calories": 999},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.food.refresh_from_db()
        self.assertEqual(self.food.calories, 100)

    def test_owner_cannot_promote_private_food_to_canonical(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(
            reverse("fooditem-detail", args=[self.food.id]),
            {"source": "canonical"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.food.refresh_from_db()
        self.assertEqual(self.food.source, "user")

        self.client.force_authenticate(user=self.other_user)
        hidden = self.client.get(reverse("fooditem-detail", args=[self.food.id]))
        self.assertEqual(hidden.status_code, 404)
