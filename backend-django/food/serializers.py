from decimal import Decimal

from django.db import transaction, models
from django.utils import timezone
from rest_framework import serializers
from .models import FoodItem, Meal, MealFoodItem, MealTemplate, MealTemplateFoodItem


class FloatWithoutTrailingZerosField(serializers.FloatField):
    """Float field that returns int for whole numbers to avoid .0 in JSON"""

    def to_representation(self, value):
        if value is None:
            return None
        # Convert to float first
        float_value = float(value)
        # If it's a whole number, return as int
        if float_value == int(float_value):
            return int(float_value)
        return float_value


class FoodItemSerializer(serializers.ModelSerializer):
    # Map snake_case model fields to camelCase for frontend
    # Use custom field to avoid trailing zeros (e.g., 1.00 -> 1, 1.5 -> 1.5)
    servingSize = FloatWithoutTrailingZerosField(source='serving_size')
    servingType = serializers.CharField(source='serving_unit')
    calories = FloatWithoutTrailingZerosField()
    protein = FloatWithoutTrailingZerosField()
    carbs = FloatWithoutTrailingZerosField()
    fat = FloatWithoutTrailingZerosField()
    fiber = FloatWithoutTrailingZerosField(required=False, allow_null=True)
    sugar = FloatWithoutTrailingZerosField(required=False, allow_null=True)
    glycemicIndex = serializers.IntegerField(source='glycemic_index', required=False, allow_null=True)
    absorptionSpeed = serializers.CharField(source='absorption_speed', required=False, allow_null=True)
    satietyScore = serializers.IntegerField(source='satiety_score', required=False, allow_null=True)
    proteinQuality = serializers.IntegerField(source='protein_quality', required=False, allow_null=True)
    insulinResponse = FloatWithoutTrailingZerosField(
        source='insulin_response',
        required=False,
        allow_null=True,
    )

    class Meta:
        model = FoodItem
        fields = [
            'id', 'user', 'name', 'brand', 'barcode', 'source',
            'servingSize', 'servingType',
            'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar',
            'glycemicIndex', 'absorptionSpeed', 'satietyScore', 'proteinQuality',
            'insulinResponse', 'category'
        ]
        # Mark user as read-only for canonical foods
        read_only_fields = ['user']

    def validate_servingSize(self, value):
        if value <= 0:
            raise serializers.ValidationError('Serving size must be greater than zero.')
        return value


class AccessibleFoodPrimaryKeyField(serializers.PrimaryKeyRelatedField):
    """Restrict writable references to canonical or requesting-user foods."""

    def get_queryset(self):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return FoodItem.objects.none()
        return FoodItem.objects.filter(
            models.Q(user=request.user) | models.Q(source='canonical')
        )


class MealFoodItemSerializer(serializers.ModelSerializer):
    # Frontend expects foodId (string), not nested food object
    foodId = AccessibleFoodPrimaryKeyField(source='food')
    grams = FloatWithoutTrailingZerosField(min_value=Decimal('0.01'))
    order = serializers.IntegerField(required=False)

    class Meta:
        model = MealFoodItem
        fields = ['id', 'foodId', 'grams', 'order']


class MealSerializer(serializers.ModelSerializer):
    # Include nested food items with frontend-friendly format
    food_items = MealFoodItemSerializer(many=True, required=False)
    # Map snake_case to camelCase
    mealType = serializers.CharField(source='meal_type')
    date = serializers.DateField(required=False)
    loggedAt = serializers.DateTimeField(source='logged_at', required=False)
    eventTime = serializers.TimeField(source='event_time', required=False, allow_null=True)
    totalCalories = serializers.SerializerMethodField()
    totalProtein = serializers.SerializerMethodField()
    totalCarbs = serializers.SerializerMethodField()
    totalFat = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = [
            'id', 'name', 'mealType', 'date', 'loggedAt', 'eventTime',
            'notes', 'source', 'food_items',
            'totalCalories', 'totalProtein', 'totalCarbs', 'totalFat',
        ]

    @transaction.atomic
    def create(self, validated_data):
        food_items = validated_data.pop('food_items', [])
        if not validated_data.get('date'):
            logged_at = validated_data.get('logged_at') or timezone.now()
            validated_data['date'] = timezone.localtime(logged_at).date()
        meal = super().create(validated_data)
        self._replace_food_items(meal, food_items)
        return meal

    @transaction.atomic
    def update(self, instance, validated_data):
        food_items = validated_data.pop('food_items', None)
        meal = super().update(instance, validated_data)
        if food_items is not None:
            self._replace_food_items(meal, food_items)
        return meal

    def _replace_food_items(self, meal, food_items):
        meal.food_items.all().delete()
        for index, item in enumerate(food_items):
            MealFoodItem.objects.create(
                meal=meal,
                food=item['food'],
                grams=item['grams'],
                order=item.get('order', index),
            )

    def _nutrition_totals(self, meal):
        totals = {
            'calories': Decimal('0'),
            'protein': Decimal('0'),
            'carbs': Decimal('0'),
            'fat': Decimal('0'),
        }
        for item in meal.food_items.select_related('food'):
            if item.food.serving_size <= 0:
                continue
            multiplier = item.grams / item.food.serving_size
            totals['calories'] += item.food.calories * multiplier
            totals['protein'] += item.food.protein * multiplier
            totals['carbs'] += item.food.carbs * multiplier
            totals['fat'] += item.food.fat * multiplier
        return {key: float(round(value, 2)) for key, value in totals.items()}

    def get_totalCalories(self, meal):
        return self._nutrition_totals(meal)['calories']

    def get_totalProtein(self, meal):
        return self._nutrition_totals(meal)['protein']

    def get_totalCarbs(self, meal):
        return self._nutrition_totals(meal)['carbs']

    def get_totalFat(self, meal):
        return self._nutrition_totals(meal)['fat']


class MealTemplateFoodItemSerializer(serializers.ModelSerializer):
    # Frontend expects foodId (string), not nested food object
    foodId = AccessibleFoodPrimaryKeyField(source='food')
    grams = FloatWithoutTrailingZerosField(min_value=Decimal('0.01'))
    order = serializers.IntegerField(required=False)

    class Meta:
        model = MealTemplateFoodItem
        fields = ['id', 'foodId', 'grams', 'order']


class MealTemplateSerializer(serializers.ModelSerializer):
    # Include nested food items with frontend-friendly format
    food_items = MealTemplateFoodItemSerializer(many=True, required=False)

    class Meta:
        model = MealTemplate
        fields = ['id', 'name', 'category', 'notes', 'food_items']

    @transaction.atomic
    def create(self, validated_data):
        food_items = validated_data.pop('food_items', [])
        template = super().create(validated_data)
        self._replace_food_items(template, food_items)
        return template

    @transaction.atomic
    def update(self, instance, validated_data):
        food_items = validated_data.pop('food_items', None)
        template = super().update(instance, validated_data)
        if food_items is not None:
            self._replace_food_items(template, food_items)
        return template

    def _replace_food_items(self, template, food_items):
        template.food_items.all().delete()
        for index, item in enumerate(food_items):
            MealTemplateFoodItem.objects.create(
                template=template,
                food=item['food'],
                grams=item['grams'],
                order=item.get('order', index),
            )


# Serializers for function-based views
class CalorieCalculationRequestSerializer(serializers.Serializer):
    """Request serializer for calorie calculation endpoint"""
    protein_g = serializers.FloatField(default=0)
    carbs_g = serializers.FloatField(default=0)
    fat_g = serializers.FloatField(default=0)


class CalorieCalculationResponseSerializer(serializers.Serializer):
    """Response serializer for calorie calculation endpoint"""
    calories = serializers.FloatField()
    protein_g = serializers.FloatField()
    carbs_g = serializers.FloatField()
    fat_g = serializers.FloatField()


class CategoryDetectionRequestSerializer(serializers.Serializer):
    """Request serializer for category detection endpoint"""
    protein_g = serializers.FloatField(default=0)
    carbs_g = serializers.FloatField(default=0)
    fat_g = serializers.FloatField(default=0)


class CategoryDetectionResponseSerializer(serializers.Serializer):
    """Response serializer for category detection endpoint"""
    category = serializers.CharField()
    protein_ratio = serializers.FloatField()
    carb_ratio = serializers.FloatField()
    fat_ratio = serializers.FloatField()


class MetabolismInferenceRequestSerializer(serializers.Serializer):
    """Request serializer for metabolism inference endpoint"""
    protein_g = serializers.FloatField(default=0)
    carbs_g = serializers.FloatField(default=0)
    fat_g = serializers.FloatField(default=0)
    fiber_g = serializers.FloatField(default=0)
    food_type = serializers.CharField(default="", allow_blank=True)


class MetabolismInferenceResponseSerializer(serializers.Serializer):
    """Response serializer for metabolism inference endpoint"""
    glycemic_index = serializers.CharField()
    absorption_speed = serializers.CharField()
    thermic_effect = serializers.CharField()
    satiety_level = serializers.CharField()


class NutritionCalculationRequestSerializer(serializers.Serializer):
    """Request serializer for nutrition calculation endpoint"""
    food_items = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of food items with food_id and grams"
    )


class NutritionCalculationResponseSerializer(serializers.Serializer):
    """Response serializer for nutrition calculation endpoint"""
    total_calories = serializers.FloatField()
    total_protein_g = serializers.FloatField()
    total_carbs_g = serializers.FloatField()
    total_fat_g = serializers.FloatField()
    total_fiber_g = serializers.FloatField()
    total_sugar_g = serializers.FloatField()
    total_sodium_mg = serializers.FloatField()
