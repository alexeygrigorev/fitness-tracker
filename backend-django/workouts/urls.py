from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExerciseViewSet, WorkoutSessionViewSet, WorkoutPresetViewSet,
    active_workout_state, calculate_volume
)

router = DefaultRouter()
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'sessions', WorkoutSessionViewSet, basename='workoutsession')
router.register(r'presets', WorkoutPresetViewSet, basename='workoutpreset')

urlpatterns = [
    path('', include(router.urls)),
    path('active-state/', active_workout_state, name='active-workout-state'),
    path('calculations/calculate-volume/', calculate_volume, name='calculate-volume'),
]
