from rest_framework import serializers
from .models import FoodItem, Meal, MealFoodItem, MealTemplate, MealTemplateFoodItem


class FoodItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = ['id', 'name', 'brand', 'serving_size', 'serving_unit', 'calories_per_serving',
                  'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg',
                  'category', 'is_custom', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_custom']


class MealFoodItemSerializer(serializers.ModelSerializer):
    food_data = FoodItemSerializer(source='food', read_only=True)

    class Meta:
        model = MealFoodItem
        fields = ['id', 'food', 'food_data', 'servings', 'order']
        read_only_fields = ['id']


class MealSerializer(serializers.ModelSerializer):
    food_items = MealFoodItemSerializer(many=True, read_only=True)

    class Meta:
        model = Meal
        fields = ['id', 'name', 'meal_type', 'date', 'notes', 'created_at', 'updated_at', 'food_items']
        read_only_fields = ['id', 'created_at', 'updated_at']


class MealTemplateFoodItemSerializer(serializers.ModelSerializer):
    food_data = FoodItemSerializer(source='food', read_only=True)

    class Meta:
        model = MealTemplateFoodItem
        fields = ['id', 'food', 'food_data', 'servings', 'order']
        read_only_fields = ['id']


class MealTemplateSerializer(serializers.ModelSerializer):
    food_items = MealTemplateFoodItemSerializer(many=True, read_only=True)

    class Meta:
        model = MealTemplate
        fields = ['id', 'name', 'notes', 'created_at', 'updated_at', 'food_items']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CalculateCaloriesRequestSerializer(serializers.Serializer):
    protein_g = serializers.FloatField(required=False, default=0)
    carbs_g = serializers.FloatField(required=False, default=0)
    fat_g = serializers.FloatField(required=False, default=0)


class DetectCategoryRequestSerializer(serializers.Serializer):
    protein_g = serializers.FloatField(required=False, default=0)
    carbs_g = serializers.FloatField(required=False, default=0)
    fat_g = serializers.FloatField(required=False, default=0)


class CalculateNutritionRequestSerializer(serializers.Serializer):
    food_items = serializers.ListField(child=serializers.DictField())


class InferMetabolismRequestSerializer(serializers.Serializer):
    protein_g = serializers.FloatField()
    carbs_g = serializers.FloatField()
    fat_g = serializers.FloatField()
    fiber_g = serializers.FloatField(required=False, default=0)
    food_type = serializers.CharField(required=False, allow_blank=True)
