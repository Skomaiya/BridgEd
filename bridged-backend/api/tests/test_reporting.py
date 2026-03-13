import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from api.models import Employer, Student, User, UserReport


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="reporter@test.com", password="testpass123", role="student"
    )
    Student.objects.create(user=user, display_name="Reporter Student")
    return user


@pytest.fixture
def reported_user(db):
    user = User.objects.create_user(
        email="reported@test.com", password="testpass123", role="employer"
    )
    Employer.objects.create(user=user, company_name="Reported Corp")
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@test.com", password="adminpass123", role="admin"
    )


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.mark.django_db
class TestUserReporting:
    def test_authenticated_user_can_submit_report(self, student_client, reported_user):
        url = reverse("api:report-list")
        data = {
            "reported_user": reported_user.user_id,
            "reason": "harassment",
            "description": "This user is being very rude in chat.",
        }
        response = student_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert UserReport.objects.filter(reported_user=reported_user).exists()
        report = UserReport.objects.get(reported_user=reported_user)
        assert report.reason == "harassment"
        assert report.description == data["description"]

    def test_unauthenticated_user_cannot_submit_report(self, reported_user):
        client = APIClient()
        url = reverse("api:report-list")
        data = {
            "reported_user": reported_user.user_id,
            "reason": "spam",
            "description": "Spamming me.",
        }
        response = client.post(url, data, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_can_list_reports(self, admin_client, student_user, reported_user):
        UserReport.objects.create(
            reporter=student_user,
            reported_user=reported_user,
            reason="scam",
            description="Clear scam attempt.",
        )
        url = reverse("api:report-list")
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) >= 1
        assert results[0]["reason"] == "scam"

    def test_regular_user_cannot_list_reports(self, student_client):
        url = reverse("api:report-list")
        response = student_client.get(url)
        # Depending on implementation, this might return 403 or filtered list.
        # Standard ViewSet with permission_classes = [IsAuthenticated] usually allows list unless filtered.
        # But our UserReportViewSet should restrict list to Admin.
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_resolve_report(self, admin_client, student_user, reported_user):
        report = UserReport.objects.create(
            reporter=student_user,
            reported_user=reported_user,
            reason="other",
        )
        url = reverse("api:report-resolve", kwargs={"report_id": report.pk})
        response = admin_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        report.refresh_from_db()
        assert report.is_resolved is True
