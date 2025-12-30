from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']
        read_only_fields = ['id']


class UserRegistrationRequestSerializer(serializers.Serializer):
    """Request serializer for user registration endpoint"""
    username = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)


class UserRegistrationResponseSerializer(serializers.Serializer):
    """Response serializer for user registration endpoint"""
    user = UserSerializer()
    message = serializers.CharField()


class UserProfileResponseSerializer(serializers.Serializer):
    """Response serializer for user profile (me) endpoint"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
