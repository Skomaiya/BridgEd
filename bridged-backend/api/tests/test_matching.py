import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from api.models import Employer, Job, Match, Resume, Student, User


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(
        user=user, display_name="Jane", location="Remote", contract_preferences=[]
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
        email="employer@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="Acme")
    return user


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.fixture
def student_with_resume(student_user):
    student = student_user.student_profile
    Resume.objects.create(
        student=student,
        parsed_data={
            "technical_skills": ["Python", "Django", "AWS"],
            "soft_skills": ["Leadership"],
        },
        status="completed",
    )
    return student


@pytest.fixture
def python_job(employer_user):
    emp = employer_user.employer_profile
    return Job.objects.create(
        employer=emp,
        title="Python Dev",
        description="Use Python.",
        required_skills=["Python", "Django"],
        nice_to_have_skills=["AWS"],
        location="Remote",
        contract_type="full-time",
        is_open=True,
    )


@pytest.fixture
def existing_match(student_with_resume, python_job):
    return Match.objects.create(
        student=student_with_resume, job=python_job, compatibility_score=92.0
    )


@pytest.mark.django_db
class TestMatchGeneration:
    """Tests for POST /api/match — generating student matches."""

    URL = "api:match"

    def test_student_with_resume_gets_matches(
        self, student_client, student_with_resume, python_job
    ):
        """A student with an uploaded, parsed resume receives job matches."""
        response = student_client.post(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_matches"] >= 1

    def test_match_response_includes_contextual_matcher_stats(
        self, student_client, student_with_resume, python_job
    ):
        """POST /match returns aggregated stats so clients can verify LLM usage."""
        response = student_client.post(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        cm = response.data.get("contextual_matcher")
        assert cm is not None
        assert "contextual_llm_enabled" in cm
        assert "min_base_score_for_llm" in cm
        assert cm["jobs_evaluated"] >= 1
        assert set(cm["outcomes"].keys()) >= {
            "applied",
            "skipped_low_base",
            "skipped_disabled",
            "unavailable",
        }

    def test_matches_stored_in_database(
        self, student_client, student_with_resume, python_job
    ):
        """Matches that meet the threshold are persisted to the database."""
        student_client.post(reverse(self.URL))
        assert Match.objects.filter(student=student_with_resume).exists()

    def test_student_without_resume_gets_400(self, student_client):
        """A student with no uploaded resume receives a 400 error."""
        response = student_client.post(reverse(self.URL))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_employer_cannot_trigger_match(self, employer_client):
        """Employers cannot call the student matching endpoint."""
        response = employer_client.post(reverse(self.URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_trigger_match(self, db):
        """Unauthenticated requests to the match endpoint are rejected."""
        response = APIClient().post(reverse(self.URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_match_response_has_correct_shape(
        self, student_client, student_with_resume, python_job
    ):
        """Match response includes student_id, total_matches, and matches array with expected fields."""
        response = student_client.post(reverse(self.URL))
        assert "student_id" in response.data
        assert "total_matches" in response.data
        assert "matches" in response.data
        matches = (
            response.data["matches"]
            if "results" not in response.data
            else response.data["results"]
        )
        if matches:
            match = matches[0]
            assert "job_title" in match
            assert "matched_skills" in match
            assert "missing_skills" in match

    def test_match_score_not_exposed_to_student(
        self, student_client, student_with_resume, python_job
    ):
        """Compatibility scores are hidden from students; only employers can see them."""
        response = student_client.post(reverse(self.URL))
        data = response.data
        matches = data.get("matches", data.get("results", []))
        if matches:
            assert "compatibility_score" not in matches[0]


@pytest.mark.django_db
class TestMatchInterestDecline:
    """Tests for POST /api/matches/<id>/interest and POST /api/matches/<id>/decline."""

    def test_student_can_indicate_interest(self, student_client, existing_match):
        """Students can accept a match by calling the interest endpoint."""
        url = reverse(
            "api:indicate-interest", kwargs={"match_id": existing_match.match_id}
        )
        response = student_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        existing_match.refresh_from_db()
        assert existing_match.student_interested is True
        assert existing_match.student_declined is False

    def test_employer_notified_when_student_accepts(
        self, student_client, existing_match, employer_user
    ):
        """When a student accepts, the job's employer receives a student_interested notification."""
        from api.models import Notification

        url = reverse(
            "api:indicate-interest", kwargs={"match_id": existing_match.match_id}
        )
        student_client.post(url)
        assert Notification.objects.filter(
            user=employer_user, type="student interested"
        ).exists()

    def test_student_can_decline_match(self, student_client, existing_match):
        """Students can pass on a match by calling the decline endpoint."""
        url = reverse(
            "api:indicate-decline", kwargs={"match_id": existing_match.match_id}
        )
        response = student_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        existing_match.refresh_from_db()
        assert existing_match.student_declined is True
        assert existing_match.student_interested is False

    def test_interest_on_nonexistent_match_returns_404(self, student_client):
        """Indicating interest on a non-existent match ID returns 404."""
        import uuid

        url = reverse("api:indicate-interest", kwargs={"match_id": uuid.uuid4()})
        response = student_client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_decline_on_nonexistent_match_returns_404(self, student_client):
        """Declining a non-existent match ID returns 404."""
        import uuid

        url = reverse("api:indicate-decline", kwargs={"match_id": uuid.uuid4()})
        response = student_client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_student_cannot_indicate_interest_on_others_match(self, existing_match):
        """A student cannot indicate interest on another student's match."""
        other_user = User.objects.create_user(
            email="anotherstudent@test.com", password="Securepass1", role="student"
        )
        Student.objects.create(user=other_user)
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        url = reverse(
            "api:indicate-interest", kwargs={"match_id": existing_match.match_id}
        )
        response = other_client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestEmployerMatchesView:
    """Tests for GET /api/employer/matches — employer view of their applicant pool."""

    URL = "api:employer-matches"

    def test_employer_can_see_their_matches(self, employer_client, existing_match):
        """Employers can see matches for their job listings."""
        response = employer_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        results = data.get("results", data)
        assert len(results) >= 1

    def test_student_info_anonymized_before_acceptance(
        self, employer_client, existing_match
    ):
        """Student info is anonymized until they indicate interest."""
        response = employer_client.get(reverse(self.URL))
        data = response.data
        results = data.get("results", data)
        assert results[0]["student"]["anonymized"] is True
        assert results[0]["student"]["email"] is None

    def test_student_info_revealed_after_acceptance(
        self, student_client, employer_client, existing_match, student_user
    ):
        """Once a student accepts, their info is visible to the employer."""
        url = reverse(
            "api:indicate-interest", kwargs={"match_id": existing_match.match_id}
        )
        student_client.post(url)
        response = employer_client.get(reverse(self.URL))
        data = response.data
        results = data.get("results", data)
        match_data = next(
            (m for m in results if str(m["match_id"]) == str(existing_match.match_id)),
            None,
        )
        assert match_data is not None
        assert match_data["student"]["anonymized"] is False
        assert match_data["student"]["email"] == student_user.email

    def test_declined_matches_hidden_from_employer(
        self, student_client, employer_client, existing_match
    ):
        """Declined matches are excluded from the employer's match list."""
        url = reverse(
            "api:indicate-decline", kwargs={"match_id": existing_match.match_id}
        )
        student_client.post(url)
        response = employer_client.get(reverse(self.URL))
        data = response.data
        results = data.get("results", data)
        match_ids = [m["match_id"] for m in results]
        assert str(existing_match.match_id) not in match_ids

    def test_student_cannot_view_employer_matches(self, student_client):
        """Students cannot access the employer matches endpoint."""
        response = student_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestJobShortlist:
    """Tests for GET /api/jobs/<job_id>/shortlist — employer shortlist endpoint."""

    def test_employer_can_retrieve_shortlist(
        self, employer_client, python_job, existing_match
    ):
        """Employers can retrieve a shortlist of qualified candidates for their job."""
        url = reverse("api:job-shortlist", kwargs={"job_id": python_job.job_id})
        response = employer_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_shortlist_respects_max_size(
        self, employer_client, employer_user, student_with_resume
    ):
        """Shortlist caps to max_shortlist_size when set."""
        emp = employer_user.employer_profile
        job = Job.objects.create(
            employer=emp,
            title="Capped",
            description="X",
            required_skills=["Python"],
            location="Remote",
            max_shortlist_size=1,
        )
        other_user = User.objects.create_user(
            email="s2@test.com", password="p", role="student"
        )
        other_student = Student.objects.create(user=other_user)
        Match.objects.create(
            student=student_with_resume, job=job, compatibility_score=90.0
        )
        Match.objects.create(student=other_student, job=job, compatibility_score=88.0)
        url = reverse("api:job-shortlist", kwargs={"job_id": job.job_id})
        response = employer_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        results = data.get("results", data)
        assert len(results) <= 1

    def test_other_employer_cannot_see_shortlist(self, python_job):
        """An employer cannot access the shortlist for another employer's job."""
        other_user = User.objects.create_user(
            email="sneaky@test.com", password="p", role="employer"
        )
        Employer.objects.create(user=other_user, company_name="Sneaky")
        sneaky_client = APIClient()
        sneaky_client.force_authenticate(user=other_user)
        url = reverse("api:job-shortlist", kwargs={"job_id": python_job.job_id})
        response = sneaky_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
