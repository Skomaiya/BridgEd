"""
DRF Serializers for BridgEd API
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    ContactRequest,
    Conversation,
    Employer,
    Job,
    Match,
    Message,
    Notification,
    Resume,
    Student,
    Subscription,
    UserReport,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""

    class Meta:
        model = User
        fields = [
            "user_id",
            "email",
            "role",
            "is_active",
            "profile_image_url",
            "profile_image_storage_path",
            "notification_preferences",
            "created_at",
        ]
        read_only_fields = ["user_id", "created_at"]


class DeleteAccountRequestSerializer(serializers.Serializer):
    """Current account password (required to authorize deletion)."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        allow_blank=False,
        style={"input_type": "password"},
    )


class ContactRequestSerializer(serializers.ModelSerializer):
    """Contact Request serializer"""

    class Meta:
        model = ContactRequest
        fields = [
            "request_id",
            "user",
            "name",
            "email",
            "subject",
            "message",
            "is_resolved",
            "created_at",
        ]
        read_only_fields = ["request_id", "is_resolved", "created_at"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration with password"""

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "password", "password_confirm", "role"]

    def validate_password(self, value):
        """
        Check that the password is at least 8 characters long and contains both
        letters and numbers.
        """
        import re

        if len(value) < 8:
            raise serializers.ValidationError(
                "Password must be at least 8 characters long."
            )

        if not re.search(r"[A-Za-z]", value):
            raise serializers.ValidationError(
                "Password must contain at least one letter."
            )

        if not re.search(r"\d", value):
            raise serializers.ValidationError(
                "Password must contain at least one number."
            )

        return value

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=validated_data["role"],
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


class AdditionalLinkSerializer(serializers.Serializer):
    """Additional link serializer"""

    link_type = serializers.CharField(max_length=100, allow_blank=False)
    url = serializers.URLField(max_length=500)


class StudentSerializer(serializers.ModelSerializer):
    """Student profile serializer. additional_links: list of {link_type, url}."""

    user = UserSerializer(read_only=True)
    university = serializers.CharField(required=True, allow_blank=False)
    course = serializers.CharField(required=True, allow_blank=False)
    expected_graduation_year = serializers.IntegerField(required=True)
    location = serializers.CharField(required=True, allow_blank=False)
    subscription_plan = serializers.CharField(required=False, allow_null=True)
    profile_completion_percentage = serializers.FloatField(
        required=False, allow_null=True
    )
    profile_image_url = serializers.URLField(
        source="user.profile_image_url", read_only=True
    )
    profile_image_storage_path = serializers.CharField(
        source="user.profile_image_storage_path", read_only=True
    )

    class Meta:
        model = Student
        fields = [
            "student_id",
            "user",
            "university",
            "course",
            "expected_graduation_year",
            "location",
            "linkedin_url",
            "additional_links",
            "is_premium_active",
            "profile_completion_percentage",
            "profile_image_url",
            "profile_image_storage_path",
            "display_name",
            "subscription_plan",
            "contract_preferences",
            "auto_accept_matches",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "student_id",
            "created_at",
            "updated_at",
            "is_premium_active",
            "profile_image_storage_path",
            "subscription_plan",
        ]

    def validate_linkedin_url(self, value):
        if not value:
            return None
        url = value.strip()
        if not url:
            return None
        if not url.startswith(("http://", "https://")):
            raise serializers.ValidationError(
                "Please provide the full URL starting with https://"
            )
        return url

    def validate_additional_links(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("additional_links must be a list.")
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(
                    f"additional_links[{i}] must be an object with link_type and url."
                )
            link_type = item.get("link_type")
            url = item.get("url")
            if not link_type or not str(link_type).strip():
                raise serializers.ValidationError(
                    f"additional_links[{i}]: link_type is required (e.g. 'GitHub', 'Website')."
                )
            if not url or not str(url).strip():
                raise serializers.ValidationError(
                    f"additional_links[{i}]: url is required."
                )
            u = str(url).strip()
            if not u.startswith(("http://", "https://")):
                raise serializers.ValidationError(
                    f"additional_links[{i}]: Please provide the full URL starting with https://"
                )
            if len(u) < 12:
                raise serializers.ValidationError(
                    f"additional_links[{i}]: url must be a valid http or https URL."
                )
        return [
            {
                "link_type": str(item.get("link_type", "")).strip(),
                "url": str(item.get("url", "")).strip(),
            }
            for item in value
        ]


class EmployerSerializer(serializers.ModelSerializer):
    """Employer profile serializer"""

    user = UserSerializer(read_only=True)
    profile_image_url = serializers.URLField(
        source="user.profile_image_url", read_only=True
    )
    profile_image_storage_path = serializers.CharField(
        source="user.profile_image_storage_path", read_only=True
    )

    class Meta:
        model = Employer
        fields = [
            "employer_id",
            "user",
            "company_name",
            "industry",
            "company_size",
            "location",
            "contact_number",
            "is_verified",
            "profile_image_url",
            "profile_image_storage_path",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "employer_id",
            "created_at",
            "updated_at",
            "is_verified",
            "profile_image_storage_path",
        ]


class ResumeSerializer(serializers.ModelSerializer):
    """Resume serializer"""

    student = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Resume
        fields = [
            "resume_id",
            "student",
            "file",
            "file_url",
            "parsed_data",
            "parsing_accuracy",
            "uploaded_at",
            "status",
            "parsing_error",
        ]
        read_only_fields = [
            "resume_id",
            "file_url",
            "parsed_data",
            "parsing_accuracy",
            "uploaded_at",
            "status",
            "parsing_error",
        ]


class ResumeUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for PATCH: update only parsed_data and/or parsing_accuracy
    (e.g. after user edits parsing results in the UI).
    """

    parsed_data = serializers.JSONField(required=False)
    parsing_accuracy = serializers.FloatField(
        required=False,
        min_value=0.0,
        max_value=1.0,
        allow_null=True,
    )

    class Meta:
        model = Resume
        fields = ["parsed_data", "parsing_accuracy"]

    def validate_parsed_data(self, value):
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("parsed_data must be a JSON object.")
        return value


class JobSerializer(serializers.ModelSerializer):
    """Job posting serializer"""

    employer = EmployerSerializer(read_only=True)
    employer_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Job
        fields = [
            "job_id",
            "employer",
            "employer_id",
            "title",
            "description",
            "required_skills",
            "nice_to_have_skills",
            "location",
            "contract_type",
            "job_length",
            "is_open",
            "published_at",
            "application_deadline",
            "max_shortlist_size",
            "recruitment_slots",
            "hired_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["job_id", "created_at", "updated_at"]

    def to_representation(self, instance):
        from django.utils import timezone

        ret = super().to_representation(instance)
        if (
            instance.application_deadline
            and instance.application_deadline < timezone.now()
        ):
            ret["is_open"] = False
        return ret

    def validate_published_at(self, value):
        from django.utils import timezone

        if self.instance and self.instance.published_at == value:
            return value
        if value and value < timezone.now():
            raise serializers.ValidationError("Publication date must be a future date.")
        return value

    def validate_application_deadline(self, value):
        from django.utils import timezone

        if self.instance and self.instance.application_deadline == value:
            return value
        if value and value < timezone.now():
            raise serializers.ValidationError(
                "Application deadline must be a future date."
            )
        return value


class JobListSerializer(serializers.ModelSerializer):
    """Simplified job list serializer (public list)."""

    company_name = serializers.CharField(source="employer.company_name", read_only=True)

    class Meta:
        model = Job
        fields = [
            "job_id",
            "title",
            "company_name",
            "location",
            "description",
            "contract_type",
            "job_length",
            "required_skills",
            "recruitment_slots",
            "hired_count",
            "is_open",
            "published_at",
            "application_deadline",
            "created_at",
        ]

    def to_representation(self, instance):
        from django.utils import timezone

        ret = super().to_representation(instance)
        if (
            instance.application_deadline
            and instance.application_deadline < timezone.now()
        ):
            ret["is_open"] = False
        return ret


class MatchSerializer(serializers.ModelSerializer):
    """Match serializer"""

    student = StudentSerializer(read_only=True)
    job = JobSerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            "match_id",
            "student",
            "job",
            "compatibility_score",
            "student_interested",
            "status",
            "matched_at",
        ]
        read_only_fields = ["match_id", "compatibility_score", "matched_at", "status"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if (
            request
            and request.user
            and getattr(request.user, "role", None) == "student"
        ):
            ret.pop("compatibility_score", None)
        return ret


class MatchListSerializer(serializers.ModelSerializer):
    """Simplified match list for dashboards"""

    job_title = serializers.CharField(source="job.title", read_only=True)
    company_name = serializers.CharField(
        source="job.employer.company_name", read_only=True
    )
    job_location = serializers.CharField(source="job.location", read_only=True)

    class Meta:
        model = Match
        fields = [
            "match_id",
            "job_title",
            "company_name",
            "job_location",
            "compatibility_score",
            "student_interested",
            "matched_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if (
            request
            and request.user
            and getattr(request.user, "role", None) == "student"
        ):
            ret.pop("compatibility_score", None)
        return ret


class SubscriptionSerializer(serializers.ModelSerializer):
    """Subscription serializer"""

    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "subscription_id",
            "student",
            "start_date",
            "expiry_date",
            "amount",
            "payment_reference",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["subscription_id", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    """Notification serializer"""

    class Meta:
        model = Notification
        fields = ["notification_id", "user", "type", "message", "is_read", "created_at"]
        read_only_fields = ["notification_id", "created_at"]


class AdminEmployerSerializer(EmployerSerializer):
    """Admin-only employer serializer with full control"""

    class Meta(EmployerSerializer.Meta):
        read_only_fields = [
            f for f in EmployerSerializer.Meta.read_only_fields if f != "is_verified"
        ]


class AdminStudentSerializer(StudentSerializer):
    """Admin-only student serializer with full control"""

    class Meta(StudentSerializer.Meta):
        read_only_fields = [
            f
            for f in StudentSerializer.Meta.read_only_fields
            if f not in ["is_premium_active", "subscription_plan"]
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin-only user serializer for CRUD management"""

    student_profile = AdminStudentSerializer(read_only=True)
    employer_profile = AdminEmployerSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "user_id",
            "email",
            "role",
            "is_active",
            "created_at",
            "profile_image_url",
            "profile_image_storage_path",
            "student_profile",
            "employer_profile",
        ]
        read_only_fields = ["user_id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    """Serializes a single Message in a conversation thread."""

    sender_email = serializers.EmailField(source="sender.email", read_only=True)
    sender_role = serializers.CharField(source="sender.role", read_only=True)

    class Meta:
        model = Message
        fields = [
            "message_id",
            "conversation",
            "sender",
            "sender_email",
            "sender_role",
            "body",
            "is_read",
            "sent_at",
            "edited_at",
            "is_edited",
        ]
        read_only_fields = [
            "message_id",
            "conversation",
            "sender",
            "sender_email",
            "sender_role",
            "is_read",
            "sent_at",
            "edited_at",
            "is_edited",
        ]


class ConversationSerializer(serializers.ModelSerializer):
    """Serializes a Conversation with preview info for the inbox list."""

    other_party_name = serializers.SerializerMethodField()
    other_party_user_id = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    match_id = serializers.SerializerMethodField()

    def get_match_id(self, obj):
        """Kept for API compatibility; conversations are keyed by employer–student pair."""
        return None

    class Meta:
        model = Conversation
        fields = [
            "conversation_id",
            "match_id",
            "other_party_name",
            "other_party_user_id",
            "last_message",
            "unread_count",
            "created_at",
        ]
        read_only_fields = fields

    def _requesting_user(self):
        request = self.context.get("request")
        return request.user if request else None

    def get_other_party_name(self, obj):
        user = self._requesting_user()
        if user and user.role == "employer":
            return obj.student.display_name or obj.student.user.email
        return obj.employer.company_name

    def get_other_party_user_id(self, obj):
        user = self._requesting_user()
        if user and user.role == "employer":
            return obj.student.user.user_id
        return obj.employer.user.user_id

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-sent_at").first()
        if not msg:
            return None
        return MessageSerializer(msg, context=self.context).data

    def get_unread_count(self, obj):
        user = self._requesting_user()
        if not user:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class UserReportSerializer(serializers.ModelSerializer):
    """Serializer for misconduct reports"""

    reporter_email = serializers.EmailField(source="reporter.email", read_only=True)
    reported_user_email = serializers.EmailField(
        source="reported_user.email", read_only=True
    )

    class Meta:
        model = UserReport
        fields = [
            "report_id",
            "reporter",
            "reporter_email",
            "reported_user",
            "reported_user_email",
            "reason",
            "description",
            "is_resolved",
            "created_at",
        ]
        read_only_fields = ["report_id", "reporter", "is_resolved", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user:
            validated_data["reporter"] = request.user
        return super().create(validated_data)


class PlatformStatsSerializer(serializers.Serializer):
    """Serializer for high-level platform statistics used on the landing page."""

    students_joined = serializers.IntegerField()
    employers_joined = serializers.IntegerField()
    active_students = serializers.IntegerField()
    active_employers = serializers.IntegerField()
    total_matches = serializers.IntegerField()


class EmployerMatchStatsSerializer(serializers.Serializer):
    """Serializer for employer-specific match statistics."""

    total_matches = serializers.IntegerField()
    accepted_matches = serializers.IntegerField()
    pending_matches = serializers.IntegerField()
    declined_matches = serializers.IntegerField()
