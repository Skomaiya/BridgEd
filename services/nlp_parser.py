"""
NLP Resume Parser Module - Enhanced Version

This module provides Natural Language Processing capabilities for extracting
structured data from unstructured resume/CV text.

Enhanced to return structured objects for education and experience sections,
with improved confidence scoring and section detection.
"""

import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from .skill_keywords import SKILL_KEYWORDS

# Configure logging for this module
logger = logging.getLogger(__name__)


class NLPResumeParser:
    """
    Extract structured information from unstructured resume text.
    
    Enhanced version with structured data extraction for education and experience.
    """

    # ============ REGEX PATTERNS ============
    
    EMAIL_REGEX = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    PHONE_REGEX = r"\+?\d[\d\s\-\(\)]{8,15}"
    
    NAME_PATTERNS = [
        r"^([A-Z][a-z]+\s+[A-Z][a-z]+)",
        r"Name:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)",
        r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n",
    ]
    
    # Degree patterns
    DEGREE_PATTERNS = [
        r"(bachelor|b\.?sc|b\.?a|undergraduate).*?(?:in|of)?\s*([\w\s]+?)(?:,|\n|$)",
        r"(master|m\.?sc|m\.?a|graduate).*?(?:in|of)?\s*([\w\s]+?)(?:,|\n|$)",
        r"(phd|ph\.d|doctorate|doctoral).*?(?:in|of)?\s*([\w\s]+?)(?:,|\n|$)",
        r"(diploma).*?(?:in|of)?\s*([\w\s]+?)(?:,|\n|$)",
    ]
    
    # Date patterns
    DATE_PATTERNS = [
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})",
        r"(\d{4})",
        r"(present|current|ongoing|now)",
    ]
    
    # Section headers
    EDUCATION_HEADERS = [
        "education", "academic", "qualifications", "academic background",
        "educational background", "academic qualifications"
    ]
    
    EXPERIENCE_HEADERS = [
        "experience", "work experience", "employment", "work history",
        "professional experience", "employment history", "career history"
    ]
    
    # Skills section headers
    SKILLS_HEADERS = [
        "skills", "technical skills", "core competencies", "expertise",
        "technologies", "proficiencies", "tools", "languages", "competencies",
        "technical expertise", "key skills"
    ]
    
    # Projects section headers
    PROJECTS_HEADERS = [
        "projects", "personal projects", "key projects", "notable projects",
        "technical projects", "project experience", "portfolio", "work samples"
    ]
    
    # Soft skills to separate from technical skills
    SOFT_SKILLS = {
        'leadership', 'communication', 'teamwork', 'problem solving',
        'adaptability', 'flexibility', 'detail oriented', 'team player',
        'soft skills', 'hard skills', 'interpersonal', 'time management',
        'critical thinking', 'analytical thinking', 'team collaboration',
        'team collaborator', 'collaboration', 'organizational', 'multitasking',
        'creativity', 'innovation', 'decision making', 'conflict resolution',
        'emotional intelligence', 'work ethic', 'self motivated', 'proactive',
        'attention to detail', 'reliable', 'punctual', 'professional'
    }
    
    # Spoken languages to filter from technical skills (50+ languages)
    SPOKEN_LANGUAGES = {
        'english', 'french', 'spanish', 'german', 'italian', 'portuguese',
        'russian', 'chinese', 'japanese', 'korean', 'arabic', 'hindi',
        'swahili', 'yoruba', 'igbo', 'hausa', 'amharic', 'zulu',
        'afrikaans', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish',
        'polish', 'turkish', 'vietnamese', 'thai', 'indonesian', 'malay',
        'urdu', 'bengali', 'punjabi', 'tamil', 'telugu', 'marathi',
        'gujarati', 'kannada', 'oriya', 'malayalam', 'assamese',
        'mandarin', 'cantonese', 'tagalog', 'czech', 'hungarian',
        'romanian', 'greek', 'hebrew', 'persian', 'farsi'
    }
    
    CERTIFICATION_KEYWORDS = [
        "certification", "certificate", "certified", "training"
    ]
    
    # Degree type validation list - comprehensive list of recognized degrees
    VALID_DEGREE_TYPES = [
        # Bachelor's degrees
        "bachelor", "bachelor's", "bachelors", "b.sc", "b.s", "b.a", "ba", "bs", "bsc",
        "bachelor of science", "bachelor of arts", "bachelor of engineering",
        "b.eng", "b.tech", "btech", "undergraduate degree", "undergraduate",
        
        # Master's degrees
        "master", "master's", "masters", "m.sc", "m.s", "m.a", "ma", "ms", "msc",
        "master of science", "master of arts", "master of engineering",
        "m.eng", "m.tech", "mba", "m.b.a", "graduate degree", "postgraduate",
        
        # Doctoral degrees
        "phd", "ph.d", "doctorate", "doctoral", "doctor of philosophy",
        "dphil", "d.phil", "edd", "ed.d", "dba", "d.b.a",
        
        # Diplomas and Certificates (academic)
        "diploma", "advanced diploma", "graduate diploma", "postgraduate diploma",
        "associate degree", "associate's", "a.a", "a.s", "associate",
        
        # Professional degrees
        "j.d", "jd", "juris doctor", "m.d", "md", "doctor of medicine",
        "dds", "d.d.s", "pharm.d", "pharmd"
    ]
    
    # Certification indicators (non-degree credentials)
    CERTIFICATION_INDICATORS = [
        "certification", "certificate", "certified", "training",
        "course completion", "professional certificate", "credential",
        "license", "licensed", "accreditation", "accredited",
        "workshop", "bootcamp", "nanodegree"
    ]
    
    # Institution type keywords
    INSTITUTION_KEYWORDS = [
        "university", "college", "institute", "school", "academy",
        "polytechnic", "conservatory", "seminary", "institution"
    ]
    
    # NOTE: FIELD_OF_STUDY_KEYWORDS removed - generic keywords like "data", "science"
    # caused false positives when matching against experience text.
    # Field extraction now uses structural patterns from degree line only.
    
    # Job title patterns
    JOB_TITLE_KEYWORDS = [
        "developer", "engineer", "manager", "analyst", "consultant",
        "specialist", "coordinator", "assistant", "lead", "senior",
        "junior", "intern", "designer", "architect", "administrator",
        "director", "officer", "executive"
    ]
    
    # Achievement and metrics patterns for detecting quantified accomplishments
    ACHIEVEMENT_PATTERNS = [
        # Percentages (e.g., "40%", "increased by 25%")
        r'(\d+(?:\.\d+)?%)',
        
        # Numbers with context (e.g., "5 developers", "10,000+ transactions")
        r'(\d+(?:,\d{3})*(?:\+)?)\s+(users|customers|clients|transactions|requests|records|files|developers|engineers|people|members|projects|applications|systems)',
        
        # Ranges and improvements (e.g., "from 3s to 1.5s", "by 40% to 60%")
        r'(?:from|reduced|decreased|improved)\s+(\d+(?:\.\d+)?(?:%|x|s|ms)?)\s+(?:to|by)\s+(\d+(?:\.\d+)?(?:%|x|s|ms)?)',
        
        # Team sizes (e.g., "team of 5", "group of 10 developers")
        r'(?:team|group)\s+of\s+(\d+)',
        
        # Time improvements (e.g., "3 seconds to 1.5 seconds")
        r'(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?|weeks?|months?)\s+to\s+(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?)',
        
        # Money amounts (e.g., "$500k", "$2.5 million")
        r'\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:million|thousand|billion|k|m|b)?',
        
        # Multipliers (e.g., "2x faster", "3x improvement")
        r'(\d+(?:\.\d+)?x)\s+(?:faster|improvement|increase|growth)',
    ]

    def __init__(self):
        """Initialize the NLP Resume Parser."""
        logger.info("NLPResumeParser initialized (Enhanced Version)")
        
    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse resume text and extract all structured data.
        
        Returns enhanced structure with objects for education and experience.
        """
        logger.info(f"Parsing resume text ({len(text)} characters)")
        
        # Detect sections first
        sections = self._detect_sections(text)
        
        # Extract all components
        name = self._extract_name(text)
        email = self._extract_email(text)
        phone = self._extract_phone(text)
        skills = self._extract_skills(text)
        languages = self._extract_languages(text)
        
        # Extract structured education and experience
        education_data = self._extract_education_structured(
            sections.get('education', text)
        )
        # Extract structured experience data
        experience_data = self._extract_experience_structured(text)
        
        # Extract projects
        projects = self._extract_projects(text)
        
        # Calculate confidence score
        confidence = self._calculate_enhanced_confidence(
            name, email, phone, skills.get('technical_skills', []), education_data, experience_data
        )
        
        logger.info(f"Parse complete - Confidence: {confidence:.2f}")
        
        return {
            'name': name,
            'email': email,
            'phone': phone,
            'technical_skills': skills.get('technical_skills', []),
            'soft_skills': skills.get('soft_skills', []),
            'languages': languages,
            'education': education_data.get('degrees', []),
            'certifications': education_data.get('certifications', []),
            'experience': experience_data,
            'projects': projects,
            'confidence': confidence
        }

    def _detect_sections(self, text: str) -> Dict[str, str]:
        """
        Detect and extract different sections from the resume.
        
        Returns:
            Dictionary with section names as keys and section text as values
        """
        sections = {}
        lines = text.split('\n')
        current_section = None
        section_content = []
        
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            
            # Check for education headers
            if any(header in line_lower for header in self.EDUCATION_HEADERS):
                if current_section:
                    sections[current_section] = '\n'.join(section_content)
                current_section = 'education'
                section_content = []
                continue
            
            # Check for experience headers
            elif any(header in line_lower for header in self.EXPERIENCE_HEADERS):
                if current_section:
                    sections[current_section] = '\n'.join(section_content)
                current_section = 'experience'
                section_content = []
                continue
            
            # Add content to current section
            if current_section:
                section_content.append(line)
        
        # Add last section
        if current_section:
            sections[current_section] = '\n'.join(section_content)
        
        logger.debug(f"Detected sections: {list(sections.keys())}")
        return sections

    def _validate_degree_type(self, text: str) -> Optional[str]:
        """
        Validate if text contains a recognized degree type.
        
        Args:
            text: Text to check for degree type
            
        Returns:
            Standardized degree name if valid, None otherwise
        """
        text_lower = text.lower().strip()
        
        for degree_type in self.VALID_DEGREE_TYPES:
            # Use word boundary matching to avoid partial matches
            pattern = r'\b' + re.escape(degree_type) + r'\b'
            if re.search(pattern, text_lower):
                # Return a standardized version
                if any(x in degree_type for x in ["bachelor", "b.sc", "b.s", "b.a", "ba", "bs", "bsc", "b.eng", "b.tech"]):
                    return "Bachelor's Degree"
                elif any(x in degree_type for x in ["master", "m.sc", "m.s", "m.a", "ma", "ms", "msc", "mba", "m.eng", "m.tech"]):
                    return "Master's Degree"
                elif any(x in degree_type for x in ["phd", "ph.d", "doctorate", "doctoral", "dphil", "edd", "dba"]):
                    return "Doctoral Degree"
                elif "diploma" in degree_type:
                    return "Diploma"
                elif "associate" in degree_type:
                    return "Associate Degree"
                else:
                    return degree_type.title()
        
        return None

    def _extract_field_of_study(self, text: str, degree_line: str) -> Optional[str]:
        """
        Extract field of study from the degree line only using structural patterns.
        
        This method extracts the field ONLY from the degree line itself to avoid
        false positives from experience text containing words like "data" or "science".
        
        Args:
            text: Full text context (unused, kept for backward compatibility)
            degree_line: The line containing the degree
            
        Returns:
            Field of study if found and valid, None otherwise
        """
        # Pattern 1: "of [Degree Type] in [Field]" (e.g., "Bachelor of Science in CS")
        # This handles "Bachelor of Arts in Psychology" correctly
        pattern_of_in = r'of\s+(?:science|arts|engineering|business)\s+in\s+([A-Z][a-zA-Z\s&]+?)(?:\s*,|\s*\n|\s*\d{4}|$)'
        
        # Pattern 2: "in [Field]" (e.g., "B.Sc in Software Engineering")
        pattern_in = r'(?:^|[^\w])in\s+([A-Z][a-zA-Z\s&]+?)(?:\s*,|\s*\n|\s*\d{4}|$)'
        
        # Pattern 3: "major: [Field]" or "specialization: [Field]"
        pattern_major = r'(?:major|specialization|concentration):\s*([A-Z][a-zA-Z\s&]+?)(?:\s*,|\s*\n|$)'
        
        # Try patterns in order of specificity
        for pattern in [pattern_of_in, pattern_in, pattern_major]:
            match = re.search(pattern, degree_line, re.IGNORECASE)
            if match:
                field = match.group(1).strip()
                
                # Basic validation: reasonable length, capitalized
                word_count = len(field.split())
                if 1 <= word_count <= 6 and field[0].isupper():
                    # Remove trailing degree type words if present
                    field = re.sub(r'\s+(bachelor|master|phd|diploma|degree).*$', '', field, flags=re.IGNORECASE)
                    # Remove trailing university/college if present
                    field = re.sub(r'\s+(university|college|institute).*$', '', field, flags=re.IGNORECASE)
                    
                    field = field.strip()
                    if field:  # Make sure we still have content after cleanup
                        logger.debug(f"Extracted field of study: {field}")
                        return field
        
        return None

    def _is_certification(self, text: str) -> bool:
        """
        Determine if a line represents a certification rather than a degree.
        
        Args:
            text: Text to analyze
            
        Returns:
            True if this is a certification, False if it's a degree
        """
        text_lower = text.lower()
        
        # Strong certification indicators
        if any(indicator in text_lower for indicator in self.CERTIFICATION_INDICATORS):
            # Make sure it's NOT also a degree
            if not self._validate_degree_type(text):
                return True
        
        # Check for certification-specific patterns
        cert_patterns = [
            r'certified\s+\w+',  # "Certified Professional"
            r'\w+\s+certification',  # "AWS Certification"
            r'certificate\s+in',  # "Certificate in Data Science"
            r'professional\s+certificate',  # "Google Professional Certificate"
        ]
        
        for pattern in cert_patterns:
            if re.search(pattern, text_lower):
                return True
        
        return False

    def _contains_date(self, text: str) -> bool:
        """
        Check if text contains date patterns.
        
        Args:
            text: Text to check
            
        Returns:
            True if text contains dates, False otherwise
        """
        for pattern in self.DATE_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _extract_company_name(self, lines: List[str], current_index: int) -> Optional[str]:
        """
        Extract company name from experience section.        
        Args:
            lines: All lines in the experience section
            current_index: Index of the current job title line
            
        Returns:
            Company name if found, None otherwise
        """
        # Check current line for pattern: "Job Title at Company Name"
        current_line = lines[current_index]
        at_match = re.search(r'\s+at\s+([A-Z][a-zA-Z0-9\s&.,]+?)(?:\s*,|\s*\n|$)', current_line, re.IGNORECASE)
        if at_match:
            company = at_match.group(1).strip()
            # Remove trailing dates if present
            company = re.sub(r'\s+\d{4}.*$', '', company)
            return company
        
        # Check next line if it doesn't contain job title keywords or dates
        if current_index + 1 < len(lines):
            next_line = lines[current_index + 1].strip()
            
            # Skip if it's a bullet point (it's a responsibility, not company)
            if next_line.startswith(('•', '-', '*', '◦', '▪', '●', '–', '—')):
                logger.debug(f"Skipped bullet point as company: {next_line[:50]}")
                return None
            
            # Skip if it contains dates
            if self._contains_date(next_line):
                return None
            
            # Skip if it starts with action verbs (it's a responsibility)
            action_verbs = ['design', 'develop', 'manage', 'create', 'implement', 'build', 
                           'lead', 'coordinate', 'organize', 'conduct', 'support', 'assist',
                           'maintain', 'improve', 'enhance', 'optimize', 'analyze', 'collaborate']
            if any(next_line.lower().startswith(verb) for verb in action_verbs):
                logger.debug(f"Skipped action verb line as company: {next_line[:50]}")
                return None
            
            # Skip if it's too long (likely a description)
            word_count = len(next_line.split())
            if word_count > 10:
                logger.debug(f"Skipped long line as company ({word_count} words): {next_line[:50]}")
                return None
            
            # Check if it looks like a company name (capitalized, reasonable length)
                if next_line and len(next_line) > 0 and next_line[0].isupper() and 2 <= len(next_line.split()) <= 8:
                    # Make sure it's not a job title
                    if not any(keyword in next_line.lower() for keyword in self.JOB_TITLE_KEYWORDS):
                        return next_line
        
        return None

    def _extract_metrics_from_responsibility(self, text: str) -> Dict[str, Any]:
        """
        Extract quantified metrics and achievements from a responsibility text.
        
        Args:
            text: Responsibility text to analyze
            
        Returns:
            Dictionary with 'text' and optional 'metrics' array
        """
        metrics = []
        
        for pattern in self.ACHIEVEMENT_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                metric_value = match.group(0)
                # Avoid duplicates
                if not any(m['value'] == metric_value for m in metrics):
                    metrics.append({
                        'value': metric_value,
                        'type': self._classify_metric_type(metric_value)
                    })
        
        result = {'text': text}
        if metrics:
            result['metrics'] = metrics
            logger.debug(f"Extracted {len(metrics)} metrics from: {text[:50]}...")
        
        return result

    def _classify_metric_type(self, value: str) -> str:
        """
        Classify the type of metric based on its format.
        
        Args:
            value: The metric value string
            
        Returns:
            Type classification: 'percentage', 'count', 'money', 'time', 'multiplier'
        """
        if '%' in value:
            return 'percentage'
        elif '$' in value:
            return 'money'
        elif 'x' in value.lower():
            return 'multiplier'
        elif any(unit in value.lower() for unit in ['second', 'minute', 'hour', 'day', 'week', 'month']):
            return 'time'
        else:
            return 'count'

    def _detect_skills_section(self, text: str) -> Optional[str]:
        """
        Detect and extract the Skills section from resume.
        
        Looks for section headers like "Skills", "Technical Skills", etc.
        and extracts all content until the next major section.
        
        Args:
            text: Full resume text
            
        Returns:
            Skills section text if found, None otherwise
        """
        lines = text.split('\n')
        in_skills_section = False
        skills_content = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            line_lower = line_stripped.lower()
            
            # Check for skills section header
            if any(header == line_lower or line_lower.startswith(header + ':') 
                   for header in self.SKILLS_HEADERS):
                in_skills_section = True
                logger.debug(f"Found Skills section at line {i}: {line_stripped}")
                continue
            
            # Check if we've moved to a new section
            if in_skills_section:
                # Stop if we hit another major section
                if any(header in line_lower for header in 
                       self.EDUCATION_HEADERS + self.EXPERIENCE_HEADERS):
                    logger.debug(f"Skills section ended at line {i}")
                    break
                
                # Add content to skills section
                if line_stripped:
                    skills_content.append(line_stripped)
        
        if skills_content:
            result = '\n'.join(skills_content)
            logger.info(f"Extracted Skills section with {len(skills_content)} lines")
            return result
        return None

    def _extract_skills_from_section(self, skills_text: str) -> List[str]:
        """
        Extract skills from the Skills section text.

        Args:
            skills_text: Text from the Skills section
            
        Returns:
            List of extracted skills (lowercase, deduplicated)
        """
        skills = set()
        

        
        # Remove bullet points and clean up
        cleaned_text = re.sub(r'[•\-\*◦▪●–—]\s*', '', skills_text)
        
        # Split by common delimiters: commas, pipes, semicolons, newlines, middle dots, slashes
        skill_items = re.split(r'[,|;\n·•/]', cleaned_text)
        
        for item in skill_items:
            item = item.strip()
            
            # Skip empty items or category labels
            if not item or item.endswith(':') or len(item) < 2:
                continue
            
            # Handle category labels with skills after colon
            # e.g., "Languages: Python, Java"
            if ':' in item:
                parts = item.split(':', 1)
                if len(parts) == 2:
                    # Recursively process the skills part
                    sub_skills = self._extract_skills_from_section(parts[1])
                    skills.update(sub_skills)
                    continue
            
            # Clean up the skill
            skill = item.strip('.,;')
            skill_lower = skill.lower()
            
            # FILTER: Skip spoken languages
            if skill_lower in self.SPOKEN_LANGUAGES:
                logger.debug(f"Skipped language in section extraction: {skill}")
                continue
            
            # Validate: reasonable length, not a full sentence
            # Made more lenient: up to 5 words and 60 chars
            word_count = len(skill.split())
            if 1 <= word_count <= 5 and len(skill) <= 60:
                skills.add(skill_lower)
                logger.debug(f"Added skill from section: {skill_lower}")
            else:
                logger.debug(f"Rejected skill (too long or invalid): {skill}")
        
        logger.info(f"Extracted {len(skills)} skills from Skills section")
        return sorted(list(skills))

    def _is_valid_technical_skill(self, skill: str) -> tuple[bool, str]:
        """
        Validate if extracted text is a technical skill and categorize it.
        
        Returns:
            Tuple of (is_valid, category) where category is 'technical' or 'soft'
        
        Rejects:
            - Course names (contains "by coursera", "by codecademy", etc.)
            - Certifications (contains "certification", "certificate")
            - Generic words (classroom, certificates, etc.)
            - Fragments starting with conjunctions ("and", "or")
            - Spoken languages (English, French, etc.)
        """
        skill_lower = skill.lower().strip()
        
        if skill_lower in self.SPOKEN_LANGUAGES:
            logger.debug(f"Rejected spoken language: {skill}")
            return (False, None)
        
        # FILTER 2: Courses and certifications
        course_indicators = ['course', 'certification', 'certificate', 'training', 'bootcamp', 'program']
        if any(indicator in skill_lower for indicator in course_indicators):
            logger.debug(f"Rejected course/certification: {skill}")
            return (False, None)
        
        # FILTER 3: Too short or too long
        if len(skill) < 2 or len(skill) > 50:
            logger.debug(f"Rejected due to length: {skill}")
            return (False, None)
        
        # FILTER 4: Generic fragments
        generic_terms = ['skills', 'knowledge', 'experience', 'proficiency', 'ability']
        if skill_lower in generic_terms:
            logger.debug(f"Rejected generic term: {skill}")
            return (False, None)
        
        # CATEGORIZE: Check if it's a soft skill
        if skill_lower in self.SOFT_SKILLS:
            logger.debug(f"Categorized as soft skill: {skill}")
            return (True, 'soft')
        
        # It's a technical skill
        logger.debug(f"Categorized as technical skill: {skill}")
        return (True, 'technical')

    def _extract_languages(self, text: str) -> List[str]:
        """Extract spoken languages from resume."""
        languages = set()
        
        # Common language section headers
        headers = ['languages', 'language skills', 'language proficiency', 'linguistic skills']
        
        # Detect language section
        lines = text.split('\n')
        in_language_section = False
        
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            
            # Check for language section header
            if any(header == line_lower or line_lower.startswith(header + ':') for header in headers):
                in_language_section = True
                logger.debug(f"Found Languages section at line {i}")
                continue
            
            # Stop at next major section
            if in_language_section:
                if any(header in line_lower for header in 
                       self.SKILLS_HEADERS + self.EDUCATION_HEADERS + self.EXPERIENCE_HEADERS):
                    break
            
            # Extract languages from section
            if in_language_section and line.strip():
                # Split by common separators
                for lang in re.split(r'[,|•\-·]', line):
                    lang = lang.strip()
                    # Remove proficiency levels
                    lang = re.sub(r'\(.*?\)', '', lang).strip()
                    lang = re.sub(r'[-–—]\s*(native|fluent|proficient|intermediate|basic|beginner|advanced).*', '', lang, flags=re.IGNORECASE).strip()
                    
                    # Language names are typically 1-2 words
                    if lang and len(lang.split()) <= 2 and len(lang) > 2:
                        # Capitalize properly
                        lang = lang.title()
                        languages.add(lang)
                        logger.debug(f"Extracted language: {lang}")
        
        logger.info(f"Extracted {len(languages)} languages")
        return sorted(list(languages))

    def _parse_experience_title_line(self, line: str, next_line: Optional[str] = None) -> Dict[str, Optional[str]]:
        """
        Parse experience title line to extract company, title, and location.
        
        Args:
            line: Current line to parse
            next_line: Next line in the text (optional)
            
        Returns:
            Dictionary with 'title', 'company', 'location' keys
        """
        result = {
            'title': None,
            'company': None,
            'location': None
        }
        
        # Pattern 1: "Company · Title | Location · Type"
        if '·' in line:
            parts = line.split('·')
            if len(parts) >= 2:
                # First part is usually company
                potential_company = parts[0].strip()
                title_part = parts[1].strip()
                
                # Check if first part has job title keywords
                if any(kw in potential_company.lower() for kw in self.JOB_TITLE_KEYWORDS):
                    # First part is title, second is company
                    result['title'] = potential_company
                    result['company'] = title_part.split('|')[0].strip()
                else:
                    # First part is company, second is title
                    result['company'] = potential_company
                    result['title'] = title_part.split('|')[0].strip()
                
                # Extract location if present
                if '|' in line:
                    location_part = line.split('|', 1)[1]
                    result['location'] = location_part.split('·')[0].strip()
        
        # Pattern 2: "Title at Company"
        elif ' at ' in line.lower():
            parts = re.split(r'\s+at\s+', line, flags=re.IGNORECASE)
            result['title'] = parts[0].strip()
            result['company'] = parts[1].strip()
        
        # Pattern 3: Check if line is just a company name (no job keywords)
        elif not any(kw in line.lower() for kw in self.JOB_TITLE_KEYWORDS):
            # Likely just a company name
            result['company'] = line
            # Title might be on next line
            if next_line and any(kw in next_line.lower() for kw in self.JOB_TITLE_KEYWORDS):
                result['title'] = next_line
        
        # Pattern 4: Just title (company on next line)
        else:
            result['title'] = line
            # Check next line for company
            if next_line and not any(kw in next_line.lower() for kw in self.JOB_TITLE_KEYWORDS):
                # Next line might be company
                if not self._contains_date(next_line) and not next_line.startswith(('•', '-', '*')):
                    result['company'] = next_line
        
        return result

    def _clean_title(self, title: str) -> str:
        """
        Remove dates and extra information from job title.
        
        Args:
            title: Raw job title string
            
        Returns:
            Cleaned title string
        """
        # Remove date range patterns (e.g., "Jun 2024 - Sep 2024")
        title = re.sub(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}', '', title, flags=re.IGNORECASE)
        
        # Remove single month-year patterns (e.g., "Jun 2024")
        title = re.sub(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}', '', title, flags=re.IGNORECASE)
        
        # Remove year ranges (e.g., "2024 - 2025")
        title = re.sub(r'\d{4}\s*-\s*\d{4}', '', title)
        
        # Remove "Present" or "Current"
        title = re.sub(r'\d{4}\s*-\s*(?:Present|Current)', '', title, flags=re.IGNORECASE)
        
        # Remove MM/YYYY patterns
        title = re.sub(r'\b\d{1,2}/\d{4}', '', title)
        
        # Clean up extra whitespace and dashes
        title = re.sub(r'\s*-\s*$', '', title)  # Remove trailing dash
        title = re.sub(r'^\s*-\s*', '', title)  # Remove leading dash
        title = re.sub(r'\s+', ' ', title)  # Normalize whitespace
        
        return title.strip()

    def _is_valid_job_title(self, line: str) -> bool:
        """
        Validate if line is actually a job title (not a project description or skills list).
        
        Args:
            line: Line to validate
            
        Returns:
            True if valid job title, False otherwise
        """
        # Reject if multiple bullet separators (skills list)
        if line.count('·') > 2:
            return False
        
        # Reject if starts with lowercase (continuation text)
        if line and line[0].islower():
            return False
        
        # Reject if contains project description keywords
        project_indicators = ['application', 'system', 'platform', 'website', 'tool', 'supports', 'features']
        if any(indicator in line.lower() for indicator in project_indicators):
            # Check if it's actually describing functionality
            if any(word in line.lower() for word in ['also', 'provides', 'allows', 'enables', 'includes']):
                return False
        
        return True

    def _extract_dates(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract start and end dates from text.
        
        Returns:
            Tuple of (start_date, end_date)
        """
        dates = []
        text_lower = text.lower()
        
        # Find all date matches
        for pattern in self.DATE_PATTERNS:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                if len(match.groups()) >= 2:
                    # Month + Year
                    dates.append(f"{match.group(1).capitalize()} {match.group(2)}")
                elif 'present' in match.group(0) or 'current' in match.group(0):
                    dates.append("Present")
                else:
                    # Just year
                    dates.append(match.group(0))
        
        if len(dates) == 0:
            return None, None
        elif len(dates) == 1:
            return dates[0], None
        else:
            return dates[0], dates[-1]

    def _is_certification(self, line: str) -> bool:
        """
        Check if a line represents a certification.
        
        Args:
            line: Text line to check
            
        Returns:
            True if line appears to be a certification
        """
        line_lower = line.lower()
        
        # Check for certification keywords
        cert_keywords = ['certification', 'certificate', 'certified', 'cert.']
        if any(keyword in line_lower for keyword in cert_keywords):
            # Make sure it's not a degree (e.g., "Certificate in Computer Science" vs "Bachelor's Degree")
            degree_keywords = ['bachelor', 'master', 'phd', 'doctorate', 'b.sc', 'm.sc', 'degree']
            if not any(deg in line_lower for deg in degree_keywords):
                return True
        
        return False

    def _extract_education_structured(self, text: str) -> Dict[str, List[Dict]]:
        """
        Extract education information as structured objects with validation.
        
        Returns:
            Dictionary with 'degrees' and 'certifications' arrays
        """
        degrees = []
        certifications = []
        lines = text.split('\n')
        
        current_entry = {}
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            if not line or len(line) < 3:
                i += 1
                continue
            
            line_lower = line.lower()
            
            # Check if this is a certification (do this FIRST to avoid mixing with degrees)
            if self._is_certification(line):
                cert_name = line.strip('•').strip('-').strip('*').strip()
                # Extract issuer if present
                issuer_match = re.search(r'by\s+([A-Z][a-zA-Z0-9\s&]+)', cert_name, re.IGNORECASE)
                issuer = issuer_match.group(1).strip() if issuer_match else None
                
                certifications.append({
                    "name": cert_name,
                    "issuer": issuer
                })
                i += 1
                continue
            
            # Validate degree type using validation list
            degree_type = self._validate_degree_type(line)
            if degree_type:
                current_entry['degree'] = degree_type
                
                # Extract field of study from same line
                field = self._extract_field_of_study(text, line)
                if field:
                    current_entry['field'] = field
                
                # Extract dates from degree line
                start, end = self._extract_dates(line)
                if start:
                    current_entry['start_date'] = start
                    if end:
                        current_entry['end_date'] = end
            
            # Check for institution using keyword validation
            if any(keyword in line_lower for keyword in self.INSTITUTION_KEYWORDS):
                # Parse institution and location
                parts = line.split(',')
                if len(parts) >= 2:
                    current_entry['institution'] = parts[0].strip()
                    current_entry['location'] = ','.join(parts[1:]).strip()
                else:
                    current_entry['institution'] = line
                
                # Extract dates from institution line if not already found
                if 'start_date' not in current_entry:
                    start, end = self._extract_dates(line)
                    if start:
                        current_entry['start_date'] = start
                        if end:
                            current_entry['end_date'] = end
            
            # If we don't have dates yet, try to extract from current line
            if current_entry and 'start_date' not in current_entry:
                start, end = self._extract_dates(line)
                if start:
                    current_entry['start_date'] = start
                    if end:
                        current_entry['end_date'] = end
                    
                    # Dates often mark the end of an entry
                    if 'degree' in current_entry or 'institution' in current_entry:
                        degrees.append(dict(current_entry))
                        current_entry = {}
            
            # If we have both degree and institution, and the next line doesn't look related, save entry
            if current_entry and 'degree' in current_entry and 'institution' in current_entry:
                # Check if next line is a new entry
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if (self._validate_degree_type(next_line) or 
                        any(keyword in next_line.lower() for keyword in self.INSTITUTION_KEYWORDS) or
                        self._is_certification(next_line)):
                        # Next line is a new entry, save current one
                        degrees.append(dict(current_entry))
                        current_entry = {}
            
            i += 1
        
        # Add any remaining entry
        if current_entry and ('degree' in current_entry or 'institution' in current_entry):
            degrees.append(current_entry)
        
        logger.info(f"Extracted {len(degrees)} degrees and {len(certifications)} certifications")
        return {
            'degrees': degrees,
            'certifications': certifications
        }

    def _extract_experience_structured(self, text: str) -> List[Dict]:
        """
        Extract structured experience data with validation.
        
        Returns list of experience dictionaries with title, company, dates, responsibilities.
        """
        experiences = []
        lines = text.split('\n')
        current_entry = {}
        responsibilities = []
        i = 0
        
        # Track which section we're in to prevent education leakage
        in_education_section = False
        in_experience_section = False
        
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
            
            line_lower = line.lower()
            
            # Check if we're entering Education section
            if any(header in line_lower for header in self.EDUCATION_HEADERS):
                in_education_section = True
                in_experience_section = False
                logger.debug(f"Entered Education section at line {i}")
                i += 1
                continue
            
            # Check if we're entering Experience section
            if any(header in line_lower for header in self.EXPERIENCE_HEADERS):
                in_experience_section = True
                in_education_section = False
                logger.debug(f"Entered Experience section at line {i}")
                i += 1
                continue
            
            # Check if we're entering another major section (Skills, Projects, etc.)
            if any(header in line_lower for header in self.SKILLS_HEADERS + self.PROJECTS_HEADERS):
                in_education_section = False
                in_experience_section = False
                i += 1
                continue
            
            # Skip processing if we're in Education section
            if in_education_section:
                i += 1
                continue
            
            # Check if this is a job title
            if any(keyword in line_lower for keyword in self.JOB_TITLE_KEYWORDS):
                # VALIDATION 1: Skip if it's a bullet point (it's a responsibility, not a title)
                if line.startswith(('•', '-', '*', '◦', '▪', '●', '–', '—')):
                    # Process as responsibility instead
                    responsibility = line.strip('•').strip('-').strip('*').strip('◦').strip('▪').strip('●').strip('–').strip('—').strip()
                    if responsibility and len(responsibility) > 5:
                        resp_data = self._extract_metrics_from_responsibility(responsibility)
                        responsibilities.append(resp_data)
                    i += 1
                    continue
                
                # VALIDATION 2: Skip if it's a certification
                if self._is_certification(line):
                    i += 1
                    continue
                
                # VALIDATION 3: Skip if line is too long (job titles are typically concise)
                if len(line) > 100:
                    i += 1
                    continue
                
                # VALIDATION 4: Validate job title format (NEW)
                if not self._is_valid_job_title(line):
                    logger.debug(f"Rejected invalid job title format: {line}")
                    i += 1
                    continue
                
                # Save previous entry
                if current_entry and 'title' in current_entry:
                    if responsibilities:
                        current_entry['responsibilities'] = responsibilities.copy()
                    experiences.append(dict(current_entry))
                    current_entry = {}
                    responsibilities = []
                
                # Parse title line for company, title, location (NEW)
                next_line_text = lines[i + 1].strip() if i + 1 < len(lines) else None
                parsed = self._parse_experience_title_line(line, next_line_text)
                
                # Extract and clean title
                if parsed['title']:
                    cleaned_title = self._clean_title(parsed['title'])
                    if cleaned_title:  # Only add if not empty after cleaning
                        current_entry['title'] = cleaned_title
                else:
                    # Fallback: use original line and clean it
                    cleaned_title = self._clean_title(line)
                    if cleaned_title:
                        current_entry['title'] = cleaned_title
                
                # Add company if found
                if parsed['company']:
                    company = parsed['company']
                    # Clean company: remove bullet descriptions
                    # If company starts with bullet, it's actually a description
                    if company.startswith(('•', '-', '*', '◦', '▪', '●', '–', '—')):
                        logger.debug(f"Company field contains bullet description, clearing: {company[:50]}")
                        company = None
                    # If company contains action verbs at start, it's a description
                    elif company and any(company.lower().startswith(verb) for verb in 
                                        ['design', 'develop', 'manage', 'create', 'implement', 'build',
                                         'lead', 'coordinate', 'organize', 'conduct', 'support', 'assist',
                                         'instruct', 'teach', 'train', 'mentor', 'guide']):
                        logger.debug(f"Company field contains action verb description, clearing: {company[:50]}")
                        company = None
                    
                    if company:
                        current_entry['company'] = company
                else:
                    # Try existing company extraction method as fallback
                    company = self._extract_company_name(lines, i)
                    if company:
                        current_entry['company'] = company
                
                # Add location if found
                if parsed['location']:
                    current_entry['location'] = parsed['location']
                
                # Extract dates from job title line
                start, end = self._extract_dates(line)
                if start:
                    current_entry['start_date'] = start
                    if end:
                        current_entry['end_date'] = end
            
            # Check for responsibilities (bullet points)
            elif line.startswith(('•', '-', '*')):
                responsibility = line.strip('•').strip('-').strip('*').strip()
                
                # Check if next lines are continuations (don't start with bullet)
                j = i + 1
                while j < len(lines):
                    next_line = lines[j].strip()
                    
                    # Stop if empty line
                    if not next_line:
                        break
                    
                    # Stop if new bullet point
                    if next_line.startswith(('•', '-', '*', '◦', '▪', '●', '–', '—')):
                        break
                    
                    # Stop if it looks like a new job title (has multiple job keywords)
                    job_keyword_count = sum(1 for kw in self.JOB_TITLE_KEYWORDS if kw in next_line.lower())
                    if job_keyword_count >= 2:
                        break
                    
                    # Stop if it's a standalone date line (short line with dates)
                    if self._contains_date(next_line) and len(next_line.split()) <= 4:
                        break
                    
                    # Append continuation
                    responsibility += ' ' + next_line
                    j += 1
                    logger.debug(f"Appended continuation line {j}: {next_line[:40]}...")
                
                # Update index to skip processed lines
                i = j - 1
                
                if responsibility and len(responsibility) > 5:
                    # Extract metrics and achievements from responsibility text
                    resp_data = self._extract_metrics_from_responsibility(responsibility)
                    responsibilities.append(resp_data)
                    logger.debug(f"Added responsibility ({len(responsibility)} chars): {responsibility[:60]}...")
            
            # Try to extract dates if not found yet
            elif current_entry and 'start_date' not in current_entry:
                start, end = self._extract_dates(line)
                if start:
                    current_entry['start_date'] = start
                    if end:
                        current_entry['end_date'] = end
            
            i += 1
        
        # Add last entry
        if current_entry and 'title' in current_entry:
            if responsibilities:
                current_entry['responsibilities'] = responsibilities
            experiences.append(current_entry)
        
        logger.info(f"Extracted {len(experiences)} experience entries")
        return experiences

    def _extract_projects(self, text: str) -> List[Dict]:
        """
        Extract projects from Projects section.
        
        Args:
            text: Full resume text
            
        Returns:
            List of project dictionaries with name, description, technologies, dates
        """
        projects = []
        
        # Detect projects section
        lines = text.split('\n')
        in_projects_section = False
        current_project = {}
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            line_lower = line_stripped.lower()
            
            # Check for projects section header
            if any(header == line_lower or line_lower.startswith(header + ':') 
                   for header in self.PROJECTS_HEADERS):
                in_projects_section = True
                logger.debug(f"Found Projects section at line {i}")
                continue
            
            # Stop if we hit another major section
            if in_projects_section:
                if any(header in line_lower for header in 
                       self.EDUCATION_HEADERS + self.EXPERIENCE_HEADERS + self.SKILLS_HEADERS):
                    # Save current project if exists
                    if current_project and 'name' in current_project:
                        projects.append(dict(current_project))
                    break
                
                # Skip empty lines
                if not line_stripped:
                    continue
                
                # Check if this is a project name (not a bullet point)
                if not line.startswith(('•', '-', '*', '◦', '▪', '●', '–', '—')):
                    # Save previous project
                    if current_project and 'name' in current_project:
                        projects.append(dict(current_project))
                        current_project = {}
                    
                    # New project
                    current_project['name'] = line_stripped
                    
                    # Try to extract dates
                    start, end = self._extract_dates(line_stripped)
                    if start:
                        current_project['start_date'] = start
                        if end:
                            current_project['end_date'] = end
                else:
                    # This is a description or technology line
                    description = line.strip('•').strip('-').strip('*').strip('◦').strip('▪').strip('●').strip('–').strip('—').strip()
                    if description:
                        if 'description' not in current_project:
                            current_project['description'] = []
                        current_project['description'].append(description)
        
        # Add last project
        if current_project and 'name' in current_project:
            projects.append(current_project)
        
        logger.info(f"Extracted {len(projects)} projects")
        return projects

    def _calculate_enhanced_confidence(
        self, 
        name: Optional[str], 
        email: Optional[str], 
        phone: Optional[str],
        skills: List[str],
        education_data: Dict,
        experience_data: List[Dict]
    ) -> float:
        """
        Calculate enhanced confidence score with validation quality metrics.
        """
        score = 0.0
        
        # Contact information (25%)
        contact_score = 0.0
        if name:
            contact_score += 0.08
        if email:
            contact_score += 0.10
        if phone:
            contact_score += 0.07
        score += contact_score
        
        # Skills (20%) - progressive scaling
        if len(skills) > 0:
            if len(skills) >= 10:
                skills_score = 0.20
            elif len(skills) >= 6:
                skills_score = 0.14 + ((len(skills) - 6) / 4) * 0.06
            elif len(skills) >= 3:
                skills_score = 0.10 + ((len(skills) - 3) / 3) * 0.04
            else:
                skills_score = (len(skills) / 3) * 0.10
            score += skills_score
        
        # Education completeness & quality (27.5%)
        degrees = education_data.get('degrees', [])
        certifications = education_data.get('certifications', [])
        
        if degrees:
            first_degree = degrees[0]
            
            # Validated degree type (10%) - higher weight for validated fields
            if 'degree' in first_degree and first_degree['degree']:
                score += 0.10
            
            # Institution (7%)
            if 'institution' in first_degree and first_degree['institution']:
                score += 0.07
            
            # Field of study (5%) - validated field
            if 'field' in first_degree and first_degree['field']:
                score += 0.05
            
            # Dates (5.5%)
            if 'start_date' in first_degree:
                score += 0.03
                if 'end_date' in first_degree:
                    score += 0.025
        
        # Experience completeness & quality (27.5%)
        if experience_data:
            first_exp = experience_data[0]
            
            # Job title (8%)
            if 'title' in first_exp and first_exp['title']:
                score += 0.08
            
            # Company name (7%) - NEW: reward company extraction
            if 'company' in first_exp and first_exp['company']:
                score += 0.07
            
            # Dates (6%)
            if 'start_date' in first_exp:
                score += 0.03
                if 'end_date' in first_exp:
                    score += 0.03
            
            # Responsibilities (6.5%)
            if 'responsibilities' in first_exp and len(first_exp['responsibilities']) > 0:
                score += 0.065
        
        # Cap at 0.95 to reflect inherent parsing uncertainty
        score = min(score, 0.95)
        
        logger.debug(f"Enhanced confidence score: {score:.2f}")
        return round(score, 2)

    def _extract_name(self, text: str) -> Optional[str]:
        """Extract candidate's name from resume text."""
        lines = text.split('\n')
        
        for line in lines[:5]:
            line_stripped = line.strip()
            for pattern in self.NAME_PATTERNS:
                match = re.search(pattern, line_stripped)
                if match:
                    name = match.group(1)
                    logger.debug(f"Name found: {name}")
                    return name
        
        if lines:
            first_line = lines[0].strip()
            words = first_line.split()
            if len(words) == 2 and all(word[0].isupper() for word in words if word):
                logger.debug(f"Name found via fallback: {first_line}")
                return first_line
        
        logger.warning("Could not extract name from resume")
        return None

    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email address from resume text."""
        match = re.search(self.EMAIL_REGEX, text)
        if match:
            email = match.group()
            logger.debug(f"Email found: {email}")
            return email
        logger.warning("Could not extract email from resume")
        return None

    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from resume text."""
        match = re.search(self.PHONE_REGEX, text)
        if match:
            phone = match.group()
            logger.debug(f"Phone found: {phone}")
            return phone
        logger.warning("Could not extract phone from resume")
        return None

    def _extract_skills(self, text: str) -> Dict[str, List[str]]:
        """
        Extract and categorize skills into technical and soft skills.
        
        Returns skills separated into 'technical_skills' and 'soft_skills'.
        """
        technical_skills = set()
        soft_skills = set()
        
        # Method 1: Extract from Skills section (if present)
        skills_section = self._detect_skills_section(text)
        if skills_section:
            section_skills = self._extract_skills_from_section(skills_section)
            
            # Categorize and filter each skill
            for skill in section_skills:
                skill_lower = skill.lower()
                
                # Skip if it's a spoken language
                if skill_lower in self.SPOKEN_LANGUAGES:
                    logger.debug(f"Skipped language from skills: {skill}")
                    continue
                
                # Validate and categorize
                is_valid, category = self._is_valid_technical_skill(skill)
                if is_valid:
                    if category == 'technical':
                        technical_skills.add(skill)
                    elif category == 'soft':
                        soft_skills.add(skill)
            
            logger.info(f"Extracted {len(technical_skills)} technical and {len(soft_skills)} soft skills from Skills section")
        
        # Method 2: Match against predefined keywords throughout resume
        text_lower = text.lower()
        keyword_matches = 0
        
        for category, keywords in SKILL_KEYWORDS.items():
            for skill in keywords:
                # Skip if it's a spoken language
                if skill.lower() in self.SPOKEN_LANGUAGES:
                    continue
                    
                pattern = r'\b' + re.escape(skill) + r'\b'
                if re.search(pattern, text_lower):
                    # Validate and categorize
                    is_valid, skill_category = self._is_valid_technical_skill(skill)
                    if is_valid:
                        if skill_category == 'technical':
                            technical_skills.add(skill)
                            keyword_matches += 1
                        elif skill_category == 'soft':
                            soft_skills.add(skill)
                            keyword_matches += 1
        
        logger.info(f"Matched {keyword_matches} predefined skill keywords")
        logger.info(f"Total: {len(technical_skills)} technical skills, {len(soft_skills)} soft skills")
        
        # Filter out languages from final results
        technical_skills_filtered = {s for s in technical_skills if s.lower() not in self.SPOKEN_LANGUAGES}
        soft_skills_filtered = {s for s in soft_skills if s.lower() not in self.SPOKEN_LANGUAGES}
        
        removed_langs = (len(technical_skills) - len(technical_skills_filtered)) + (len(soft_skills) - len(soft_skills_filtered))
        if removed_langs > 0:
            logger.info(f"Removed {removed_langs} languages from final skills")
        
        return {
            'technical_skills': sorted(list(technical_skills_filtered)),
            'soft_skills': sorted(list(soft_skills_filtered))
        }
