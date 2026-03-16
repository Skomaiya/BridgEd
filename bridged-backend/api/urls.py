"""
API URL Configuration
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (  # Authentication; Resumes; Profiles; Jobs; Matching; Support; Notifications; Payments; Admin; Messaging; Match management; Public stats
    AdminContactRequestView,
    AdminUserViewSet,
    ContactRequestView,
    ConversationViewSet,
    DeleteAccountView,
    DismissMatchView,
    EmployerMatchesView,
    EmployerMatchResumeDownloadView,
    EmployerMatchStudentProfileView,
    EmployerMatchStatsView,
    EmployerProfilePhotoView,
    EmployerProfileView,
    EmployMatchView,
    IndicateDeclineView,
    IndicateInterestView,
    JobViewSet,
    LoginView,
    LogoutView,
    MarkNotificationReadView,
    MatchView,
    MessageListView,
    NotificationListView,
    PaystackInitializeView,
    PaystackVerifyView,
    RegisterView,
    ResumeDetailView,
    ResumeUploadView,
    PlatformStatsView,
    StudentProfilePhotoView,
    StudentProfileView,
    UserProfilePhotoView,
    UserProfileView,
    UserReportViewSet,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r"jobs", JobViewSet, basename="job")
router.register(r"admin/users", AdminUserViewSet, basename="admin-user")
router.register(r"conversations", ConversationViewSet, basename="conversation")
router.register(r"reports", UserReportViewSet, basename="report")

app_name = "api"

urlpatterns = [
    # Authentication endpoints
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/delete-account", DeleteAccountView.as_view(), name="delete-account"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    # Public statistics
    path("stats/platform", PlatformStatsView.as_view(), name="platform-stats"),
    # Profile endpoints
    path("students/profile", StudentProfileView.as_view(), name="student-profile"),
    path(
        "students/profile/photo",
        StudentProfilePhotoView.as_view(),
        name="student-profile-photo",
    ),
    path("employers/profile", EmployerProfileView.as_view(), name="employer-profile"),
    path(
        "employers/profile/photo",
        EmployerProfilePhotoView.as_view(),
        name="employer-profile-photo",
    ),
    path(
        "user/profile/photo", UserProfilePhotoView.as_view(), name="user-profile-photo"
    ),
    path("user/profile", UserProfileView.as_view(), name="user-profile"),
    # Resume endpoints
    path("resumes/upload", ResumeUploadView.as_view(), name="resume-upload"),
    path("resumes/<uuid:resume_id>", ResumeDetailView.as_view(), name="resume-detail"),
    # Matching endpoints
    path("match", MatchView.as_view(), name="match"),
    path(
        "matches/<uuid:match_id>/interest",
        IndicateInterestView.as_view(),
        name="indicate-interest",
    ),
    path(
        "matches/<uuid:match_id>/decline",
        IndicateDeclineView.as_view(),
        name="indicate-decline",
    ),
    path(
        "employer/matches/<uuid:match_id>/student",
        EmployerMatchStudentProfileView.as_view(),
        name="employer-match-student",
    ),
    path(
        "employer/matches/<uuid:match_id>/resume-download",
        EmployerMatchResumeDownloadView.as_view(),
        name="employer-match-resume-download",
    ),
    path("employer/matches", EmployerMatchesView.as_view(), name="employer-matches"),
    path(
        "employer/matches/stats",
        EmployerMatchStatsView.as_view(),
        name="employer-match-stats",
    ),
    path("matches/<uuid:pk>/employ/", EmployMatchView.as_view(), name="match-employ"),
    path(
        "matches/<uuid:pk>/dismiss/", DismissMatchView.as_view(), name="match-dismiss"
    ),
    # Notification endpoints
    path("notifications", NotificationListView.as_view(), name="notifications"),
    path(
        "notifications/<uuid:notification_id>/read",
        MarkNotificationReadView.as_view(),
        name="notification-read",
    ),
    # Support endpoints
    path("contact/submit", ContactRequestView.as_view(), name="contact-submit"),
    path(
        "admin/contacts/", AdminContactRequestView.as_view(), name="admin-contact-list"
    ),
    path(
        "admin/contacts/<uuid:pk>/resolve/",
        AdminContactRequestView.as_view(),
        name="admin-contact-resolve",
    ),
    # Payment endpoints
    path(
        "payments/paystack/initialize",
        PaystackInitializeView.as_view(),
        name="paystack-initialize",
    ),
    path(
        "payments/paystack/verify", PaystackVerifyView.as_view(), name="paystack-verify"
    ),
    # Messaging endpoints
    path(
        "conversations/<uuid:conversation_id>/messages/",
        MessageListView.as_view(),
        name="conversation-messages",
    ),
    # Router URLs (jobs CRUD, conversations, admin users)
    path("", include(router.urls)),
]
