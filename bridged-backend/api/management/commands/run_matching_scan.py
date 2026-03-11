"""
Management command: run_matching_scan

Iterates through every student with a completed resume and runs the matching
engine against all currently open jobs.  Existing matches are updated with the
latest score; new matches are inserted.  Students with at least one newly
visible match (score >= SHOW_THRESHOLD) receive an in-app notification.

Usage:
    python manage.py run_matching_scan

The scheduler (scheduler.py) calls this via django.core.management.call_command
twice a day (08:00 and 20:00 server time).
"""

import logging

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

STORE_THRESHOLD = 50
SHOW_THRESHOLD = 85


class Command(BaseCommand):
    help = "Scan all students with completed resumes and update/create job matches."

    def handle(self, *args, **options):
        from api.models import Job, Match, Notification, Resume, Student
        from services.matching_engine import MatchingEngine, _skills_from_parsed_data

        self.stdout.write("Starting matching scan…")
        logger.info("Periodic matching scan started.")

        students = Student.objects.select_related("user", "resume").filter(
            resume__status=Resume.STATUS_COMPLETED
        )

        now = timezone.now()
        expired_count = Job.objects.filter(
            is_open=True, application_deadline__lt=now
        ).update(is_open=False)
        if expired_count > 0:
            self.stdout.write(f"Closed {expired_count} expired job(s).")
            logger.info(f"Periodic scan: closed {expired_count} expired job(s).")

        open_jobs = list(Job.objects.open_for_applications())

        if not open_jobs:
            self.stdout.write("No open jobs — scan complete.")
            logger.info("Periodic scan: no open jobs, nothing to do.")
            return

        engine = MatchingEngine()
        total_students = students.count()
        notified = 0
        updated = 0

        for student in students:
            try:
                resume = student.resume
                student_skills = _skills_from_parsed_data(resume.parsed_data or {})
                new_visible = 0

                for job in open_jobs:
                    match_result = engine.calculate_match(
                        student_skills, job.required_skills, job.nice_to_have_skills
                    )
                    score = match_result["score"]

                    if score >= STORE_THRESHOLD:
                        _, created = Match.objects.update_or_create(
                            student=student,
                            job=job,
                            defaults={"compatibility_score": score},
                        )
                        if created and score >= SHOW_THRESHOLD:
                            new_visible += 1
                        updated += 1

                if new_visible > 0:
                    Notification.objects.create(
                        user=student.user,
                        type="new match",
                        message=(
                            f"You have {new_visible} new job match"
                            f"{'es' if new_visible != 1 else ''} available. "
                            "Head to Matches to review them."
                        ),
                    )
                    notified += 1

            except Exception as exc:
                logger.exception(
                    "Scan error for student %s: %s", student.student_id, exc
                )

        summary = (
            f"Scan complete — {total_students} students processed, "
            f"{updated} match records updated, {notified} students notified."
        )
        self.stdout.write(summary)
        logger.info(summary)
