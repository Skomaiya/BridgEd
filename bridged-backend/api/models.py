"""
BridgEd API Models
Following README.md database schema
"""

import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom user manager"""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with role-based access
    Roles: student, employer, admin
    """

    ROLE_CHOICES = [
        ("student", "Student"),
        ("employer", "Employer"),
        ("admin", "Admin"),
    ]

    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    profile_image_url = models.URLField(max_length=500, blank=True, null=True)
    profile_image_storage_path = models.CharField(max_length=500, blank=True, null=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["role"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"


class Student(models.Model):
    """Student profile linked to User"""

    student_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="student_profile"
    )
    display_name = models.CharField(max_length=255, blank=True)
    university = models.CharField(max_length=255, blank=True)
    course = models.CharField(max_length=255, blank=True)
    expected_graduation_year = models.IntegerField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    linkedin_url = models.URLField(max_length=500, blank=True, null=True)
    additional_links = models.JSONField(default=list, blank=True)
    SUBSCRIPTION_CHOICES = [
        ("free", "Free"),
        ("basic", "Basic"),
        ("premium", "Premium"),
    ]

    is_premium_active = models.BooleanField(default=False)
    subscription_plan = models.CharField(
        max_length=20, choices=SUBSCRIPTION_CHOICES, default="free"
    )
    profile_completion_percentage = models.FloatField(
        default=0.0, validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    contract_preferences = models.JSONField(default=list, blank=True)
    auto_accept_matches = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.university or 'No University'}"

    class Meta:
        db_table = "students"
        verbose_name = "Student"
        verbose_name_plural = "Students"


class Employer(models.Model):
    """Employer profile linked to User"""

    employer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="employer_profile"
    )
    company_name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255, blank=True)
    company_size = models.CharField(
        max_length=50,
        blank=True,
    )
    location = models.CharField(
        max_length=255,
        blank=True,
    )
    office_address = models.TextField(
        blank=True,
    )
    contact_number = models.CharField(max_length=20, blank=True)
    website = models.URLField(max_length=500, blank=True, null=True)
    bio = models.TextField(
        blank=True,
    )
    registration_number = models.CharField(
        max_length=100,
        blank=True,
    )
    year_established = models.IntegerField(
        null=True,
        blank=True,
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name} ({self.user.email})"

    class Meta:
        db_table = "employers"
        verbose_name = "Employer"
        verbose_name_plural = "Employers"


class Resume(models.Model):
    """Resume with parsed data (JSON)"""

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    resume_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, related_name="resume"
    )
    file = models.FileField(
        upload_to="resumes/%Y/%m/", max_length=500, null=True, blank=True
    )
    file_url = models.URLField(max_length=500, blank=True, null=True)
    file_storage_path = models.CharField(max_length=500, blank=True, null=True)
    parsed_data = models.JSONField(
        default=dict,
        help_text=(
            "Structured CV data from LLM parser. Shape: "
            "name (str), email (str), phone (str); "
            "technical_skills, soft_skills, languages (list of str); "
            "education (list of {degree, field, institution, location, start_date, end_date}); "
            "experience (list of {title, company, location, start_date, end_date, responsibilities}); "
            "certifications (list of {name, issuer}); "
            "projects (list of {name, description, start_date, end_date}); "
            "confidence (float 0-1). Matching uses technical_skills + soft_skills."
        ),
    )
    parsing_accuracy = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    parsing_error = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Resume for {self.student.user.email}"

    def delete(self, *args, **kwargs):
        """Delete the file from storage when the Resume is deleted (e.g. on re-upload)."""
        if self.file_storage_path:
            try:
                from services.supabase_storage import delete_resume_file

                delete_resume_file(self.file_storage_path)
            except Exception:
                pass
        if self.file:
            try:
                self.file.delete(save=False)
            except Exception:
                pass
        super().delete(*args, **kwargs)

    class Meta:
        db_table = "resumes"
        verbose_name = "Resume"
        verbose_name_plural = "Resumes"


class JobManager(models.Manager):
    """Jobs that are open and within their application window (published, not past deadline)."""

    def open_for_applications(self):
        now = timezone.now()
        return (
            self.filter(is_open=True)
            .filter(Q(published_at__isnull=True) | Q(published_at__lte=now))
            .filter(
                Q(application_deadline__isnull=True) | Q(application_deadline__gte=now)
            )
        )


class Job(models.Model):
    """Job/Internship postings by employers."""

    objects = JobManager()
    job_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employer = models.ForeignKey(
        Employer, on_delete=models.CASCADE, related_name="jobs"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    required_skills = models.JSONField(default=list)
    nice_to_have_skills = models.JSONField(default=list)
    CONTRACT_TYPE_CHOICES = [
        ("full-time", "Full-time"),
        ("part-time", "Part-time"),
        ("contract", "Contract"),
        ("internship", "Internship"),
        ("freelance", "Freelance"),
    ]
    contract_type = models.CharField(
        max_length=50, choices=CONTRACT_TYPE_CHOICES, default="internship"
    )
    job_length = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255)
    is_open = models.BooleanField(default=True)
    published_at = models.DateTimeField(null=True, blank=True)
    application_deadline = models.DateTimeField(null=True, blank=True)
    max_shortlist_size = models.PositiveIntegerField(null=True, blank=True)
    recruitment_slots = models.PositiveIntegerField(default=1)
    hired_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def check_expiry(self):
        """Update is_open in DB if deadline has passed."""
        from django.utils import timezone

        if (
            self.is_open
            and self.application_deadline
            and self.application_deadline < timezone.now()
        ):
            self.is_open = False
            self.save(update_fields=["is_open", "updated_at"])
            return True
        return False

    def __str__(self):
        return f"{self.title} at {self.employer.company_name}"

    class Meta:
        db_table = "jobs"
        verbose_name = "Job"
        verbose_name_plural = "Jobs"
        ordering = ["-created_at"]


class Match(models.Model):
    """Job-Student matches with compatibility scores"""

    match_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="matches"
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="matches")
    compatibility_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    student_interested = models.BooleanField(default=False)
    student_declined = models.BooleanField(default=False)
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("employed", "Employed"),
        ("dismissed", "Dismissed"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    matched_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.user.email} - {self.job.title} ({self.compatibility_score}%)"

    class Meta:
        db_table = "matches"
        verbose_name = "Match"
        verbose_name_plural = "Matches"
        ordering = ["-compatibility_score", "-matched_at"]
        indexes = [
            models.Index(fields=["-compatibility_score"]),
            models.Index(fields=["student_interested"]),
        ]
        unique_together = ("student", "job")


class Subscription(models.Model):
    """Student subscriptions for premium features"""

    subscription_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="subscriptions"
    )
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
        db_table = "subscriptions"
        verbose_name = "Subscription"
        verbose_name_plural = "Subscriptions"
        ordering = ["-created_at"]


class Notification(models.Model):
    """User notifications"""

    NOTIFICATION_TYPES = [
        ("new match", "New Match"),
        ("new message", "New Message"),
        ("student interested", "Student Interested"),
        ("interest confirmed", "Interest Confirmed"),
        ("match declined", "Match Declined"),
        ("job posted", "Job Posted"),
        ("job published", "Job Published"),
        ("user registered", "User Registered"),
        ("user suspended", "User Suspended"),
        ("profile incomplete", "Profile Incomplete"),
        ("subscription expiring", "Subscription Expiring"),
        ("profile update", "Profile Updated"),
        ("cv parsed", "CV Parsed"),
    ]

    notification_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.type}"

    class Meta:
        db_table = "notifications"
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-created_at"]


class ContactRequest(models.Model):
    """Contact form submissions for support/inquiries"""

    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contact_requests",
    )
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"Contact from {self.name} ({self.email}) - {self.subject or 'No Subject'}"
        )

    class Meta:
        db_table = "contact_requests"
        verbose_name = "Contact Request"
        verbose_name_plural = "Contact Requests"
        ordering = ["-created_at"]


class Conversation(models.Model):
    """A direct-message thread between an employer and a student (one thread per pair)."""

    conversation_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    employer = models.ForeignKey(
        Employer, on_delete=models.CASCADE, related_name="conversations"
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="conversations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation: {self.employer.company_name} ↔ {self.student.user.email}"

    class Meta:
        db_table = "conversations"
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["employer", "student"],
                name="uniq_conversation_employer_student",
            )
        ]


class Message(models.Model):
    """An individual message within a Conversation."""

    message_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_messages"
    )
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_edited(self):
        return self.edited_at is not None

    def __str__(self):
        return f"Message from {self.sender.email} at {self.sent_at:%Y-%m-%d %H:%M}"

    class Meta:
        db_table = "messages"
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ["sent_at"]


class UserReport(models.Model):
    """Safety feature: Report misconduct"""

    REPORT_REASON_CHOICES = [
        ("harassment", "Harassment"),
        ("spam", "Spam"),
        ("inappropriate_content", "Inappropriate Content"),
        ("scam", "Scam/Fraud"),
        ("other", "Other"),
    ]

    report_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reports_filed"
    )
    reported_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reports_received"
    )
    reason = models.CharField(max_length=50, choices=REPORT_REASON_CHOICES)
    description = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report by {self.reporter.email} on {self.reported_user.email} - {self.reason}"

    class Meta:
        db_table = "user_reports"
        verbose_name = "User Report"
        verbose_name_plural = "User Reports"
        ordering = ["-created_at"]
