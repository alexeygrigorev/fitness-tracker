from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


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
