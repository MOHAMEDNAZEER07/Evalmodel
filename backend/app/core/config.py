"""
Application Configuration
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    APP_ENV: str = "development"

    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    ENABLE_DEBUG_ROUTES: bool = False
    
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
    # Model format allow-list used by evaluation and upload validation.
    # Example: "onnx" (strict) or "onnx,pkl,joblib" (legacy compatibility)
    ALLOWED_MODEL_FORMATS: str = "onnx"
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

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def allowed_model_formats(self) -> List[str]:
        return [
            item.strip().lower().lstrip(".")
            for item in self.ALLOWED_MODEL_FORMATS.split(",")
            if item.strip()
        ]

    def validate_runtime_config(self) -> None:
        """Fail fast on unsafe production configurations."""
        if not self.is_production:
            return

        errors: List[str] = []

        if self.DEBUG:
            errors.append("DEBUG must be false in production")

        if self.ENABLE_DEBUG_ROUTES:
            errors.append("ENABLE_DEBUG_ROUTES must be false in production")

        if not self.SUPABASE_URL:
            errors.append("SUPABASE_URL is required in production")

        if not self.SUPABASE_SERVICE_ROLE_KEY:
            errors.append("SUPABASE_SERVICE_ROLE_KEY is required in production")

        origins = [origin.strip().lower() for origin in self.cors_origins if origin.strip()]
        if not origins:
            errors.append("ALLOWED_ORIGINS must include at least one trusted origin in production")

        if any("localhost" in origin or "127.0.0.1" in origin for origin in origins):
            errors.append("ALLOWED_ORIGINS cannot include localhost origins in production")

        if any(origin == "*" for origin in origins):
            errors.append("ALLOWED_ORIGINS cannot include '*' in production")

        formats = self.allowed_model_formats
        if not formats:
            errors.append("ALLOWED_MODEL_FORMATS must define at least one format in production")

        if formats and any(fmt != "onnx" for fmt in formats):
            errors.append("ALLOWED_MODEL_FORMATS must be 'onnx' only in production")

        if errors:
            raise ValueError("Invalid production configuration: " + "; ".join(errors))

settings = Settings()
