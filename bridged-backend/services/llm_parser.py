"""
LLM-based Resume Parser — Structure CV with a Small Open Model

Raw CV text is turned into structured JSON by a Small Language Model (SLM).
This module prioritizes Hugging Face for cloud inference and falls back to
local Ollama for offline development.

Supported Environments:
  1. Hugging Face (Default) — Uses the LLM_API_KEY and LLM_BASE_URL.
  2. Ollama — Easiest for local, private parsing (requires no API key).

Returns a fixed structure (name, email, skills, education, experience, etc.)
for pipeline and database compatibility.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

import openai

logger = logging.getLogger(__name__)

CV_EXTRACTION_PROMPT = """Extract from the CV into JSON. Keys: name or full_name, email, phone; technical_skills and tools (array of strings, one per skill); soft_skills (array of strings); education (array of {degree, field, institution, start_date, end_date}); experience (array of {title, company, start_date, end_date, responsibilities}); certifications (array of {name/title, issuer/provider}); projects (array of {name, description}); languages (array of strings). Valid JSON only."""

CV_TEXT_MAX_CHARS = 7000
LLM_MAX_TOKENS = 1500


def _get_client():
    """LLM Client Factory. Checks for Hugging Face API key first, then local Ollama config."""
    from decouple import config

    base_url = config("LLM_BASE_URL", default=None)
    api_key = config("LLM_API_KEY", default=None)

    if api_key:
        import openai

        return openai.OpenAI(api_key=api_key, base_url=base_url)

    if base_url and ("11434" in base_url or "ollama" in base_url.lower()):
        import openai

        return openai.OpenAI(api_key="ollama", base_url=base_url)

    raise ValueError(
        "No LLM Configuration found. Please set LLM_API_KEY (for Hugging Face) or LLM_BASE_URL (for local Ollama) in your .env file."
    )

    return openai.OpenAI(api_key=api_key, base_url=base_url)


def _try_close_truncated_json(s: str) -> str:
    """Close unclosed strings/arrays/objects if response was truncated."""
    stack = []
    in_string = False
    escape = False
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if in_string:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            i += 1
            continue
        if c == "{":
            stack.append("o")
        elif c == "}":
            if stack and stack[-1] == "o":
                stack.pop()
        elif c == "[":
            stack.append("a")
        elif c == "]":
            if stack and stack[-1] == "a":
                stack.pop()
        i += 1
    suffix = '"' if in_string else ""
    for kind in reversed(stack):
        suffix += "]" if kind == "a" else "}"
    return s + suffix


def _extract_json_from_response(content: str) -> Optional[Dict]:
    """Extract JSON from LLM response with repair strategies for truncation and common errors."""
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```\s*$", "", content)

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.debug(f"JSON decode error: {e}. Attempting repair.")

    fixed = re.sub(r",\s*([}\]])", r"\1", content)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    if content.startswith("{"):
        repaired = _try_close_truncated_json(fixed)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

    start = content.find("{")
    if start != -1:
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(content)):
            c = content[i]
            if in_string:
                if escape:
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == '"':
                    in_string = False
            elif c == '"':
                in_string = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[start : i + 1])
                    except json.JSONDecodeError:
                        pass

    return None


def _get_key(raw: Dict, *candidates: str) -> Any:
    """Get value from dict trying multiple keys (LLMs often use 'Skills' vs 'skills', etc.)."""
    for key in candidates:
        if key in raw and raw[key] is not None:
            return raw[key]
    raw_lower = {str(k).lower().strip(): v for k, v in raw.items()}
    for key in candidates:
        k = key.lower().strip()
        if k in raw_lower and raw_lower[k] is not None:
            return raw_lower[k]
    return None


def _normalize_parsed(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure output has the expected shape and types for the pipeline and DB."""

    def safe_list(val, default=None):
        if default is None:
            default = []
        return list(val) if isinstance(val, list) else default

    def safe_str(val):
        return str(val).strip() if val is not None and str(val).strip() else None

    def safe_float(val, default=0.0):
        try:
            return float(val) if val is not None else default
        except (TypeError, ValueError):
            return default

    education = []
    for item in safe_list(_get_key(raw, "education") or []):
        if isinstance(item, dict):
            education.append(
                {
                    "degree": safe_str(_get_key(item, "degree", "Degree")),
                    "field": safe_str(
                        _get_key(item, "field", "Field", "field of study")
                    ),
                    "institution": safe_str(
                        _get_key(item, "institution", "Institution", "school")
                    ),
                    "location": safe_str(_get_key(item, "location", "Location")),
                    "start_date": safe_str(
                        _get_key(item, "start_date", "Start Date", "start")
                    ),
                    "end_date": safe_str(_get_key(item, "end_date", "End Date", "end")),
                }
            )
        else:
            education.append(item)

    certifications = []
    for item in safe_list(_get_key(raw, "certifications") or []):
        if isinstance(item, dict):
            cname = safe_str(
                _get_key(item, "name", "title", "Title", "name/title")
            ) or (str(item).strip() if item else None)
            cissuer = safe_str(_get_key(item, "issuer", "provider", "Provider"))
            certifications.append(
                {"name": cname or str(item).strip(), "issuer": cissuer}
            )
        else:
            certifications.append({"name": str(item).strip(), "issuer": None})

    experience = []
    for item in safe_list(_get_key(raw, "experience") or []):
        if isinstance(item, dict):
            resp = _get_key(
                item,
                "responsibilities",
                "Responsibilities",
                "description",
                "Description",
                "duties",
            )
            if isinstance(resp, list):
                responsibilities = [str(r).strip() for r in resp if r]
            elif resp:
                responsibilities = [str(resp).strip()]
            else:
                responsibilities = []
            experience.append(
                {
                    "title": safe_str(
                        _get_key(
                            item, "title", "Title", "job title", "position", "Position"
                        )
                    ),
                    "company": safe_str(
                        _get_key(item, "company", "Company", "employer", "Employer")
                    ),
                    "location": safe_str(_get_key(item, "location", "Location")),
                    "start_date": safe_str(
                        _get_key(item, "start_date", "Start Date", "start")
                    ),
                    "end_date": safe_str(_get_key(item, "end_date", "End Date", "end")),
                    "responsibilities": responsibilities,
                }
            )
        else:
            experience.append(item)

    projects = []
    for item in safe_list(_get_key(raw, "projects") or []):
        if isinstance(item, dict):
            name_val = safe_str(_get_key(item, "name", "title", "Title"))
            desc = item.get("description")
            if isinstance(desc, list):
                description = [str(d).strip() for d in desc if str(d).strip()]
            elif desc is not None:
                description = [str(desc).strip()] if str(desc).strip() else []
            else:
                description = []
            if not name_val and not description:
                continue
            if name_val and name_val.lower() in {"project", "projects"} and not description:
                continue
            projects.append(
                {
                    "name": name_val,
                    "description": description,
                    "start_date": safe_str(item.get("start_date")),
                    "end_date": safe_str(item.get("end_date")),
                }
            )
        else:
            text = str(item).strip()
            if text and text.lower() not in {"project", "projects"}:
                projects.append(text)

    name = safe_str(_get_key(raw, "name", "full_name", "full name"))

    def skill_to_string(s: Any) -> Optional[str]:
        """Turn one skill entry (string or dict like {'name': 'Python'}) into a single string."""
        if s is None:
            return None
        if isinstance(s, str):
            return s.strip() or None
        if isinstance(s, dict):
            text = safe_str(_get_key(s, "name", "skill", "title", "Skill", "Name"))
            if text:
                return text
            for v in s.values():
                if isinstance(v, str) and v.strip():
                    return v.strip()
            return None
        return str(s).strip() or None

    skills_val = _get_key(raw, "technical_skills", "skills")
    if isinstance(skills_val, str):
        skills_raw = [s.strip() for s in re.split(r"[,;\n|]", skills_val) if s.strip()]
    else:
        skills_raw = safe_list(skills_val or [])
    technical_skills = [x.lower() for s in skills_raw if (x := skill_to_string(s))]

    soft_val = _get_key(raw, "soft_skills")
    soft_list = (
        safe_list(soft_val)
        if not isinstance(soft_val, str)
        else [s.strip() for s in re.split(r"[,;\n|]", str(soft_val)) if s.strip()]
    )
    soft_skills = [x.lower() for s in soft_list if (x := skill_to_string(s))]

    confidence = safe_float(_get_key(raw, "confidence"), 0.0)
    if (confidence == 0.0 or confidence < 0.3) and (
        name or technical_skills or education or experience
    ):
        confidence = min(
            0.95,
            0.1
            * (
                (0.15 if name else 0)
                + (0.15 if _get_key(raw, "email") else 0)
                + (0.1 if _get_key(raw, "phone") else 0)
                + (0.2 * min(1.0, len(technical_skills) / 10.0))
                + (0.2 if education else 0)
                + (0.2 if experience else 0)
            ),
        )
    confidence = max(0.0, min(1.0, confidence))

    return {
        "name": name,
        "email": safe_str(_get_key(raw, "email")),
        "phone": safe_str(_get_key(raw, "phone")),
        "technical_skills": technical_skills,
        "soft_skills": soft_skills,
        "languages": [
            str(s).strip()
            for s in safe_list(_get_key(raw, "languages") or [])
            if str(s).strip()
        ],
        "education": education,
        "certifications": certifications,
        "experience": experience,
        "projects": projects,
        "confidence": round(confidence, 2),
    }


class LLMResumeParser:
    """
    Extract structured resume data using a Small Language Model (SLM).
    Returns a fixed structure for pipeline and DB compatibility.
    """

    def __init__(self, model: Optional[str] = None):
        """
        Initialize the parser.
        Default: Hugging Face Llama 3.1 Instruct.
        """
        from decouple import config

        if model:
            self.model = model
        else:
            self.model = config("LLM_MODEL", default="meta-llama/Llama-3.1-8B-Instruct")

    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse resume text with LLM and return structured data for the pipeline.
        """
        if not text or len(text.strip()) < 10:
            logger.warning("Resume text too short for LLM parsing")
            return _normalize_parsed(
                {
                    "name": None,
                    "email": None,
                    "phone": None,
                    "technical_skills": [],
                    "soft_skills": [],
                    "languages": [],
                    "education": [],
                    "certifications": [],
                    "experience": [],
                    "projects": [],
                    "confidence": 0.0,
                }
            )

        client = _get_client()
        user_prompt = CV_EXTRACTION_PROMPT + "\n\n" + text[:CV_TEXT_MAX_CHARS]

        messages = [
            {
                "role": "system",
                "content": "Output only valid JSON. No markdown, no comments.",
            },
            {"role": "user", "content": user_prompt},
        ]
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=LLM_MAX_TOKENS,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            if (
                "response_format" in str(e).lower()
                or "json_object" in str(e).lower()
                or "unexpected keyword" in str(e).lower()
            ):
                response = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.0,
                    max_tokens=LLM_MAX_TOKENS,
                )
            else:
                logger.error(f"LLM API call failed: {e}")
                raise

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            raise ValueError("LLM returned empty response")

        parsed = _extract_json_from_response(content)
        if not parsed:
            raise ValueError("LLM response did not contain valid JSON")

        result = _normalize_parsed(parsed)
        n_tech = len(result.get("technical_skills", []))
        n_soft = len(result.get("soft_skills", []))
        if n_tech == 0 and n_soft == 0 and isinstance(parsed, dict):
            logger.warning(
                "LLM returned 0 skills; raw JSON keys: %s (normalizer accepts e.g. 'skills', 'Skills', 'technical_skills')",
                list(parsed.keys()),
            )
        logger.info(
            f"LLM parsing complete: {n_tech} technical skills, "
            f"{n_soft} soft skills, confidence={result.get('confidence', 0):.2f}"
        )
        return result
