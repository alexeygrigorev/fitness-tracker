from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Exercise, WorkoutSession, WorkoutSet, WorkoutPreset, WorkoutPresetExercise, ActiveWorkoutState
from .serializers import (
    ExerciseSerializer, WorkoutSessionSerializer, WorkoutSetSerializer,
    WorkoutPresetSerializer, WorkoutPresetExerciseSerializer, ActiveWorkoutStateSerializer,
    VolumeCalculationRequestSerializer
)


class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return super().get_permissions()


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSessionSerializer

    def get_queryset(self):
        return WorkoutSession.objects.filter(user=self.request.user)


class WorkoutPresetViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutPresetSerializer

    def get_queryset(self):
        return WorkoutPreset.objects.filter(user=self.request.user)


@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
def active_workout_state(request):
    state, created = ActiveWorkoutState.objects.get_or_create(
        user=request.user,
        defaults={'data': request.data if request.method == 'POST' else {}}
    )

    if request.method == 'GET':
        serializer = ActiveWorkoutStateSerializer(state)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = ActiveWorkoutStateSerializer(state, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    elif request.method == 'PATCH':
        serializer = ActiveWorkoutStateSerializer(state, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    elif request.method == 'DELETE':
        state.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def calculate_volume(request):
    serializer = VolumeCalculationRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    sets = serializer.validated_data['sets']
    total_volume = 0
    volume_by_exercise = {}

    for set_item in sets:
        weight = set_item.get('weight_lbs', 0) or 0
        reps = set_item.get('reps', 0) or 0
        set_volume = weight * reps
        total_volume += set_volume

        exercise_id = set_item.get('exercise_id', 'unknown')
        if exercise_id not in volume_by_exercise:
            volume_by_exercise[exercise_id] = 0
        volume_by_exercise[exercise_id] += set_volume

    return Response({
        'total_volume': total_volume,
        'volume_by_exercise': volume_by_exercise
    })
