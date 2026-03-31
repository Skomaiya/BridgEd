"""
API Views for BridgEd Platform
Includes authentication, CRUD operations, and custom endpoints
"""

import logging
import os
import tempfile
import threading
import time

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

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
    UserReport,
)
from .permissions import (
    IsAdmin,
    IsEmployer,
    IsJobOwner,
    IsOwnProfile,
    IsStudent,
)
from .serializers import (
    AdminUserSerializer,
    AuthResponseSerializer,
    EmployerMatchStatsSerializer,
    ContactRequestSerializer,
    ConversationSerializer,
    EmployerSerializer,
    FileUploadSerializer,
    JobListSerializer,
    JobSerializer,
    LoginSerializer,
    LogoutSerializer,
    MatchListSerializer,
    MatchSerializer,
    MessageSerializer,
    NotificationSerializer,
    ResumeSerializer,
    ResumeUpdateSerializer,
    StudentSerializer,
    SubscriptionSerializer,
    UserRegistrationSerializer,
    UserReportSerializer,
    UserSerializer,
    PlatformStatsSerializer,
    DeleteAccountRequestSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """User registration endpoint"""

    permission_classes = [AllowAny]

    @extend_schema(
        request=UserRegistrationSerializer,
        responses={
            201: AuthResponseSerializer,
            400: OpenApiResponse(description="Validation errors"),
        },
        description="Register a new user account (student or employer)",
        tags=["Authentication"],
    )
    @transaction.atomic
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            if user.role == "student":
                Student.objects.create(user=user)
            elif user.role == "employer":
                company_name = request.data.get("company_name", "Company Name Required")
                Employer.objects.create(user=user, company_name=company_name)

            refresh = RefreshToken.for_user(user)

            admin_users = User.objects.filter(role="admin")
            for admin in admin_users:
                Notification.objects.create(
                    user=admin,
                    type="user registered",
                    message=f"New {user.role} registered: {user.email}",
                )

            return Response(
                {
                    "user": UserSerializer(user).data,
                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ContactRequestView(APIView):
    """Contact form submission endpoint."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=ContactRequestSerializer,
        responses={
            201: ContactRequestSerializer,
            400: OpenApiResponse(description="Validation errors"),
        },
        description="Submit a contact form request which is saved to the database.",
        tags=["Support"],
    )
    def post(self, request):
        data = request.data.copy()

        if request.user.is_authenticated:
            data["user"] = request.user.user_id
            data["email"] = request.user.email
            if not data.get("name"):
                if hasattr(request.user, "student_profile"):
                    data["name"] = request.user.student_profile.display_name
                elif hasattr(request.user, "employer_profile"):
                    data["name"] = request.user.employer_profile.company_name

        serializer = ContactRequestSerializer(data=data)
        if serializer.is_valid():
            contact_request = serializer.save()

            admin_users = User.objects.filter(role="admin")
            for admin in admin_users:
                Notification.objects.create(
                    user=admin,
                    type="user registered",
                    message=f"New support query from {contact_request.name}: '{contact_request.subject or 'No Subject'}'",
                )

            return Response(
                {
                    "message": "Your enquiry has been received and is being processed.",
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """User login endpoint"""

    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(description="Missing credentials"),
            401: OpenApiResponse(description="Invalid credentials"),
            403: OpenApiResponse(description="Account inactive"),
        },
        description="Authenticate user and receive JWT tokens",
        tags=["Authentication"],
    )
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and password required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(email=email, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {
                    "error": "Your account has been suspended. Please contact support for assistance."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            }
        )


class PlatformStatsView(APIView):
    """Public platform statistics for the marketing landing page."""

    permission_classes = [AllowAny]

    @extend_schema(
        responses={200: PlatformStatsSerializer},
        description=(
            "High-level platform statistics including counts of students, employers, "
            "active accounts, and total matches. Intended for public landing page display."
        ),
        tags=["Public"],
    )
    def get(self, request):
        students_joined = Student.objects.count()
        employers_joined = Employer.objects.count()
        active_students = User.objects.filter(role="student", is_active=True).count()
        active_employers = User.objects.filter(role="employer", is_active=True).count()
        total_matches = Match.objects.count()

        serializer = PlatformStatsSerializer(
            {
                "students_joined": students_joined,
                "employers_joined": employers_joined,
                "active_students": active_students,
                "active_employers": active_employers,
                "total_matches": total_matches,
            }
        )
        return Response(serializer.data)


class LogoutView(APIView):
    """User logout endpoint"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=LogoutSerializer,
        responses={
            200: OpenApiResponse(description="Logout successful"),
            400: OpenApiResponse(description="Invalid token"),
        },
        description="Logout user by blacklisting refresh token",
        tags=["Authentication"],
    )
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logout successful"})
        except Exception:
            return Response(
                {"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST
            )


class StudentProfileView(generics.RetrieveUpdateAPIView):
    """Student profile management"""

    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_object(self):
        return self.request.user.student_profile


class EmployerProfileView(generics.RetrieveUpdateAPIView):
    """Employer profile management"""

    serializer_class = EmployerSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_object(self):
        return self.request.user.employer_profile


def _handle_photo_upload(user, request, role_folder):
    """Shared helper to handle profile photo upload and User model update."""
    from services.supabase_storage import (
        delete_profile_image,
        is_supabase_configured,
        upload_profile_image,
    )

    file = request.FILES.get("file")
    if not file:
        ct = request.content_type if hasattr(request, "content_type") else "unknown"
        return Response(
            {"error": f"No file provided (Content-Type: {ct})"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = ("image/jpeg", "image/png", "image/webp", "image/gif")
    if file.content_type not in allowed:
        return Response(
            {"error": "Invalid file type. Use JPEG, PNG, WebP or GIF."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if file.size > 2 * 1024 * 1024:
        return Response(
            {"error": "File too large. Max 2MB."}, status=status.HTTP_400_BAD_REQUEST
        )

    if not is_supabase_configured():
        return Response(
            {"error": "Profile photos are not configured (Supabase)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    ext = os.path.splitext(getattr(file, "name", "") or "")[1].lower() or ".jpg"
    user_id = str(user.user_id)
    timestamp = int(time.time())
    object_path = f"{role_folder}/{user_id}/avatar_{timestamp}{ext}"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        for chunk in file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        public_url, storage_path = upload_profile_image(
            tmp_path, object_path, content_type=file.content_type
        )
        if not public_url or not storage_path:
            return Response(
                {"error": "Upload failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        old_path = user.profile_image_storage_path
        if old_path:
            try:
                delete_profile_image(old_path)
            except Exception:
                pass

        user.profile_image_url = public_url
        user.profile_image_storage_path = storage_path
        user.save(update_fields=["profile_image_url", "profile_image_storage_path"])

        return Response({"profile_image_url": public_url}, status=status.HTTP_200_OK)
    finally:
        if os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


class StudentProfilePhotoView(APIView):
    """Upload student profile photo to Supabase."""

    permission_classes = [IsAuthenticated, IsStudent]

    def delete(self, request):
        if request.user.profile_image_storage_path:
            from services.supabase_storage import delete_profile_image

            delete_profile_image(request.user.profile_image_storage_path)
            request.user.profile_image_url = None
            request.user.profile_image_storage_path = None
            request.user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request):
        return _handle_photo_upload(request.user, request, "students")


class EmployerProfilePhotoView(APIView):
    """Upload employer profile photo to Supabase."""

    permission_classes = [IsAuthenticated, IsEmployer]

    def delete(self, request):
        if request.user.profile_image_storage_path:
            from services.supabase_storage import delete_profile_image

            delete_profile_image(request.user.profile_image_storage_path)
            request.user.profile_image_url = None
            request.user.profile_image_storage_path = None
            request.user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request):
        return _handle_photo_upload(request.user, request, "employers")


class UserProfilePhotoView(APIView):
    """Generic user profile photo upload for Admins."""

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        if request.user.profile_image_storage_path:
            from services.supabase_storage import delete_profile_image

            delete_profile_image(request.user.profile_image_storage_path)
            request.user.profile_image_url = None
            request.user.profile_image_storage_path = None
            request.user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request):
        role_folder = f"{request.user.role}s"
        return _handle_photo_upload(request.user, request, role_folder)


def _auto_run_matching(student):
    """Run the matching engine for a single student against all open jobs."""
    from services.matching_engine import MatchingEngine

    try:
        resume = student.resume
        if not resume or resume.status != Resume.STATUS_COMPLETED:
            return

        parsed_data = resume.parsed_data or {}
        jobs = Job.objects.open_for_applications()
        engine = MatchingEngine()
        STORE_THRESHOLD = 70
        SHOW_THRESHOLD = 85
        total_stored = 0
        visible_count = 0

        for job in jobs:
            match_result = engine.calculate_match_for_student(
                student, job, parsed_data=parsed_data
            )
            score = match_result["score"]
            if score >= STORE_THRESHOLD:
                Match.objects.update_or_create(
                    student=student,
                    job=job,
                    defaults={"compatibility_score": score},
                )
                total_stored += 1
                if score >= SHOW_THRESHOLD:
                    visible_count += 1

        if visible_count > 0:
            Notification.objects.create(
                user=student.user,
                type="new match",
                message=(
                    f"You have {visible_count} job match{'es' if visible_count != 1 else ''} "
                    "based on your CV. Head to Matches to review them."
                ),
            )
        elif total_stored > 0:
            Notification.objects.create(
                user=student.user,
                type="new match",
                message=(
                    f"{total_stored} potential job match{'es were' if total_stored != 1 else ' was'} found "
                    "based on your CV. Head to Matches to review them."
                ),
            )
    except Exception:
        pass


def _run_parsing_in_background(
    resume_id,
    file_path,
    original_filename=None,
    content_type=None,
    use_supabase=False,
):
    """Run parsing then optionally upload original file to Supabase."""
    from services.resume_pipeline import PipelineExecutionError, ResumeParsingPipeline
    from services.supabase_storage import is_supabase_configured, upload_resume_file

    try:
        pipeline = ResumeParsingPipeline()
        parsed_data = pipeline.run(file_path)

        file_url = None
        file_storage_path = None
        if use_supabase and is_supabase_configured() and original_filename:
            safe_name = os.path.basename(original_filename) or "document.pdf"
            object_path = f"resumes/{resume_id}/{safe_name}"
            file_url, file_storage_path = upload_resume_file(
                file_path, object_path, content_type=content_type
            )

        raw_confidence = parsed_data.get("confidence")
        if raw_confidence is not None:
            try:
                val = float(raw_confidence)
                parsing_accuracy = val if 0 <= val <= 1 else val / 100.0
                parsing_accuracy = max(0.0, min(1.0, parsing_accuracy))
            except (TypeError, ValueError):
                parsing_accuracy = None
        else:
            parsing_accuracy = None
        update_kw = {
            "parsed_data": parsed_data,
            "parsing_accuracy": parsing_accuracy,
            "status": Resume.STATUS_COMPLETED,
            "parsing_error": None,
        }
        if file_url is not None:
            update_kw["file_url"] = file_url
        if file_storage_path is not None:
            update_kw["file_storage_path"] = file_storage_path

        Resume.objects.filter(resume_id=resume_id).update(**update_kw)

        try:
            resume_obj = Resume.objects.select_related("student__user").get(
                resume_id=resume_id
            )
            _auto_run_matching(resume_obj.student)
        except Exception:
            pass

        try:
            resume_obj = Resume.objects.select_related("student__user").get(
                resume_id=resume_id
            )
            Notification.objects.create(
                user=resume_obj.student.user,
                type="cv parsed",
                message=(
                    "Your CV has been processed and your information has been saved. "
                    "Head to Matches to see your job matches."
                ),
            )
        except Exception:
            pass
    except Exception as e:
        error_msg = str(e)
        if isinstance(e, PipelineExecutionError):
            error_msg = f"{e.stage}: {e.original_error}"
        Resume.objects.filter(resume_id=resume_id).update(
            status=Resume.STATUS_FAILED,
            parsing_error=error_msg,
        )
    finally:
        if use_supabase and file_path and os.path.isfile(file_path):
            try:
                os.unlink(file_path)
            except OSError:
                pass


class ResumeUploadView(APIView):
    """Resume upload and async parsing."""

    permission_classes = [IsAuthenticated, IsStudent]
    ALLOWED_EXTENSIONS = (".pdf", ".doc", ".docx", ".txt")

    @extend_schema(
        request=FileUploadSerializer,
        responses={
            201: ResumeSerializer,
            400: OpenApiResponse(description="No file provided"),
            500: OpenApiResponse(description="Upload error"),
        },
        description="Upload a student resume; parsing runs in background. Poll GET /resumes/<id> for status.",
        tags=["Resumes"],
    )
    @transaction.atomic
    def post(self, request):
        file = request.FILES.get("file")

        if not file:
            return Response(
                {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(file.name)[1].lower() if file.name else ""
        if ext not in ResumeUploadView.ALLOWED_EXTENSIONS:
            return Response(
                {
                    "error": "Invalid file type. Only PDF, DOC, DOCX, or TXT are allowed."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from services.supabase_storage import is_supabase_configured

            student = request.user.student_profile

            if hasattr(student, "resume"):
                student.resume.delete()

            use_supabase = is_supabase_configured()

            if use_supabase:
                suffix = os.path.splitext(file.name)[1] or ".pdf"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    for chunk in file.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                resume = Resume.objects.create(
                    student=student,
                    file=None,
                    status=Resume.STATUS_PROCESSING,
                )
                resume_id = resume.resume_id
                thread = threading.Thread(
                    target=_run_parsing_in_background,
                    args=(resume_id, tmp_path),
                    kwargs={
                        "original_filename": file.name,
                        "content_type": file.content_type or "application/octet-stream",
                        "use_supabase": True,
                    },
                    daemon=True,
                )
            else:
                resume = Resume.objects.create(
                    student=student,
                    file=file,
                    status=Resume.STATUS_PROCESSING,
                )
                file_path = resume.file.path
                resume_id = resume.resume_id
                thread = threading.Thread(
                    target=_run_parsing_in_background,
                    args=(resume_id, file_path),
                    kwargs={"use_supabase": False},
                    daemon=True,
                )
            thread.start()

            return Response(
                ResumeSerializer(resume).data, status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResumeDetailView(generics.RetrieveUpdateAPIView):
    """Get or update resume (parsed_data only)."""

    permission_classes = [IsAuthenticated, IsOwnProfile]
    queryset = Resume.objects.all()
    lookup_field = "resume_id"

    def get_serializer_class(self):
        if self.request.method == "PATCH" or self.request.method == "PUT":
            return ResumeUpdateSerializer
        return ResumeSerializer

    def put(self, request, *args, **kwargs):
        """Treat PUT as partial update so only parsed_data/parsing_accuracy need to be sent."""
        return self.partial_update(request, *args, **kwargs)


def _recompute_matches_for_job(job):
    """Re-evaluate all existing matches for a job when it is updated."""
    from services.matching_engine import MatchingEngine

    from .models import Match, Notification, Resume, Student

    try:
        engine = MatchingEngine()
        students = Student.objects.select_related("user").all()
        SHOW_THRESHOLD = 85
        STORE_THRESHOLD = 70

        for student in students:
            old_match = Match.objects.filter(job=job, student=student).first()
            old_score = old_match.compatibility_score if old_match else 0

            try:
                r = Resume.objects.get(student=student)
                pd = r.parsed_data or {}
            except Resume.DoesNotExist:
                pd = {}

            res = engine.calculate_match_for_student(student, job, parsed_data=pd)
            new_score = res["score"]

            if new_score >= STORE_THRESHOLD:
                Match.objects.update_or_create(
                    student=student,
                    job=job,
                    defaults={"compatibility_score": new_score},
                )

                if old_score < SHOW_THRESHOLD and new_score >= SHOW_THRESHOLD:
                    Notification.objects.create(
                        user=student.user,
                        type="new match",
                        message=(
                            f"New match: Job '{job.title}' by {job.employer.company_name} "
                            "you now meets the strong match threshold after an update."
                        ),
                    )
            elif old_match:
                if old_score >= STORE_THRESHOLD:
                    Notification.objects.create(
                        user=student.user,
                        type="match declined",
                        message=(
                            f"Match removal: Job '{job.title}' has been updated by the employer "
                            "and you no longer meets the minimum match threshold."
                        ),
                    )
                old_match.delete()

    except Exception as e:
        logger.error(f"Error recomputing matches for job {job.job_id}: {e}")


class JobViewSet(viewsets.ModelViewSet):
    """Job CRUD operations."""

    lookup_field = "job_id"
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "description", "contract_type", "employer__company_name"]

    def get_queryset(self):
        queryset = Job.objects.all()
        if self.request.user.role == "admin":
            queryset = queryset.order_by("-created_at")
        elif self.action == "list":
            queryset = Job.objects.open_for_applications()

        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset

    def get_serializer_class(self):
        if self.action == "list" or self.request.user.role == "admin":
            return JobListSerializer
        return JobSerializer

    def get_permissions(self):
        """
        Permissions for Job CRUD:
        - List/Retrieve: Authenticated students/employers/admins
        - Create: Employers
        - Update/Delete: Job Owner or Admin
        """
        if self.action == "create":
            return [IsAuthenticated(), IsEmployer()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), (IsJobOwner | IsAdmin)()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        """Re-calculate matches if job details changed."""
        published_at = serializer.validated_data.get("published_at")
        if "published_at" in serializer.validated_data and published_at is None:
            serializer.validated_data["published_at"] = timezone.now()

        job = serializer.save()
        thread = threading.Thread(target=_recompute_matches_for_job, args=(job,))
        thread.daemon = True
        thread.start()

    def perform_create(self, serializer):
        """Auto-assign employer when creating job; notify them when the listing goes live."""
        from django.utils import timezone as tz

        employer = self.request.user.employer_profile
        job = serializer.save(employer=employer)

        published_at = job.published_at or tz.now()
        if not job.published_at:
            job.published_at = published_at
            job.save()

        is_live = job.is_open and (published_at <= tz.now())

        admin_users = User.objects.filter(role="admin")
        for admin in admin_users:
            Notification.objects.create(
                user=admin,
                type="job posted",
                message=f"New job posted by {employer.company_name}: '{job.title}'",
            )

        if is_live:
            Notification.objects.create(
                user=self.request.user,
                type="job published",
                message=(
                    f"Your job listing \u2018{job.title}\u2019 is now live and accepting applications. "
                    "You can view and manage it from My Jobs."
                ),
            )

    @action(
        detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsEmployer]
    )
    def my_jobs(self, request):
        """Jobs for the current employer.

        Query params:
        - ``search`` — SearchFilter (title, description, etc.)
        - ``listing_status`` — optional ``active`` or ``expired``. If omitted, all jobs
          (newest first), including closed and past-deadline.

        Paginated responses include ``active_count`` and ``expired_count`` (totals for
        this employer, before ``search`` / ``listing_status`` filters).
        """
        now = timezone.now()
        active_q = Q(is_open=True) & (
            Q(application_deadline__isnull=True) | Q(application_deadline__gte=now)
        )
        expired_q = Q(is_open=False) | (
            Q(application_deadline__isnull=False) & Q(application_deadline__lt=now)
        )

        base_qs = Job.objects.filter(employer__user=request.user)
        active_count = base_qs.filter(active_q).count()
        expired_count = base_qs.filter(expired_q).count()

        queryset = base_qs.order_by("-created_at")
        listing_status = request.query_params.get("listing_status")
        if listing_status == "active":
            queryset = queryset.filter(active_q)
        elif listing_status == "expired":
            queryset = queryset.filter(expired_q)

        jobs = self.filter_queryset(queryset)

        page = self.paginate_queryset(jobs)
        if page is not None:
            serializer = JobListSerializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["active_count"] = active_count
            response.data["expired_count"] = expired_count
            return response

        serializer = JobListSerializer(jobs, many=True)
        return Response(
            {
                "results": serializer.data,
                "active_count": active_count,
                "expired_count": expired_count,
            }
        )

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticated, IsEmployer],
        url_path="shortlist",
    )
    def shortlist(self, request, job_id=None):
        """Pre-qualified student shortlist for a job (employer only)."""
        job = self.get_object()
        if job.employer.user != request.user:
            return Response({"error": "Not your job"}, status=status.HTTP_403_FORBIDDEN)

        cap = job.max_shortlist_size
        thresholds = [85, 80, 75, 70]

        selected_ids = []
        for threshold in thresholds:
            if cap is not None and len(selected_ids) >= cap:
                break
            remaining_needed = (cap - len(selected_ids)) if cap is not None else None
            qs = (
                Match.objects.filter(
                    job=job,
                    compatibility_score__gte=threshold,
                    status__isnull=True,
                    student_declined=False,
                )
                .exclude(match_id__in=selected_ids)
                .order_by("-compatibility_score")
            )
            if remaining_needed is not None:
                qs = qs[:remaining_needed]
            selected_ids.extend([m.match_id for m in qs])

        matches = (
            Match.objects.filter(match_id__in=selected_ids)
            .select_related("student", "student__user")
            .order_by("-compatibility_score")
        )

        page = self.paginate_queryset(matches)
        if page is not None:
            serializer = MatchSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = MatchSerializer(matches, many=True)
        return Response(serializer.data)


class MatchView(APIView):
    """Get matches for student"""

    permission_classes = [IsAuthenticated, IsStudent]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(
                description="List of job matches with compatibility scores",
                response={
                    "type": "object",
                    "properties": {
                        "student_id": {"type": "string", "format": "uuid"},
                        "total_matches": {"type": "integer"},
                        "matches": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "match_id": {"type": "string", "format": "uuid"},
                                    "job_id": {"type": "string", "format": "uuid"},
                                    "job_title": {"type": "string"},
                                    "company": {"type": "string"},
                                    "location": {"type": "string"},
                                    "compatibility_score": {"type": "number"},
                                    "matched_skills": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "missing_skills": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                },
                            },
                        },
                    },
                },
            ),
            400: OpenApiResponse(description="Resume required"),
            500: OpenApiResponse(description="Matching error"),
        },
        description="Calculate job matches for authenticated student based on their resume",
        tags=["Matching"],
    )
    def post(self, request):
        try:
            student = request.user.student_profile

            if not hasattr(student, "resume"):
                return Response(
                    {"error": "Please upload a resume first"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            resume = student.resume
            from services.matching_engine import (
                DEFAULT_MATCHING_LLM_MIN_BASE_SCORE,
                MatchingEngine,
                _env_bool,
                _env_float,
                _match_response_from_job,
            )

            parsed_data = resume.parsed_data or {}
            jobs = Job.objects.open_for_applications()
            engine = MatchingEngine()

            STORE_THRESHOLD = 70
            SHOW_THRESHOLD = 85

            contextual_matcher_stats = {
                "contextual_llm_enabled": _env_bool(
                    "MATCHING_CONTEXT_LLM_ENABLED", True
                ),
                "min_base_score_for_llm": _env_float(
                    "MATCHING_LLM_MIN_BASE_SCORE", DEFAULT_MATCHING_LLM_MIN_BASE_SCORE
                ),
                "jobs_evaluated": len(jobs),
                "outcomes": {
                    "applied": 0,
                    "skipped_low_base": 0,
                    "skipped_disabled": 0,
                    "unavailable": 0,
                },
            }

            matches_data = []
            any_new_strong = False
            any_new_moderate = False

            for job in jobs:
                match_result = engine.calculate_match_for_student(
                    student, job, parsed_data=parsed_data
                )
                ml = match_result.get("matcher_llm")
                if ml and ml.get("outcome") in contextual_matcher_stats["outcomes"]:
                    contextual_matcher_stats["outcomes"][ml["outcome"]] += 1
                score = match_result["score"]

                if score < STORE_THRESHOLD:
                    continue

                match, created = Match.objects.update_or_create(
                    student=student,
                    job=job,
                    defaults={"compatibility_score": score},
                )

                deadline = job.application_deadline
                if deadline is not None:
                    deadline_date = (
                        deadline.date()
                        if hasattr(deadline, "date") and callable(deadline.date)
                        else deadline
                    )
                    deadline_passed = deadline_date < timezone.now().date()
                else:
                    deadline_passed = False
                cap = job.max_shortlist_size
                if cap is not None:
                    accepted_count = (
                        Match.objects.filter(
                            job=job,
                            student_interested=True,
                            student_declined=False,
                        )
                        .exclude(match_id=match.match_id)
                        .count()
                    )
                    shortlist_full = accepted_count >= cap
                else:
                    shortlist_full = False
                can_accept = not deadline_passed and not shortlist_full

                if (
                    score >= SHOW_THRESHOLD
                    and getattr(student, "auto_accept_matches", False)
                    and can_accept
                ):
                    if not match.student_interested and not match.student_declined:
                        match.student_interested = True
                        match.student_declined = False
                        match.save(
                            update_fields=["student_interested", "student_declined"]
                        )

                        student_display = (
                            getattr(match.student, "display_name", None)
                            or match.student.user.email
                        )
                        Notification.objects.create(
                            user=match.job.employer.user,
                            type="student interested",
                            message=(
                                f"{student_display} has automatically accepted this match "
                                f"for your position '{job.title}' Visit Matches to view their profile."
                            ),
                        )
                        Notification.objects.create(
                            user=request.user,
                            type="interest confirmed",
                            message=(
                                f"We've automatically accepted your match with '{job.title}' at "
                                f"{job.employer.company_name} based on your settings. "
                                "The employer has been notified and can now view your profile."
                            ),
                        )

                if created:
                    if score >= SHOW_THRESHOLD:
                        any_new_strong = True
                    else:
                        any_new_moderate = True

                match_payload = _match_response_from_job(job, match_result)
                match_payload["match_id"] = str(match.match_id)
                match_payload["company_name"] = (
                    match_payload.get("company") or job.employer.company_name
                )
                match_payload["employer_bio"] = getattr(job.employer, "bio", "") or ""
                match_payload["employer_industry"] = (
                    getattr(job.employer, "industry", "") or ""
                )
                match_payload["employer_company_size"] = (
                    getattr(job.employer, "company_size", "") or ""
                )
                match_payload["employer_website"] = (
                    getattr(job.employer, "website", "") or ""
                )
                match_payload["employer_location"] = (
                    getattr(job.employer, "location", "") or ""
                )
                match_payload["is_open"] = job.is_open
                match_payload["application_deadline"] = (
                    job.application_deadline.isoformat()
                    if job.application_deadline
                    else None
                )
                match_payload["student_interested"] = match.student_interested
                match_payload["student_declined"] = match.student_declined
                match_payload["can_accept"] = can_accept
                match_payload["score_tier"] = (
                    "strong" if score >= SHOW_THRESHOLD else "standard"
                )
                matches_data.append(match_payload)

            matches_data.sort(
                key=lambda x: (
                    -float(x.get("compatibility_score") or 0),
                    -len(x.get("matched_skills", [])),
                )
            )

            for match_data in matches_data:
                match_data.pop("compatibility_score", None)

            new_match_count = len(matches_data)
            if new_match_count > 0 and (any_new_strong or any_new_moderate):
                from datetime import timedelta

                one_hour_ago = timezone.now() - timedelta(hours=1)
                recent_notif = Notification.objects.filter(
                    user=student.user, type="new match", created_at__gte=one_hour_ago
                ).exists()

                if not recent_notif:
                    if any_new_moderate and not any_new_strong:
                        if new_match_count == 1:
                            job_title = matches_data[0].get("job_title", "a position")
                            msg = (
                                f"We found a potential match for '{job_title}' (review suggested). "
                                "Open Matches to see details and respond."
                            )
                        else:
                            titles = ", ".join(
                                f"'{m.get('job_title', 'position')}'"
                                for m in matches_data[:3]
                            )
                            extra = (
                                f" and {new_match_count - 3} more"
                                if new_match_count > 3
                                else ""
                            )
                            msg = (
                                f"You have {new_match_count} potential job matches: {titles}{extra}. "
                                "These meet the expanded threshold — review them in Matches."
                            )
                    elif new_match_count == 1:
                        job_title = matches_data[0].get("job_title", "a position")
                        msg = (
                            f"Great news! You have been matched with '{job_title}'. "
                            "Your profile aligns strongly — head to Matches to review and respond."
                        )
                    else:
                        titles = ", ".join(
                            f"'{m.get('job_title', 'position')}'"
                            for m in matches_data[:3]
                        )
                        extra = (
                            f" and {new_match_count - 3} more"
                            if new_match_count > 3
                            else ""
                        )
                        msg = (
                            f"You have {new_match_count} new job matches: {titles}{extra}. "
                            "Head to Matches to review them and let employers know if you're interested."
                        )
                    Notification.objects.create(
                        user=student.user,
                        type="new match",
                        message=msg,
                    )

            paginator = PageNumberPagination()
            paginator.page_size = 20
            page = paginator.paginate_queryset(matches_data, request)

            if page is not None:
                return Response(
                    {
                        "count": new_match_count,
                        "total_matches": new_match_count,
                        "next": paginator.get_next_link(),
                        "previous": paginator.get_previous_link(),
                        "matches": page,
                        "student_id": str(student.student_id),
                        "contextual_matcher": contextual_matcher_stats,
                    }
                )

            return Response(
                {
                    "count": new_match_count,
                    "matches": matches_data,
                    "student_id": str(student.student_id),
                    "contextual_matcher": contextual_matcher_stats,
                }
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class IndicateInterestView(APIView):
    """
    Student indicates interest in a match
    POST /api/matches/<match_id>/interest
    """

    permission_classes = [IsAuthenticated, IsStudent]

    @extend_schema(
        request=None,
        responses={
            200: MatchListSerializer,
            404: OpenApiResponse(description="Match not found"),
        },
        description="Student indicates interest in a specific job match",
        tags=["Matching"],
    )
    def post(self, request, match_id):
        try:
            match = Match.objects.select_related(
                "student",
                "student__user",
                "job",
                "job__employer",
                "job__employer__user",
            ).get(match_id=match_id, student__user=request.user)
            match.student_interested = True
            match.student_declined = False
            match.save()

            job_title = match.job.title
            company_name = match.job.employer.company_name

            student_display = (
                getattr(match.student, "display_name", None) or match.student.user.email
            )
            Notification.objects.create(
                user=match.job.employer.user,
                type="student interested",
                message=(
                    f"({student_display}) has accepted their match and is interested "
                    f"in your position '{job_title}'. Visit Matches to view their profile."
                ),
            )

            Notification.objects.create(
                user=request.user,
                type="interest confirmed",
                message=(
                    f"You've accepted your match with '{job_title}' at {company_name}. "
                    "The employer has been notified and can now view your profile."
                ),
            )

            return Response(
                {
                    "message": "Interest indicated successfully",
                    "match": MatchListSerializer(match).data,
                }
            )
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND
            )


class IndicateDeclineView(APIView):
    """
    Student declines a match. Match remains visible to the student so they can
    change their mind later — it is only hidden from the employer while declined.
    """

    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, match_id):
        try:
            match = Match.objects.select_related("student", "job", "job__employer").get(
                match_id=match_id, student__user=request.user
            )
            match.student_declined = True
            match.student_interested = False
            match.save()

            Notification.objects.create(
                user=request.user,
                type="match declined",
                message=(
                    f"You've passed on the '{match.job.title}' at {match.job.employer.company_name}. "
                    "The match is still visible in case you change your mind, "
                    "you can accept it again as long as the position is still open."
                ),
            )

            return Response({"message": "Match declined"})
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND
            )


class EmployerMatchesView(generics.ListAPIView):
    """
    Get matches for employer's jobs. Shows all matches the student has not declined.
    Anonymized (e.g. "A student") until the student accepts (student_interested=True).
    Respects job.max_shortlist_size: only top N by compatibility_score per job.
    """

    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        qs = Match.objects.filter(
            job__employer__user=self.request.user,
            student_declined=False,
        ).exclude(status="dismissed")
        job_id = self.request.query_params.get("job_id")
        if job_id:
            qs = qs.filter(job_id=job_id)

        return qs.select_related("job", "student", "student__user").order_by(
            "job_id", "-compatibility_score"
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        results_to_serialize = page if page is not None else queryset

        out = []
        for m in results_to_serialize:
            out.append(
                {
                    "match_id": str(m.match_id),
                    "job": {
                        "job_id": str(m.job.job_id),
                        "title": m.job.title,
                    },
                    "status": m.status,
                    "is_open": m.job.is_open,
                    "application_deadline": m.job.application_deadline,
                    "compatibility_score": m.compatibility_score,
                    "student_interested": m.student_interested,
                    "matched_at": m.matched_at,
                    "student": {
                        "email": m.student.user.email if m.student_interested else None,
                        "display_name": (
                            m.student.display_name if m.student_interested else None
                        ),
                        "anonymized": not m.student_interested,
                    },
                }
            )

        if page is not None:
            return self.get_paginated_response(out)
        return Response(out)


class EmployerMatchStatsView(APIView):
    """
    Aggregate match statistics for the current employer across all their jobs
    or for a specific job when job_id is provided.
    """

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        responses={200: EmployerMatchStatsSerializer},
        description=(
            "Return total matches for the employer's jobs (or a specific job), "
            "along with counts of accepted, pending, and declined matches."
        ),
        tags=["Employer"],
    )
    def get(self, request):
        qs = Match.objects.filter(job__employer__user=request.user).exclude(status="dismissed")
        job_id = request.query_params.get("job_id")
        if job_id:
            qs = qs.filter(job_id=job_id)
        total_matches = qs.count()
        accepted_matches = qs.filter(
            student_interested=True, student_declined=False
        ).count()
        pending_matches = qs.filter(
            student_interested=False, student_declined=False
        ).count()
        declined_matches = qs.filter(student_declined=True).count()

        serializer = EmployerMatchStatsSerializer(
            {
                "total_matches": total_matches,
                "accepted_matches": accepted_matches,
                "pending_matches": pending_matches,
                "declined_matches": declined_matches,
            }
        )
        return Response(serializer.data)


class EmployerMatchStudentProfileView(APIView):
    """Get full student profile for an accepted match (employer only)."""

    permission_classes = [IsAuthenticated, IsEmployer]

    def get(self, request, match_id):
        try:
            match = Match.objects.select_related("student", "student__user", "job").get(
                match_id=match_id,
                job__employer__user=request.user,
            )
            if not match.student_interested:
                return Response(
                    {"error": "Student has not accepted this match"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            student = match.student
            profile = {
                "student_id": str(student.student_id),
                "email": student.user.email,
                "display_name": getattr(student, "display_name", "") or "",
                "profile_image_url": student.user.profile_image_url or "",
                "university": student.university or "",
                "course": student.course or "",
                "expected_graduation_year": student.expected_graduation_year,
                "location": student.location or "",
                "linkedin_url": student.linkedin_url or "",
                "additional_links": student.additional_links or [],
                "compatibility_score": match.compatibility_score,
                "job_title": match.job.title,
            }
            if hasattr(student, "resume") and student.resume:
                resume = student.resume
                profile["resume_id"] = str(resume.resume_id)
                profile["resume_file_url"] = resume.file_url
                profile["has_resume_file"] = bool(resume.file or resume.file_url)
                if resume.parsed_data:
                    profile["parsed_data"] = resume.parsed_data
            else:
                profile["resume_id"] = None
                profile["resume_file_url"] = None
                profile["has_resume_file"] = False
                profile["parsed_data"] = None
            return Response(profile)
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND
            )


class EmployerMatchResumeDownloadView(APIView):
    """Download resume/CV for an accepted match (employer only)."""

    permission_classes = [IsAuthenticated, IsEmployer]

    def get(self, request, match_id):
        try:
            match = Match.objects.select_related(
                "student", "student__resume", "job"
            ).get(
                match_id=match_id,
                job__employer__user=request.user,
            )
            if not match.student_interested:
                return Response(
                    {"error": "Student has not accepted this match"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if not hasattr(match.student, "resume") or not match.student.resume:
                return Response(
                    {"error": "No resume available"}, status=status.HTTP_404_NOT_FOUND
                )
            resume = match.student.resume

            if resume.status == Resume.STATUS_PROCESSING:
                return Response(
                    {
                        "error": "Please try again in a moment.",
                        "resume_status": resume.status,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

            if resume.file_storage_path:
                try:
                    from services.supabase_storage import create_signed_resume_url

                    signed_url = create_signed_resume_url(
                        resume.file_storage_path, expires_in=3600
                    )
                    if signed_url:
                        return Response({"url": signed_url, "signed": True})
                except Exception:
                    pass

            if resume.file_url:
                return Response(
                    {
                        "url": resume.file_url,
                        "message": "Open the URL to download the resume",
                    }
                )

            if resume.file:
                try:
                    f = open(resume.file.path, "rb")
                    response = FileResponse(f, as_attachment=True)
                    response["Content-Disposition"] = (
                        f'attachment; filename="resume_{match.student.user.email.replace("@", "_")}.pdf"'
                    )
                    return response
                except Exception as e:
                    return Response(
                        {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            return Response(
                {"error": "No resume file available"}, status=status.HTTP_404_NOT_FOUND
            )
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND
            )


class NotificationListView(generics.ListAPIView):
    """
    Get user notifications
    GET /api/notifications
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class MarkNotificationReadView(APIView):
    """Mark notification as read"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Notification marked as read"),
            404: OpenApiResponse(description="Notification not found"),
        },
        description="Mark a specific notification as read",
        tags=["Notifications"],
    )
    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                notification_id=notification_id, user=request.user
            )
            notification.is_read = True
            notification.save()
            return Response({"message": "Notification marked as read"})
        except Notification.DoesNotExist:
            return Response(
                {"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND
            )


SUBSCRIPTION_PLANS = {
    "basic": {
        "plan_code": "PLN_3l9w5mzowec8qk9",
        "name": "Basic",
    },
    "premium": {
        "plan_code": "PLN_ezstxk5xzdlkj6c",
        "name": "Premium",
    },
}

PLAN_CODE_LOOKUP = {v["plan_code"]: k for k, v in SUBSCRIPTION_PLANS.items()}


class PaystackInitializeView(APIView):
    """Initialize a Paystack subscription checkout session."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests as http_requests
        from django.conf import settings as django_settings

        plan_name = (request.data.get("plan") or "").lower()
        plan_info = SUBSCRIPTION_PLANS.get(plan_name)
        if not plan_info:
            return Response(
                {"error": f"Unknown plan '{plan_name}'. Choose 'basic' or 'premium'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        secret_key = getattr(django_settings, "PAYSTACK_SECRET_KEY", "")
        if not secret_key:
            return Response(
                {"error": "Payment is not configured on this server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        callback_url = request.data.get("callback_url") or ""

        payload = {
            "email": request.user.email,
            "plan": plan_info["plan_code"],
            "amount": 0,
            "metadata": {
                "plan": plan_name,
                "user_id": str(request.user.user_id),
            },
        }
        if callback_url:
            payload["callback_url"] = callback_url

        try:
            resp = http_requests.post(
                "https://api.paystack.co/transaction/initialize",
                json=payload,
                headers={"Authorization": f"Bearer {secret_key}"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return Response(
                {
                    "authorization_url": data["data"]["authorization_url"],
                    "reference": data["data"]["reference"],
                }
            )
        except Exception as exc:
            return Response(
                {"error": f"Payment initialization failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class PaystackVerifyView(APIView):
    """Verify a completed Paystack transaction and activate the student's plan."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        import logging

        import requests as http_requests
        from django.conf import settings as django_settings

        logger = logging.getLogger(__name__)

        reference = (request.data.get("reference") or "").strip()
        if not reference:
            return Response(
                {"error": "Transaction reference is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        secret_key = getattr(django_settings, "PAYSTACK_SECRET_KEY", "")
        if not secret_key:
            return Response(
                {"error": "Payment is not configured on this server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            resp = http_requests.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {secret_key}"},
                timeout=10,
            )
            resp.raise_for_status()
            resp_json = resp.json()
            data = resp_json.get("data", {})
            plan_obj = data.get("plan") or {}
            if isinstance(plan_obj, str):
                plan_code = plan_obj
            else:
                plan_code = plan_obj.get("plan_code") or ""

            logger.info(
                "Paystack verify response for ref=%s: status=%s plan_code=%s metadata=%s",
                reference,
                data.get("status"),
                plan_code,
                data.get("metadata"),
            )
        except Exception as exc:
            logger.error("Paystack verify network error: %s", exc)
            return Response(
                {"error": f"Verification failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        tx_status = data.get("status")
        if tx_status != "success":
            return Response(
                {
                    "error": f"Transaction not successful (status: {tx_status}). No changes made."
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        plan_obj = data.get("plan") or {}
        if isinstance(plan_obj, str):
            plan_code = plan_obj
        else:
            plan_code = plan_obj.get("plan_code") or plan_obj.get("plan_code") or ""

        metadata = data.get("metadata") or {}
        plan_name = PLAN_CODE_LOOKUP.get(plan_code) or metadata.get("plan") or ""

        if not plan_name:
            for field in metadata.get("custom_fields") or []:
                if field.get("variable_name") == "plan":
                    plan_name = field.get("value", "")
                    break

        if request.user.role == "student":
            try:
                student = request.user.student_profile
                student.subscription_plan = plan_name or "basic"
                if student.subscription_plan != "free":
                    student.is_premium_active = True
                student.save(update_fields=["subscription_plan", "is_premium_active"])
                logger.info(
                    "Updated student %s profile: plan=%s, is_premium=%s",
                    request.user.email,
                    student.subscription_plan,
                    student.is_premium_active,
                )
            except Exception as e:
                logger.warning("Could not update student profile after payment: %s", e)

        plan_display = SUBSCRIPTION_PLANS.get(plan_name, {}).get(
            "name", plan_name or "Unknown"
        )
        Notification.objects.create(
            user=request.user,
            type="new match",
            message=f"Your {plan_display} plan is now active. Enjoy your upgraded features!",
        )

        return Response(
            {
                "status": "success",
                "plan": plan_name,
                "plan_display": plan_display,
                "message": f"Your {plan_display} plan is now active.",
            }
        )


class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin-only viewset for user management."""

    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminUserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "email",
        "student_profile__display_name",
        "employer_profile__company_name",
    ]
    queryset = (
        User.objects.all()
        .select_related("student_profile", "employer_profile")
        .order_by("-created_at")
    )
    lookup_field = "user_id"

    def perform_destroy(self, instance):
        """Delete user from local DB, Supabase Auth, and Supabase Storage."""
        from services.supabase_storage import delete_profile_image, delete_resume_file

        if instance.profile_image_storage_path:
            delete_profile_image(instance.profile_image_storage_path)

        if hasattr(instance, "student_profile") and hasattr(
            instance.student_profile, "resume"
        ):
            resume = instance.student_profile.resume
            if resume.file_storage_path:
                delete_resume_file(resume.file_storage_path)

        user_id = str(instance.user_id)
        from services.supabase_auth import delete_supabase_user

        delete_supabase_user(user_id)
        instance.delete()

    @action(
        detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsAdmin]
    )
    def students(self, request):
        """List all students with pagination (admin only)"""
        queryset = User.objects.filter(role="student").order_by("-created_at")
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AdminUserSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = AdminUserSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsAdmin]
    )
    def employers(self, request):
        """List all employers with pagination (admin only)"""
        queryset = User.objects.filter(role="employer").order_by("-created_at")
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AdminUserSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = AdminUserSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False, methods=["get"], permission_classes=[IsAuthenticated, IsAdmin]
    )
    def admins(self, request):
        """List all admins with pagination (admin only)"""
        queryset = User.objects.filter(role="admin").order_by("-created_at")
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AdminUserSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = AdminUserSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="verify-employer")
    def verify_employer(self, request, user_id=None):
        """Toggle employer verification status (admin only)"""
        user = self.get_object()
        if user.role != "employer" or not hasattr(user, "employer_profile"):
            return Response(
                {"error": "User is not an employer"}, status=status.HTTP_400_BAD_REQUEST
            )

        employer = user.employer_profile
        employer.is_verified = not employer.is_verified
        employer.save()

        status_msg = "verified" if employer.is_verified else "unverified"

        Notification.objects.create(
            user=user,
            type="profile update",
            message=f"Your profile has been {status_msg} by an administrator.",
        )

        if employer.is_verified:
            admins = User.objects.filter(
                role="admin", notification_preferences__verified_employer=True
            )
            notifications = [
                Notification(
                    user=admin,
                    type="profile update",
                    message=f"Employer '{employer.company_name}' has been verified.",
                )
                for admin in admins
            ]
            if notifications:
                Notification.objects.bulk_create(notifications)

        return Response(
            {
                "message": f"Profile {status_msg} successfully",
                "is_verified": employer.is_verified,
            }
        )

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, user_id=None):
        """Suspend or reactivate a user account (admin only)"""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()

        status_msg = "activated" if user.is_active else "suspended"

        admin_users = User.objects.filter(
            role="admin", notification_preferences__user_suspended=True
        )
        notifications = [
            Notification(
                user=admin,
                type="user suspended",
                message=f"User {user.email} has been {status_msg} by admin {request.user.email}.",
            )
            for admin in admin_users
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)

        return Response(
            {"message": f"User {status_msg} successfully", "is_active": user.is_active}
        )

    @action(detail=True, methods=["post"], url_path="update-plan")
    def update_plan(self, request, user_id=None):
        """Manually update student subscription plan (admin only)"""
        user = self.get_object()
        if user.role != "student" or not hasattr(user, "student_profile"):
            return Response(
                {"error": "User is not a student"}, status=status.HTTP_400_BAD_REQUEST
            )

        plan = request.data.get("plan")
        if not plan:
            return Response(
                {"error": "Plan is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        student = user.student_profile
        student.subscription_plan = plan
        student.is_premium_active = plan in ("basic", "premium")
        student.save(update_fields=["subscription_plan", "is_premium_active"])

        Notification.objects.create(
            user=user,
            type="profile update",
            message=f"Your subscription plan has been manually updated to '{plan}' by an administrator.",
        )

        return Response(
            {
                "message": f"Student plan updated to '{plan}' successfully",
                "subscription_plan": student.subscription_plan,
                "is_premium_active": student.is_premium_active,
            }
        )

    @action(detail=True, methods=["post"], url_path="update-email")
    def update_email(self, request, user_id=None):
        """Manually update user email (admin only)"""
        user = self.get_object()
        email = request.data.get("email")
        if not email:
            return Response(
                {"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exclude(user_id=user.user_id).exists():
            return Response(
                {"error": "Email already in use"}, status=status.HTTP_400_BAD_REQUEST
            )

        user.email = email
        user.save()

        return Response(
            {
                "message": f"User email updated to '{email}' successfully",
                "email": user.email,
            }
        )


class DeleteAccountView(APIView):
    """Allow authenticated users to delete their own account."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=DeleteAccountRequestSerializer,
        responses={
            204: OpenApiResponse(description="Account deleted"),
            400: OpenApiResponse(description="Error deleting account"),
        },
        description="Permanently delete the current user's account. Requires the correct account password.",
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = DeleteAccountRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = serializer.validated_data["password"]

        user = request.user
        if not user.check_password(password):
            return Response(
                {"error": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_id = str(user.user_id)
        from services.supabase_auth import delete_supabase_user
        from services.supabase_storage import delete_profile_image, delete_resume_file

        if user.profile_image_storage_path:
            delete_profile_image(user.profile_image_storage_path)

        if hasattr(user, "student_profile") and hasattr(user.student_profile, "resume"):
            resume = user.student_profile.resume
            if resume.file_storage_path:
                delete_resume_file(resume.file_storage_path)

        delete_supabase_user(user_id)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserProfileView(APIView):
    """View to get or update the current user's profile and preferences."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: UserSerializer},
        description="Get the current user's data and notification preferences.",
        tags=["User"],
    )
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        request=UserSerializer,
        responses={200: UserSerializer},
        description="Update current user's data (photo, name, preferences).",
        tags=["User"],
    )
    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminContactRequestView(APIView):
    """Admin-only view to list and resolve contact requests."""

    permission_classes = [permissions.IsAdminUser]

    @extend_schema(
        responses={200: ContactRequestSerializer(many=True)},
        description="List all contact requests (Admin only).",
        tags=["Admin"],
    )
    def get(self, request):
        queryset = ContactRequest.objects.all().order_by("-created_at")

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
            )

        serializer = ContactRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        request=None,
        responses={200: ContactRequestSerializer},
        description="Toggle the resolved status of a contact request (Admin only).",
        tags=["Admin"],
    )
    def post(self, request, pk):
        try:
            contact_req = ContactRequest.objects.get(pk=pk)
            contact_req.is_resolved = not contact_req.is_resolved
            contact_req.save()
            return Response(ContactRequestSerializer(contact_req).data)
        except ContactRequest.DoesNotExist:
            return Response(
                {"error": "Contact request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )


class ConversationViewSet(viewsets.GenericViewSet):
    """Conversation management for direct messaging."""

    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "employer":
            return (
                Conversation.objects.filter(employer__user=user)
                .select_related("employer", "student__user")
                .prefetch_related("messages__sender")
            )
        else:
            return (
                Conversation.objects.filter(student__user=user)
                .select_related("employer", "student__user")
                .prefetch_related("messages__sender")
            )

    def list(self, request):
        """GET /api/conversations/ — list all conversations for the current user."""
        qs = self.get_queryset().order_by("-created_at")
        serializer = self.get_serializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """GET /api/conversations/<id>/ — get conversation detail and mark messages as read."""
        try:
            conversation = self.get_queryset().get(conversation_id=pk)
        except Conversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND
            )
        conversation.messages.filter(is_read=False).exclude(sender=request.user).update(
            is_read=True
        )
        serializer = self.get_serializer(conversation, context={"request": request})
        return Response(serializer.data)

    def create(self, request):
        """
        POST /api/conversations/ — employer starts a conversation.
        Body: { "match_id": "<uuid>" }
        Only employers can initiate. The match must have student_interested=True.
        """
        if request.user.role != "employer":
            return Response(
                {"error": "Only employers can initiate conversations."},
                status=status.HTTP_403_FORBIDDEN,
            )
        match_id = request.data.get("match_id")
        if not match_id:
            return Response(
                {"error": "match_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            match = Match.objects.select_related(
                "student__user", "job__employer__user"
            ).get(
                match_id=match_id,
                job__employer=request.user.employer_profile,
            )
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if not match.student_interested:
            return Response(
                {
                    "error": "You can only message students who have accepted this match."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        conversation, created = Conversation.objects.get_or_create(
            employer=request.user.employer_profile,
            student=match.student,
        )
        if created:
            Notification.objects.create(
                user=match.student.user,
                type="new message",
                message=(
                    f"{request.user.employer_profile.company_name} has started a conversation with you."
                ),
            )
        return Response(
            ConversationSerializer(conversation, context={"request": request}).data
        )


class UserReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for misconduct reports.
    Users can CREATE. Admins can LIST and RESOLVE (partial_update).
    """

    queryset = UserReport.objects.all()
    serializer_class = UserReportSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "report_id"

    def get_permissions(self):
        if self.action in ["list", "retrieve", "partial_update", "update", "destroy"]:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        if self.request.user.role == "admin":
            return UserReport.objects.all().order_by("-created_at")
        return UserReport.objects.filter(reporter=self.request.user).order_by(
            "-created_at"
        )

    @action(detail=True, methods=["post"])
    def resolve(self, request, report_id=None):
        """Mark a report as resolved (Admin only)"""
        report = self.get_object()
        report.is_resolved = True
        report.save()
        return Response({"status": "report resolved"})


class EmployMatchView(APIView):
    """Employer employs a candidate."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: MatchSerializer},
        description="Employer hires a candidate for a job.",
        tags=["Employer"],
    )
    def post(self, request, pk):
        if request.user.role != "employer":
            return Response(
                {"error": "Only employers can hire."}, status=status.HTTP_403_FORBIDDEN
            )

        try:
            match = Match.objects.select_related("job").get(
                pk=pk, job__employer=request.user.employer_profile
            )
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if match.status == "employed":
            return Response(MatchSerializer(match).data, status=status.HTTP_200_OK)

        job = match.job
        if job.hired_count >= job.recruitment_slots:
            return Response(
                {"error": "No recruitment slots left."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match.status = "employed"
        match.save()

        job.hired_count += 1
        if job.hired_count >= job.recruitment_slots:
            job.is_open = False
        job.save()

        Notification.objects.create(
            user=match.student.user,
            type="employment confirmed",
            message=f"Congratulations! You have been employed for the role of {job.title} at {job.employer.company_name}.",
        )

        return Response(MatchSerializer(match).data)


class DismissMatchView(APIView):
    """Employer dismisses a candidate."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: MatchSerializer},
        description="Employer dismisses a candidate for a role.",
        tags=["Employer"],
    )
    def post(self, request, pk):
        if request.user.role != "employer":
            return Response(
                {"error": "Only employers can dismiss candidates."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            match = Match.objects.get(
                pk=pk, job__employer=request.user.employer_profile
            )
        except Match.DoesNotExist:
            return Response(
                {"error": "Match not found."}, status=status.HTTP_404_NOT_FOUND
            )

        match.status = "dismissed"
        match.save()

        return Response(MatchSerializer(match).data)


class MessageListView(APIView):
    """List and send messages within a conversation."""

    permission_classes = [IsAuthenticated]

    def _get_conversation(self, request, conversation_id):
        user = request.user
        try:
            if user.role == "employer":
                return Conversation.objects.get(
                    conversation_id=conversation_id,
                    employer=user.employer_profile,
                )
            elif user.role == "student":
                return Conversation.objects.get(
                    conversation_id=conversation_id,
                    student=user.student_profile,
                )
        except Conversation.DoesNotExist:
            pass
        return None

    def get(self, request, conversation_id):
        conv = self._get_conversation(request, conversation_id)
        if not conv:
            return Response(
                {"error": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND
            )
        messages = conv.messages.all()

        serializer = MessageSerializer(
            messages, many=True, context={"request": request}
        )
        conv.messages.filter(is_read=False).exclude(sender=request.user).update(
            is_read=True
        )
        return Response(serializer.data)

    def post(self, request, conversation_id):
        conversation = self._get_conversation(request, conversation_id)
        if not conversation:
            return Response(
                {"error": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND
            )
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response(
                {"error": "Message body cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(body) > 4000:
            return Response(
                {"error": "Message too long (max 4000 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            body=body,
        )
        if request.user.role == "employer":
            recipient = conversation.student.user
            sender_name = request.user.employer_profile.company_name
        else:
            recipient = conversation.employer.user
            sender_name = conversation.student.display_name or request.user.email
        Notification.objects.create(
            user=recipient,
            type="new message",
            message=f"New message from {sender_name}: {body[:60]}{'…' if len(body) > 60 else ''}",
        )
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    def patch(self, request, conversation_id):
        """Edit an existing message."""
        conversation = self._get_conversation(request, conversation_id)
        if not conversation:
            return Response(
                {"error": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND
            )

        message_id = request.data.get("message_id")
        if not message_id:
            return Response(
                {"error": "message_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            message = Message.objects.get(pk=message_id, conversation=conversation)
        except Message.DoesNotExist:
            return Response(
                {"error": "Message not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if message.sender != request.user:
            return Response(
                {"error": "You can only edit your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        time_diff = timezone.now() - message.sent_at
        if time_diff.total_seconds() > 300:
            return Response(
                {"error": "Message can only be edited within 5 minutes of sending."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = (request.data.get("body") or "").strip()
        if not body:
            return Response(
                {"error": "Message body cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(body) > 4000:
            return Response(
                {"error": "Message too long (max 4000 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message.body = body
        message.edited_at = timezone.now()
        message.save(update_fields=["body", "edited_at"])

        return Response(MessageSerializer(message).data)
    