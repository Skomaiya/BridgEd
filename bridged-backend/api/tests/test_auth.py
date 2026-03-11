import sys
from unittest.mock import MagicMock

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import Employer, Notification, Student, User


def make_client():
    return APIClient()


@pytest.mark.django_db
class TestRegistration:
    """Tests for user registration via POST /api/auth/register."""

    URL = "api:register"

    def test_student_registers_successfully(self, client):
        """A valid student submission creates a user, profile, and returns tokens."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "student@test.com",
                "password": "Securepass1",
                "password_confirm": "Securepass1",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert User.objects.filter(email="student@test.com", role="student").exists()
        assert Student.objects.filter(user__email="student@test.com").exists()

    def test_employer_registers_and_creates_profile(self, client):
        """A valid employer submission creates a user, employer profile, and returns tokens."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "employer@test.com",
                "password": "Securepass1",
                "password_confirm": "Securepass1",
                "role": "employer",
                "company_name": "Acme Ltd",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Employer.objects.filter(
            user__email="employer@test.com", company_name="Acme Ltd"
        ).exists()

    def test_registration_notifies_admins(self, client):
        """Admins receive a user_registered notification when a new user signs up."""
        admin = User.objects.create_superuser(
            email="admin@test.com", password="adminPass1"
        )
        client.post(
            reverse(self.URL),
            {
                "email": "newbie@test.com",
                "password": "Securepass1",
                "password_confirm": "Securepass1",
                "role": "student",
            },
        )
        assert Notification.objects.filter(user=admin, type="user registered").exists()

    def test_mismatched_passwords_rejected(self, client):
        """Passwords that don't match return 400."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "bad@test.com",
                "password": "Securepass1",
                "password_confirm": "Different1",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_password_too_short_rejected(self, client):
        """Passwords shorter than 8 characters return 400."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "short@test.com",
                "password": "abc1",
                "password_confirm": "abc1",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_password_without_number_rejected(self, client):
        """Passwords with no digits return 400."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "nonum@test.com",
                "password": "NoNumbers",
                "password_confirm": "NoNumbers",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_password_without_letter_rejected(self, client):
        """Passwords with no letters return 400."""
        response = client.post(
            reverse(self.URL),
            {
                "email": "nolet@test.com",
                "password": "12345678",
                "password_confirm": "12345678",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_duplicate_email_rejected(self, client):
        """Registering with an already-used email returns 400."""
        User.objects.create_user(
            email="dupe@test.com", password="Securepass1", role="student"
        )
        response = client.post(
            reverse(self.URL),
            {
                "email": "dupe@test.com",
                "password": "Securepass1",
                "password_confirm": "Securepass1",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_email_rejected(self, client):
        """Requests without an email field return 400."""
        response = client.post(
            reverse(self.URL),
            {
                "password": "Securepass1",
                "password_confirm": "Securepass1",
                "role": "student",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    """Tests for user login via POST /api/auth/login."""

    URL = "api:login"

    def test_login_success_returns_tokens(self, client):
        """Valid credentials return JWT access + refresh tokens."""
        User.objects.create_user(
            email="login@test.com", password="Securepass1", role="student"
        )
        response = client.post(
            reverse(self.URL), {"email": "login@test.com", "password": "Securepass1"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]
        assert response.data["user"]["email"] == "login@test.com"

    def test_login_returns_user_role(self, client):
        """Login response includes the user's role."""
        User.objects.create_user(
            email="emp@test.com", password="Securepass1", role="employer"
        )
        response = client.post(
            reverse(self.URL), {"email": "emp@test.com", "password": "Securepass1"}
        )
        assert response.data["user"]["role"] == "employer"

    def test_wrong_password_returns_401(self, client):
        """Incorrect password returns 401."""
        User.objects.create_user(
            email="user@test.com", password="Securepass1", role="student"
        )
        response = client.post(
            reverse(self.URL), {"email": "user@test.com", "password": "WrongPass1"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_nonexistent_user_returns_401(self, client):
        """Login attempt for unknown email returns 401."""
        response = client.post(
            reverse(self.URL), {"email": "ghost@test.com", "password": "SomePass1"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_suspended_account_returns_error(self, client):
        """Deactivated accounts receive an error on login (Django authenticate blocks inactive users)."""
        user = User.objects.create_user(
            email="banned@test.com", password="Securepass1", role="student"
        )
        user.is_active = False
        user.save()
        response = client.post(
            reverse(self.URL), {"email": "banned@test.com", "password": "Securepass1"}
        )
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_missing_email_field_returns_400(self, client):
        """Login with no email field returns 400."""
        response = client.post(reverse(self.URL), {"password": "Securepass1"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_password_field_returns_400(self, client):
        """Login with no password field returns 400."""
        response = client.post(reverse(self.URL), {"email": "user@test.com"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogout:
    """Tests for token blacklisting via POST /api/auth/logout."""

    URL = "api:logout"

    def test_valid_token_blacklisted_on_logout(self, db):
        """Authenticated user can logout and blacklist their refresh token."""
        user = User.objects.create_user(
            email="out@test.com", password="Securepass1", role="student"
        )
        refresh = RefreshToken.for_user(user)
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(reverse(self.URL), {"refresh_token": str(refresh)})
        assert response.status_code == status.HTTP_200_OK
        assert "Logout successful" in response.data["message"]

    def test_invalid_token_returns_400(self, db):
        """Providing a bad or already-used token returns 400."""
        user = User.objects.create_user(
            email="out2@test.com", password="Securepass1", role="student"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post(reverse(self.URL), {"refresh_token": "not-a-real-token"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_logout(self, db):
        """Unauthenticated logout attempt returns 401."""
        response = APIClient().post(reverse(self.URL), {"refresh_token": "anything"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDeleteAccount:
    """Tests for account deletion via POST /api/auth/delete-account."""

    URL = "api:delete-account"

    def test_user_can_delete_own_account(self, db):
        """An authenticated user can delete their own account via POST."""
        from unittest.mock import patch

        user = User.objects.create_user(
            email="del@test.com", password="Securepass1", role="student"
        )
        Student.objects.create(user=user)
        client = APIClient()
        client.force_authenticate(user=user)
        mock_sa = MagicMock()
        mock_sa.delete_supabase_user = MagicMock(return_value=None)
        with patch.dict(sys.modules, {"services.supabase_auth": mock_sa}):
            response = client.post(reverse(self.URL))
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)
        assert not User.objects.filter(email="del@test.com").exists()

    def test_unauthenticated_cannot_delete(self, db):
        """Unauthenticated delete attempt returns 401."""
        response = APIClient().delete(reverse(self.URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
