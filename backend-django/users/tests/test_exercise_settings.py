from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from users.models import ExerciseSettings
from workouts.models import Exercise

User = get_user_model()


class ExerciseSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create a test exercise
        self.exercise = Exercise.objects.create(
            name='Bench Press',
            is_compound=True,
            is_bodyweight=False
        )

    def test_create_exercise_settings(self):
        """Test creating exercise settings via API"""
        response = self.client.post(
            f'/api/auth/exercise-settings/{self.exercise.id}/',
            {'weight': 80, 'reps': 10},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('weight', response.data)
        self.assertEqual(response.data['weight'], 80)
        self.assertEqual(response.data['reps'], 10)

        # Verify it was created in DB
        settings = ExerciseSettings.objects.filter(user=self.user, exercise=self.exercise)
        self.assertTrue(settings.exists())
        self.assertEqual(settings.first().weight, 80)

    def test_update_exercise_settings(self):
        """Test updating existing exercise settings"""
        # Create initial settings
        ExerciseSettings.objects.create(
            user=self.user,
            exercise=self.exercise,
            weight=60,
            reps=8
        )

        # Update via API
        response = self.client.post(
            f'/api/auth/exercise-settings/{self.exercise.id}/',
            {'weight': 80, 'reps': 10},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['weight'], 80)
        self.assertEqual(response.data['reps'], 10)

        # Verify it was updated in DB
        settings = ExerciseSettings.objects.get(user=self.user, exercise=self.exercise)
        self.assertEqual(settings.weight, 80)
        self.assertEqual(settings.reps, 10)

    def test_exercise_settings_with_dropdowns(self):
        """Test saving exercise settings with sub-sets (for dropdown sets)"""
        sub_sets = [
            {'weight': 60, 'reps': 10},
            {'weight': 57.5, 'reps': 10},
            {'weight': 55, 'reps': 10}
        ]
        response = self.client.post(
            f'/api/auth/exercise-settings/{self.exercise.id}/',
            {'weight': 60, 'reps': 10, 'subSets': sub_sets},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['subSets'], sub_sets)

    def test_exercise_settings_unique_per_user(self):
        """Test that each user has their own exercise settings"""
        # Create settings for first user
        ExerciseSettings.objects.create(
            user=self.user,
            exercise=self.exercise,
            weight=80,
            reps=10
        )

        # Create second user
        user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            password='testpass123'
        )

        # Create settings for second user with different values
        ExerciseSettings.objects.create(
            user=user2,
            exercise=self.exercise,
            weight=60,
            reps=8
        )

        # Verify both settings exist independently
        settings1 = ExerciseSettings.objects.get(user=self.user, exercise=self.exercise)
        settings2 = ExerciseSettings.objects.get(user=user2, exercise=self.exercise)

        self.assertEqual(settings1.weight, 80)
        self.assertEqual(settings2.weight, 60)

    def test_preset_includes_last_used_weights(self):
        """Test that preset response includes last used weights"""
        from workouts.models import WorkoutPreset, WorkoutPresetExercise

        # Create exercise settings
        ExerciseSettings.objects.create(
            user=self.user,
            exercise=self.exercise,
            weight=80,
            reps=10
        )

        # Create a preset with this exercise
        preset = WorkoutPreset.objects.create(
            user=self.user,
            name='Test Preset'
        )
        WorkoutPresetExercise.objects.create(
            preset=preset,
            exercise=self.exercise,
            type='normal',
            sets=3,
            order=0
        )

        # Fetch preset via API
        response = self.client.get(f'/api/workouts/presets/{preset.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('lastUsedWeights', response.data)
        self.assertIn(str(self.exercise.id), response.data['lastUsedWeights'])
        self.assertEqual(response.data['lastUsedWeights'][str(self.exercise.id)]['weight'], 80)
        self.assertEqual(response.data['lastUsedWeights'][str(self.exercise.id)]['reps'], 10)
