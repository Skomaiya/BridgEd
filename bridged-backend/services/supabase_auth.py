"""
Supabase Auth integration for user management.
Provides administrative functions like deleting users from Supabase Auth.
"""

import logging
from decouple import config
from supabase import create_client, Client

logger = logging.getLogger(__name__)

def _get_supabase_client() -> Client:
    """Initialize and return the Supabase admin client."""
    url = config("SUPABASE_URL", default="")
    key = config("SUPABASE_SERVICE_KEY", default="")
    if not key:
        key = config("SUPABASE_SERVICE_ROLE_KEY", default="")
    
    if not url or not key:
        raise ValueError("Supabase URL or Service Key not configured.")
        
    return create_client(url, key)

def delete_supabase_user(user_id: str) -> bool:
    """
    Delete a user from Supabase Auth by their UUID.
    
    Args:
        user_id: The UUID of the user in Supabase.
        
    Returns:
        True if successful or if user doesn't exist, False otherwise.
    """
    try:
        client = _get_supabase_client()
        response = client.auth.admin.delete_user(user_id)
        logger.info(f"Successfully deleted user {user_id} from Supabase Auth.")
        return True
    except Exception as e:
        if "User not found" in str(e):
            logger.info(f"User {user_id} not found in Supabase Auth, skipping deletion.")
            return True
        logger.error(f"Failed to delete user {user_id} from Supabase Auth: {e}")
        return False
