import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from api.models import Employer, Resume, Student, User


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@example.com", password="password123", role="student"
    )
    Student.objects.create(
        user=user,
        display_name="Jane Doe",
        university="University of Lagos",
        course="Computer Science",
        expected_graduation_year=2025,
        location="Lagos",
        contract_preferences=["full-time", "internship"],
    )
    return user


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def employer_user(db):
    user = User.objects.create_user(
        email="employer@example.com", password="password123", role="employer"
    )
    Employer.objects.create(
        user=user,
        company_name="TechCorp Ltd",
        industry="Technology",
        location="Nairobi",
        company_size="50-200",
    )
    return user


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.mark.django_db
class TestStudentProfileRetrieval:
    """Tests for GET /api/students/profile."""

    URL = "api:student-profile"

    def test_student_can_retrieve_own_profile(self, student_client, student_user):
        """Students can view their own full profile including nested user object."""
        response = student_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["email"] == "student@example.com"
        assert response.data["university"] == "University of Lagos"
        assert response.data["course"] == "Computer Science"

    def test_profile_includes_all_serializer_fields(self, student_client):
        """Profile response contains all expected fields from the StudentSerializer."""
        response = student_client.get(reverse(self.URL))
        expected_fields = [
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
            "display_name",
            "subscription_plan",
            "contract_preferences",
            "created_at",
            "updated_at",
        ]
        for field in expected_fields:
            assert field in response.data

    def test_employer_cannot_access_student_profile(self, employer_client):
        """Employers are forbidden from accessing the student profile endpoint."""
        response = employer_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_access_student_profile(self, db):
        """Unauthenticated requests to the student profile endpoint return 401."""
        response = APIClient().get(reverse(self.URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestStudentProfileUpdate:
    """Tests for PATCH /api/students/profile."""

    URL = "api:student-profile"

    def test_student_can_update_display_name(self, student_client):
        """Students can change their public display name."""
        response = student_client.patch(
            reverse(self.URL), {"display_name": "Jane Updated"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["display_name"] == "Jane Updated"

    def test_student_can_update_university(self, student_client):
        """Students can update their university field."""
        response = student_client.patch(
            reverse(self.URL), {"university": "UNILAG"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["university"] == "UNILAG"

    def test_student_can_update_location(self, student_client):
        """Students can change their location preference."""
        response = student_client.patch(
            reverse(self.URL), {"location": "Nairobi"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["location"] == "Nairobi"

    def test_student_can_update_contract_preferences(self, student_client):
        """Students can change which contract types they are interested in."""
        response = student_client.patch(
            reverse(self.URL),
            {"contract_preferences": ["contract", "freelance"]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        prefs = response.data["contract_preferences"]
        assert "contract" in prefs
        assert "freelance" in prefs

    def test_student_can_add_linkedin_url(self, student_client):
        """Students can add a valid LinkedIn URL."""
        response = student_client.patch(
            reverse(self.URL),
            {"linkedin_url": "https://linkedin.com/in/janedoe"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["linkedin_url"] == "https://linkedin.com/in/janedoe"

    def test_linkedin_url_without_https_rejected(self, student_client):
        """LinkedIn URLs without http(s) scheme are rejected with 400."""
        response = student_client.patch(
            reverse(self.URL),
            {"linkedin_url": "linkedin.com/in/janedoe"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_student_can_add_additional_links(self, student_client):
        """Students can add a list of typed additional links like GitHub or Portfolio."""
        links = [
            {"link_type": "GitHub", "url": "https://github.com/janedoe"},
            {"link_type": "Portfolio", "url": "https://janedoe.dev"},
        ]
        response = student_client.patch(
            reverse(self.URL), {"additional_links": links}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["additional_links"]) == 2

    def test_additional_link_without_url_rejected(self, student_client):
        """Additional links with a missing url are rejected."""
        bad_links = [{"link_type": "GitHub"}]
        response = student_client.patch(
            reverse(self.URL), {"additional_links": bad_links}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_additional_link_without_link_type_rejected(self, student_client):
        """Additional links with a missing link_type are rejected."""
        bad_links = [{"url": "https://github.com/someone"}]
        response = student_client.patch(
            reverse(self.URL), {"additional_links": bad_links}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_subscription_plan_not_in_student_writable_fields(self, student_client):
        """The subscription_plan field is listed as read_only in StudentSerializer's Meta, meaning it is not intended for direct student updates."""
        from api.serializers import StudentSerializer

        assert "subscription_plan" in StudentSerializer.Meta.read_only_fields

    def test_student_id_is_read_only(self, student_client, student_user):
        """The student_id field cannot be changed by the student."""
        original_id = student_user.student_profile.student_id
        student_client.patch(
            reverse(self.URL),
            {"student_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        student_user.student_profile.refresh_from_db()
        assert student_user.student_profile.student_id == original_id


@pytest.mark.django_db
class TestEmployerProfileRetrieval:
    """Tests for GET /api/employers/profile."""

    URL = "api:employer-profile"

    def test_employer_can_retrieve_own_profile(self, employer_client):
        """Employers can view their own company profile."""
        response = employer_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["company_name"] == "TechCorp Ltd"
        assert response.data["industry"] == "Technology"

    def test_profile_includes_all_serializer_fields(self, employer_client):
        """Employer profile response contains all expected fields from the EmployerSerializer."""
        response = employer_client.get(reverse(self.URL))
        expected_fields = [
            "employer_id",
            "user",
            "company_name",
            "industry",
            "company_size",
            "location",
            "contact_number",
            "is_verified",
            "profile_image_url",
            "created_at",
            "updated_at",
        ]
        for field in expected_fields:
            assert field in response.data

    def test_is_verified_false_by_default(self, employer_client):
        """Newly registered employers have is_verified set to False."""
        response = employer_client.get(reverse(self.URL))
        assert response.data["is_verified"] is False

    def test_student_cannot_access_employer_profile(self, student_client):
        """Students are forbidden from accessing the employer profile endpoint."""
        response = student_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_access_employer_profile(self, db):
        """Unauthenticated requests to the employer profile endpoint return 401."""
        response = APIClient().get(reverse(self.URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestEmployerProfileUpdate:
    """Tests for PATCH /api/employers/profile."""

    URL = "api:employer-profile"

    def test_employer_can_update_company_name(self, employer_client):
        """Employers can change their company's display name."""
        response = employer_client.patch(
            reverse(self.URL), {"company_name": "TechCorp Africa"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["company_name"] == "TechCorp Africa"

    def test_employer_can_update_industry(self, employer_client):
        """Employers can update their industry field."""
        response = employer_client.patch(
            reverse(self.URL), {"industry": "Finance"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["industry"] == "Finance"

    def test_employer_can_update_company_size(self, employer_client):
        """Employers can update their company size banding."""
        response = employer_client.patch(
            reverse(self.URL), {"company_size": "200-500"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["company_size"] == "200-500"

    def test_employer_can_update_location(self, employer_client):
        """Employers can update the company's primary location."""
        response = employer_client.patch(
            reverse(self.URL), {"location": "Lagos"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["location"] == "Lagos"

    def test_is_verified_is_read_only_for_employer(
        self, employer_client, employer_user
    ):
        """Employers cannot promote their own verification status."""
        employer_client.patch(reverse(self.URL), {"is_verified": True}, format="json")
        employer_user.employer_profile.refresh_from_db()
        assert employer_user.employer_profile.is_verified is False

    def test_employer_id_is_read_only(self, employer_client, employer_user):
        """The employer_id field cannot be changed through the profile update endpoint."""
        original_id = employer_user.employer_profile.employer_id
        employer_client.patch(
            reverse(self.URL),
            {"employer_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        employer_user.employer_profile.refresh_from_db()
        assert employer_user.employer_profile.employer_id == original_id
