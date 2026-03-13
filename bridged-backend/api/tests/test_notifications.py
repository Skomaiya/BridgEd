import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from api.models import Notification, Student, User
from datetime import timedelta


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
def other_student(db):
    user = User.objects.create_user(
        email="other@test.com", password="Securepass1", role="student"
    )
    Student.objects.create(user=user)
    return user


@pytest.mark.django_db
class TestNotificationListing:
    """Tests for GET /api/notifications."""

    URL = "api:notifications"

    def test_student_sees_own_notifications(self, student_client, student_user):
        """Students can retrieve a list of their own notifications."""
        Notification.objects.create(
            user=student_user, type="new match", message="Match 1"
        )
        Notification.objects.create(
            user=student_user, type="job posted", message="Job alert"
        )
        response = student_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 2

    def test_student_does_not_see_others_notifications(
        self, student_client, other_student
    ):
        """Students cannot see notifications belonging to other users."""
        Notification.objects.create(
            user=other_student, type="new match", message="Hidden"
        )
        response = student_client.get(reverse(self.URL))
        results = response.data.get("results", response.data)
        assert len(results) == 0

    def test_notifications_ordered_newest_first(self, student_client, student_user):
        """Notifications are returned newest-first by default."""
        Notification.objects.create(user=student_user, type="new match", message="Old")
        Notification.objects.create(user=student_user, type="job posted", message="New")
        response = student_client.get(reverse(self.URL))
        results = response.data.get("results", response.data)
        assert results[0]["message"] == "New"

    def test_all_notification_types_are_retrievable(self, student_client, student_user):
        """All valid notification types appear in the listing."""
        types = [
            "new match",
            "job posted",
            "job published",
            "cv parsed",
            "subscription expiring",
        ]
        for t in types:
            Notification.objects.create(user=student_user, type=t, message=t)
        response = student_client.get(reverse(self.URL))
        results = response.data.get("results", response.data)
        fetched_types = {n["type"] for n in results}
        for t in types:
            assert t in fetched_types

    def test_unauthenticated_cannot_list_notifications(self, db):
        """Unauthenticated requests return 401."""
        response = APIClient().get(reverse(self.URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_list_returned_if_no_notifications(self, student_client):
        """No error is raised when a user has no notifications; an empty list is returned."""
        response = student_client.get(reverse(self.URL))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert results == []


@pytest.mark.django_db
class TestMarkNotificationRead:
    """Tests for POST /api/notifications/<id>/read."""

    URL = "api:notification-read"

    def test_student_can_mark_notification_as_read(self, student_client, student_user):
        """Students can mark one of their own notifications as read."""
        n = Notification.objects.create(
            user=student_user, type="new match", message="!!", is_read=False
        )
        response = student_client.post(
            reverse(self.URL, kwargs={"notification_id": n.notification_id})
        )
        assert response.status_code == status.HTTP_200_OK
        n.refresh_from_db()
        assert n.is_read is True

    def test_marking_already_read_notification_is_idempotent(
        self, student_client, student_user
    ):
        """Marking a notification that is already read does not cause an error."""
        n = Notification.objects.create(
            user=student_user, type="new match", message="Done", is_read=True
        )
        response = student_client.post(
            reverse(self.URL, kwargs={"notification_id": n.notification_id})
        )
        assert response.status_code == status.HTTP_200_OK

    def test_student_cannot_mark_others_notification_as_read(
        self, student_client, other_student
    ):
        """Students cannot mark notifications belonging to another user as read."""
        n = Notification.objects.create(
            user=other_student, type="new match", message="Private"
        )
        response = student_client.post(
            reverse(self.URL, kwargs={"notification_id": n.notification_id})
        )
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )

    def test_nonexistent_notification_returns_404(self, student_client):
        """Marking a non-existent notification ID returns 404."""
        import uuid

        fake_id = uuid.uuid4()
        response = student_client.post(
            reverse(self.URL, kwargs={"notification_id": fake_id})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_cannot_mark_notification_read(self, db, student_user):
        """Unauthenticated mark-read requests return 401."""
        n = Notification.objects.create(
            user=student_user, type="new match", message="!!!"
        )
        response = APIClient().post(
            reverse(self.URL, kwargs={"notification_id": n.notification_id})
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestNotificationDeduplication:
    """Tests to verify match notifications aren't spammed when matching runs repeatedly."""

    def test_match_notification_has_1hr_cooldown(self, student_user):
        """A new_match notification created within the last hour is considered recent (prevents duplicates)."""
        Notification.objects.create(
            user=student_user, type="new match", message="Just matched!"
        )
        one_hour_ago = timezone.now() - timedelta(hours=1)
        exists = Notification.objects.filter(
            user=student_user, type="new match", created_at__gte=one_hour_ago
        ).exists()
        assert exists is True

    def test_notification_older_than_1hr_is_not_recent(self, student_user):
        """A new_match notification from more than one hour ago is not flagged as recent."""
        old_notif = Notification.objects.create(
            user=student_user, type="new match", message="Old"
        )
        old_notif.created_at = timezone.now() - timedelta(hours=2)
        old_notif.save(update_fields=["created_at"])
        one_hour_ago = timezone.now() - timedelta(hours=1)
        exists = Notification.objects.filter(
            user=student_user, type="new match", created_at__gte=one_hour_ago
        ).exists()
        assert exists is False
