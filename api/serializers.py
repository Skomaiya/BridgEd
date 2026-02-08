"""
DRF Serializers for BridgEd API
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Student, Employer, Resume, Job, Match, Subscription, Invoice, Notification

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    class Meta:
        model = User
        fields = ['user_id', 'email', 'role', 'is_active', 'created_at']
        read_only_fields = ['user_id', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration with password"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'role']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match")
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role']
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Login request serializer"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)


class LogoutSerializer(serializers.Serializer):
    """Logout request serializer"""
    refresh_token = serializers.CharField(required=True)


class TokenResponseSerializer(serializers.Serializer):
    """JWT Token response serializer"""
    refresh = serializers.CharField()
    access = serializers.CharField()


class AuthResponseSerializer(serializers.Serializer):
    """Authentication response with user and tokens"""
    user = UserSerializer()
    tokens = TokenResponseSerializer()


class FileUploadSerializer(serializers.Serializer):
    """File upload serializer"""
    file = serializers.FileField(required=True)


class StudentSerializer(serializers.ModelSerializer):
    """Student profile serializer"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Student
        fields = ['student_id', 'user', 'university', 'course', 
                  'expected_graduation_year', 'location', 'proximity_radius',
                  'is_premium_active', 'profile_completion_percentage',
                  'created_at', 'updated_at']
        read_only_fields = ['student_id', 'created_at', 'updated_at', 'is_premium_active']


class EmployerSerializer(serializers.ModelSerializer):
    """Employer profile serializer"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Employer
        fields = ['employer_id', 'user', 'company_name', 'industry',
                  'company_size', 'location', 'contact_number', 'is_verified',
                  'created_at', 'updated_at']
        read_only_fields = ['employer_id', 'created_at', 'updated_at', 'is_verified']


class ResumeSerializer(serializers.ModelSerializer):
    """Resume serializer"""
    student = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Resume
        fields = ['resume_id', 'student', 'file', 'parsed_data',
                  'parsing_accuracy', 'uploaded_at']
        read_only_fields = ['resume_id', 'parsed_data', 'parsing_accuracy', 'uploaded_at']


class JobSerializer(serializers.ModelSerializer):
    """Job posting serializer"""
    employer = EmployerSerializer(read_only=True)
    employer_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = Job
        fields = ['job_id', 'employer', 'employer_id', 'title', 'description',
                  'required_skills', 'nice_to_have_skills', 'location',
                  'is_open', 'created_at', 'updated_at']
        read_only_fields = ['job_id', 'created_at', 'updated_at']


class JobListSerializer(serializers.ModelSerializer):
    """Simplified job list serializer"""
    company_name = serializers.CharField(source='employer.company_name', read_only=True)
    
    class Meta:
        model = Job
        fields = ['job_id', 'title', 'company_name', 'location',
                  'required_skills', 'is_open', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    """Match serializer"""
    student = StudentSerializer(read_only=True)
    job = JobSerializer(read_only=True)
    
    class Meta:
        model = Match
        fields = ['match_id', 'student', 'job', 'compatibility_score',
                  'student_interested', 'matched_at']
        read_only_fields = ['match_id', 'compatibility_score', 'matched_at']


class MatchListSerializer(serializers.ModelSerializer):
    """Simplified match list for dashboards"""
    job_title = serializers.CharField(source='job.title', read_only=True)
    company_name = serializers.CharField(source='job.employer.company_name', read_only=True)
    job_location = serializers.CharField(source='job.location', read_only=True)
    
    class Meta:
        model = Match
        fields = ['match_id', 'job_title', 'company_name', 'job_location',
                  'compatibility_score', 'student_interested', 'matched_at']


class SubscriptionSerializer(serializers.ModelSerializer):
    """Subscription serializer"""
    is_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Subscription
        fields = ['subscription_id', 'student', 'start_date', 'expiry_date',
                  'amount', 'payment_reference', 'is_active', 'created_at']
        read_only_fields = ['subscription_id', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Invoice serializer"""
    employer = EmployerSerializer(read_only=True)
    job = JobListSerializer(read_only=True)
    
    class Meta:
        model = Invoice
        fields = ['invoice_id', 'employer', 'job', 'success_fee',
                  'payment_status', 'issued_at', 'paid_at']
        read_only_fields = ['invoice_id', 'issued_at']


class NotificationSerializer(serializers.ModelSerializer):
    """Notification serializer"""
    class Meta:
        model = Notification
        fields = ['notification_id', 'user', 'type', 'message',
                  'is_read', 'created_at']
        read_only_fields = ['notification_id', 'created_at']
