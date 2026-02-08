"""
API URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    # Authentication
    RegisterView, LoginView, LogoutView,
    # Profiles
    StudentProfileView, EmployerProfileView,
    # Resumes
    ResumeUploadView, ResumeDetailView,
    # Jobs
    JobViewSet,
    # Matching
    MatchView, IndicateInterestView, EmployerMatchesView,
    # Notifications
    NotificationListView, MarkNotificationReadView,
)

# Router for ViewSets
router = DefaultRouter()
router.register(r'jobs', JobViewSet, basename='job')

app_name = 'api'

urlpatterns = [
    # Authentication endpoints
    path('auth/register', RegisterView.as_view(), name='register'),
    path('auth/login', LoginView.as_view(), name='login'),
    path('auth/logout', LogoutView.as_view(), name='logout'),
    path('auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile endpoints
    path('students/profile', StudentProfileView.as_view(), name='student-profile'),
    path('employers/profile', EmployerProfileView.as_view(), name='employer-profile'),
    
    # Resume endpoints
    path('resumes/upload', ResumeUploadView.as_view(), name='resume-upload'),
    path('resumes/<uuid:resume_id>', ResumeDetailView.as_view(), name='resume-detail'),
    
    # Matching endpoints
    path('match', MatchView.as_view(), name='match'),
    path('matches/<uuid:match_id>/interest', IndicateInterestView.as_view(), name='indicate-interest'),
    path('employer/matches', EmployerMatchesView.as_view(), name='employer-matches'),
    
    # Notification endpoints
    path('notifications', NotificationListView.as_view(), name='notifications'),
    path('notifications/<uuid:notification_id>/read', MarkNotificationReadView.as_view(), name='notification-read'),
    
    # Router URLs (jobs CRUD)
    path('', include(router.urls)),
]
