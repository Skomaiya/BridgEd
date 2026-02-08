"""
Resume Parsing Pipeline Module

This module orchestrates the complete CV/resume parsing workflow by coordinating
the text extraction and NLP parsing components.

The pipeline provides a clean, single-method interface for Django views to use,
abstracting away the complexity of the multi-step parsing process.

Classes:
    ResumeParsingPipeline: Main orchestrator for the CV parsing process
    PipelineExecutionError: Custom exception for pipeline failures
"""

import logging
from typing import Dict, Any
from .text_extractor import TextExtractor, UnsupportedFileFormatError, TextExtractionError
from .nlp_parser import NLPResumeParser

# Configure logging for this module
logger = logging.getLogger(__name__)


class PipelineExecutionError(Exception):
    """
    Exception raised when the resume parsing pipeline fails.
    
    This exception wraps any errors that occur during the pipeline execution,
    providing context about which stage failed.
    
    Attributes:
        stage: The pipeline stage where the error occurred ('extraction' or 'parsing')
        file_path: Path to the file being processed
        original_error: The original exception that caused the failure
    """
    
    def __init__(self, stage: str, file_path: str, original_error: Exception):
        self.stage = stage
        self.file_path = file_path
        self.original_error = original_error
        super().__init__(
            f"Pipeline failed at {stage} stage for {file_path}: {str(original_error)}"
        )


class ResumeParsingPipeline:
    """
    Orchestrate the complete resume/CV parsing workflow.
    
    This class coordinates the multi-step process of extracting and analyzing
    resume data. It provides a single, clean interface for Django views.
    
    Pipeline Stages:
        1. Text Extraction: Convert file (PDF/DOCX/TXT) to raw text
        2. NLP Parsing: Extract structured data from text
        3. Return: Parsed data dictionary
    """

    def __init__(self):
        """
        Initialize the pipeline with its component services.
        
        This creates instances of the text extractor and NLP parser
        that will be used for all parsing operations.
        """
        self.extractor = TextExtractor()
        self.parser = NLPResumeParser()
        logger.info("ResumeParsingPipeline initialized")

    def run(self, file_path: str) -> Dict[str, Any]:
        """
        Execute the complete resume parsing pipeline.
        
        This is the main entry point that Django views should call.
        It orchestrates both extraction and parsing stages.
        
        Args:
            file_path: Absolute path to the uploaded CV/resume file
            
        Returns:
            Dictionary containing all parsed resume data:
            {
                'name': str or None,
                'email': str or None,
                'phone': str or None,
                'skills': List[str],
                'education': List[str],
                'experience': List[str],
                'confidence': float (0.0 to 1.0)
            }
        
        Implementation Flow:
            1. Log pipeline start
            2. STAGE 1: Text Extraction
               - Call TextExtractor.extract(file_path)
               - Handle extraction-specific errors
               - Log text length
            3. STAGE 2: NLP Parsing
               - Call NLPResumeParser.parse(text)
               - Handle parsing-specific errors
               - Log parsing results
            4. Return parsed data
            5. Handle and log any errors
        """
        logger.info(f"Starting pipeline execution for: {file_path}")
        
        try:
            # ========== STAGE 1: TEXT EXTRACTION ==========
            logger.debug("Stage 1: Extracting text from file")
            text = self.extractor.extract(file_path)
            logger.info(f"Text extraction complete: {len(text)} characters extracted")
            
            # Validate that we got meaningful text
            if not text or len(text.strip()) < 10:
                logger.warning(f"Very short text extracted ({len(text)} chars), results may be poor")
            
            # ========== STAGE 2: NLP PARSING ==========
            logger.debug("Stage 2: Parsing text with NLP")
            parsed_data = self.parser.parse(text)
            
            # Log skill counts
            technical_count = len(parsed_data.get('technical_skills', []))
            soft_count = len(parsed_data.get('soft_skills', []))
            logger.info(f"NLP parsing complete: {technical_count} technical skills, {soft_count} soft skills found")
            
            # ========== PIPELINE COMPLETE ==========
            logger.info(f"Pipeline execution complete for: {file_path}")
            logger.debug(f"Final confidence score: {parsed_data.get('confidence', 0):.2f}")
            
            return parsed_data
            
        except (UnsupportedFileFormatError, TextExtractionError) as e:
            # Re-raise extraction errors as-is (they're already descriptive)
            logger.error(f"Extraction stage failed: {str(e)}")
            raise
            
        except Exception as e:
            # Wrap unexpected errors in PipelineExecutionError
            logger.error(f"Pipeline execution failed unexpectedly: {str(e)}", exc_info=True)
            raise PipelineExecutionError('parsing', file_path, e)

    def validate_file(self, file_path: str) -> bool:
        """
        Validate that a file can be processed by the pipeline.
        
        This is a quick pre-check that can be used before calling run()
        to validate file format without actually processing the file.
        
        Args:
            file_path: Path to the file to validate
            
        Returns:
            True if the file can be processed, False otherwise
        """
        return self.extractor.is_supported(file_path)

