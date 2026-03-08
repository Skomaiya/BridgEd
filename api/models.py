"""
BridgEd API Models
Following README.md database schema
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class UserManager(BaseUserManager):
    """Custom user manager"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with role-based access
    Roles: student, employer, admin
    """
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('employer', 'Employer'),
        ('admin', 'Admin'),
    ]
    
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['role']
    
    def __str__(self):
        return f"{self.email} ({self.role})"
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Student(models.Model):
    """Student profile linked to User"""
    student_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    university = models.CharField(max_length=255, blank=True)
    course = models.CharField(max_length=255, blank=True)
    expected_graduation_year = models.IntegerField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    proximity_radius = models.FloatField(
        default=50.0,
        validators=[MinValueValidator(1.0), MaxValueValidator(500.0)],
        help_text="Search radius in kilometers"
    )
    is_premium_active = models.BooleanField(default=False)
    profile_completion_percentage = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.university or 'No University'}"
    
    class Meta:
        db_table = 'students'
        verbose_name = 'Student'
        verbose_name_plural = 'Students'


class Employer(models.Model):
    """Employer profile linked to User"""
    employer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employer_profile')
    company_name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255, blank=True)
    company_size = models.CharField(max_length=50, blank=True,
                                   help_text="e.g., 1-10, 11-50, 51-200, 200+")
    location = models.CharField(max_length=255, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.company_name} ({self.user.email})"
    
    class Meta:
        db_table = 'employers'
        verbose_name = 'Employer'
        verbose_name_plural = 'Employers'


class Resume(models.Model):
    """Resume with parsed data (JSON)"""
    resume_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='resume')
    file = models.FileField(upload_to='resumes/%Y/%m/', max_length=500)
    parsed_data = models.JSONField(
        default=dict,
        help_text="Parsed resume data: name, email, skills, education, experience"
    )
    parsing_accuracy = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Resume for {self.student.user.email}"
    
    class Meta:
        db_table = 'resumes'
        verbose_name = 'Resume'
        verbose_name_plural = 'Resumes'


class Job(models.Model):
    """Job/Internship postings by employers"""
    job_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name='jobs')
    title = models.CharField(max_length=255)
    description = models.TextField()
    required_skills = models.JSONField(
        default=list,
        help_text="List of required skills"
    )
    nice_to_have_skills = models.JSONField(
        default=list,
        help_text="List of nice-to-have skills"
    )
    location = models.CharField(max_length=255)
    is_open = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} at {self.employer.company_name}"
    
    class Meta:
        db_table = 'jobs'
        verbose_name = 'Job'
        verbose_name_plural = 'Jobs'
        ordering = ['-created_at']


class Match(models.Model):
    """Job-Student matches with compatibility scores"""
    match_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='matches')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='matches')
    compatibility_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Compatibility percentage (0-100)"
    )
    student_interested = models.BooleanField(default=False)
    matched_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.student.user.email} - {self.job.title} ({self.compatibility_score}%)"
    
    class Meta:
        db_table = 'matches'
        verbose_name = 'Match'
        verbose_name_plural = 'Matches'
        ordering = ['-compatibility_score', '-matched_at']
        indexes = [
            models.Index(fields=['-compatibility_score']),
            models.Index(fields=['student_interested']),
        ]
        unique_together = ('student', 'job')


class Subscription(models.Model):
    """Student subscriptions for premium features"""
    subscription_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='subscriptions')
    start_date = models.DateTimeField()
    expiry_date = models.DateTimeField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_reference = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    @property
    def is_active(self):
        """Check if subscription is currently active"""
        from django.utils import timezone
        return self.start_date <= timezone.now() <= self.expiry_date
    
    def __str__(self):
        return f"{self.student.user.email} - {self.start_date} to {self.expiry_date}"
    
    class Meta:
        db_table = 'subscriptions'
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'
        ordering = ['-created_at']


class Invoice(models.Model):
    """Success fee invoices for employers"""
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]
    
    invoice_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name='invoices')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='invoices')
    success_fee = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(max_length=50, choices=PAYMENT_STATUS_CHOICES, default='pending')
    issued_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Invoice {self.invoice_id} - {self.employer.company_name} ({self.payment_status})"
    
    class Meta:
        db_table = 'invoices'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-issued_at']


class Notification(models.Model):
    """User notifications"""
    NOTIFICATION_TYPES = [
        ('new_match', 'New Match'),
        ('student_interested', 'Student Interested'),
        ('job_posted', 'Job Posted'),
        ('profile_incomplete', 'Profile Incomplete'),
        ('subscription_expiring', 'Subscription Expiring'),
    ]
    
    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.type}"
    
    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
