from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FoodItemViewSet, MealViewSet, MealTemplateViewSet,
    calculate_calories, detect_category, infer_metabolism, calculate_nutrition
)

router = DefaultRouter()
router.register(r'foods', FoodItemViewSet, basename='fooditem')
router.register(r'meals', MealViewSet, basename='meal')
router.register(r'templates', MealTemplateViewSet, basename='mealtemplate')

urlpatterns = [
    path('', include(router.urls)),
    path('calculations/calculate-calories/', calculate_calories, name='calculate-calories'),
    path('calculations/detect-category/', detect_category, name='detect-category'),
    path('calculations/infer-metabolism/', infer_metabolism, name='infer-metabolism'),
    path('calculations/calculate-nutrition/', calculate_nutrition, name='calculate-nutrition'),
]
