import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import ContactRequest, Employer, Notification, Student, User


@pytest.fixture
def admin_client(db):
    user = User.objects.create_superuser(email="admin@test.com", password="adminPass1")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(user=user, display_name="Jane Student")
    return user


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def employer_user(db):
    user = User.objects.create_user(
        email="emp@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="My Company")
    return user


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.mark.django_db
class TestContactSubmit:
    """Tests for the public contact form endpoint POST /api/contact/submit."""

    URL = "api:contact-submit"

    def test_anonymous_user_can_submit(self, client):
        """Unauthenticated users can submit a contact request."""
        response = client.post(
            reverse(self.URL),
            {
                "name": "John Anon",
                "email": "anon@test.com",
                "subject": "Question",
                "message": "I need help.",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert ContactRequest.objects.filter(email="anon@test.com").exists()

    def test_submission_requires_name(self, client):
        """Missing name field returns 400."""
        response = client.post(
            reverse(self.URL), {"email": "anon@test.com", "message": "I need help."}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_requires_message(self, client):
        """Missing message field returns 400."""
        response = client.post(
            reverse(self.URL), {"name": "John", "email": "anon@test.com"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_requires_email(self, client):
        """Missing email field returns 400."""
        response = client.post(
            reverse(self.URL), {"name": "John", "message": "Please help me."}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_submission_with_no_subject_is_allowed(self, client):
        """Subject is optional; omitting it still succeeds."""
        response = client.post(
            reverse(self.URL),
            {"name": "John", "email": "john@test.com", "message": "No subject needed."},
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_authenticated_student_email_auto_set(self, student_client):
        """When a logged-in student submits, their actual account email is used."""
        response = student_client.post(
            reverse(self.URL),
            {
                "name": "Jane Student",
                "email": "override@test.com",
                "message": "Help me please.",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        req = ContactRequest.objects.latest("created_at")
        assert req.email == "student@test.com"

    def test_authenticated_employer_email_auto_set(self, employer_client):
        """When a logged-in employer submits, their actual account email is used."""
        response = employer_client.post(
            reverse(self.URL),
            {
                "name": "My Company",
                "email": "override@test.com",
                "message": "I need support.",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        req = ContactRequest.objects.latest("created_at")
        assert req.email == "emp@test.com"

    def test_submission_notifies_admins(self, db):
        """When a contact request is submitted, all admin users get a notification."""
        admin = User.objects.create_superuser(
            email="admin@here.com", password="Admin1234"
        )
        APIClient().post(
            reverse(self.URL),
            {"name": "Someone", "email": "someone@test.com", "message": "Help"},
        )
        assert Notification.objects.filter(user=admin).exists()

    def test_linked_to_authenticated_user(self, student_client, student_user):
        """Submitting while authenticated links the request to the user account."""
        student_client.post(reverse(self.URL), {"name": "Jane", "message": "Hello"})
        req = ContactRequest.objects.latest("created_at")
        assert req.user == student_user


@pytest.mark.django_db
class TestAdminContactManagement:
    """Tests for admin listing and resolving contact requests."""

    LIST_URL = "api:admin-contact-list"
    RESOLVE_URL = "api:admin-contact-resolve"

    def test_admin_can_list_all_requests(self, admin_client):
        """Admins can retrieve all contact requests."""
        client, _ = admin_client
        ContactRequest.objects.create(name="A", email="a@a.com", message="Hi")
        ContactRequest.objects.create(name="B", email="b@b.com", message="Hello")
        response = client.get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_non_admin_cannot_list_requests(self, student_client):
        """Non-admin users are forbidden from listing contact requests."""
        response = student_client.get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_list_requests(self, db):
        """Unauthenticated requests to the admin list are rejected."""
        response = APIClient().get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_can_resolve_request(self, admin_client):
        """Admin can mark a contact request as resolved."""
        client, _ = admin_client
        req = ContactRequest.objects.create(name="C", email="c@c.com", message="Fix me")
        response = client.post(reverse(self.RESOLVE_URL, kwargs={"pk": req.request_id}))
        assert response.status_code == status.HTTP_200_OK
        req.refresh_from_db()
        assert req.is_resolved is True

    def test_resolving_already_resolved_is_idempotent(self, admin_client):
        """Resolving an already-resolved request does not error."""
        client, _ = admin_client
        req = ContactRequest.objects.create(
            name="D", email="d@d.com", message="Already done", is_resolved=True
        )
        response = client.post(reverse(self.RESOLVE_URL, kwargs={"pk": req.request_id}))
        assert response.status_code == status.HTTP_200_OK

    def test_resolving_nonexistent_request_returns_404(self, admin_client):
        """Attempting to resolve a non-existent request returns 404."""
        import uuid

        client, _ = admin_client
        fake_id = uuid.uuid4()
        response = client.post(reverse(self.RESOLVE_URL, kwargs={"pk": fake_id}))
        assert response.status_code == status.HTTP_404_NOT_FOUND
