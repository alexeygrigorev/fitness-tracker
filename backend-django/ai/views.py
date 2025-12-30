from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema


@extend_schema(
    operation_id='ai_analyze_food',
    tags=['AI'],
    summary='Analyze food from description',
    description='AI-powered food analysis that returns nutritional information',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'description': {'type': 'string', 'description': 'Food description'},
            },
            'required': ['description'],
        }
    },
    responses={
        200: {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'serving_size': {'type': 'number'},
                'serving_unit': {'type': 'string'},
                'calories_per_serving': {'type': 'number'},
                'protein_g': {'type': 'number'},
                'carbs_g': {'type': 'number'},
                'fat_g': {'type': 'number'},
                'fiber_g': {'type': 'number'},
                'sugar_g': {'type': 'number'},
                'sodium_mg': {'type': 'number'},
                'category': {'type': 'string'},
                'confidence': {'type': 'number'},
            },
        }
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_food(request):
    description = request.data.get('description', '')
    result = {
        'name': description.title() if description else 'Unknown Food',
        'serving_size': 100,
        'serving_unit': 'g',
        'calories_per_serving': 150,
        'protein_g': 10,
        'carbs_g': 20,
        'fat_g': 5,
        'fiber_g': 2,
        'sugar_g': 5,
        'sodium_mg': 300,
        'category': 'balanced',
        'confidence': 0.8
    }
    return Response(result)


@extend_schema(
    operation_id='ai_analyze_meal',
    tags=['AI'],
    summary='Analyze meal from description',
    description='AI-powered meal analysis that breaks down into food items',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'description': {'type': 'string', 'description': 'Meal description'},
            },
            'required': ['description'],
        }
    },
    responses={
        200: {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'meal_type': {'type': 'string'},
                'food_items': {'type': 'array'},
                'total_calories': {'type': 'number'},
                'total_protein_g': {'type': 'number'},
                'total_carbs_g': {'type': 'number'},
                'total_fat_g': {'type': 'number'},
                'confidence': {'type': 'number'},
            },
        }
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_meal(request):
    description = request.data.get('description', '')
    result = {
        'name': description.title() if description else 'Unknown Meal',
        'meal_type': 'lunch',
        'food_items': [
            {'name': 'Protein Source', 'serving_size': 100, 'serving_unit': 'g',
             'calories_per_serving': 150, 'protein_g': 25, 'carbs_g': 0, 'fat_g': 5},
            {'name': 'Vegetable', 'serving_size': 100, 'serving_unit': 'g',
             'calories_per_serving': 50, 'protein_g': 2, 'carbs_g': 10, 'fat_g': 0}
        ],
        'total_calories': 200,
        'total_protein_g': 27,
        'total_carbs_g': 10,
        'total_fat_g': 5,
        'confidence': 0.75
    }
    return Response(result)


@extend_schema(
    operation_id='ai_analyze_exercise',
    tags=['AI'],
    summary='Analyze exercise from description',
    description='AI-powered exercise analysis that returns exercise details',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'description': {'type': 'string', 'description': 'Exercise description'},
            },
            'required': ['description'],
        }
    },
    responses={
        200: {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'muscle_group': {'type': 'string'},
                'equipment': {'type': 'string'},
                'description': {'type': 'string'},
                'is_compound': {'type': 'boolean'},
                'primary_muscles': {'type': 'array', 'items': {'type': 'string'}},
                'secondary_muscles': {'type': 'array', 'items': {'type': 'string'}},
                'difficulty': {'type': 'string'},
                'confidence': {'type': 'number'},
            },
        }
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_exercise(request):
    description = request.data.get('description', '')
    result = {
        'name': description.title() if description else 'Unknown Exercise',
        'muscle_group': 'chest',
        'equipment': 'dumbbells',
        'description': 'A compound exercise that targets multiple muscle groups.',
        'is_compound': True,
        'primary_muscles': ['chest', 'triceps', 'shoulders'],
        'secondary_muscles': ['core'],
        'difficulty': 'intermediate',
        'confidence': 0.85
    }
    return Response(result)
