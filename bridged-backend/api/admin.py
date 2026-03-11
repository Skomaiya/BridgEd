"""
Django Admin Configuration
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    ContactRequest,
    Employer,
    Job,
    Match,
    Notification,
    Resume,
    Student,
    Subscription,
    User,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom user admin"""

    list_display = ["email", "role", "is_active", "is_staff", "created_at"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["email"]
    ordering = ["-created_at"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("role",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Important dates", {"fields": ("last_login", "created_at")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "role"),
            },
        ),
    )

    readonly_fields = ["created_at", "last_login"]


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """Student admin"""

    list_display = [
        "user",
        "university",
        "course",
        "is_premium_active",
        "profile_completion_percentage",
    ]
    list_filter = ["is_premium_active", "university"]
    search_fields = ["user__email", "university", "course"]
    readonly_fields = ["student_id", "created_at", "updated_at"]


@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    """Employer admin"""

    list_display = [
        "company_name",
        "user",
        "industry",
        "location",
        "is_verified",
        "created_at",
    ]
    list_filter = ["is_verified", "industry"]
    search_fields = [
        "company_name",
        "user__email",
        "office_address",
        "registration_number",
    ]
    readonly_fields = ["employer_id", "created_at", "updated_at"]
    actions = ["verify_companies"]

    def verify_companies(self, request, queryset):
        queryset.update(is_verified=True)

    verify_companies.short_description = "Verify selected companies"


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    """Resume admin"""

    list_display = ["student", "parsing_accuracy", "uploaded_at"]
    search_fields = ["student__user__email"]
    readonly_fields = ["resume_id", "uploaded_at"]


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    """Job admin"""

    list_display = [
        "title",
        "employer",
        "location",
        "is_open",
        "published_at",
        "application_deadline",
        "max_shortlist_size",
        "created_at",
    ]
    list_filter = ["is_open", "created_at"]
    search_fields = ["title", "employer__company_name"]
    readonly_fields = ["job_id", "created_at", "updated_at"]


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    """Match admin"""

    list_display = [
        "student",
        "job",
        "compatibility_score",
        "student_interested",
        "matched_at",
    ]
    list_filter = ["student_interested", "matched_at"]
    search_fields = ["student__user__email", "job__title"]
    readonly_fields = ["match_id", "matched_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    """Subscription admin"""

    list_display = ["student", "start_date", "expiry_date", "amount", "is_active"]
    list_filter = ["start_date", "expiry_date"]
    search_fields = ["student__user__email", "payment_reference"]
    readonly_fields = ["subscription_id", "created_at"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Notification admin"""

    list_display = ["user", "type", "is_read", "created_at"]
    list_filter = ["type", "is_read", "created_at"]
    search_fields = ["user__email", "message"]
    readonly_fields = ["notification_id", "created_at"]


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    """Contact Request admin"""

    list_display = ["name", "email", "subject", "is_resolved", "created_at"]
    list_filter = ["is_resolved", "created_at"]
    search_fields = ["name", "email", "subject", "message"]
    readonly_fields = ["request_id", "created_at"]
    actions = ["mark_as_resolved"]

    def mark_as_resolved(self, request, queryset):
        queryset.update(is_resolved=True)

    mark_as_resolved.short_description = "Mark selected requests as resolved"
