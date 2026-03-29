"""
Tests for the Direct Messaging System
Tests Conversation creation, message sending, read-marking,
permission enforcement, and validation.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from api.models import (
    Conversation,
    Employer,
    Job,
    Match,
    Message,
    Notification,
    Student,
    User,
)


@pytest.fixture
def student_user(db):
    """A student user with a complete student profile."""
    user = User.objects.create_user(
        email="msg_student@test.com",
        password="testpass123",
        role="student",
    )
    Student.objects.create(user=user, display_name="Test Student")
    return user


@pytest.fixture
def employer_user(db):
    """An employer user with a complete employer profile."""
    user = User.objects.create_user(
        email="msg_employer@test.com",
        password="testpass123",
        role="employer",
    )
    Employer.objects.create(user=user, company_name="Test Corp")
    return user


@pytest.fixture
def student_profile(student_user):
    return student_user.student_profile


@pytest.fixture
def employer_profile(employer_user):
    return employer_user.employer_profile


@pytest.fixture
def employer_job(employer_profile):
    return Job.objects.create(
        employer=employer_profile,
        title="Python Backend Dev",
        description="Write Django code.",
        required_skills=["Python"],
        location="Remote",
        is_open=True,
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def employer_client(employer_user):
    client = APIClient()
    client.force_authenticate(user=employer_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def accepted_match(student_profile, employer_job):
    """A Match where the student has expressed interest (accepted)."""
    return Match.objects.create(
        student=student_profile,
        job=employer_job,
        compatibility_score=90.0,
        student_interested=True,
        student_declined=False,
    )


@pytest.fixture
def pending_match(student_profile, employer_job):
    """A Match where the student has NOT yet accepted."""
    return Match.objects.create(
        student=student_profile,
        job=employer_job,
        compatibility_score=85.0,
        student_interested=False,
        student_declined=False,
    )


@pytest.fixture
def existing_conversation(accepted_match, employer_profile, student_profile):
    """An existing Conversation between employer and student."""
    return Conversation.objects.create(
        employer=employer_profile,
        student=student_profile,
    )


@pytest.mark.django_db
class TestStartConversation:
    """Employers start conversations; students cannot."""

    def test_employer_can_start_conversation_for_accepted_match(
        self, employer_client, accepted_match
    ):
        response = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED), (
            f"Expected 200 or 201 when employer starts conversation, "
            f"got {response.status_code}: {response.data}"
        )
        assert (
            "conversation_id" in response.data
        ), f"Response missing 'conversation_id': {response.data}"

    def test_starting_conversation_sends_notification_to_student(
        self, employer_client, accepted_match, student_user
    ):
        employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        notification_exists = Notification.objects.filter(
            user=student_user,
            type="new message",
        ).exists()
        assert (
            notification_exists
        ), "Starting a conversation should send a 'new message' notification to the student"

    def test_starting_conversation_twice_returns_same_conversation(
        self, employer_client, accepted_match
    ):
        """Idempotent: POSTing the same match_id twice returns the same conversation."""
        response1 = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        response2 = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        assert response1.data["conversation_id"] == response2.data["conversation_id"], (
            "Two POSTs for the same match should return the same conversation_id, "
            f"but got {response1.data['conversation_id']} and {response2.data['conversation_id']}"
        )

    def test_different_accepted_matches_same_student_reuse_one_conversation(
        self, employer_client, employer_profile, student_profile, accepted_match
    ):
        """One DM thread per employer–student pair, regardless of which job/match opened it."""
        r1 = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        assert r1.status_code == status.HTTP_200_OK
        conv_id = r1.data["conversation_id"]

        other_job = Job.objects.create(
            employer=employer_profile,
            title="Data Analyst",
            description="Analyze data.",
            required_skills=["SQL"],
            location="Remote",
            is_open=True,
        )
        other_match = Match.objects.create(
            student=student_profile,
            job=other_job,
            compatibility_score=88.0,
            student_interested=True,
            student_declined=False,
        )
        r2 = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(other_match.match_id)},
            format="json",
        )
        assert r2.status_code == status.HTTP_200_OK
        assert (
            r2.data["conversation_id"] == conv_id
        ), "A second accepted match with the same student should reuse the existing conversation."
        assert (
            Conversation.objects.filter(
                student=student_profile, employer=employer_profile
            ).count()
            == 1
        ), (
            f"Expected exactly 1 Conversation for the pair, "
            f"found {Conversation.objects.filter(student=student_profile, employer=employer_profile).count()}"
        )

    def test_employer_cannot_start_conversation_for_pending_match(
        self, employer_client, pending_match
    ):
        """Student has not accepted — employer cannot message yet."""
        response = employer_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(pending_match.match_id)},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_400_BAD_REQUEST
        ), f"Expected 400 for unaccepted match, got {response.status_code}: {response.data}"

    def test_student_cannot_initiate_conversation(self, student_client, accepted_match):
        response = student_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_403_FORBIDDEN
        ), f"Expected 403 when student tries to initiate, got {response.status_code}: {response.data}"

    def test_employer_cannot_start_conversation_without_match_id(self, employer_client):
        response = employer_client.post(
            reverse("api:conversation-list"), {}, format="json"
        )
        assert (
            response.status_code == status.HTTP_400_BAD_REQUEST
        ), f"Expected 400 when match_id is missing, got {response.status_code}: {response.data}"

    def test_unauthenticated_user_cannot_start_conversation(
        self, api_client, accepted_match
    ):
        response = api_client.post(
            reverse("api:conversation-list"),
            {"match_id": str(accepted_match.match_id)},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_401_UNAUTHORIZED
        ), f"Expected 401 for unauthenticated request, got {response.status_code}"


@pytest.mark.django_db
class TestListConversations:
    """Users only see their own conversations."""

    def test_employer_sees_their_own_conversations(
        self, employer_client, existing_conversation
    ):
        response = employer_client.get(reverse("api:conversation-list"))
        assert (
            response.status_code == status.HTTP_200_OK
        ), f"Expected 200 listing conversations, got {response.status_code}: {response.data}"
        conversation_ids = [c["conversation_id"] for c in response.data]
        assert str(existing_conversation.conversation_id) in conversation_ids, (
            f"Employer should see their own conversation_id "
            f"({existing_conversation.conversation_id}) in the list, "
            f"but got: {conversation_ids}"
        )

    def test_student_sees_their_own_conversations(
        self, student_client, existing_conversation
    ):
        response = student_client.get(reverse("api:conversation-list"))
        assert (
            response.status_code == status.HTTP_200_OK
        ), f"Expected 200 listing conversations for student, got {response.status_code}"
        conversation_ids = [c["conversation_id"] for c in response.data]
        assert str(existing_conversation.conversation_id) in conversation_ids, (
            f"Student should see their own conversation in the list, "
            f"but it was absent: {conversation_ids}"
        )

    def test_conversation_list_includes_unread_count(
        self, employer_client, existing_conversation, student_user
    ):
        """Unread count reflects messages not yet read by the requesting user."""
        Message.objects.create(
            conversation=existing_conversation,
            sender=student_user,
            body="Hello employer!",
        )
        response = employer_client.get(reverse("api:conversation-list"))
        assert response.status_code == status.HTTP_200_OK
        conv_data = next(
            c
            for c in response.data
            if c["conversation_id"] == str(existing_conversation.conversation_id)
        )
        assert conv_data["unread_count"] == 1, (
            f"Expected unread_count=1 for employer who hasn't read student's message, "
            f"got {conv_data['unread_count']}"
        )

    def test_conversation_list_includes_last_message_preview(
        self, employer_client, existing_conversation, student_user
    ):
        MESSAGE_BODY = "Very excited about this opportunity!"
        Message.objects.create(
            conversation=existing_conversation,
            sender=student_user,
            body=MESSAGE_BODY,
        )
        response = employer_client.get(reverse("api:conversation-list"))
        conv_data = next(
            c
            for c in response.data
            if c["conversation_id"] == str(existing_conversation.conversation_id)
        )
        assert (
            conv_data["last_message"] is not None
        ), "last_message should not be None when messages exist"
        assert (
            MESSAGE_BODY[:80] in conv_data["last_message"]["body"]
        ), f"last_message.body should contain the message text, got: {conv_data['last_message']}"

    def test_conversation_list_empty_when_no_conversations(self, employer_client):
        response = employer_client.get(reverse("api:conversation-list"))
        assert response.status_code == status.HTTP_200_OK
        assert (
            response.data == []
        ), f"Expected empty list when employer has no conversations, got {response.data}"


@pytest.mark.django_db
class TestMessages:
    """Send and retrieve messages; permissions are enforced."""

    def messages_url(self, conversation_id):
        return reverse(
            "api:conversation-messages", kwargs={"conversation_id": conversation_id}
        )

    def test_employer_can_send_message(self, employer_client, existing_conversation):
        BODY = "Hi! Are you available for an interview?"
        response = employer_client.post(
            self.messages_url(existing_conversation.conversation_id),
            {"body": BODY},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_201_CREATED
        ), f"Expected 201 when employer sends message, got {response.status_code}: {response.data}"
        assert (
            response.data["body"] == BODY
        ), f"Message body mismatch — expected '{BODY}', got '{response.data['body']}'"

    def test_student_can_send_reply(
        self, student_client, existing_conversation, employer_user
    ):
        Message.objects.create(
            conversation=existing_conversation,
            sender=employer_user,
            body="Are you available?",
        )
        response = student_client.post(
            self.messages_url(existing_conversation.conversation_id),
            {"body": "Yes, I am available next week!"},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_201_CREATED
        ), f"Expected 201 when student replies, got {response.status_code}: {response.data}"

    def test_sending_message_notifies_recipient(
        self, employer_client, existing_conversation, student_user
    ):
        employer_client.post(
            self.messages_url(existing_conversation.conversation_id),
            {"body": "We would love to invite you for an interview."},
            format="json",
        )
        assert Notification.objects.filter(
            user=student_user, type="new message"
        ).exists(), "Sending a message should create a 'new message' notification for the recipient (student)"

    def test_employer_can_read_messages(
        self, employer_client, existing_conversation, student_user
    ):
        MESSAGE_BODY = "Looking forward to hearing from you!"
        Message.objects.create(
            conversation=existing_conversation,
            sender=student_user,
            body=MESSAGE_BODY,
        )
        response = employer_client.get(
            self.messages_url(existing_conversation.conversation_id)
        )
        assert (
            response.status_code == status.HTTP_200_OK
        ), f"Expected 200 reading messages, got {response.status_code}: {response.data}"
        assert (
            len(response.data) == 1
        ), f"Expected 1 message in thread, got {len(response.data)}: {response.data}"
        assert (
            response.data[0]["body"] == MESSAGE_BODY
        ), f"Message body mismatch: expected '{MESSAGE_BODY}', got '{response.data[0]['body']}'"

    def test_reading_messages_marks_them_as_read(
        self, employer_client, existing_conversation, student_user
    ):
        """GET /messages/ marks unread messages from the other party as read."""
        unread_message = Message.objects.create(
            conversation=existing_conversation,
            sender=student_user,
            body="Unread message",
            is_read=False,
        )
        employer_client.get(self.messages_url(existing_conversation.conversation_id))
        unread_message.refresh_from_db()
        assert unread_message.is_read is True, (
            "Reading the message thread should mark the student's message as is_read=True for the employer, "
            f"but is_read is still False"
        )

    def test_cannot_send_empty_message(self, employer_client, existing_conversation):
        response = employer_client.post(
            self.messages_url(existing_conversation.conversation_id),
            {"body": "   "},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_400_BAD_REQUEST
        ), f"Expected 400 for empty/whitespace body, got {response.status_code}: {response.data}"

    def test_cannot_send_message_exceeding_character_limit(
        self, employer_client, existing_conversation
    ):
        TOO_LONG_BODY = "x" * 4001
        response = employer_client.post(
            self.messages_url(existing_conversation.conversation_id),
            {"body": TOO_LONG_BODY},
            format="json",
        )
        assert (
            response.status_code == status.HTTP_400_BAD_REQUEST
        ), f"Expected 400 for body exceeding 4000 chars, got {response.status_code}: {response.data}"

    def test_outsider_employer_cannot_access_another_employers_conversation(
        self, existing_conversation
    ):
        """A second employer who is not part of the conversation cannot see messages."""
        other_user = User.objects.create_user(
            email="outsider_employer@test.com",
            password="testpass123",
            role="employer",
        )
        Employer.objects.create(user=other_user, company_name="Outsider Corp")
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=other_user)
        response = outsider_client.get(
            self.messages_url(existing_conversation.conversation_id)
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND, (
            f"Expected 404 for outsider accessing another employer's conversation, "
            f"got {response.status_code}: {response.data}"
        )

    def test_unauthenticated_cannot_read_messages(
        self, api_client, existing_conversation
    ):
        response = api_client.get(
            self.messages_url(existing_conversation.conversation_id)
        )
        assert (
            response.status_code == status.HTTP_401_UNAUTHORIZED
        ), f"Expected 401 for unauthenticated request, got {response.status_code}"

    def test_messages_are_returned_in_chronological_order(
        self, employer_client, existing_conversation, student_user, employer_user
    ):
        Message.objects.create(
            conversation=existing_conversation, sender=employer_user, body="First"
        )
        Message.objects.create(
            conversation=existing_conversation, sender=student_user, body="Second"
        )
        Message.objects.create(
            conversation=existing_conversation, sender=employer_user, body="Third"
        )
        response = employer_client.get(
            self.messages_url(existing_conversation.conversation_id)
        )
        assert response.status_code == status.HTTP_200_OK
        bodies = [m["body"] for m in response.data]
        assert bodies == [
            "First",
            "Second",
            "Third",
        ], f"Messages should be in chronological order (oldest first), but got: {bodies}"
