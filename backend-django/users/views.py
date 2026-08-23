from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.password_validation import validate_password
from drf_spectacular.utils import extend_schema
from .models import User, ExerciseSettings
from .serializers import (
    UserRegistrationRequestSerializer,
    UserRegistrationResponseSerializer,
    UserProfileResponseSerializer,
    UserProfileUpdateRequestSerializer,
    ExerciseSettingsRequestSerializer,
    ExerciseSettingsResponseSerializer,
    LoginResponseSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    @extend_schema(
        responses={200: LoginResponseSerializer},
        description="Authenticate with a username and password and receive JWTs plus the user profile.",
    )
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username')
            try:
                user = User.objects.get(username=username)
                response.data['user'] = {'id': user.id, 'username': user.username, 'email': user.email, 'dark_mode': user.dark_mode}
            except User.DoesNotExist:
                pass
        return response


@extend_schema(
    request=UserRegistrationRequestSerializer,
    responses={201: UserRegistrationResponseSerializer},
    description="Register a new user account"
)
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    request_serializer = UserRegistrationRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    data = request_serializer.validated_data
    username = data['username']
    email = data['email']
    password = data['password']

    if password != data['password_confirm']:
        return Response({'error': 'Password fields did not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(password, user=User(username=username, email=email))
    except DjangoValidationError as exc:
        return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Account already exists'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(username=username, email=email, password=password)
    except IntegrityError:
        return Response({'error': 'Account already exists'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        'user': {'id': user.id, 'username': user.username, 'email': user.email, 'dark_mode': user.dark_mode},
        'message': 'User created successfully'
    }, status=status.HTTP_201_CREATED)


@extend_schema(
    responses={200: UserProfileResponseSerializer},
    description="Get current user profile information"
)
@api_view(['GET'])
def me(request):
    return Response({'id': request.user.id, 'username': request.user.username, 'email': request.user.email, 'dark_mode': request.user.dark_mode})


@extend_schema(
    request=UserProfileUpdateRequestSerializer,
    responses={200: UserProfileResponseSerializer},
    description="Update current user profile (supports dark_mode)"
)
@api_view(['PATCH'])
def update_profile(request):
    """Update user profile fields like dark_mode preference."""
    serializer = UserProfileUpdateRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    request.user.dark_mode = serializer.validated_data['dark_mode']
    request.user.save()
    return Response({'id': request.user.id, 'username': request.user.username, 'email': request.user.email, 'dark_mode': request.user.dark_mode})


@extend_schema(
    request=ExerciseSettingsRequestSerializer,
    responses={200: ExerciseSettingsResponseSerializer},
    description="Update or create exercise settings for a specific exercise"
)
@api_view(['POST', 'PATCH'])
def exercise_settings_upsert(request, exercise_id):
    """Update or create exercise settings for a specific exercise."""
    from django.db.models import Q
    from workouts.models import Exercise

    request_serializer = ExerciseSettingsRequestSerializer(data=request.data)
    request_serializer.is_valid(raise_exception=True)
    data = request_serializer.validated_data
    weight = data.get('weight')
    reps = data['reps']
    sub_sets = data.get('subSets')

    # Get the Exercise object
    try:
        exercise = Exercise.objects.filter(
            Q(user__isnull=True) | Q(user=request.user)
        ).get(id=exercise_id)
    except Exercise.DoesNotExist:
        return Response({'error': 'Exercise not found'}, status=status.HTTP_404_NOT_FOUND)

    setting, created = ExerciseSettings.objects.get_or_create(
        user=request.user,
        exercise=exercise,
        defaults={'weight': weight, 'reps': reps, 'sub_sets': sub_sets or []}
    )

    if not created:
        if weight is not None:
            setting.weight = weight
        setting.reps = reps
        if sub_sets is not None:
            setting.sub_sets = sub_sets
        setting.save()

    result = {'reps': setting.reps}
    if setting.weight is not None:
        result['weight'] = setting.weight
    if setting.sub_sets:
        result['subSets'] = setting.sub_sets

    return Response(result)
@extend_schema(
    responses={
        200: {
            'type': 'object',
            'additionalProperties': {
                '$ref': '#/components/schemas/ExerciseSettingsResponse',
            },
        },
    },
    description="Get all exercise settings for the current user"
)
@api_view(['GET'])
def exercise_settings_list(request):
    """Get all exercise settings for the current user."""
    settings = ExerciseSettings.objects.filter(user=request.user)
    result = {}
    for setting in settings:
        data = {'reps': setting.reps}
        if setting.weight is not None:
            data['weight'] = setting.weight
        if setting.sub_sets:
            data['subSets'] = setting.sub_sets
        result[str(setting.exercise.id)] = data
    return Response(result)
