"""
Matching Engine — core algorithm for student-job compatibility scoring.

Skill matching supports exact, substring, and synonym variants
(e.g. "Python 3"/"Python", "JS"/"JavaScript", "ReactJS"/"React").
"""

import re
import logging
from typing import List, Set, Tuple, Any, Dict

logger = logging.getLogger(__name__)

from .synonyms import SKILL_SYNONYMS


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
    Ensures that even if a string inside a list contains commas, it gets split.
    Also handles parenthetical sub-skills: "A (B, C)" -> ["a", "b", "c"].
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
            item = (item.get("name") or item.get("skill") or item.get("title") or "").strip()
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
    Otherwise, we do a simple case-insensitive containment check.
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


def _match_contract(student_contract_preferences: List[str], job_contract_type: str) -> bool:
    """
    Check if the job's contract type matches any of the student's preferences.
    If student has no preferences set, we assume they are open to all.
    """
    if not student_contract_preferences:
        return True
    
    if not job_contract_type:
        return True
        
    return job_contract_type.lower() in [p.lower() for p in student_contract_preferences]


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
        found = any(
            _skill_matches(req, stu) for stu in student_normalized
        )
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

    def calculate_match_for_student(self, student, job) -> Dict[str, Any]:
        """
        Primary entry point: Checks hard filters (location, contract, dismissal) 
        before calculating skill score.
        """
        from api.models import Match
        if Match.objects.filter(student=student, job=job, status='dismissed').exists():
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [r for r in _normalize_skills_list(job.required_skills) if r],
                "failed_filter": "dismissed"
            }

        if not _match_location(student.location, job.location):
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [r for r in _normalize_skills_list(job.required_skills) if r],
                "failed_filter": "location"
            }
            
        if not _match_contract(student.contract_preferences, job.contract_type):
            return {
                "score": 0.0,
                "matched_required": [],
                "matched_nice_to_have": [],
                "missing_required": [r for r in _normalize_skills_list(job.required_skills) if r],
                "failed_filter": "contract"
            }

        from api.models import Resume
        try:
            resume = Resume.objects.get(student=student)
            student_skills = _skills_from_parsed_data(resume.parsed_data)
        except Resume.DoesNotExist:
            student_skills = []

        return self.calculate_match(
            student_skills,
            job.required_skills,
            job.nice_to_have_skills,
        )


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
    return {
        "job_id": str(job.job_id),
        "job_title": job.title,
        "company": job.employer.company_name,
        "location": job.location,
        "description": job.description,
        "compatibility_score": match_result["score"],
        "matched_skills": (
            match_result["matched_required"] + match_result["matched_nice_to_have"]
        ),
        "missing_skills": match_result["missing_required"],
        "failed_filter": match_result.get("failed_filter")
    }
