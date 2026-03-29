"""
Management command: run_matching_scan

Iterates through every student with a completed resume and runs the full
matching pipeline (location, contract, contextual LLM when enabled) against
all currently open jobs. Existing matches are updated with the latest score;
new matches are inserted. Students receive tiered in-app notifications when
new matches appear (strong ≥85% vs expanded 70–84%).

Usage:
    python manage.py run_matching_scan

The scheduler (scheduler.py) calls this via django.core.management.call_command
twice a day (08:00 and 20:00 server time).
"""

import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)

STORE_THRESHOLD = 70
SHOW_THRESHOLD = 85


class Command(BaseCommand):
    help = "Scan all students with completed resumes and update/create job matches."

    def handle(self, *args, **options):
        from api.models import Job, Match, Notification, Resume, Student
        from services.matching_engine import MatchingEngine

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
                new_strong = 0
                new_moderate = 0

                resume = student.resume
                pd = resume.parsed_data or {}
                for job in open_jobs:
                    match_result = engine.calculate_match_for_student(
                        student, job, parsed_data=pd
                    )
                    score = match_result["score"]

                    if score < STORE_THRESHOLD:
                        continue

                    _, created = Match.objects.update_or_create(
                        student=student,
                        job=job,
                        defaults={"compatibility_score": score},
                    )
                    updated += 1
                    if created:
                        if score >= SHOW_THRESHOLD:
                            new_strong += 1
                        else:
                            new_moderate += 1

                if new_strong > 0:
                    Notification.objects.create(
                        user=student.user,
                        type="new match",
                        message=(
                            f"You have {new_strong} new strong job match"
                            f"{'es' if new_strong != 1 else ''} (85%+). "
                            "Head to Matches to review them."
                        ),
                    )
                    notified += 1
                elif new_moderate > 0:
                    Notification.objects.create(
                        user=student.user,
                        type="new match",
                        message=(
                            f"You have {new_moderate} additional job match"
                            f"{'es' if new_moderate != 1 else ''} (expanded threshold). "
                            "Review them in Matches — contextual scoring still applies."
                        ),
                    )
                    notified += 1

            except Exception as exc:
                logger.exception(
                    "Scan error for student %s: %s", student.student_id, exc
                )

        summary = (
            f"Scan complete — {total_students} students processed, "
            f"{updated} match records upserted, {notified} students notified."
        )
        self.stdout.write(summary)
        logger.info(summary)
