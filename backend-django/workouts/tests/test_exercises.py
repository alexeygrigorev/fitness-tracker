from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workouts.models import Exercise
from users.models import User


class TestCommonExercises(TestCase):
    """Test cases for common exercises (user=None, immutable by regular users)."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1", email="user1@test.com", password="pass")
        self.user2 = User.objects.create_user(username="user2", email="user2@test.com", password="pass")

        # Create a common exercise (user=None)
        self.common_exercise = Exercise.objects.create(
            name="Bench Press",
            is_compound=True,
            is_bodyweight=False,
            user=None  # Common exercise
        )

    def test_common_exercise_has_no_user(self):
        """Common exercises have user=None."""
        exercise = Exercise.objects.get(name="Bench Press")
        self.assertIsNone(exercise.user)

    def test_anyone_can_view_common_exercises(self):
        """Common exercises are visible to everyone."""
        # Test unauthenticated
        response = self.client.get(reverse("exercise-list"))
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)

        # Test authenticated user
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("exercise-list"))
        self.assertEqual(response.status_code, 200)
        exercise_ids = [ex["id"] for ex in response.data]
        self.assertIn(self.common_exercise.id, exercise_ids)

    def test_user_cannot_modify_common_exercise(self):
        """Users cannot PATCH (update) a common exercise."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.common_exercise.id})
        response = self.client.patch(url, {"name": "Modified Bench Press"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot modify common exercises", response.data["error"])

        # Verify exercise wasn't modified
        self.common_exercise.refresh_from_db()
        self.assertEqual(self.common_exercise.name, "Bench Press")

    def test_user_cannot_delete_common_exercise(self):
        """Users cannot DELETE a common exercise."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.common_exercise.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot delete common exercises", response.data["error"])

        # Verify exercise still exists
        self.assertTrue(Exercise.objects.filter(id=self.common_exercise.id).exists())


class TestUserExercises(TestCase):
    """Test cases for user-specific exercises (mutable by owner only)."""

    def setUp(self):
        """Set up test client and users."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1a", email="user1a@test.com", password="pass")
        self.user2 = User.objects.create_user(username="user2a", email="user2a@test.com", password="pass")

        # Create user-specific exercises
        self.user1_exercise = Exercise.objects.create(
            name="User1 Custom Exercise",
            is_compound=False,
            is_bodyweight=True,
            user=self.user1
        )
        self.user2_exercise = Exercise.objects.create(
            name="User2 Custom Exercise",
            is_compound=False,
            is_bodyweight=True,
            user=self.user2
        )

    def test_user_exercise_has_owner(self):
        """User exercises have a user set."""
        exercise = Exercise.objects.get(name="User1 Custom Exercise")
        self.assertEqual(exercise.user, self.user1)

    def test_create_exercise_assigns_to_authenticated_user(self):
        """When creating an exercise, it's assigned to the authenticated user."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            reverse("exercise-list"),
            {"name": "My New Exercise", "is_compound": False},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        exercise = Exercise.objects.get(id=response.data["id"])
        self.assertEqual(exercise.user, self.user1)

    def test_owner_can_view_their_exercises(self):
        """Users can see their own exercises."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(reverse("exercise-list"))
        self.assertEqual(response.status_code, 200)
        exercise_ids = [ex["id"] for ex in response.data]
        self.assertIn(self.user1_exercise.id, exercise_ids)

    def test_owner_can_modify_their_exercise(self):
        """Users can PATCH (update) their own exercises."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.user1_exercise.id})
        response = self.client.patch(url, {"name": "Updated Exercise"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Updated Exercise")

        # Verify database was updated
        self.user1_exercise.refresh_from_db()
        self.assertEqual(self.user1_exercise.name, "Updated Exercise")

    def test_owner_can_delete_their_exercise(self):
        """Users can DELETE their own exercises."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.user1_exercise.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)

        # Verify exercise was deleted
        self.assertFalse(Exercise.objects.filter(id=self.user1_exercise.id).exists())

    def test_user_cannot_modify_another_users_exercise(self):
        """Users cannot modify exercises created by another user."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.user2_exercise.id})
        response = self.client.patch(url, {"name": "Hacked Exercise"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot modify exercises created by another user", response.data["error"])

        # Verify exercise wasn't modified
        self.user2_exercise.refresh_from_db()
        self.assertEqual(self.user2_exercise.name, "User2 Custom Exercise")

    def test_user_cannot_delete_another_users_exercise(self):
        """Users cannot delete exercises created by another user."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("exercise-detail", kwargs={"pk": self.user2_exercise.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Cannot delete exercises created by another user", response.data["error"])

        # Verify exercise still exists
        self.assertTrue(Exercise.objects.filter(id=self.user2_exercise.id).exists())


class TestExerciseListFiltering(TestCase):
    """Test listing exercises shows both common and user exercises."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuserex", email="testuserex@test.com", password="pass")

        # Create common exercises
        Exercise.objects.create(name="Squat", user=None, is_compound=True)
        Exercise.objects.create(name="Deadlift", user=None, is_compound=True)

        # Create user exercises
        Exercise.objects.create(name="My Custom Exercise", user=self.user, is_compound=False)

    def test_list_shows_all_exercises(self):
        """Exercise list returns both common and user exercises."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("exercise-list"))
        self.assertEqual(response.status_code, 200)
        names = [ex["name"] for ex in response.data]
        self.assertIn("Squat", names)
        self.assertIn("Deadlift", names)
        self.assertIn("My Custom Exercise", names)

    def test_unauthenticated_can_see_common_exercises(self):
        """Unauthenticated users can see common exercises."""
        response = self.client.get(reverse("exercise-list"))
        self.assertEqual(response.status_code, 200)
        names = [ex["name"] for ex in response.data]
        self.assertIn("Squat", names)
        self.assertIn("Deadlift", names)
        # User exercises might also be visible depending on permissions
