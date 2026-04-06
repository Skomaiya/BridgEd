"""
Matching Engine — core algorithm for student-job compatibility scoring.

Skill matching supports exact, substring, and synonym variants
(e.g. "Python 3"/"Python", "JS"/"JavaScript", "ReactJS"/"React").
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Set, Tuple

from .synonyms import ROLE_SENIORITY_SYNONYMS, SKILL_SYNONYMS

logger = logging.getLogger(__name__)

DEFAULT_MATCHING_LLM_MIN_BASE_SCORE = 25.0
DEFAULT_MATCHING_LLM_TIMEOUT_SEC = 15.0

SENIORITY_CUES = (
    "senior",
    "sr",
    "sr.",
    "lead",
    "principal",
    "staff",
    "architect",
    "expert",
    "manager",
    "head of",
    "tech lead",
    "team lead",
    "lead engineer",
    "lead developer",
    "staff engineer",
    "principal engineer",
    "engineering manager",
    "technical manager",
    "senior software engineer",
    "senior developer",
    "senior backend engineer",
    "senior frontend engineer",
)


def _normalize_skill(s: str) -> str:
    """Lowercase, strip, collapse spaces. Return canonical form if synonym exists."""
    if not s or not isinstance(s, str):
        return ""
    s = re.sub(r"\s+", " ", s.lower().strip())
    return SKILL_SYNONYMS.get(s, s)


def _normalize_skills_list(skills) -> List[str]:
    """
    Turn input into a list of normalized non-empty skill strings.
    Handles: list of strings, list of mixed, single string with commas/semicolons.
    """
    if not skills:
        return []

    out = []
    items_to_process = []

    if isinstance(skills, str):
        items_to_process.append(skills)
    elif isinstance(skills, (list, tuple, set)):
        items_to_process.extend(skills)
    else:
        items_to_process.append(skills)

    for item in items_to_process:
        if isinstance(item, dict):
            item = (
                item.get("name") or item.get("skill") or item.get("title") or ""
            ).strip()
        if item is not None and not isinstance(item, str):
            item = str(item)
        if isinstance(item, str) and item:
            item = item.replace("(", ", ").replace(")", "")
            parts = re.split(r"[,;|/\n\r\t]+", item)
            for p in parts:
                n = _normalize_skill(p)
                if n and n not in out:
                    out.append(n)
    return out


def _match_location(student_location: str, job_location: str) -> bool:
    """
    Check if student is in a compatible location for the job.
    'Remote' jobs (case-insensitive) match everyone.
    """
    if not job_location:
        return True

    j_loc = job_location.lower().strip()
    if j_loc == "remote":
        return True

    if not student_location:
        return False

    s_loc = student_location.lower().strip()
    return s_loc in j_loc or j_loc in s_loc


def _match_contract(
    student_contract_preferences: List[str], job_contract_type: str
) -> bool:
    """
    Check if the job's contract type matches any of the student's preferences.
    If student has no preferences set, we assume they are open to all.
    """
    if not student_contract_preferences:
        return True

    if not job_contract_type:
        return True

    return job_contract_type.lower() in [
        p.lower() for p in student_contract_preferences
    ]


def _skill_matches(job_skill: str, student_skill: str) -> bool:
    """
    Return True if the student skill satisfies the job skill requirement.
    Handles exact match, version variants, JS-suffix shorthand, and synonyms.
    """
    if not job_skill or not student_skill:
        return False
    j = _normalize_skill(job_skill)
    s = _normalize_skill(student_skill)
    if j == s:
        return True
    if len(j) > 1 and len(s) > 1:
        if j.startswith(s + " ") or s.startswith(j + " "):
            return True
        if (j.endswith("js") and s == j[:-2]) or (s.endswith("js") and j == s[:-2]):
            return True
    j_canon = SKILL_SYNONYMS.get(j, j)
    s_canon = SKILL_SYNONYMS.get(s, s)
    return j_canon == s_canon


def _match_required_to_student(
    required_skills: List[str],
    student_skills: List[str],
) -> Tuple[Set[str], Set[str]]:
    """
    For each required skill, see if any student skill matches.
    Returns (matched_required_set, missing_required_set).
    """
    required_normalized = _normalize_skills_list(required_skills)
    student_normalized = _normalize_skills_list(student_skills)
    matched = set()
    missing = set()
    for req in required_normalized:
        if not req:
            continue
        found = any(_skill_matches(req, stu) for stu in student_normalized)
        if found:
            matched.add(req)
        else:
            missing.add(req)
    return matched, missing


def _match_nice_to_have(
    nice_to_have_skills: List[str],
    student_skills: List[str],
) -> Set[str]:
    """Return set of nice-to-have skills that the student has."""
    nice_normalized = _normalize_skills_list(nice_to_have_skills)
    student_normalized = _normalize_skills_list(student_skills)
    matched = set()
    for n in nice_normalized:
        if not n:
            continue
        if any(_skill_matches(n, stu) for stu in student_normalized):
            matched.add(n)
    return matched


def _parse_date(value: Any) -> datetime | None:
    """Best-effort parser for common date formats found in parsed resume data."""
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    lower = text.lower()
    if lower in {"present", "current", "now", "ongoing"}:
        return datetime.utcnow()

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y/%m", "%Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _months_between(start: datetime | None, end: datetime | None) -> int:
    """Return whole-month duration between two dates (minimum 0)."""
    if not start:
        return 0
    final_end = end or datetime.utcnow()
    if final_end < start:
        return 0
    return max(0, (final_end.year - start.year) * 12 + (final_end.month - start.month))


def _join_responsibilities(raw: Any) -> str:
    if isinstance(raw, str):
        return raw.strip()
    if isinstance(raw, list):
        return "; ".join(str(r).strip() for r in raw if r)
    return ""


def _truncate_text(text: str, max_len: int) -> str:
    s = (text or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _candidate_snapshot_for_llm_matcher(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rebuild only the fields needed for the third-party contextual matcher.

    Student identifiers (name, email, phone, address, etc.) are never read from
    ``parsed_data`` — only skills, experience (title, company, responsibilities,
    dates), and projects are included so the model can judge fit without regex
    redaction of full resume blobs.
    """
    tech: List[str] = []
    for x in parsed_data.get("technical_skills") or []:
        t = str(x).strip()
        if t:
            tech.append(t)
    soft: List[str] = []
    for x in parsed_data.get("soft_skills") or []:
        t = str(x).strip()
        if t:
            soft.append(t)

    experience_out: List[Dict[str, Any]] = []
    for item in parsed_data.get("experience") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        company = str(item.get("company") or "").strip()
        resp = _join_responsibilities(item.get("responsibilities"))
        experience_out.append(
            {
                "title": title,
                "company": company,
                "responsibilities": _truncate_text(resp, 400),
                "start_date": item.get("start_date"),
                "end_date": item.get("end_date"),
            }
        )

    projects_out: List[Dict[str, Any]] = []
    for item in parsed_data.get("projects") or []:
        if not isinstance(item, dict):
            continue
        projects_out.append(
            {
                "name": str(item.get("name") or "").strip(),
                "description": _truncate_text(
                    str(item.get("description") or "").strip(), 500
                ),
            }
        )

    return {
        "technical_skills": tech,
        "soft_skills": soft,
        "experience": experience_out[:12],
        "projects": projects_out[:6],
    }


def _build_experience_summary(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Summarize experience with durations for LLM contextual scoring."""
    entries = []
    total_months = 0
    for item in parsed_data.get("experience") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        company = str(item.get("company") or "").strip()
        responsibilities = item.get("responsibilities") or []
        if isinstance(responsibilities, str):
            resp_text = responsibilities
        elif isinstance(responsibilities, list):
            resp_text = "; ".join(str(r).strip() for r in responsibilities if r)
        else:
            resp_text = ""

        start = _parse_date(item.get("start_date"))
        end = _parse_date(item.get("end_date"))
        months = _months_between(start, end)
        total_months += months

        entries.append(
            {
                "title": title,
                "company": company,
                "months": months,
                "responsibilities": resp_text[:350],
            }
        )

    return {
        "total_experience_months": total_months,
        "experience_entries": entries[:8],
    }


def _is_likely_senior_job(job) -> bool:
    """Heuristic check for seniority signals in job title/description/skills."""
    haystacks = [
        str(getattr(job, "title", "") or "").lower(),
        str(getattr(job, "description", "") or "").lower(),
        " ".join(str(s).lower() for s in (getattr(job, "required_skills", []) or [])),
        " ".join(
            str(s).lower() for s in (getattr(job, "nice_to_have_skills", []) or [])
        ),
    ]
    merged = re.sub(r"[\-_/]", " ", " ".join(haystacks))
    merged = re.sub(r"\s+", " ", merged).strip()
    for cue in SENIORITY_CUES:
        if not cue:
            continue
        # Prefer phrase-safe matching to avoid accidental substring hits.
        pattern = r"\b" + re.escape(cue.lower().strip()) + r"\b"
        if re.search(pattern, merged):
            return True

    for alias, canonical in ROLE_SENIORITY_SYNONYMS.items():
        alias_pattern = r"\b" + re.escape(alias.lower().strip()) + r"\b"
        if re.search(alias_pattern, merged):
            if canonical in {
                "senior",
                "lead",
                "principal",
                "staff",
                "architect",
                "manager",
                "head",
            }:
                return True
    return False


def _get_context_llm_client():
    """Create LLM client using matcher-specific credentials/settings."""
    from . import llm_parser

    base_url = os.getenv("MATCHING_LLM_BASE_URL", "").strip()
    api_key = os.getenv("MATCHING_LLM_API_KEY", "").strip()

    if not base_url:
        raise ValueError("MATCHING_LLM_BASE_URL is required for contextual matcher")
    if not api_key:
        if "11434" in base_url or "ollama" in base_url.lower():
            api_key = "ollama"
        else:
            raise ValueError("MATCHING_LLM_API_KEY is required for contextual matcher")

    timeout_sec = _env_float(
        "MATCHING_LLM_TIMEOUT_SECONDS", DEFAULT_MATCHING_LLM_TIMEOUT_SEC
    )
    return llm_parser.openai.OpenAI(
        api_key=api_key, base_url=base_url, timeout=timeout_sec
    )


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(str(raw).strip())
    except ValueError:
        return default


def _llm_contextualize_match(
    job, parsed_data: Dict[str, Any], base_score: float
) -> Dict[str, Any] | None:
    """
    Call the contextual LLM with a rebuilt candidate snapshot (no student identity fields).

    Caller must only invoke when ``MATCHING_CONTEXT_LLM_ENABLED`` is true and base score
    is above the minimum. Returns None on transport/model errors.
    """
    try:
        client = _get_context_llm_client()
        model = os.getenv("MATCHING_LLM_MODEL", "").strip()
        if not model:
            raise ValueError("Set MATCHING_LLM_MODEL for contextual matcher")
    except Exception as exc:
        logger.debug("Context LLM disabled/unavailable: %s", exc)
        return None

    snapshot = _candidate_snapshot_for_llm_matcher(parsed_data)
    exp_summary = _build_experience_summary(snapshot)
    candidate_payload: Dict[str, Any] = {
        "technical_skills": snapshot.get("technical_skills") or [],
        "soft_skills": snapshot.get("soft_skills") or [],
        "experience_summary": exp_summary,
    }
    projects_safe = snapshot.get("projects") or []
    if projects_safe:
        candidate_payload["projects"] = projects_safe

    job_description = (getattr(job, "description", "") or "")[:1200]
    payload = {
        "job": {
            "title": getattr(job, "title", "") or "",
            "description": job_description,
            "required_skills": getattr(job, "required_skills", []) or [],
            "nice_to_have_skills": getattr(job, "nice_to_have_skills", []) or [],
        },
        "candidate": candidate_payload,
        "base_skill_score": base_score,
        "task": (
            "Perform an objective Evidence-Based Proficiency Audit for this role at any level (intern, junior, mid, senior). "
            "Ignore simple keyword counts (already handled by the system). Focus entirely on the depth, complexity, and contextual application of skills "
            "as described in the experience and projects sections. For early-career roles, weigh coursework, internships, and volunteer work results. "
            "For senior roles, weigh ownership and technical leadership evidence. "
            "Return a score representing the qualitative competency of this candidate. Return strict JSON only."
        ),
        "output_schema": {
            "expertise_fit": "number 0..1",
            "recommended_multiplier": "number 0.6..1.1",
            "relevant_experience_months": "integer >=0",
            "confidence": "number 0..1",
            "rationale": "short string",
        },
    }

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict scoring assistant. Output only valid JSON. "
                        "Do not add markdown or explanation text. "
                        "Candidate data excludes student names and contact identifiers; "
                        "role titles, employers, and responsibilities are included for assessment."
                    ),
                },
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.0,
            max_tokens=260,
            response_format={"type": "json_object"},
        )
    except Exception:
        return None

    content = response.choices[0].message.content if response.choices else ""
    if not content:
        return None
    try:
        data = json.loads(content)
        expertise_fit = float(data.get("expertise_fit", 1.0))
        multiplier = float(data.get("recommended_multiplier", 1.0))
        confidence = float(data.get("confidence", 0.0))
        rel_months = int(data.get("relevant_experience_months", 0))
        rationale = str(data.get("rationale", "")).strip()
    except Exception:
        return None

    expertise_fit = max(0.0, min(1.0, expertise_fit))
    multiplier = max(0.6, min(1.1, multiplier))
    confidence = max(0.0, min(1.0, confidence))
    rel_months = max(0, rel_months)

    return {
        "expertise_fit": expertise_fit,
        "recommended_multiplier": multiplier,
        "confidence": confidence,
        "relevant_experience_months": rel_months,
        "rationale": rationale,
    }


class MatchingEngine:
    """
    Calculate compatibility between student skills and job requirements.
    Uses normalized skill lists with exact, substring, and synonym matching.
    """

    def __init__(
        self,
        required_weight: float = 0.9,
        nice_to_have_weight: float = 0.1,
        min_score_threshold: float = 70.0,
    ):
        """
        Args:
            required_weight: Weight for required skills (0–1). Default 0.9.
            nice_to_have_weight: Weight for nice-to-have skills (0–1). Default 0.1.
            min_score_threshold: Minimum score (0–100) to consider a match.
        """
        self.required_weight = required_weight
        self.nice_to_have_weight = nice_to_have_weight
        self.min_score_threshold = min_score_threshold

    def calculate_match(
        self,
        student_skills,
        job_required_skills,
        job_nice_to_have=None,
    ):
        """
        Calculate compatibility score between student and job based ONLY on skills.
        """
        required_list = _normalize_skills_list(job_required_skills)
        required_list = [r for r in required_list if r]

        if not required_list:
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [],
            }

        matched_required, missing_required = _match_required_to_student(
            job_required_skills,
            student_skills,
        )
        matched_nice_to_have = _match_nice_to_have(
            job_nice_to_have or [],
            student_skills,
        )

        required_set = set(required_list)
        required_ratio = len(matched_required) / len(required_set)

        nice_list = _normalize_skills_list(job_nice_to_have or [])
        nice_list = [n for n in nice_list if n]
        if nice_list:
            nice_set = set(nice_list)
            nice_ratio = len(matched_nice_to_have) / len(nice_set)
            score = (
                self.required_weight * required_ratio
                + self.nice_to_have_weight * nice_ratio
            )
        else:
            score = required_ratio

        final_score = round(min(100.0, max(0.0, score * 100)), 2)

        return {
            "score": final_score,
            "matched_required": sorted(list(matched_required)),
            "matched_nice_to_have": sorted(list(matched_nice_to_have)),
            "missing_required": sorted(list(missing_required)),
        }

    def calculate_match_for_student(
        self,
        student,
        job,
        *,
        parsed_data: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Primary entry point: Checks hard filters (location, contract, dismissal)
        before calculating skill score.
        """
        from api.models import Match

        if Match.objects.filter(student=student, job=job, status="dismissed").exists():
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [
                    r for r in _normalize_skills_list(job.required_skills) if r
                ],
                "failed_filter": "dismissed",
            }

        if not _match_location(student.location, job.location):
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [
                    r for r in _normalize_skills_list(job.required_skills) if r
                ],
                "failed_filter": "location",
            }

        if not _match_contract(student.contract_preferences, job.contract_type):
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [
                    r for r in _normalize_skills_list(job.required_skills) if r
                ],
                "failed_filter": "contract",
            }

        from api.models import Resume

        if parsed_data is None:
            try:
                resume = Resume.objects.get(student=student)
                parsed_data = resume.parsed_data or {}
            except Resume.DoesNotExist:
                parsed_data = {}
        student_skills = _skills_from_parsed_data(parsed_data)

        base_result = self.calculate_match(
            student_skills,
            job.required_skills,
            job.nice_to_have_skills,
        )

        min_llm_base = _env_float(
            "MATCHING_LLM_MIN_BASE_SCORE", DEFAULT_MATCHING_LLM_MIN_BASE_SCORE
        )
        if base_result["score"] < min_llm_base:
            base_result["matcher_llm"] = {"outcome": "skipped_low_base"}
            return base_result

        if not _env_bool("MATCHING_CONTEXT_LLM_ENABLED", default=True):
            base_result["matcher_llm"] = {"outcome": "skipped_disabled"}
            return base_result

        context = _llm_contextualize_match(job, parsed_data, base_result["score"])
        if not context:
            base_result["matcher_llm"] = {"outcome": "unavailable"}
            return base_result

        keyword_contribution = base_result["score"] * 0.40
        llm_contribution = context["expertise_fit"] * 100 * 0.60
        adjusted = keyword_contribution + llm_contribution
        
        adjusted *= (0.9 + (context["recommended_multiplier"] - 0.6) * 0.2 / 0.5) if context["recommended_multiplier"] != 1.0 else 1.0
        
        if _is_likely_senior_job(job):
            weak_experience = context["relevant_experience_months"] < 24
            low_expertise = context["expertise_fit"] < 0.45
            if weak_experience or low_expertise:
                adjusted = min(adjusted, 69.0)

        base_result["score"] = round(max(0.0, min(100.0, adjusted)), 2)
        base_result["contextualized"] = True
        base_result["hybrid_weights"] = {"keyword": "40%", "llm": "60%"}
        base_result["expertise_fit"] = round(context["expertise_fit"], 3)
        base_result["context_confidence"] = round(context["confidence"], 3)
        base_result["relevant_experience_months"] = context[
            "relevant_experience_months"
        ]
        if context["rationale"]:
            base_result["context_rationale"] = context["rationale"]
        base_result["matcher_llm"] = {"outcome": "applied"}
        return base_result


def _skills_from_parsed_data(parsed_data: Dict[str, Any]) -> List[str]:
    """
    Extract student skills from Resume.parsed_data (api.models.Resume).
    Uses 'skills' if present, else technical_skills + soft_skills.
    """
    if not parsed_data:
        return []
    skills = parsed_data.get("skills")
    if skills:
        return list(skills) if isinstance(skills, list) else [skills]
    tech = list(parsed_data.get("technical_skills") or [])
    soft = list(parsed_data.get("soft_skills") or [])
    return tech + soft


def _match_response_from_job(job, match_result: Dict[str, Any]) -> Dict[str, Any]:
    """Build the match response dict from a Job instance and match_result."""
    public = {
        k: v
        for k, v in match_result.items()
        if k != "matcher_llm" and not str(k).startswith("_")
    }
    return {
        "job_id": str(job.job_id),
        "job_title": job.title,
        "company": job.employer.company_name,
        "location": job.location,
        "description": job.description,
        "compatibility_score": public["score"],
        "matched_skills": (public["matched_required"] + public["matched_nice_to_have"]),
        "missing_skills": public["missing_required"],
        "failed_filter": public.get("failed_filter"),
    }
