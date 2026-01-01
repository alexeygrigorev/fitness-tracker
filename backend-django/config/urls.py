from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import HttpResponse, FileResponse
import os
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


def serve_spa(request, path=''):
    """Serve React SPA - static files or index.html for all non-API routes"""
    frontend_path = getattr(settings, 'FRONTEND_BUILD', None)
    if frontend_path and os.path.exists(frontend_path):
        # First try to serve the file directly
        if path:
            file_path = os.path.join(frontend_path, path)
            if os.path.exists(file_path) and not os.path.isdir(file_path):
                return FileResponse(open(file_path, 'rb'))
        # Otherwise serve index.html for SPA routing
        index_path = os.path.join(frontend_path, 'index.html')
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse("Frontend not built. Run `npm run build` in web/ directory.", status=503)


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

# Catch-all for SPA (assets, vite.svg, and all frontend routes)
# Must be last so API routes are matched first
urlpatterns += [re_path(r'^(?!api/|admin/).*$', serve_spa)]
