import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from api.models import Employer, Job, Match, Notification, Student, User


@pytest.fixture
def employer_user(db):
    user = User.objects.create_user(
        email="employer_test@test.com", password="Securepass1", role="employer"
    )
    Employer.objects.create(user=user, company_name="Acme Corp")
    return user


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student_test@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(user=user)
    return user


@pytest.fixture
def open_job(employer_user):
    emp = employer_user.employer_profile
    return Job.objects.create(
        employer=emp,
        title="Software Engineer",
        description="Build things.",
        required_skills=["Python", "Django"],
        location="Remote",
        contract_type="internship",
        recruitment_slots=2,
        is_open=True,
    )


@pytest.mark.django_db
class TestEmploymentDismissal:
    def test_employ_candidate(
        self, employer_client, employer_user, student_user, open_job
    ):
        student = student_user.student_profile
        match = Match.objects.create(
            job=open_job, student=student, compatibility_score=85.0
        )

        url = reverse("api:match-employ", kwargs={"pk": match.match_id})
        response = employer_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        open_job.refresh_from_db()

        assert match.status == "employed"
        assert open_job.hired_count == 1
        assert open_job.is_open is True

        assert Notification.objects.filter(
            user=student_user, type="employment confirmed"
        ).exists()

    def test_job_closes_when_filled(
        self, employer_client, employer_user, student_user, open_job
    ):
        student = student_user.student_profile
        open_job.recruitment_slots = 1
        open_job.save()

        match = Match.objects.create(
            job=open_job, student=student, compatibility_score=85.0
        )

        url = reverse("api:match-employ", kwargs={"pk": match.match_id})
        employer_client.post(url)

        open_job.refresh_from_db()
        assert open_job.hired_count == 1
        assert open_job.is_open is False

    def test_dismiss_candidate(
        self, employer_client, employer_user, student_user, open_job
    ):
        student = student_user.student_profile
        match = Match.objects.create(
            job=open_job, student=student, compatibility_score=85.0
        )

        url = reverse("api:match-dismiss", kwargs={"pk": match.match_id})
        response = employer_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.status == "dismissed"

    def test_matching_engine_filters_dismissed(self, student_user, open_job):
        from services.matching_engine import MatchingEngine

        student = student_user.student_profile

        Match.objects.create(
            job=open_job, student=student, compatibility_score=85.0, status="dismissed"
        )

        engine = MatchingEngine()
        result = engine.calculate_match_for_student(student, open_job)

        assert result["score"] == 0.0
        assert result["failed_filter"] == "dismissed"
