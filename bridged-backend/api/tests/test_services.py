import json
from unittest.mock import patch

import pytest
from services.matching_engine import (
    MatchingEngine,
    _match_contract,
    _match_location,
    _normalize_skill,
    _normalize_skills_list,
    _skill_matches,
)


class TestNormalizeSkill:
    """_normalize_skill maps abbreviations/aliases to canonical form."""

    def test_lowercases_and_strips_whitespace(self):
        """Leading/trailing spaces and mixed case are handled."""
        assert _normalize_skill("  Python  ") == "python"
        assert _normalize_skill("PYTHON") == "python"

    def test_maps_js_to_javascript(self):
        """'JS' expands to 'javascript'."""
        assert _normalize_skill("JS") == "javascript"
        assert _normalize_skill("js") == "javascript"

    def test_maps_aws_to_amazon_web_services(self):
        """'AWS' expands to 'amazon web services'."""
        assert _normalize_skill("AWS") == "amazon web services"

    def test_maps_gcp_to_google_cloud_platform(self):
        """'GCP' expands to 'google cloud platform'."""
        assert _normalize_skill("GCP") == "google cloud platform"

    def test_maps_reactjs_to_react(self):
        """'ReactJS' normalises to 'react'."""
        assert _normalize_skill("ReactJS") == "react"

    def test_maps_nodejs_to_node(self):
        """'NodeJS' normalises to 'node.js'."""
        result = _normalize_skill("NodeJS")
        assert "node" in result

    def test_maps_ml_to_machine_learning(self):
        """'ML' expands to 'machine learning'."""
        assert _normalize_skill("ML") == "machine learning"

    def test_maps_ai_to_artificial_intelligence(self):
        """'AI' expands to 'artificial intelligence'."""
        assert _normalize_skill("AI") == "artificial intelligence"

    def test_unknown_skill_returns_lowercase(self):
        """An unknown skill is returned lowercased without change."""
        assert _normalize_skill("FoobarXYZ") == "foobarxyz"

    def test_none_input_returns_empty_string(self):
        """None input is handled gracefully and returns an empty string."""
        assert _normalize_skill(None) == ""

    def test_non_string_input_returns_empty_string(self):
        """Non-string inputs are handled gracefully and return an empty string."""
        assert _normalize_skill(123) == ""
        assert _normalize_skill([]) == ""


class TestNormalizeSkillsList:
    """_normalize_skills_list converts various input shapes into a clean list."""

    def test_comma_separated_string(self):
        """Comma-separated string is split and each skill normalised."""
        result = _normalize_skills_list("Python, JS, AWS")
        assert "python" in result
        assert "javascript" in result
        assert "amazon web services" in result

    def test_semicolon_separated_string(self):
        """Semicolon-separated skills are split correctly."""
        result = _normalize_skills_list("Python; Django; SQL")
        assert "python" in result
        assert "django" in result

    def test_slash_separated_string(self):
        """Skills separated by '/' are split correctly."""
        result = _normalize_skills_list("Docker/Kubernetes")
        assert "docker" in result
        assert "kubernetes" in result

    def test_parentheses_remove_and_split(self):
        """Content inside parentheses is extracted and treated as individual skills."""
        result = _normalize_skills_list("Frontend (React, Vue)")
        assert "react" in result
        assert "vue" in result

    def test_list_of_strings(self):
        """A plain list of skill strings is normalised."""
        result = _normalize_skills_list(["Python", "ReactJS", "AWS"])
        assert "python" in result
        assert "react" in result
        assert "amazon web services" in result

    def test_nested_delimiters_in_list(self):
        """Each item in a list can itself contain comma-separated skills."""
        result = _normalize_skills_list(["Python, Django", "AWS"])
        assert "python" in result
        assert "django" in result

    def test_list_of_dicts_with_name_key(self):
        """Parsed CV skills in {'name': 'X'} format are extracted."""
        result = _normalize_skills_list([{"name": "Python"}, {"name": "JS"}])
        assert "python" in result
        assert "javascript" in result

    def test_empty_list_returns_empty(self):
        """An empty list returns an empty list."""
        assert _normalize_skills_list([]) == []

    def test_none_returns_empty(self):
        """None input returns an empty list."""
        assert _normalize_skills_list(None) == []

    def test_no_duplicates(self):
        """Duplicate skills after normalisation appear only once."""
        result = _normalize_skills_list(["Python", "python", "PYTHON"])
        assert result.count("python") == 1


class TestMatchLocation:
    """_match_location determines whether a student's location is compatible with a job's location."""

    def test_remote_job_matches_any_student_location(self):
        """'Remote' jobs always pass the location filter regardless of where the student is."""
        assert _match_location("Lagos", "Remote") is True
        assert _match_location("San Francisco", "Remote") is True
        assert _match_location(None, "Remote") is True

    def test_exact_city_match(self):
        """Student and job with the same city match."""
        assert _match_location("Lagos", "Lagos") is True

    def test_containment_match_student_in_job(self):
        """If the student's location contains the job location it's still a match."""
        assert _match_location("Lagos, Nigeria", "Lagos") is True

    def test_containment_match_job_in_student(self):
        """If the job location contains the student's location it's still a match."""
        assert _match_location("Nairobi", "Nairobi, Kenya") is True

    def test_different_cities_do_not_match(self):
        """Student in Lagos and job in Nairobi is a location mismatch."""
        assert _match_location("Lagos", "Nairobi") is False

    def test_none_student_location_non_remote_job_fails(self):
        """A student with no location set does not match a non-remote job."""
        assert _match_location(None, "Lagos") is False


class TestMatchContract:
    """_match_contract determines if a job's contract type aligns with student preferences."""

    def test_empty_preferences_match_everything(self):
        """A student with no contract preferences matches any job type."""
        assert _match_contract([], "full-time") is True
        assert _match_contract([], "internship") is True

    def test_matching_preference(self):
        """A job's contract type that is in the student's preference list matches."""
        assert _match_contract(["full-time", "contract"], "full-time") is True
        assert _match_contract(["internship"], "internship") is True

    def test_non_matching_preference(self):
        """A job type not in the student preference list does not match."""
        assert _match_contract(["full-time"], "part-time") is False
        assert _match_contract(["internship"], "freelance") is False

    def test_case_insensitive_matching(self):
        """Contract matching should be case-insensitive."""
        assert _match_contract(["Full-Time"], "full-time") is True


class TestSkillMatches:
    """_skill_matches checks if a student skill satisfies a job skill requirement."""

    def test_exact_match(self):
        """Identical skills always match."""
        assert _skill_matches("Python", "Python") is True

    def test_version_suffix_match(self):
        """Python matches the requirement 'Python 3'."""
        assert _skill_matches("Python", "Python 3") is True

    def test_js_suffix_removal(self):
        """React matches ReactJS (JS-suffix shorthand is transparent)."""
        assert _skill_matches("React", "ReactJS") is True

    def test_synonym_match(self):
        """'JS' and 'JavaScript' are recognised as equivalent."""
        assert _skill_matches("JS", "JavaScript") is True
        assert _skill_matches("AWS", "Amazon Web Services") is True

    def test_different_skills_do_not_match(self):
        """Clearly unrelated skills do not match."""
        assert _skill_matches("Docker", "Kubernetes") is False
        assert _skill_matches("Python", "Java") is False


class TestMatchingEngineCalculate:
    """MatchingEngine.calculate_match returns correctly weighted scores."""

    def test_perfect_match_score_is_100(self):
        """Having all required and nice-to-have skills gives a score of 100."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Python", "Django"], ["Python", "Django"], [])
        assert result["score"] == 100.0

    def test_half_required_skills_met(self):
        """Meeting half the required skills (1 of 2) gives a score of 50.0."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Python"], ["Python", "JavaScript"], [])
        assert result["score"] == pytest.approx(50.0)

    def test_no_skills_match_score_is_zero(self):
        """Having no relevant skills gives a score of 0."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Cobol"], ["Python", "JavaScript"], ["React"])
        assert result["score"] == 0.0

    def test_nice_to_have_adds_to_score(self):
        """Matching all required and all nice-to-have skills gives a perfect score."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Python", "Docker"], ["Python"], ["Docker"])
        assert result["score"] == 100.0

    def test_matched_required_list_is_correct(self):
        """The returned matched_required list contains exactly the matched required skills."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Python"], ["Python", "SQL"], [])
        assert "python" in result["matched_required"]
        assert "sql" in result["missing_required"]

    def test_matched_nice_to_have_list_is_correct(self):
        """The returned matched_nice_to_have list contains exactly the matched nice-to-have skills."""
        engine = MatchingEngine()
        result = engine.calculate_match(["Python", "AWS"], ["Python"], ["AWS"])
        assert "amazon web services" in result["matched_nice_to_have"]


@pytest.mark.django_db
class TestMatchingEngineFilters:
    """MatchingEngine.calculate_match_for_student applies location and contract hard filters."""

    @pytest.fixture
    def employer(self, db):
        from api.models import Employer, User

        eu = User.objects.create_user(
            email="emp@test.com", password="p", role="employer"
        )
        return Employer.objects.create(user=eu, company_name="Emp")

    @pytest.fixture
    def student(self, db):
        from api.models import Resume, Student, User

        su = User.objects.create_user(
            email="stn@test.com", password="p", role="student"
        )
        s = Student.objects.create(
            user=su, location="Lagos", contract_preferences=["full-time"]
        )
        Resume.objects.create(
            student=s,
            parsed_data={"technical_skills": ["Python"]},
            status="completed",
        )
        return s

    def test_location_filter_fails_mismatched_city(self, db):
        """A non-remote job in a different city yields score=0 and failed_filter='location'."""
        from api.models import Employer, Job, Resume, Student, User

        eu = User.objects.create_user(email="e@e.com", password="p", role="employer")
        emp = Employer.objects.create(user=eu, company_name="E")
        su = User.objects.create_user(email="s@s.com", password="p", role="student")
        st = Student.objects.create(user=su, location="Lagos", contract_preferences=[])
        Resume.objects.create(
            student=st, parsed_data={"technical_skills": ["Python"]}, status="completed"
        )
        job = Job.objects.create(
            employer=emp,
            title="Job",
            description="X",
            required_skills=["Python"],
            location="Nairobi",
        )
        engine = MatchingEngine()
        result = engine.calculate_match_for_student(st, job)
        assert result["score"] == 0.0
        assert result["failed_filter"] == "location"

    def test_contract_filter_fails_mismatched_type(self, db):
        """A job with a contract type not in the student's preferences yields score=0 and failed_filter='contract'."""
        from api.models import Employer, Job, Resume, Student, User

        eu = User.objects.create_user(email="e2@e.com", password="p", role="employer")
        emp = Employer.objects.create(user=eu, company_name="E2")
        su = User.objects.create_user(email="s2@s.com", password="p", role="student")
        st = Student.objects.create(
            user=su, location="Remote", contract_preferences=["full-time"]
        )
        Resume.objects.create(
            student=st, parsed_data={"technical_skills": ["Python"]}, status="completed"
        )
        job = Job.objects.create(
            employer=emp,
            title="Job",
            description="X",
            required_skills=["Python"],
            location="Remote",
            contract_type="internship",
        )
        engine = MatchingEngine()
        result = engine.calculate_match_for_student(st, job)
        assert result["score"] == 0.0
        assert result["failed_filter"] == "contract"

    def test_remote_job_bypasses_location_filter(self, db):
        """A remote job bypasses the location filter entirely."""
        from api.models import Employer, Job, Resume, Student, User

        eu = User.objects.create_user(email="e3@e.com", password="p", role="employer")
        emp = Employer.objects.create(user=eu, company_name="E3")
        su = User.objects.create_user(email="s3@s.com", password="p", role="student")
        st = Student.objects.create(
            user=su, location="Cape Town", contract_preferences=[]
        )
        Resume.objects.create(
            student=st, parsed_data={"technical_skills": ["Python"]}, status="completed"
        )
        job = Job.objects.create(
            employer=emp,
            title="R Job",
            description="X",
            required_skills=["Python"],
            location="Remote",
        )
        engine = MatchingEngine()
        result = engine.calculate_match_for_student(st, job)
        assert result.get("failed_filter") is None
        assert result["score"] > 0


@pytest.mark.django_db
class TestMatchingEngineContextualLLM:
    """Contextual LLM hook is invoked only when deterministic score warrants it."""

    _llm_payload = {
        "expertise_fit": 0.85,
        "recommended_multiplier": 1.0,
        "confidence": 0.9,
        "relevant_experience_months": 12,
        "rationale": "ok",
    }

    def test_llm_contextualizer_called_when_base_score_high(self, monkeypatch):
        """Above MATCHING_LLM_MIN_BASE_SCORE, _llm_contextualize_match runs and can mark contextualized."""
        from api.models import Employer, Job, Resume, Student, User

        monkeypatch.setenv("MATCHING_CONTEXT_LLM_ENABLED", "true")
        monkeypatch.delenv("MATCHING_LLM_MIN_BASE_SCORE", raising=False)

        eu = User.objects.create_user(
            email="llm-e@e.com", password="p", role="employer"
        )
        emp = Employer.objects.create(user=eu, company_name="LLM Co")
        su = User.objects.create_user(email="llm-s@s.com", password="p", role="student")
        st = Student.objects.create(
            user=su, location="Remote", contract_preferences=["full-time"]
        )
        Resume.objects.create(
            student=st,
            parsed_data={"technical_skills": ["Python", "Django"]},
            status="completed",
        )
        job = Job.objects.create(
            employer=emp,
            title="Python Dev",
            description="Django API work",
            required_skills=["Python", "Django"],
            nice_to_have_skills=[],
            location="Remote",
            contract_type="full-time",
        )
        pd = {"technical_skills": ["Python", "Django"]}
        engine = MatchingEngine()
        with patch(
            "services.matching_engine._llm_contextualize_match",
            return_value=self._llm_payload,
        ) as mock_llm:
            result = engine.calculate_match_for_student(st, job, parsed_data=pd)
        mock_llm.assert_called_once()
        assert result.get("contextualized") is True
        assert result.get("matcher_llm", {}).get("outcome") == "applied"
        assert "expertise_fit" in result

    def test_llm_contextualizer_skipped_when_base_score_low(self, monkeypatch):
        """Below threshold, no LLM call — deterministic score only (saves latency)."""
        from api.models import Employer, Job, Resume, Student, User

        monkeypatch.setenv("MATCHING_CONTEXT_LLM_ENABLED", "true")
        monkeypatch.delenv("MATCHING_LLM_MIN_BASE_SCORE", raising=False)

        eu = User.objects.create_user(
            email="llm2-e@e.com", password="p", role="employer"
        )
        emp = Employer.objects.create(user=eu, company_name="Co2")
        su = User.objects.create_user(
            email="llm2-s@s.com", password="p", role="student"
        )
        st = Student.objects.create(
            user=su, location="Remote", contract_preferences=["full-time"]
        )
        Resume.objects.create(
            student=st,
            parsed_data={"technical_skills": ["Python"]},
            status="completed",
        )
        job = Job.objects.create(
            employer=emp,
            title="Full stack",
            description="Many skills",
            required_skills=["Python", "Django", "React", "PostgreSQL"],
            nice_to_have_skills=[],
            location="Remote",
            contract_type="full-time",
        )
        pd = {"technical_skills": ["Python"]}
        engine = MatchingEngine()
        with patch(
            "services.matching_engine._llm_contextualize_match",
            return_value=self._llm_payload,
        ) as mock_llm:
            result = engine.calculate_match_for_student(st, job, parsed_data=pd)
        mock_llm.assert_not_called()
        assert result.get("contextualized") is None
        assert result.get("matcher_llm", {}).get("outcome") == "skipped_low_base"
        assert result["score"] < 35


class TestMatcherLLMCandidateSnapshot:
    """LLM matcher receives a rebuilt snapshot: no student identity fields; role context included."""

    def test_snapshot_omits_root_identity_fields_includes_work_context(self):
        from services.matching_engine import _candidate_snapshot_for_llm_matcher

        pd = {
            "name": "Secret Student",
            "email": "student@evil.test",
            "phone": "+10000000000",
            "technical_skills": ["Python", "Django"],
            "soft_skills": ["Communication"],
            "experience": [
                {
                    "title": "Backend Engineer",
                    "company": "Acme Corp",
                    "responsibilities": "Built REST APIs and deployments",
                    "start_date": "2020-01",
                    "end_date": "2021-06",
                }
            ],
        }
        snap = _candidate_snapshot_for_llm_matcher(pd)
        blob = json.dumps(snap, ensure_ascii=True)
        assert "Secret" not in blob
        assert "student@evil" not in blob
        assert "+10000000000" not in blob
        assert "Acme Corp" in blob
        assert "Backend Engineer" in blob
        assert "REST APIs" in blob

    @pytest.mark.django_db
    def test_llm_request_json_excludes_root_identity_fields(self, monkeypatch):
        """Integration: chat payload does not include name/email/phone from resume root."""
        from unittest.mock import MagicMock

        from api.models import Employer, Job, User

        monkeypatch.setenv("MATCHING_CONTEXT_LLM_ENABLED", "true")
        monkeypatch.delenv("MATCHING_LLM_MIN_BASE_SCORE", raising=False)

        eu = User.objects.create_user(
            email="pii-e@e.com", password="p", role="employer"
        )
        emp = Employer.objects.create(user=eu, company_name="E")
        job = Job.objects.create(
            employer=emp,
            title="Dev",
            description="Work",
            required_skills=["Python"],
            nice_to_have_skills=[],
            location="Remote",
            contract_type="full-time",
        )
        pd = {
            "name": "Secret Person",
            "email": "secret@user.com",
            "phone": "555-0000",
            "technical_skills": ["Python"],
            "soft_skills": [],
            "experience": [
                {
                    "title": "Engineer",
                    "company": "Acme Corp",
                    "responsibilities": "Shipped product features",
                    "start_date": "2022-01",
                    "end_date": "2023-01",
                }
            ],
        }
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"expertise_fit":1,"recommended_multiplier":1,"confidence":1,"relevant_experience_months":12,"rationale":"x"}'
                )
            )
        ]
        mock_client.chat.completions.create.return_value = mock_response

        monkeypatch.setattr(
            "services.matching_engine._get_context_llm_client", lambda: mock_client
        )
        monkeypatch.setenv("MATCHING_LLM_MODEL", "dummy-model")

        from services.matching_engine import _llm_contextualize_match

        _llm_contextualize_match(job, pd, 90.0)
        kwargs = mock_client.chat.completions.create.call_args[1]
        user_content = kwargs["messages"][1]["content"]
        payload = json.loads(user_content)
        cand = json.dumps(payload["candidate"])
        assert "Secret Person" not in cand
        assert "secret@user.com" not in cand
        assert "555-0000" not in cand
        assert "Acme Corp" in cand
        assert "Engineer" in cand
