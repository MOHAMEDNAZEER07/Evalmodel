"""
Dependency injection functions for FastAPI routes
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client, create_client
from typing import Optional
from jose import JWTError, jwt
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

# JWT Configuration (must match auth.py)
SECRET_KEY = "your-secret-key-change-this-in-production-use-env-variable"
ALGORITHM = "HS256"


def get_supabase() -> Client:
    """
    Get Supabase client instance
    """
    try:
        supabase: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY 
        )
        return supabase
    except Exception as e:
        logger.error(f"Error creating Supabase client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection error"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase)
) -> dict:
    """
    Verify JWT token and return current user
    """
    try:
        token = credentials.credentials
        
        # Decode and verify our custom JWT token (not Supabase auth token)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            email = payload.get("email")
            
            if user_id is None:
                logger.error("No 'sub' claim in JWT token")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials"
                )
            
            logger.info(f"JWT decoded successfully, user_id: {user_id}")
            
            # Return user info from JWT payload (already verified)
            # No need to query database again - JWT is our source of truth
            return {
                "id": user_id,
                "email": email or "",
                "username": payload.get("username", ""),
                "tier": payload.get("tier", "free")
            }
            
        except JWTError as e:
            logger.error(f"JWT decode error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
