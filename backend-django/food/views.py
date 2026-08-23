from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from decimal import Decimal

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Prefetch, Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import FoodItem, Meal, MealFoodItem, MealTemplate, MealTemplateFoodItem
from .serializers import (
    FoodItemSerializer, MealSerializer, MealTemplateSerializer,
    MealDailyTotalsSerializer,
    CalorieCalculationRequestSerializer, CalorieCalculationResponseSerializer,
    CategoryDetectionRequestSerializer, CategoryDetectionResponseSerializer,
    MetabolismInferenceRequestSerializer, MetabolismInferenceResponseSerializer,
    NutritionCalculationRequestSerializer, NutritionCalculationResponseSerializer
)

class FoodItemViewSet(viewsets.ModelViewSet):
    serializer_class = FoodItemSerializer
    
    def get_queryset(self):
        # User can see their own foods and canonical foods
        if self.request.user.is_authenticated:
            return FoodItem.objects.filter(
                user=self.request.user
            ) | FoodItem.objects.filter(source='canonical')
        return FoodItem.objects.filter(source='canonical')

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def _ensure_owner(self, instance):
        if instance.user_id != self.request.user.id:
            raise PermissionDenied('Only the food owner can modify this item.')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, source='user')
        return Response(serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        instance.delete()
        return Response(status=204)

@extend_schema_view(
    by_date=extend_schema(responses={200: MealSerializer(many=True)}),
    daily_totals=extend_schema(responses={200: MealDailyTotalsSerializer}),
)
class MealViewSet(viewsets.ModelViewSet):
    serializer_class = MealSerializer

    def get_queryset(self):
        return Meal.objects.filter(user=self.request.user).prefetch_related(
            Prefetch(
                "food_items",
                queryset=MealFoodItem.objects.select_related("food"),
            )
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)

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
        from decimal import Decimal

        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

        meals = Meal.objects.filter(user=request.user, date=date_obj)

        # Calculate totals from meal food items using grams instead of servings
        meal_food_items = MealFoodItem.objects.filter(meal__in=meals).select_related('food')

        total_calories = Decimal(0)
        total_protein = Decimal(0)
        total_carbs = Decimal(0)
        total_fat = Decimal(0)
        total_fiber = Decimal(0)
        total_sugar = Decimal(0)
        total_sodium = Decimal(0)

        for mfi in meal_food_items:
            if mfi.food.serving_size <= 0:
                continue
            # Calculate multiplier based on serving size (grams in meal / serving_size in food)
            multiplier = mfi.grams / mfi.food.serving_size
            total_calories += mfi.food.calories * multiplier
            total_protein += mfi.food.protein * multiplier
            total_carbs += mfi.food.carbs * multiplier
            total_fat += mfi.food.fat * multiplier
            total_fiber += mfi.food.fiber * multiplier
            total_sugar += mfi.food.sugar * multiplier
            if mfi.food.sodium:
                total_sodium += mfi.food.sodium * multiplier

        return Response({
            "date": date_str,
            "calories": float(total_calories),
            "protein_g": float(total_protein),
            "carbs_g": float(total_carbs),
            "fat_g": float(total_fat),
            "fiber_g": float(total_fiber),
            "sugar_g": float(total_sugar),
            "sodium_mg": float(total_sodium),
        })

class MealTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = MealTemplateSerializer

    def get_queryset(self):
        return MealTemplate.objects.filter(user=self.request.user).prefetch_related(
            Prefetch(
                "food_items",
                queryset=MealTemplateFoodItem.objects.select_related("food"),
            )
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=204)

@extend_schema(
    request=CalorieCalculationRequestSerializer,
    responses={200: CalorieCalculationResponseSerializer},
    description="Calculate calories from macronutrients (protein, carbs, fat)"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def calculate_calories(request):
    request_serializer = CalorieCalculationRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    data = request_serializer.validated_data
    protein = data["protein_g"]
    carbs = data["carbs_g"]
    fat = data["fat_g"]
    calories = (protein * 4) + (carbs * 4) + (fat * 9)
    return Response({
        "calories": float(calories),
        "protein_g": float(protein),
        "carbs_g": float(carbs),
        "fat_g": float(fat),
    })

@extend_schema(
    request=CategoryDetectionRequestSerializer,
    responses={200: CategoryDetectionResponseSerializer},
    description="Detect food category based on macronutrient composition"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def detect_category(request):
    request_serializer = CategoryDetectionRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    data = request_serializer.validated_data
    protein = data["protein_g"]
    carbs = data["carbs_g"]
    fat = data["fat_g"]
    total = protein + carbs + fat

    if total == 0:
        category = "unknown"
    elif protein > total * Decimal("0.4"):
        category = "protein"
    elif carbs > total * Decimal("0.5"):
        category = "carb"
    elif fat > total * Decimal("0.5"):
        category = "fat"
    else:
        category = "balanced"

    return Response({
        "category": category,
        "protein_ratio": float(protein / total) if total > 0 else 0,
        "carb_ratio": float(carbs / total) if total > 0 else 0,
        "fat_ratio": float(fat / total) if total > 0 else 0,
    })

@extend_schema(
    request=MetabolismInferenceRequestSerializer,
    responses={200: MetabolismInferenceResponseSerializer},
    description="Infer metabolic properties of food (glycemic index, absorption speed, etc.)"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def infer_metabolism(request):
    request_serializer = MetabolismInferenceRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    data = request_serializer.validated_data
    protein = data["protein_g"]
    carbs = data["carbs_g"]
    fat = data["fat_g"]
    fiber = data["fiber_g"]
    food_type = data["food_type"].lower()

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

    thermic_effect = (
        "high"
        if protein > total * Decimal("0.3")
        else ("medium" if protein > total * Decimal("0.15") else "low")
    )

    satiety_score = 0
    if protein > total * Decimal("0.2"):
        satiety_score += 3
    if fiber >= 5:
        satiety_score += 3
    elif fiber >= 3:
        satiety_score += 2
    elif fiber > 0:
        satiety_score += 1
    if fat > total * Decimal("0.2"):
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

@extend_schema(
    request=NutritionCalculationRequestSerializer,
    responses={200: NutritionCalculationResponseSerializer},
    description="Calculate total nutrition for a list of food items"
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def calculate_nutrition(request):
    request_serializer = NutritionCalculationRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    items = request_serializer.validated_data["food_items"]
    total_calories = Decimal(0)
    total_protein = Decimal(0)
    total_carbs = Decimal(0)
    total_fat = Decimal(0)
    total_fiber = Decimal(0)
    total_sugar = Decimal(0)
    total_sodium = Decimal(0)

    for item in items:
        food = FoodItem.objects.filter(
            Q(user__isnull=True) | Q(user=request.user),
            id=item["food_id"],
        ).first()

        if food and food.serving_size > 0:
            multiplier = item["grams"] / food.serving_size
            total_calories += food.calories * multiplier
            total_protein += food.protein * multiplier
            total_carbs += food.carbs * multiplier
            total_fat += food.fat * multiplier
            total_fiber += food.fiber * multiplier
            total_sugar += food.sugar * multiplier
            if food.sodium:
                total_sodium += food.sodium * multiplier

    return Response({
        "total_calories": float(round(total_calories, 2)),
        "total_protein_g": float(round(total_protein, 2)),
        "total_carbs_g": float(round(total_carbs, 2)),
        "total_fat_g": float(round(total_fat, 2)),
        "total_fiber_g": float(round(total_fiber, 2)),
        "total_sugar_g": float(round(total_sugar, 2)),
        "total_sodium_mg": float(round(total_sodium, 2))
    })
