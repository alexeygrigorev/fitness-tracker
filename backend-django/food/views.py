from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, F
from .models import FoodItem, Meal, MealFoodItem, MealTemplate, MealTemplateFoodItem
from .serializers import (
    FoodItemSerializer, MealSerializer, MealFoodItemSerializer,
    MealTemplateSerializer, MealTemplateFoodItemSerializer,
    CalculateCaloriesRequestSerializer, DetectCategoryRequestSerializer,
    CalculateNutritionRequestSerializer, InferMetabolismRequestSerializer
)


class FoodItemViewSet(viewsets.ModelViewSet):
    serializer_class = FoodItemSerializer

    def get_queryset(self):
        return FoodItem.objects.filter(
            user=self.request.user
        ) | FoodItem.objects.filter(is_custom=False)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return super().get_permissions()


class MealViewSet(viewsets.ModelViewSet):
    serializer_class = MealSerializer

    def get_queryset(self):
        return Meal.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="date/(?P<date_str>[^/.]+)")
    def by_date(self, request, date_str=None):
        from datetime import datetime
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

        meals = self.get_queryset().filter(date=date_obj)
        serializer = self.get_serializer(meals, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="daily/totals/(?P<date_str>[^/.]+)")
    def daily_totals(self, request, date_str=None):
        from datetime import datetime
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

        meals = Meal.objects.filter(user=request.user, date=date_obj)

        totals = meals.aggregate(
            total_calories=Sum(F("food_items__servings") * F("food_items__food__calories_per_serving")),
            total_protein=Sum(F("food_items__servings") * F("food_items__food__protein_g")),
            total_carbs=Sum(F("food_items__servings") * F("food_items__food__carbs_g")),
            total_fat=Sum(F("food_items__servings") * F("food_items__food__fat_g")),
            total_fiber=Sum(F("food_items__servings") * F("food_items__food__fiber_g")),
            total_sugar=Sum(F("food_items__servings") * F("food_items__food__sugar_g")),
            total_sodium=Sum(F("food_items__servings") * F("food_items__food__sodium_mg")),
        )

        return Response({
            "date": date_str,
            "calories": totals["total_calories"] or 0,
            "protein_g": totals["total_protein"] or 0,
            "carbs_g": totals["total_carbs"] or 0,
            "fat_g": totals["total_fat"] or 0,
            "fiber_g": totals["total_fiber"] or 0,
            "sugar_g": totals["total_sugar"] or 0,
            "sodium_mg": totals["total_sodium"] or 0,
        })


class MealTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = MealTemplateSerializer

    def get_queryset(self):
        return MealTemplate.objects.filter(user=self.request.user)


@api_view(["POST"])
@permission_classes([AllowAny])
def calculate_calories(request):
    serializer = CalculateCaloriesRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    protein = serializer.validated_data.get("protein_g", 0)
    carbs = serializer.validated_data.get("carbs_g", 0)
    fat = serializer.validated_data.get("fat_g", 0)

    calories = (protein * 4) + (carbs * 4) + (fat * 9)

    return Response({"calories": calories, "protein_g": protein, "carbs_g": carbs, "fat_g": fat})

@api_view(["POST"])
@permission_classes([AllowAny])
def detect_category(request):
    serializer = DetectCategoryRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    protein = serializer.validated_data.get("protein_g", 0)
    carbs = serializer.validated_data.get("carbs_g", 0)
    fat = serializer.validated_data.get("fat_g", 0)

    total = protein + carbs + fat
    if total == 0:
        category = "unknown"
    elif protein > total * 0.4:
        category = "protein"
    elif carbs > total * 0.5:
        category = "carb"
    elif fat > total * 0.5:
        category = "fat"
    else:
        category = "balanced"

    return Response({
        "category": category,
        "protein_ratio": protein / total if total > 0 else 0,
        "carb_ratio": carbs / total if total > 0 else 0,
        "fat_ratio": fat / total if total > 0 else 0
    })

@api_view(["POST"])
@permission_classes([AllowAny])
def infer_metabolism(request):
    serializer = InferMetabolismRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    protein = serializer.validated_data.get("protein_g", 0)
    carbs = serializer.validated_data.get("carbs_g", 0)
    fat = serializer.validated_data.get("fat_g", 0)
    fiber = serializer.validated_data.get("fiber_g", 0)
    food_type = serializer.validated_data.get("food_type", "").lower()

    total = protein + carbs + fat

    if carbs > 0 and fiber > 0:
        glycemic_index = "low" if fiber >= 5 else ("medium" if fiber >= 3 else "high")
    elif "whole" in food_type or "complex" in food_type:
        glycemic_index = "low"
    elif "sugar" in food_type or "candy" in food_type or "soda" in food_type:
        glycemic_index = "high"
    else:
        glycemic_index = "medium"

    if glycemic_index == "high":
        absorption_speed = "fast"
    elif glycemic_index == "low":
        absorption_speed = "slow"
    else:
        absorption_speed = "moderate"

    thermic_effect = "high" if protein > total * 0.3 else ("medium" if protein > total * 0.15 else "low")

    satiety_score = 0
    if protein > total * 0.2:
        satiety_score += 3
    if fiber >= 5:
        satiety_score += 3
    elif fiber >= 3:
        satiety_score += 2
    elif fiber > 0:
        satiety_score += 1
    if fat > total * 0.2:
        satiety_score += 2

    if satiety_score >= 6:
        satiety_level = "very_high"
    elif satiety_score >= 4:
        satiety_level = "high"
    elif satiety_score >= 2:
        satiety_level = "moderate"
    else:
        satiety_level = "low"

    return Response({
        "glycemic_index": glycemic_index,
        "absorption_speed": absorption_speed,
        "thermic_effect": thermic_effect,
        "satiety_level": satiety_level
    })

@api_view(["POST"])
@permission_classes([AllowAny])
def calculate_nutrition(request):
    serializer = CalculateNutritionRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    items = serializer.validated_data["food_items"]
    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    total_fiber = 0
    total_sugar = 0
    total_sodium = 0

    for item in items:
        food_id = item.get("food_id")
        servings = item.get("servings", 1)

        try:
            food = FoodItem.objects.get(id=food_id)
            total_calories += food.calories_per_serving * servings
            total_protein += food.protein_g * servings
            total_carbs += food.carbs_g * servings
            total_fat += food.fat_g * servings
            total_fiber += food.fiber_g * servings
            total_sugar += food.sugar_g * servings
            total_sodium += food.sodium_mg * servings
        except FoodItem.DoesNotExist:
            continue

    return Response({
        "total_calories": round(total_calories, 2),
        "total_protein_g": round(total_protein, 2),
        "total_carbs_g": round(total_carbs, 2),
        "total_fat_g": round(total_fat, 2),
        "total_fiber_g": round(total_fiber, 2),
        "total_sugar_g": round(total_sugar, 2),
        "total_sodium_mg": round(total_sodium, 2)
    })
