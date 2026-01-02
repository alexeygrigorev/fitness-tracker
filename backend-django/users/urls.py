from django.urls import path
from .views import CustomTokenObtainPairView, register, me, update_profile, exercise_settings_upsert

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', register, name='register'),
    path('me/', me, name='me'),
    path('me/update/', update_profile, name='update_profile'),
    path('exercise-settings/<str:exercise_id>/', exercise_settings_upsert, name='exercise_settings_upsert'),
]
