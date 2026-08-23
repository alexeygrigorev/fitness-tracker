import math

from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    dark_mode = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'dark_mode']
        read_only_fields = ['id']


class UserRegistrationRequestSerializer(serializers.Serializer):
    """Request serializer for user registration endpoint"""
    username = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)


class UserProfileUpdateRequestSerializer(serializers.Serializer):
    dark_mode = serializers.BooleanField(required=True)


class NonNegativeFloatField(serializers.FloatField):
    """Reject NaN/infinite values that Python's float() would otherwise accept."""

    def __init__(self, *, max_value=None, **kwargs):
        self.hard_max_value = max_value
        kwargs.setdefault('min_value', 0)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not math.isfinite(value):
            self.fail('invalid')
        if self.hard_max_value is not None and value > self.hard_max_value:
            self.fail('max_value', max_value=self.hard_max_value)
        return value


class ExerciseSubSetSerializer(serializers.Serializer):
    weight = NonNegativeFloatField(max_value=9999.99)
    reps = serializers.IntegerField(min_value=0, max_value=10000)


class ExerciseSettingsRequestSerializer(serializers.Serializer):
    weight = NonNegativeFloatField(max_value=9999.99, allow_null=True, required=False)
    reps = serializers.IntegerField(min_value=0, max_value=10000, default=10)
    subSets = ExerciseSubSetSerializer(many=True, required=False, max_length=20)


class UserRegistrationResponseSerializer(serializers.Serializer):
    """Response serializer for user registration endpoint"""
    user = UserSerializer()
    message = serializers.CharField()


class UserProfileResponseSerializer(serializers.Serializer):
    """Response serializer for user profile (me) endpoint"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    dark_mode = serializers.BooleanField()
