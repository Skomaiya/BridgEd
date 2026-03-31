"""
Load level-balanced test jobs for matching evaluation.

Reads `api.data.jobs_data.JOBS_DATA` and **inserts only** jobs that do not
already exist for this employer (same title = skipped). Existing jobs are
**never** deleted or overwritten.

Usage:
  python manage.py load_jobs
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from api.data.jobs_data import JOBS_DATA
from api.models import Employer, Job

User = get_user_model()

EMPLOYER_EMAIL = "i.kewa@alustudent.com"
EMPLOYER_PASSWORD = "password"


class Command(BaseCommand):
    help = (
        "Insert jobs from JOBS_DATA for an existing employer; skips existing titles; "
        "never deletes jobs."
    )

    def handle(self, *args, **options):
        employer_email = EMPLOYER_EMAIL.strip()
        employer_password = EMPLOYER_PASSWORD

        if not employer_email or not employer_password:
            raise CommandError(
                "Set EMPLOYER_EMAIL and EMPLOYER_PASSWORD in load_jobs.py."
            )

        user = User.objects.filter(email=employer_email).first()
        if not user:
            raise CommandError(
                f"No user found for '{employer_email}'. Use an existing employer account."
            )
        if user.role != "employer":
            raise CommandError(f"User '{employer_email}' is not an employer account.")
        if not user.check_password(employer_password):
            raise CommandError(
                "Employer password is invalid. Update EMPLOYER_PASSWORD."
            )

        employer = Employer.objects.filter(user=user).first()
        if not employer:
            raise CommandError(
                f"Employer profile missing for '{employer_email}'. Complete employer setup first."
            )

        created_count = 0
        skipped = 0
        now = timezone.now()
        for job_data in JOBS_DATA:
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
                contract_type=job_data.get("contract_type", "internship"),
                job_length=job_data.get("job_length", ""),
                is_open=True,
                published_at=now,
                application_deadline=now
                + timedelta(days=job_data.get("days_to_deadline", 30)),
                max_shortlist_size=job_data.get("max_shortlist_size"),
                recruitment_slots=job_data.get("recruitment_slots", 1),
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count} job(s) for {employer_email}, skipped {skipped} (already exist)."
            )
        )
