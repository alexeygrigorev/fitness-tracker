from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.CharField(max_length=255, unique=True)
    username = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    dark_mode = models.BooleanField(default=False)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username


class ExerciseSettings(models.Model):
    """Stores user's last used weights and reps per exercise"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exercise_settings')
    exercise = models.ForeignKey('workouts.Exercise', on_delete=models.CASCADE, related_name='user_settings')
    weight = models.FloatField(null=True, blank=True)
    reps = models.IntegerField(default=10)
    sub_sets = models.JSONField(default=list, blank=True)  # For dropdown sets: [{weight, reps}, ...]
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'exercise']
        verbose_name_plural = 'Exercise Settings'

    def __str__(self):
        return f"{self.user.username} - {self.exercise.name}: {self.weight}kg x {self.reps}"
