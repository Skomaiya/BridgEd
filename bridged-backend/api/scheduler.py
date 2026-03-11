"""
BridgEd background scheduler — twice-daily matching scan.

Runs `run_matching_scan` management command at 08:00 and 20:00 server time.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def start():
    """Start the APScheduler background scheduler if enabled."""
    enabled = getattr(settings, "MATCHING_SCHEDULER_ENABLED", True)
    if not enabled:
        logger.info(
            "Matching scheduler disabled via settings. Skipping scheduler startup."
        )
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from django.core.management import call_command
    except ImportError:
        logger.warning(
            "APScheduler not installed. Periodic matching scan will not run. "
        )
        return

    def run_scan():
        logger.info("Scheduler: triggering run_matching_scan…")
        try:
            call_command("run_matching_scan")
        except Exception as exc:
            logger.exception("Scheduler: run_matching_scan failed: %s", exc)

    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        run_scan,
        CronTrigger(hour=8, minute=0),
        id="matching_scan_morning",
        replace_existing=True,
    )
    scheduler.add_job(
        run_scan,
        CronTrigger(hour=20, minute=0),
        id="matching_scan_evening",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Matching scheduler started — scans at 08:00 and 20:00 UTC.")
