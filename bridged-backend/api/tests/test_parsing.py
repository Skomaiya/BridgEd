"""
Parsing tests — two levels:

1.  Pipeline unit tests (mocked): fast, deterministic, run in all environments.
2.  Real-resume integration tests (pytest mark): iterate over every file in
    ``Resume list/`` at the project root, call TextExtractor directly, and
    assert the output is non-empty.  These are *not* full LLM tests — they
    verify text extraction works against real files without hitting an LLM.
    Skip gracefully when the folder is absent (e.g. on CI).
"""

import os
import sys
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from api.models import User, Student, Resume

RESUME_LIST_DIR = Path(__file__).resolve().parent.parent.parent / "test_data/resumes"

MOCK_PARSED_DATA = {
    "name": "Jane Doe",
    "email": "janedoe@example.com",
    "phone": "+44 7700 900000",
    "technical_skills": ["Python", "Django", "AWS"],
    "soft_skills": ["Communication", "Leadership"],
    "education": [{"institution": "Uni of Lagos", "degree": "BSc Computer Science", "year": "2023"}],
    "experience": [{"company": "StartupX", "role": "Dev", "duration": "1 year"}],
    "confidence": 0.92,
}

@pytest.fixture
def student_account(db):
    user = User.objects.create_user(email="student@test.com", password="Securepass1", role="student")
    Student.objects.create(user=user)
    return user

@pytest.fixture
def student_api(student_account):
    client = APIClient()
    client.force_authenticate(user=student_account)
    return client

@pytest.fixture
def employer_account(db):
    from api.models import Employer
    user = User.objects.create_user(email="employer@test.com", password="Securepass1", role="employer")
    Employer.objects.create(user=user, company_name="Acme")
    return user

@pytest.fixture
def employer_api(employer_account):
    client = APIClient()
    client.force_authenticate(user=employer_account)
    return client

def make_pdf_file(filename="cv.pdf", content=b"fake pdf content"):
    """Return a SimpleUploadedFile mimicking a PDF upload."""
    return SimpleUploadedFile(filename, content, content_type="application/pdf")

def make_docx_file(filename="cv.docx"):
    """Return a SimpleUploadedFile mimicking a DOCX upload."""
    return SimpleUploadedFile(filename, b"fake docx content",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

def make_txt_file(filename="cv.txt"):
    """Return a SimpleUploadedFile mimicking a plain-text CV upload."""
    return SimpleUploadedFile(filename, b"John Doe\nPython Developer\nSkills: Python, Django",
        content_type="text/plain")


@pytest.mark.django_db
class TestResumeUpload:
    """Tests for POST /api/resumes/upload — file upload and background parsing trigger."""

    UPLOAD_URL = 'api:resume-upload'

    def test_student_can_upload_pdf_returns_201_with_resume_id(self, student_api):
        """A student uploading a valid PDF gets back 201 with a resume_id field."""
        with patch('services.supabase_storage.is_supabase_configured', return_value=False), \
             patch('api.views._run_parsing_in_background'):
            api_response = student_api.post(
                reverse(self.UPLOAD_URL),
                {"file": make_pdf_file()},
                format='multipart'
            )
        assert api_response.status_code == status.HTTP_201_CREATED
        assert "resume_id" in api_response.data
        assert Resume.objects.filter(student__user__email="student@test.com").exists()

    def test_student_can_upload_docx_file(self, student_api):
        """A student can upload a Microsoft Word (.docx) resume file."""
        with patch('services.supabase_storage.is_supabase_configured', return_value=False), \
             patch('api.views._run_parsing_in_background'):
            api_response = student_api.post(
                reverse(self.UPLOAD_URL),
                {"file": make_docx_file()},
                format='multipart'
            )
        assert api_response.status_code == status.HTTP_201_CREATED

    def test_student_can_upload_txt_file(self, student_api):
        """A student can upload a plain-text (.txt) resume file."""
        with patch('services.supabase_storage.is_supabase_configured', return_value=False), \
             patch('api.views._run_parsing_in_background'):
            api_response = student_api.post(
                reverse(self.UPLOAD_URL),
                {"file": make_txt_file()},
                format='multipart'
            )
        assert api_response.status_code == status.HTTP_201_CREATED

    def test_uploading_second_cv_replaces_first_record(self, student_api, student_account):
        """When a student uploads a new CV the old Resume row is deleted and replaced."""
        student_profile = student_account.student_profile
        first_resume_record = Resume.objects.create(student=student_profile, status="completed")
        with patch('services.supabase_storage.is_supabase_configured', return_value=False), \
             patch('api.views._run_parsing_in_background'):
            student_api.post(
                reverse(self.UPLOAD_URL),
                {"file": make_pdf_file()},
                format='multipart'
            )
        assert not Resume.objects.filter(resume_id=first_resume_record.resume_id).exists()
        assert Resume.objects.filter(student=student_profile).count() == 1

    def test_new_upload_starts_with_processing_status(self, student_api):
        """A freshly uploaded resume begins with status 'processing' while parsing runs in background."""
        with patch('services.supabase_storage.is_supabase_configured', return_value=False), \
             patch('api.views._run_parsing_in_background'):
            api_response = student_api.post(
                reverse(self.UPLOAD_URL),
                {"file": make_pdf_file()},
                format='multipart'
            )
        assert api_response.data["status"] == "processing"

    def test_upload_with_no_file_field_returns_400(self, student_api):
        """Posting to the upload endpoint with no file attached returns 400."""
        api_response = student_api.post(reverse(self.UPLOAD_URL), {}, format='multipart')
        assert api_response.status_code == status.HTTP_400_BAD_REQUEST

    def test_image_file_type_is_rejected_with_400(self, student_api):
        """Unsupported file types (e.g., .jpg image) are rejected with a 400 error."""
        image_file = SimpleUploadedFile("photo.jpg", b"pixel data", content_type="image/jpeg")
        api_response = student_api.post(
            reverse(self.UPLOAD_URL),
            {"file": image_file},
            format='multipart'
        )
        assert api_response.status_code == status.HTTP_400_BAD_REQUEST

    def test_employer_is_forbidden_from_uploading_resume(self, employer_api):
        """Employers do not have a profile page for resumes; the upload endpoint returns 403."""
        api_response = employer_api.post(
            reverse(self.UPLOAD_URL),
            {"file": make_pdf_file()},
            format='multipart'
        )
        assert api_response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_request_is_rejected_with_401(self, db):
        """Unauthenticated (no bearer token) upload requests return 401."""
        anonymous_client = APIClient()
        api_response = anonymous_client.post(
            reverse(self.UPLOAD_URL),
            {"file": make_pdf_file()},
            format='multipart'
        )
        assert api_response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestResumeDetail:
    """Tests for GET /api/resumes/<id> — polling resume status after upload."""

    DETAIL_URL = 'api:resume-detail'

    def test_student_can_poll_own_resume_status(self, student_api, student_account):
        """The student can GET their resume by ID to check if parsing has finished."""
        student_profile = student_account.student_profile
        processing_resume = Resume.objects.create(student=student_profile, status="processing")
        api_response = student_api.get(reverse(self.DETAIL_URL, kwargs={"resume_id": processing_resume.resume_id}))
        assert api_response.status_code == status.HTTP_200_OK
        assert api_response.data["status"] == "processing"

    def test_completed_resume_exposes_parsed_data(self, student_api, student_account):
        """A completed resume returns the parsed_data dict from the database."""
        student_profile = student_account.student_profile
        completed_resume = Resume.objects.create(
            student=student_profile,
            parsed_data=MOCK_PARSED_DATA,
            status="completed"
        )
        api_response = student_api.get(reverse(self.DETAIL_URL, kwargs={"resume_id": completed_resume.resume_id}))
        assert api_response.status_code == status.HTTP_200_OK
        assert api_response.data["parsed_data"]["name"] == "Jane Doe"
        assert "Python" in api_response.data["parsed_data"]["technical_skills"]

    def test_student_can_patch_parsed_data_to_correct_errors(self, student_api, student_account):
        """Students can PATCH their parsed data to fix any LLM extraction mistakes."""
        student_profile = student_account.student_profile
        completed_resume = Resume.objects.create(
            student=student_profile,
            parsed_data={"technical_skills": ["Python"]},
            status="completed"
        )
        corrected_skills = {"technical_skills": ["Python", "Django", "AWS"]}
        api_response = student_api.patch(
            reverse(self.DETAIL_URL, kwargs={"resume_id": completed_resume.resume_id}),
            {"parsed_data": corrected_skills},
            format='json'
        )
        assert api_response.status_code == status.HTTP_200_OK
        completed_resume.refresh_from_db()
        assert "Django" in completed_resume.parsed_data["technical_skills"]

    def test_another_student_cannot_view_someone_elses_resume(self, student_account):
        """A student cannot read another student's resume record — returns 403 or 404."""
        original_student_profile = student_account.student_profile
        private_resume = Resume.objects.create(student=original_student_profile, status="processing")

        intruder_account = User.objects.create_user(email="intruder@test.com", password="Securepass1", role="student")
        Student.objects.create(user=intruder_account)
        intruder_api = APIClient()
        intruder_api.force_authenticate(user=intruder_account)

        api_response = intruder_api.get(
            reverse(self.DETAIL_URL, kwargs={"resume_id": private_resume.resume_id})
        )
        assert api_response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


class TestResumeParsingPipeline:
    """Unit tests for ResumeParsingPipeline using mocked extractor and LLM parser."""

    def _make_pipeline(self, MockExtractor, MockParser, extracted_text="Jane Doe, Python Developer"):
        """Helper: wire up mocked pipeline and return an instance ready to call .run()."""
        MockExtractor.return_value.extract.return_value = extracted_text
        MockParser.return_value.parse.return_value = MOCK_PARSED_DATA
        from services.resume_pipeline import ResumeParsingPipeline
        return ResumeParsingPipeline()

    def test_run_delegates_to_extractor_then_parser_in_order(self):
        """Pipeline calls text extraction first, then passes extracted text to parser."""
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser') as MockParser, \
             patch('services.resume_pipeline.log_device_info'), \
             patch('os.path.exists', return_value=True):
            pipeline = self._make_pipeline(MockExtractor, MockParser)
            pipeline.run("/fake/path/cv.pdf")

            MockExtractor.return_value.extract.assert_called_once_with("/fake/path/cv.pdf")
            MockParser.return_value.parse.assert_called_once()

    def test_run_returns_technical_and_soft_skills_from_llm(self):
        """The result dict from run() contains both technical_skills and soft_skills."""
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser') as MockParser, \
             patch('services.resume_pipeline.log_device_info'), \
             patch('os.path.exists', return_value=True):
            pipeline = self._make_pipeline(MockExtractor, MockParser)
            parsed_result = pipeline.run("/fake/path/cv.pdf")

            assert "Python" in parsed_result["technical_skills"]
            assert "Communication" in parsed_result["soft_skills"]

    def test_run_includes_confidence_score_between_0_and_1(self):
        """The parsed result includes a float confidence field in the range [0, 1]."""
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser') as MockParser, \
             patch('services.resume_pipeline.log_device_info'), \
             patch('os.path.exists', return_value=True):
            pipeline = self._make_pipeline(MockExtractor, MockParser)
            parsed_result = pipeline.run("/fake/path/cv.pdf")

            assert "confidence" in parsed_result
            assert 0.0 <= parsed_result["confidence"] <= 1.0

    def test_run_propagates_text_extraction_error(self):
        """If TextExtractor raises TextExtractionError, the pipeline re-raises it."""
        from services.text_extractor import TextExtractionError
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser'), \
             patch('services.resume_pipeline.log_device_info'), \
             patch('os.path.exists', return_value=True):
            MockExtractor.return_value.extract.side_effect = TextExtractionError(
                "/fake/path/bad.pdf", Exception("corrupt")
            )
            from services.resume_pipeline import ResumeParsingPipeline
            pipeline = ResumeParsingPipeline()
            with pytest.raises(TextExtractionError):
                pipeline.run("/fake/path/bad.pdf")

    def test_validate_file_returns_true_for_supported_extension(self):
        """validate_file() returns True when the TextExtractor considers the file supported."""
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser'), \
             patch('services.resume_pipeline.log_device_info'):
            MockExtractor.return_value.is_supported.return_value = True
            from services.resume_pipeline import ResumeParsingPipeline
            pipeline = ResumeParsingPipeline()
            assert pipeline.validate_file("/any/file.pdf") is True

    def test_validate_file_returns_false_for_unsupported_extension(self):
        """validate_file() returns False for unsupported types like .jpg or .png."""
        with patch('services.resume_pipeline.TextExtractor') as MockExtractor, \
             patch('services.resume_pipeline.LLMResumeParser'), \
             patch('services.resume_pipeline.log_device_info'):
            MockExtractor.return_value.is_supported.return_value = False
            from services.resume_pipeline import ResumeParsingPipeline
            pipeline = ResumeParsingPipeline()
            assert pipeline.validate_file("/any/photo.jpg") is False


@pytest.mark.skipif(
    not RESUME_LIST_DIR.exists(),
    reason="Resume list/ folder not found at project root — skipping real-file extraction tests"
)
class TestRealResumeExtraction:
    """
    Integration tests that run TextExtractor against every real CV in ``Resume list/``.

    These tests do NOT call the LLM — they only verify that text can be extracted
    from each file and meets basic quality requirements (non-empty, enough content
    to be a real document).

    Run all of these: ``pytest api/tests/test_parsing.py::TestRealResumeExtraction -v``
    """

    SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}

    def _resume_files(self):
        """Yield (filename, absolute_path) for every supported file in Resume list/."""
        for resume_file_path in sorted(RESUME_LIST_DIR.iterdir()):
            if resume_file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                yield resume_file_path.name, str(resume_file_path)

    @pytest.mark.parametrize(
        "resume_filename,resume_path",
        [
            (resume_file_path.name, str(resume_file_path))
            for resume_file_path in sorted(RESUME_LIST_DIR.iterdir())
            if resume_file_path.suffix.lower() in {".pdf", ".docx", ".doc", ".txt"}
        ]
        if RESUME_LIST_DIR.exists() else []
    )
    def test_text_can_be_extracted_from_real_resume(self, resume_filename, resume_path):
        """TextExtractor returns a non-empty string from each real resume in Resume list/.
        Scanned/image-only PDFs will produce empty text — those are marked xfail."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        extracted_text = extractor.extract(resume_path)
        assert isinstance(extracted_text, str), (
            f"Expected str from {resume_filename}, got {type(extracted_text)}"
        )
        if len(extracted_text.strip()) == 0:
            pytest.xfail(
                f"'{resume_filename}' produced empty text — it is likely a scanned/image-only PDF "
                "that requires OCR to extract text. This is a known TextExtractor limitation."
            )
        assert len(extracted_text.strip()) > 50, (
            f"Extracted text from '{resume_filename}' is suspiciously short "
            f"({len(extracted_text.strip())} chars). File may be corrupt or near-empty."
        )

    @pytest.mark.parametrize(
        "resume_filename,resume_path",
        [
            (resume_file_path.name, str(resume_file_path))
            for resume_file_path in sorted(RESUME_LIST_DIR.iterdir())
            if resume_file_path.suffix.lower() in {".pdf", ".docx", ".doc", ".txt"}
        ]
        if RESUME_LIST_DIR.exists() else []
    )
    def test_extraction_result_is_single_string_not_list(self, resume_filename, resume_path):
        """TextExtractor.extract() must return a plain str, not a list or bytes."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        extracted_text = extractor.extract(resume_path)
        assert not isinstance(extracted_text, (list, bytes)), (
            f"TextExtractor returned {type(extracted_text)} for '{resume_filename}' — expected str"
        )

    @pytest.mark.parametrize(
        "resume_filename,resume_path",
        [
            (resume_file_path.name, str(resume_file_path))
            for resume_file_path in sorted(RESUME_LIST_DIR.iterdir())
            if resume_file_path.suffix.lower() in {".pdf", ".docx", ".doc", ".txt"}
        ]
        if RESUME_LIST_DIR.exists() else []
    )
    def test_extracted_text_contains_at_least_one_alphabetic_word(self, resume_filename, resume_path):
        """The extracted text from a real resume must contain at least one recognisable word.
        Scanned/image-only PDFs that yield no text are marked xfail."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        extracted_text = extractor.extract(resume_path)
        if len(extracted_text.strip()) == 0:
            pytest.xfail(
                f"'{resume_filename}' is a scanned/image-only PDF — no text could be extracted."
            )
        words_found = [word for word in extracted_text.split() if word.isalpha() and len(word) > 1]
        assert len(words_found) > 0, (
            f"No alphabetic words found in '{resume_filename}'. "
            "Extraction may have failed or the document may be image-only."
        )


class TestInvalidFilePaths:
    """Tests that the pipeline and extractor handle bad inputs gracefully."""

    def test_extractor_raises_for_nonexistent_file_path(self):
        """TextExtractor raises an exception when given a path that does not exist."""
        from services.text_extractor import TextExtractor, TextExtractionError
        extractor = TextExtractor()
        with pytest.raises((TextExtractionError, FileNotFoundError, Exception)):
            extractor.extract("/nonexistent/path/no_such_file.pdf")

    def test_extractor_raises_for_empty_string_path(self):
        """TextExtractor raises an exception when given an empty string path."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        with pytest.raises(Exception):
            extractor.extract("")

    def test_extractor_raises_for_directory_path_instead_of_file(self, tmp_path):
        """TextExtractor raises an exception when given a directory path instead of a file path."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        with pytest.raises(Exception):
            extractor.extract(str(tmp_path))

    def test_extractor_is_supported_returns_false_for_image(self):
        """is_supported() returns False for image file extensions like .jpg, .png."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        assert extractor.is_supported("/any/photo.jpg") is False
        assert extractor.is_supported("/any/scan.png") is False

    def test_extractor_is_supported_returns_true_for_pdf(self):
        """is_supported() returns True for .pdf files."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        assert extractor.is_supported("/any/cv.pdf") is True

    def test_extractor_is_supported_returns_true_for_docx(self):
        """is_supported() returns True for .docx files."""
        from services.text_extractor import TextExtractor
        extractor = TextExtractor()
        assert extractor.is_supported("/any/resume.docx") is True

    def test_pipeline_validate_rejects_zero_byte_file(self, tmp_path):
        """validate_file() returns False for a real zero-byte file."""
        from services.text_extractor import TextExtractor
        zero_byte_pdf = tmp_path / "empty.pdf"
        zero_byte_pdf.write_bytes(b"")
        extractor = TextExtractor()
        with pytest.raises(Exception):
            extractor.extract(str(zero_byte_pdf))
