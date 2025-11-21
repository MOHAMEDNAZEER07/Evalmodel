"""
Application Configuration
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    
    # Supabase Configuration
    # Provide safe defaults so Settings() can be constructed even if env vars are absent.
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # Database Configuration
    DATABASE_URL: str = ""
    
    # CORS - will be parsed from comma-separated string
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"
    
    # Storage
    MAX_UPLOAD_SIZE_MB: int = 1024
    STORAGE_BUCKET_MODELS: str = "models"
    STORAGE_BUCKET_DATASETS: str = "datasets"
    # Sensitive attributes detection (comma-separated). Update via environment for production.
    SENSITIVE_ATTRIBUTES: str = "gender,race,sex,age_group,ethnicity,protected_attribute"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra fields from .env
    )
    
    @property
    def cors_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def sensitive_attributes(self) -> List[str]:
        """Return configured sensitive attribute candidate column names as a normalized list."""
        return [s.strip().lower() for s in self.SENSITIVE_ATTRIBUTES.split(",") if s.strip()]

settings = Settings()
