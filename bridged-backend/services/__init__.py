"""
Services Module for Resume/CV Parsing

This module provides the core services for extracting and parsing resume/CV files
in the BridgEd platform. It implements a clean, modular architecture for:
- Text extraction from various file formats (PDF, DOCX, TXT)
- LLM-based parsing to extract structured data (Ollama/Gemini/OpenAI)
- Pipeline orchestration
- Job–resume matching

Modules:
    text_extractor: Extract raw text from resume files
    llm_parser: Parse text into structured JSON using an LLM
    resume_pipeline: Orchestrate the complete parsing workflow
    matching_engine: Match resumes to jobs based on skills

Architecture:
    Layer 1: File Processing (text_extractor.py)
        - Handles file I/O and format-specific extraction
        - Supports: PDF, DOCX, TXT

    Layer 2: Data Extraction (llm_parser.py)
        - Sends raw text to LLM (Ollama, Gemini, or OpenAI)
        - Returns structured JSON (name, email, skills, education, experience, etc.)

    Layer 3: Orchestration (resume_pipeline.py)
        - Coordinates extraction + LLM parsing
        - Single entry point for Django views

    Layer 4: Business Logic (matching_engine.py)
        - Skill-based matching and compatibility scores

Main Classes:
    - TextExtractor: Extract text from resume files
    - LLMResumeParser: Parse resume text via LLM into structured data
    - ResumeParsingPipeline: Orchestrate the parsing workflow
    - MatchingEngine: Match resumes to jobs

Example Workflow:
    Django View → ResumeParsingPipeline.run()
                    ↓
                TextExtractor.extract() → Raw text
                    ↓
                LLMResumeParser.parse() → Structured data
                    ↓
                Return to Django View
"""

from .device_utils import (
    get_device,
    get_device_and_info,
    is_cuda_available,
    log_device_info,
)
from .llm_parser import LLMResumeParser
from .resume_pipeline import PipelineExecutionError, ResumeParsingPipeline
from .text_extractor import (
    TextExtractionError,
    TextExtractor,
    UnsupportedFileFormatError,
)

__all__ = [
    "TextExtractor",
    "UnsupportedFileFormatError",
    "TextExtractionError",
    "LLMResumeParser",
    "ResumeParsingPipeline",
    "PipelineExecutionError",
    "get_device",
    "get_device_and_info",
    "is_cuda_available",
    "log_device_info",
]

__version__ = "1.0.0"
__author__ = "BridgEd Development Team"
