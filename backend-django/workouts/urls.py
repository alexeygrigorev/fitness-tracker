from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExerciseViewSet, WorkoutSetViewSet, WorkoutSessionViewSet, WorkoutPresetViewSet, WorkoutPlanViewSet,
    calculate_volume
)

router = DefaultRouter()
router.register(r"exercises", ExerciseViewSet, basename="exercise")
router.register(r"sets", WorkoutSetViewSet, basename="workoutset")
router.register(r"sessions", WorkoutSessionViewSet, basename="workoutsession")
router.register(r"presets", WorkoutPresetViewSet, basename="workoutpreset")
router.register(r"plans", WorkoutPlanViewSet, basename="workoutplan")

urlpatterns = [
    path("", include(router.urls)),
    path("calculations/calculate-volume/", calculate_volume, name="calculate-volume"),
]
