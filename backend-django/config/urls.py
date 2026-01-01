from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import HttpResponse
import os
import mimetypes
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
    if not frontend_path:
        return HttpResponse("Frontend path not configured.", status=500)

    if not os.path.exists(frontend_path):
        return HttpResponse(f"Frontend build not found at {frontend_path}", status=503)

    # If a path is provided, try to serve the file
    if path:
        # Remove leading slash if present
        path = path.lstrip('/')
        file_path = os.path.join(frontend_path, path)

        # Security check: ensure file is within frontend_path
        file_path = os.path.realpath(file_path)
        frontend_path_real = os.path.realpath(frontend_path)
        if not file_path.startswith(frontend_path_real):
            return HttpResponse("Access denied.", status=403)

        if os.path.exists(file_path) and not os.path.isdir(file_path):
            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                if file_path.endswith('.js') or file_path.endswith('.mjs'):
                    mime_type = 'application/javascript'
                elif file_path.endswith('.css'):
                    mime_type = 'text/css'
                elif file_path.endswith('.svg'):
                    mime_type = 'image/svg+xml'
                else:
                    mime_type = 'application/octet-stream'
            # Read file and return with correct content type
            with open(file_path, 'rb') as f:
                return HttpResponse(f.read(), content_type=mime_type)

    # Serve index.html for SPA routing (or if file not found)
    index_path = os.path.join(frontend_path, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')

    return HttpResponse("Frontend build incomplete - index.html missing.", status=503)


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
# Only added when frontend is built (Docker/production mode)
# In dev mode, frontend runs separately on Vite dev server
if getattr(settings, 'FRONTEND_BUILD', None):
    urlpatterns += [re_path(r'^(?!api/|admin/)(.*)$', serve_spa)]
