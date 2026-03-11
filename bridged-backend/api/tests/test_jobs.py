from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Employer, Job, Notification, Student, User


@pytest.fixture
def employer_user(db):
    user = User.objects.create_user(
        email="employer@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="Acme Corp")
    return user


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.fixture
def second_employer(db):
    user = User.objects.create_user(
        email="other@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="Other Corp")
    return user


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(user=user)
    return user


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def open_job(employer_user):
    emp = employer_user.employer_profile
    return Job.objects.create(
        employer=emp,
        title="Software Engineer",
        description="Build things.",
        required_skills=["Python", "Django"],
        nice_to_have_skills=["Docker"],
        location="Remote",
        contract_type="internship",
        is_open=True,
    )


@pytest.mark.django_db
class TestJobCreation:
    """Tests for POST /api/jobs/ (employer only)."""

    URL = "api:job-list"

    def test_employer_creates_job_successfully(self, employer_client):
        """An employer can post a new job and it is stored in the database."""
        response = employer_client.post(
            reverse(self.URL),
            {
                "title": "Backend Developer",
                "description": "Python required.",
                "required_skills": ["Python"],
                "location": "Remote",
                "contract_type": "full-time",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Job.objects.filter(title="Backend Developer").exists()

    def test_employer_assigned_automatically(self, employer_client, employer_user):
        """The employer is auto-assigned from the authenticated user's profile, not from the request body."""
        employer_client.post(
            reverse(self.URL),
            {
                "title": "Auto Assigned",
                "description": "Test auto-assign.",
                "required_skills": ["Python"],
                "location": "Remote",
                "contract_type": "full-time",
            },
            format="json",
        )
        job = Job.objects.get(title="Auto Assigned")
        assert job.employer.user == employer_user

    def test_employer_notified_when_job_goes_live(self, employer_client, employer_user):
        """Employer receives a job_published notification when a live job is posted."""
        employer_client.post(
            reverse(self.URL),
            {
                "title": "Live Job",
                "description": "Immediately live.",
                "required_skills": ["Python"],
                "location": "Remote",
                "contract_type": "full-time",
                "is_open": True,
            },
            format="json",
        )
        assert Notification.objects.filter(
            user=employer_user, type="job published"
        ).exists()

    def test_student_cannot_create_job(self, student_client):
        """Students receive 403 when attempting to post a job."""
        response = student_client.post(
            reverse(self.URL),
            {"title": "Illegal", "description": "X", "location": "Y"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_create_job(self, db):
        """Unauthenticated requests to POST /jobs are rejected."""
        response = APIClient().post(reverse(self.URL), {"title": "X"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_title_rejected(self, employer_client):
        """Creating a job without a title returns 400."""
        response = employer_client.post(
            reverse(self.URL),
            {
                "description": "No title.",
                "location": "Remote",
                "contract_type": "full-time",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_description_rejected(self, employer_client):
        """Creating a job without a description returns 400."""
        response = employer_client.post(
            reverse(self.URL),
            {"title": "No Desc", "location": "Remote", "contract_type": "full-time"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_past_application_deadline_rejected(self, employer_client):
        """Setting an application_deadline in the past returns 400."""
        past = (timezone.now() - timedelta(days=1)).isoformat()
        response = employer_client.post(
            reverse(self.URL),
            {
                "title": "Old Deadline",
                "description": "Test.",
                "required_skills": [],
                "location": "Remote",
                "contract_type": "full-time",
                "application_deadline": past,
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestJobRetrieval:
    """Tests for GET /api/jobs/ and GET /api/jobs/<job_id>/."""

    LIST_URL = "api:job-list"
    MY_JOBS_URL = "api:job-my-jobs"

    def test_authenticated_user_sees_open_jobs(self, student_client, open_job):
        """Authenticated users see only open jobs in the main list."""
        response = student_client.get(reverse(self.LIST_URL))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert any(j["title"] == "Software Engineer" for j in results)

    def test_closed_jobs_hidden_from_authenticated_list(
        self, student_client, employer_user
    ):
        """Closed jobs do not appear in the public job list."""
        emp = employer_user.employer_profile
        Job.objects.create(
            employer=emp,
            title="Closed Listing",
            description="X",
            required_skills=[],
            location="R",
            is_open=False,
        )
        response = student_client.get(reverse(self.LIST_URL))
        results = response.data.get("results", response.data)
        assert not any(j["title"] == "Closed Listing" for j in results)

    def test_employer_can_retrieve_own_job_detail(self, employer_client, open_job):
        """Employer can retrieve a specific job's full details."""
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = employer_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Software Engineer"

    def test_employer_my_jobs_includes_closed_listings(
        self, employer_client, employer_user
    ):
        """The my_jobs action returns all employer jobs, including closed ones."""
        emp = employer_user.employer_profile
        Job.objects.create(
            employer=emp,
            title="Old Role",
            description="X",
            required_skills=[],
            location="R",
            is_open=False,
        )
        response = employer_client.get(reverse(self.MY_JOBS_URL))
        assert response.status_code == status.HTTP_200_OK
        results = (
            response.data
            if isinstance(response.data, list)
            else response.data.get("results", response.data)
        )
        assert any(j["title"] == "Old Role" for j in results)

    def test_job_search_by_title(self, student_client, open_job):
        """Jobs can be searched by title via the ?search= query parameter."""
        response = student_client.get(
            reverse(self.LIST_URL), {"search": "Software Engineer"}
        )
        results = response.data.get("results", response.data)
        assert any(j["title"] == "Software Engineer" for j in results)


@pytest.mark.django_db
class TestJobUpdateDelete:
    """Tests for PATCH/DELETE on /api/jobs/<job_id>/."""

    def test_employer_can_update_own_job(self, employer_client, open_job):
        """A job's owner can patch its details."""
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = employer_client.patch(url, {"title": "Updated Title"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        open_job.refresh_from_db()
        assert open_job.title == "Updated Title"

    def test_employer_can_close_job(self, employer_client, open_job):
        """An employer can close an open job by setting is_open to false."""
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = employer_client.patch(url, {"is_open": False}, format="json")
        assert response.status_code == status.HTTP_200_OK
        open_job.refresh_from_db()
        assert open_job.is_open is False

    def test_employer_can_delete_own_job(self, employer_client, open_job):
        """The job owner can delete their own job listing."""
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = employer_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Job.objects.filter(job_id=open_job.job_id).exists()

    def test_other_employer_cannot_update_job(self, open_job, second_employer):
        """An employer who does not own a job cannot update it."""
        client = APIClient()
        client.force_authenticate(user=second_employer)
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = client.patch(url, {"title": "Stolen"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_other_employer_cannot_delete_job(self, open_job, second_employer):
        """An employer who does not own a job cannot delete it."""
        client = APIClient()
        client.force_authenticate(user=second_employer)
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_job(self, student_client, open_job):
        """Students are forbidden from updating any job."""
        url = reverse("api:job-detail", kwargs={"job_id": open_job.job_id})
        response = student_client.patch(url, {"title": "Hacked"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
