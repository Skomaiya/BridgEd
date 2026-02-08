"""
Services Module for Resume/CV Parsing

This module provides the core services for extracting and parsing resume/CV files
in the BridgEd platform. It implements a clean, modular architecture for:
- Text extraction from various file formats (PDF, DOCX, TXT)
- NLP-based parsing to extract structured data
- Skill keyword matching
- Pipeline orchestration

Modules:
    text_extractor: Extract raw text from resume files
    nlp_parser: Parse text and extract structured resume data
    resume_pipeline: Orchestrate the complete parsing workflow
    skill_keywords: Database of technical and soft skills
    matching_engine: Match resumes to jobs based on skills

Architecture:
    The services module follows a layered architecture:
    
    Layer 1: File Processing (text_extractor.py)
        - Handles file I/O and format-specific extraction
        - Supports: PDF, DOCX, TXT
    
    Layer 2: Data Extraction (nlp_parser.py)
        - Extracts structured data from unstructured text
        - Uses regex patterns and keyword matching
    
    Layer 3: Orchestration (resume_pipeline.py)
        - Coordinates the entire parsing workflow
        - Provides single entry point for Django views
    
    Layer 4: Business Logic (matching_engine.py)
        - Implements skill-based matching algorithms
        - Calculates compatibility scores

Main Classes:
    - TextExtractor: Extract text from resume files
    - NLPResumeParser: Parse resume text into structured data
    - ResumeParsingPipeline: Orchestrate the parsing workflow
    - MatchingEngine: Match resumes to jobs

Example Workflow:
    Django View → ResumeParsingPipeline.run()
                    ↓
                TextExtractor.extract() → Raw text
                    ↓
                NLPResumeParser.parse() → Structured data
                    ↓
                Return to Django View
"""

# Export main classes for easy importing
from .text_extractor import (
    TextExtractor,
    UnsupportedFileFormatError,
    TextExtractionError
)

from .nlp_parser import NLPResumeParser

from .resume_pipeline import (
    ResumeParsingPipeline,
    PipelineExecutionError
)

from .skill_keywords import (
    SKILL_KEYWORDS,
    get_all_skills,
    get_skills_by_category,
    get_all_categories,
    search_skills,
    get_skill_count,
    get_category_info
)

# Define what gets imported with "from services import *"
__all__ = [
    # Text Extraction
    'TextExtractor',
    'UnsupportedFileFormatError',
    'TextExtractionError',
    
    # NLP Parsing
    'NLPResumeParser',
    
    # Pipeline
    'ResumeParsingPipeline',
    'PipelineExecutionError',
    
    # Skill Keywords
    'SKILL_KEYWORDS',
    'get_all_skills',
    'get_skills_by_category',
    'get_all_categories',
    'search_skills',
    'get_skill_count',
    'get_category_info',
]

# Module metadata
__version__ = '1.0.0'
__author__ = 'BridgEd Development Team'
