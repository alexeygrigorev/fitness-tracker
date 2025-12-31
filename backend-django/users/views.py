from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema
from .models import User
from .serializers import (
    UserRegistrationRequestSerializer,
    UserRegistrationResponseSerializer,
    UserProfileResponseSerializer
)


class CustomTokenObtainPairView(TokenObtainPairView):
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
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    password_confirm = request.data.get('password_confirm')

    if not username or not email or not password:
        return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

    if password != password_confirm:
        return Response({'error': 'Password fields did not match.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
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
    request=UserProfileResponseSerializer,
    responses={200: UserProfileResponseSerializer},
    description="Update current user profile (supports dark_mode)"
)
@api_view(['PATCH'])
def update_profile(request):
    """Update user profile fields like dark_mode preference."""
    dark_mode = request.data.get('dark_mode')
    if dark_mode is not None:
        request.user.dark_mode = bool(dark_mode)
        request.user.save()
    return Response({'id': request.user.id, 'username': request.user.username, 'email': request.user.email, 'dark_mode': request.user.dark_mode})
