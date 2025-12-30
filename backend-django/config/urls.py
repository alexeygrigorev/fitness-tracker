from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from drf_spectacular.utils import extend_schema


class HealthCheckResponseSerializer(serializers.Serializer):
    """Response serializer for health check endpoint"""
    status = serializers.CharField()
    version = serializers.CharField()
    framework = serializers.CharField()


@extend_schema(
    responses={200: HealthCheckResponseSerializer},
    description="Check if the API is healthy and operational"
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({
        'status': 'healthy',
        'version': '1.0.0',
        'framework': 'Django REST Framework'
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('users.urls')),
    path('api/workouts/', include('workouts.urls')),
    path('api/food/', include('food.urls')),
    path('api/ai/', include('ai.urls')),
    # OpenAPI endpoints (like FastAPI's /docs)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
