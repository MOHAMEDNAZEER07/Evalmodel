"""
Supabase Client Singleton
"""
from supabase import create_client, Client
from app.core.config import settings

class SupabaseClient:

    @staticmethod
    def get_client() -> Client:
        """Service role key — bypasses RLS.
        This project uses custom JWTs (not Supabase Auth), so auth.uid() is
        always NULL and RLS blocks all queries under the anon key. Access
        control is enforced at the application layer via user_id WHERE clauses.
        """
        return create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )

    @staticmethod
    def get_admin_client() -> Client:
        """Alias of get_client() — service role for background tasks."""
        return SupabaseClient.get_client()

def get_supabase() -> Client:
    """Dependency for FastAPI routes."""
    return SupabaseClient.get_client()
