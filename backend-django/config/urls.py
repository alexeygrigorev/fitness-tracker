from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
import mimetypes
from django.http import FileResponse, HttpResponse
from pathlib import Path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import serializers, status
from django.db import DatabaseError, connection
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from drf_spectacular.utils import extend_schema


class HealthCheckResponseSerializer(serializers.Serializer):
    """Response serializer for health check endpoint"""
    status = serializers.CharField()
    version = serializers.CharField()
    framework = serializers.CharField()


@extend_schema(
    responses={200: HealthCheckResponseSerializer, 503: HealthCheckResponseSerializer},
    description="Check if the API is healthy and operational"
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1 FROM django_migrations LIMIT 1')
            cursor.fetchone()
    except DatabaseError:
        return Response({
            'status': 'unhealthy',
            'version': '1.0.0',
            'framework': 'Django REST Framework',
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({
        'status': 'healthy',
        'version': '1.0.0',
        'framework': 'Django REST Framework',
    })


def serve_spa(request, path=''):
    """Serve React SPA - static files or index.html for all non-API routes"""
    frontend_path = getattr(settings, 'FRONTEND_BUILD', None)
    if not frontend_path:
        return HttpResponse("Frontend path not configured.", status=500)

    frontend_root = Path(frontend_path)
    if not frontend_root.exists():
        return HttpResponse(f"Frontend build not found at {frontend_path}", status=503)

    # If a path is provided, try to serve the file
    if path:
        # Remove leading slash if present
        path = path.lstrip('/')
        try:
            file_path = (frontend_root.resolve() / path).resolve()
            file_path.relative_to(frontend_root.resolve())
        except (ValueError, OSError):
            return HttpResponse("Access denied.", status=403)

        if file_path.is_file():
            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None or mime_type == 'text/plain':
                suffix = file_path.suffix.lower()
                if suffix in {'.js', '.mjs'}:
                    mime_type = 'application/javascript'
                elif suffix == '.css':
                    mime_type = 'text/css'
                elif suffix == '.svg':
                    mime_type = 'image/svg+xml'
                else:
                    mime_type = 'application/octet-stream'

            # Vite includes a content hash in filenames under assets/.
            cache_control = (
                'public, max-age=31536000, immutable'
                if file_path.parent.name == 'assets'
                else 'public, max-age=3600'
            )
            response = FileResponse(file_path.open('rb'), content_type=mime_type)
            response['Cache-Control'] = cache_control
            return response

    # Serve index.html for SPA routing (or if file not found)
    index_path = frontend_root / 'index.html'
    if index_path.is_file():
        response = FileResponse(index_path.open('rb'), content_type='text/html')
        # Never pin users to an old application entrypoint after a deploy.
        response['Cache-Control'] = 'no-store, must-revalidate'
        return response

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
