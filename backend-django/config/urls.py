from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


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
    path('api/v1/health/', health_check, name='health-check'),
    path('api/v1/auth/', include('users.urls')),
    path('api/v1/workouts/', include('workouts.urls')),
    path('api/v1/food/', include('food.urls')),
    path('api/v1/ai/', include('ai.urls')),
]
