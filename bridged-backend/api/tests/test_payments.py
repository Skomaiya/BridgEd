import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import MagicMock, patch
from api.models import Student

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@example.com", password="password123", role="student"
    )
    Student.objects.create(user=user, subscription_plan="basic")
    return user


@pytest.mark.django_db
class TestPaystackVerify:
    def test_verify_success_with_plan_object(self, api_client, student_user):
        api_client.force_authenticate(user=student_user)
        url = reverse("api:paystack-verify")

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "status": "success",
                "plan": {"plan_code": "PLN_ezstxk5xzdlkj6c"},
                "metadata": {"plan": "premium"},
            }
        }

        with patch("requests.get", return_value=mock_response):
            response = api_client.post(url, {"reference": "test_ref"})
            assert response.status_code == status.HTTP_200_OK
            student_user.student_profile.refresh_from_db()
            assert student_user.student_profile.subscription_plan == "premium"

    def test_verify_success_with_plan_string(self, api_client, student_user):
        """Testing the specific fix where 'plan' is a string"""
        api_client.force_authenticate(user=student_user)
        url = reverse("api:paystack-verify")

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "status": "success",
                "plan": "PLN_ezstxk5xzdlkj6c",
                "metadata": {"plan": "premium"},
            }
        }

        with patch("requests.get", return_value=mock_response):
            response = api_client.post(url, {"reference": "test_ref"})
            assert response.status_code == status.HTTP_200_OK
            student_user.student_profile.refresh_from_db()
            assert student_user.student_profile.subscription_plan == "premium"
