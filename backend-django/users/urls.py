from django.urls import path
from .views import CustomTokenObtainPairView, register, me

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', register, name='register'),
    path('me/', me, name='me'),
]
