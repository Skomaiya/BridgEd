"""
Supabase Storage integration for CV/resume files and profile images.

When enabled, resumes are stored in a Supabase bucket and the public URL is saved on the Resume model.
Profile images use a separate bucket. Parsed data continues in PostgreSQL (Django backend).
"""

import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def _get_service_key() -> str:
    """Return Supabase service role key (SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY)."""
    try:
        from decouple import config
        key = config("SUPABASE_SERVICE_KEY", default="")
        if not key:
            key = config("SUPABASE_SERVICE_ROLE_KEY", default="")
        return key or ""
    except Exception:
        return ""


def is_supabase_configured() -> bool:
    """Return True if Supabase URL and service key are set (storage will use Supabase)."""
    try:
        from decouple import config
        url = config("SUPABASE_URL", default="")
        key = _get_service_key()
        return bool(url and key)
    except Exception:
        return False


def get_bucket_name() -> str:
    """Return the bucket name for resumes (default: resumes)."""
    try:
        from decouple import config
        return config("SUPABASE_BUCKET_RESUMES", default="resumes")
    except Exception:
        return "resumes"


def get_profile_bucket_name() -> str:
    """Return the bucket name for profile images (default: profile-images)."""
    try:
        from decouple import config
        return config("SUPABASE_BUCKET_PROFILE_IMAGES", default="profile-images")
    except Exception:
        return "profile-images"


def upload_resume_file(
    local_file_path: str,
    object_path: str,
    content_type: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Upload a file from local path to Supabase Storage."""
    if not is_supabase_configured():
        logger.warning("Supabase not configured; upload_resume_file no-op")
        return None, None

    try:
        from supabase import create_client
        from decouple import config
    except ImportError:
        logger.error("supabase package not installed; pip install supabase")
        return None, None

    url = config("SUPABASE_URL")
    key = _get_service_key()
    bucket = get_bucket_name()

    try:
        client = create_client(url, key)
        with open(local_file_path, "rb") as f:
            data = f.read()

        file_options = {}
        if content_type:
            file_options["content-type"] = content_type

        client.storage.from_(bucket).upload(
            object_path,
            data,
            file_options=file_options if file_options else None,
        )
        public_url = client.storage.from_(bucket).get_public_url(object_path)
        logger.info(f"Uploaded to Supabase: {object_path}")
        return public_url, object_path
    except Exception as e:
        logger.exception(f"Supabase upload failed: {e}")
        return None, None


def delete_resume_file(storage_path: str) -> bool:
    """Delete a file from Supabase Storage by its storage path."""
    if not is_supabase_configured() or not storage_path:
        return True

    try:
        from supabase import create_client
        from decouple import config

        client = create_client(config("SUPABASE_URL"), _get_service_key())
        bucket = get_bucket_name()
        client.storage.from_(bucket).remove([storage_path])
        logger.info(f"Deleted from Supabase: {storage_path}")
        return True
    except Exception as e:
        logger.exception(f"Supabase delete failed: {e}")
        return False


def create_signed_resume_url(storage_path: str, expires_in: int = 3600) -> str | None:
    """Generate a time-limited signed URL for a resume file stored in Supabase."""
    if not is_supabase_configured() or not storage_path:
        logger.warning("Supabase not configured or no storage_path; cannot create signed URL")
        return None

    try:
        from supabase import create_client
        from decouple import config

        client = create_client(config("SUPABASE_URL"), _get_service_key())
        bucket = get_bucket_name()
        result = client.storage.from_(bucket).create_signed_url(storage_path, expires_in)
        signed_url = (
            result.get("signedURL")
            or result.get("signedUrl")
            or (result.get("data") or {}).get("signedURL")
            or (result.get("data") or {}).get("signedUrl")
        )
        if signed_url:
            logger.info(f"Created signed URL for: {storage_path} (expires in {expires_in}s)")
            return signed_url
        logger.warning(f"Supabase signed URL response missing key: {result}")
        return None
    except Exception as e:
        logger.exception(f"Supabase create_signed_url failed: {e}")
        return None


def upload_profile_image(
    local_file_path: str,
    object_path: str,
    content_type: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Upload a profile image from local path to Supabase Storage (profile-images bucket)."""
    if not is_supabase_configured():
        logger.warning("Supabase not configured; upload_profile_image no-op")
        return None, None

    try:
        from supabase import create_client
        from decouple import config
    except ImportError:
        logger.error("supabase package not installed; pip install supabase")
        return None, None

    url = config("SUPABASE_URL")
    key = _get_service_key()
    bucket = get_profile_bucket_name()

    try:
        client = create_client(url, key)
        with open(local_file_path, "rb") as f:
            data = f.read()
        file_options = {"upsert": "true"}
        if content_type:
            file_options["content-type"] = content_type
        client.storage.from_(bucket).upload(
            object_path,
            data,
            file_options=file_options,
        )
        public_url = client.storage.from_(bucket).get_public_url(object_path)
        logger.info(f"Uploaded profile image to Supabase: {object_path}")
        return public_url, object_path
    except Exception as e:
        logger.exception(f"Supabase profile image upload failed: {e}")
        return None, None



def delete_profile_image(storage_path: str) -> bool:
    """Delete a profile image from Supabase Storage by its storage path."""
    if not is_supabase_configured() or not storage_path:
        return True
    try:
        from supabase import create_client
        from decouple import config
        client = create_client(config("SUPABASE_URL"), _get_service_key())
        bucket = get_profile_bucket_name()
        client.storage.from_(bucket).remove([storage_path])
        logger.info(f"Deleted profile image from Supabase: {storage_path}")
        return True
    except Exception as e:
        logger.exception(f"Supabase profile image delete failed: {e}")
        return False
