"""
Supabase Client Singleton
"""
from supabase import create_client, Client
from app.core.config import settings
from typing import Optional

class SupabaseClient:
    _instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        if cls._instance is None:
            # Use service_role key for backend database operations
            cls._instance = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
        return cls._instance

def get_supabase() -> Client:
    """Dependency for FastAPI routes"""
    return SupabaseClient.get_client()
