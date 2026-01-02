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

    class Meta:
        model = FoodItem
        fields = [
            'id', 'user', 'name', 'brand', 'barcode', 'source',
            'servingSize', 'servingType',
            'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar',
            'glycemicIndex', 'absorptionSpeed', 'satietyScore', 'proteinQuality',
            'category'
        ]
        # Mark user as read-only for canonical foods
        read_only_fields = ['user']


class MealFoodItemSerializer(serializers.ModelSerializer):
    # Frontend expects foodId (string), not nested food object
    foodId = serializers.IntegerField(source='food_id')
    grams = FloatWithoutTrailingZerosField()

    class Meta:
        model = MealFoodItem
        fields = ['id', 'foodId', 'grams', 'order']


class MealSerializer(serializers.ModelSerializer):
    # Include nested food items with frontend-friendly format
    food_items = MealFoodItemSerializer(many=True, read_only=True)
    # Map snake_case to camelCase
    mealType = serializers.CharField(source='meal_type')
    loggedAt = serializers.DateTimeField(source='logged_at')
    eventTime = serializers.TimeField(source='event_time', required=False)

    class Meta:
        model = Meal
        fields = ['id', 'name', 'mealType', 'date', 'loggedAt', 'eventTime', 'notes', 'source', 'food_items']


class MealTemplateFoodItemSerializer(serializers.ModelSerializer):
    # Frontend expects foodId (string), not nested food object
    foodId = serializers.IntegerField(source='food_id')
    grams = FloatWithoutTrailingZerosField()

    class Meta:
        model = MealTemplateFoodItem
        fields = ['id', 'foodId', 'grams', 'order']


class MealTemplateSerializer(serializers.ModelSerializer):
    # Include nested food items with frontend-friendly format
    food_items = MealTemplateFoodItemSerializer(many=True, read_only=True)

    class Meta:
        model = MealTemplate
        fields = ['id', 'name', 'category', 'notes', 'food_items']


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
