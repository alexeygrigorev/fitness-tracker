from rest_framework import serializers


class AiAnalysisRequestSerializer(serializers.Serializer):
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
    )


class AiExerciseAnalysisSerializer(serializers.Serializer):
    name = serializers.CharField()
    category = serializers.ChoiceField(choices=['compound', 'isolation', 'cardio'])
    muscleGroups = serializers.ListField(child=serializers.CharField())
    equipment = serializers.CharField(allow_blank=True, allow_null=True)
    instructions = serializers.ListField(child=serializers.CharField())
    bodyweight = serializers.BooleanField()


class AiFoodAnalysisSerializer(serializers.Serializer):
    name = serializers.CharField()
    brand = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    category = serializers.ChoiceField(
        choices=['carb', 'protein', 'fat', 'mixed', 'beverage']
    )
    servingSize = serializers.FloatField(min_value=0.01)
    servingType = serializers.CharField()
    calories = serializers.FloatField(min_value=0)
    protein = serializers.FloatField(min_value=0)
    carbs = serializers.FloatField(min_value=0)
    fat = serializers.FloatField(min_value=0)
    saturatedFat = serializers.FloatField(min_value=0, required=False, allow_null=True)
    sugar = serializers.FloatField(min_value=0)
    fiber = serializers.FloatField(min_value=0)
    sodium = serializers.FloatField(min_value=0, required=False, allow_null=True)
    glycemicIndex = serializers.IntegerField(min_value=0, max_value=100)
    absorptionSpeed = serializers.ChoiceField(choices=['slow', 'moderate', 'fast'])
    insulinResponse = serializers.FloatField(min_value=0, max_value=100)
    satietyScore = serializers.IntegerField(min_value=0, max_value=10)
    proteinQuality = serializers.IntegerField(min_value=1, max_value=3)


class AiMealFoodSerializer(AiFoodAnalysisSerializer):
    grams = serializers.FloatField(min_value=0.01)


class AiMealAnalysisSerializer(serializers.Serializer):
    name = serializers.CharField()
    mealType = serializers.ChoiceField(
        choices=['breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'beverage']
    )
    foods = AiMealFoodSerializer(many=True)
