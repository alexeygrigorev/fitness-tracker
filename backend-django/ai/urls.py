from django.urls import path
from .views import analyze_food, analyze_meal, analyze_exercise, resolve_meal_foods

urlpatterns = [
    path('analyze-food/', analyze_food, name='analyze-food'),
    path('analyze-meal/', analyze_meal, name='analyze-meal'),
    path('meal-foods/', resolve_meal_foods, name='meal-foods'),
    path('analyze-exercise/', analyze_exercise, name='analyze-exercise'),
]
