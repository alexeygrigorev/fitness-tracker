from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .serializers import (
    AiAnalysisRequestSerializer,
    AiExerciseAnalysisSerializer,
    AiFoodAnalysisSerializer,
    AiMealAnalysisSerializer,
)


@extend_schema(
    operation_id='ai_analyze_food',
    tags=['AI'],
    summary='Analyze food from description',
    description='AI-powered food analysis that returns nutritional information',
    request=AiAnalysisRequestSerializer,
    responses={200: AiFoodAnalysisSerializer},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_food(request):
    request_serializer = AiAnalysisRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    description = request_serializer.validated_data['description']
    result = {
        'name': description.title() if description else 'Unknown Food',
        'brand': None,
        'category': 'mixed',
        'servingSize': 100,
        'servingType': 'g',
        'calories': 150,
        'protein': 10,
        'carbs': 20,
        'fat': 5,
        'saturatedFat': 1,
        'sugar': 5,
        'fiber': 2,
        'sodium': 300,
        'glycemicIndex': 45,
        'absorptionSpeed': 'moderate',
        'insulinResponse': 45,
        'satietyScore': 5,
        'proteinQuality': 2,
    }
    return Response(result)


@extend_schema(
    operation_id='ai_analyze_meal',
    tags=['AI'],
    summary='Analyze meal from description',
    description='AI-powered meal analysis that breaks down into food items',
    request=AiAnalysisRequestSerializer,
    responses={200: AiMealAnalysisSerializer},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_meal(request):
    request_serializer = AiAnalysisRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    description = request_serializer.validated_data['description']
    protein_source = {
        'name': 'Protein Source',
        'brand': None,
        'category': 'protein',
        'servingSize': 100,
        'servingType': 'g',
        'calories': 165,
        'protein': 31,
        'carbs': 0,
        'fat': 4,
        'saturatedFat': 1,
        'sugar': 0,
        'fiber': 0,
        'sodium': 75,
        'glycemicIndex': 0,
        'absorptionSpeed': 'slow',
        'insulinResponse': 20,
        'satietyScore': 8,
        'proteinQuality': 3,
        'grams': 150,
    }
    vegetable = {
        **protein_source,
        'name': 'Vegetable',
        'category': 'mixed',
        'calories': 50,
        'protein': 2,
        'carbs': 10,
        'fat': 0,
        'saturatedFat': 0,
        'sugar': 4,
        'fiber': 3,
        'sodium': 30,
        'glycemicIndex': 35,
        'absorptionSpeed': 'moderate',
        'insulinResponse': 25,
        'satietyScore': 5,
        'proteinQuality': 1,
        'grams': 100,
    }
    result = {
        'name': description.title() if description else 'Unknown Meal',
        'mealType': 'lunch',
        'foods': [
            protein_source,
            vegetable,
        ],
    }
    return Response(result)


@extend_schema(
    operation_id='ai_analyze_exercise',
    tags=['AI'],
    summary='Analyze exercise from description',
    description='AI-powered exercise analysis that returns exercise details',
    request=AiAnalysisRequestSerializer,
    responses={200: AiExerciseAnalysisSerializer},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_exercise(request):
    request_serializer = AiAnalysisRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    description = request_serializer.validated_data['description']
    result = {
        'name': description.title() if description else 'Unknown Exercise',
        'category': 'compound',
        'muscleGroups': ['chest', 'triceps', 'shoulders'],
        'equipment': 'dumbbells',
        'instructions': [
            'Lie on a bench holding dumbbells at chest height.',
            'Press the dumbbells upward until your arms are extended.',
            'Lower them under control to the starting position.',
        ],
        'bodyweight': False,
    }
    return Response(result)
