"""
Load 20 dummy jobs for testing the matching engine.

Creates a test employer if needed, then creates all jobs from api.data.dummy_jobs_data.
Existing open jobs from the same employer are left as-is; duplicate titles are skipped
unless --replace is used.

Usage:
  python manage.py load_dummy_jobs
  python manage.py load_dummy_jobs --replace   # replace existing dummy jobs by title
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from api.data.dummy_jobs_data import DUMMY_JOBS
from api.models import Employer, Job

User = get_user_model()

TEST_EMPLOYER_EMAIL = "dummy-jobs@bridged-test.local"
TEST_COMPANY_NAME = "BridgEd Test Company (Dummy Jobs)"


class Command(BaseCommand):
    help = "Load 20 dummy jobs for testing matching (creates test employer if needed)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing jobs from test employer that match dummy job titles before creating.",
        )

    def handle(self, *args, **options):
        replace = options["replace"]

        user, created = User.objects.get_or_create(
            email=TEST_EMPLOYER_EMAIL,
            defaults={"role": "employer"},
        )
        if created:
            user.set_password("test-dummy-jobs")
            user.save()
            self.stdout.write(f"Created test user: {TEST_EMPLOYER_EMAIL}")

        employer, emp_created = Employer.objects.get_or_create(
            user=user,
            defaults={"company_name": TEST_COMPANY_NAME},
        )
        if emp_created:
            self.stdout.write(f"Created test employer: {TEST_COMPANY_NAME}")

        if replace:
            titles = [j["title"] for j in DUMMY_JOBS]
            deleted, _ = Job.objects.filter(
                employer=employer, title__in=titles
            ).delete()
            if deleted:
                self.stdout.write(
                    self.style.WARNING(f"Replaced {deleted} existing job(s).")
                )

        created_count = 0
        skipped = 0
        for job_data in DUMMY_JOBS:
            if Job.objects.filter(employer=employer, title=job_data["title"]).exists():
                skipped += 1
                continue
            Job.objects.create(
                employer=employer,
                title=job_data["title"],
                description=job_data["description"],
                required_skills=job_data["required_skills"],
                nice_to_have_skills=job_data["nice_to_have_skills"],
                location=job_data["location"],
                is_open=True,
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count} dummy job(s), skipped {skipped} (already exist)."
            )
        )
