import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Employer, Notification, Student, User


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(email="admin@test.com", password="adminPass1")


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def regular_student(db):
    user = User.objects.create_user(
        email="student@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(user=user, display_name="Test Student")
    return user


@pytest.fixture
def regular_employer(db):
    user = User.objects.create_user(
        email="employer@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="Test Corp", is_verified=False)
    return user


@pytest.mark.django_db
class TestAdminUserListing:
    """Tests for admin user listing and filtering."""

    LIST_URL = "api:admin-user-list"
    STUDENTS_URL = "api:admin-user-students"
    EMPLOYERS_URL = "api:admin-user-employers"

    def test_admin_can_list_all_users(
        self, admin_client, regular_student, regular_employer
    ):
        """Admins can retrieve a paginated list of all platform users."""
        response = admin_client.get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        emails = [u["email"] for u in results]
        assert "student@test.com" in emails
        assert "employer@test.com" in emails

    def test_admin_can_filter_students(self, admin_client, regular_student):
        """Admins can retrieve only student accounts."""
        response = admin_client.get(reverse(self.STUDENTS_URL))
        assert response.status_code == status.HTTP_200_OK
        student_accounts = response.data.get("results", response.data)
        assert all(u["role"] == "student" for u in student_accounts)

    def test_admin_can_filter_employers(self, admin_client, regular_employer):
        """Admins can retrieve only employer accounts."""
        response = admin_client.get(reverse(self.EMPLOYERS_URL))
        assert response.status_code == status.HTTP_200_OK
        employer_accounts = response.data.get("results", response.data)
        assert all(u["role"] == "employer" for u in employer_accounts)

    def test_admin_can_search_users_by_email(self, admin_client, regular_student):
        """Admins can search users by email via ?search= query parameter."""
        response = admin_client.get(
            reverse(self.LIST_URL), {"search": "student@test.com"}
        )
        results = response.data.get("results", response.data)
        assert any(u["email"] == "student@test.com" for u in results)

    def test_non_admin_cannot_list_users(self, regular_student):
        """Non-admin users cannot access the admin user list."""
        client = APIClient()
        client.force_authenticate(user=regular_student)
        response = client.get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_list_users(self, db):
        """Unauthenticated requests to the admin user list are rejected."""
        response = APIClient().get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAdminActions:
    """Tests for admin-only actions on users."""

    def test_admin_can_verify_employer(self, admin_client, regular_employer):
        """Admins can toggle an employer's verification status."""
        url = reverse(
            "api:admin-user-verify-employer",
            kwargs={"user_id": regular_employer.user_id},
        )
        response = admin_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        regular_employer.employer_profile.refresh_from_db()
        assert regular_employer.employer_profile.is_verified is True

    def test_verify_employer_notifies_employer(self, admin_client, regular_employer):
        """Verifying an employer sends them a profile_update notification."""
        url = reverse(
            "api:admin-user-verify-employer",
            kwargs={"user_id": regular_employer.user_id},
        )
        admin_client.post(url)
        assert Notification.objects.filter(
            user=regular_employer, type="profile update"
        ).exists()

    def test_verify_on_student_returns_400(self, admin_client, regular_student):
        """Attempting to verify a non-employer account returns 400."""
        url = reverse(
            "api:admin-user-verify-employer",
            kwargs={"user_id": regular_student.user_id},
        )
        response = admin_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_can_suspend_user(self, admin_client, regular_student):
        """Admins can deactivate a user account (toggle is_active to False)."""
        url = reverse(
            "api:admin-user-toggle-active", kwargs={"user_id": regular_student.user_id}
        )
        response = admin_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        regular_student.refresh_from_db()
        assert regular_student.is_active is False

    def test_admin_can_reactivate_suspended_user(self, admin_client, regular_student):
        """Admins can reactivate a previously suspended user."""
        regular_student.is_active = False
        regular_student.save()
        url = reverse(
            "api:admin-user-toggle-active", kwargs={"user_id": regular_student.user_id}
        )
        admin_client.post(url)
        regular_student.refresh_from_db()
        assert regular_student.is_active is True

    def test_admin_can_update_user_email(self, admin_client, regular_student):
        """Admins can update any user's email via PATCH on the detail endpoint."""
        url = reverse(
            "api:admin-user-detail", kwargs={"user_id": regular_student.user_id}
        )
        response = admin_client.patch(url, {"email": "updated@test.com"})
        assert response.status_code == status.HTTP_200_OK
        regular_student.refresh_from_db()
        assert regular_student.email == "updated@test.com"

    def test_admin_can_update_student_plan(self, admin_client, regular_student):
        """Admins can update a student's subscription plan via the update-plan action."""
        url = reverse(
            "api:admin-user-update-plan", kwargs={"user_id": regular_student.user_id}
        )
        response = admin_client.post(url, {"plan": "premium"})
        assert response.status_code == status.HTTP_200_OK
        regular_student.student_profile.refresh_from_db()
        assert regular_student.student_profile.subscription_plan == "premium"

    def test_update_plan_on_employer_returns_400(self, admin_client, regular_employer):
        """Attempting to update plan for a non-student account returns 400."""
        url = reverse(
            "api:admin-user-update-plan", kwargs={"user_id": regular_employer.user_id}
        )
        response = admin_client.post(url, {"plan": "premium"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_admin_cannot_toggle_active(self, regular_student):
        """Non-admins cannot toggle any user's active status."""
        client = APIClient()
        client.force_authenticate(user=regular_student)
        url = reverse(
            "api:admin-user-toggle-active", kwargs={"user_id": regular_student.user_id}
        )
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
