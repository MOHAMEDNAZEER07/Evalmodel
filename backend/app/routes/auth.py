"""
Authentication Routes - FastAPI Native Auth with Supabase as Storage Only
Supabase is used ONLY for database storage, not for authentication
"""
from fastapi import APIRouter, HTTPException, Depends, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.supabase_client import get_supabase
from supabase import Client
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = "your-secret-key-change-this-in-production-use-env-variable"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

# ============= REQUEST/RESPONSE MODELS =============

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        # Bcrypt has 72-byte limit, truncate if needed
        if len(v.encode('utf-8')) > 72:
            # Truncate to 70 chars to be safe
            return v[:70]
        return v
    
    model_config = ConfigDict(protected_namespaces=())

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    
    model_config = ConfigDict(protected_namespaces=())

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    message: str
    
    model_config = ConfigDict(protected_namespaces=())

class MessageResponse(BaseModel):
    message: str

class UserInDB(BaseModel):
    id: str
    email: str
    username: str
    hashed_password: str
    tier: str = "free"
    created_at: datetime
    model_count: int = 0

# ============= UTILITY FUNCTIONS =============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Truncate to 72 characters max for bcrypt
    plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Truncate to 72 characters max for bcrypt
    password = password[:72]
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"Token decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ============= DEPENDENCIES =============

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase)
) -> Dict[str, Any]:
    """Dependency to get current authenticated user from JWT token"""
    try:
        token = credentials.credentials
        payload = decode_token(token)
        
        # Check token type
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Get user from database
        result = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    supabase: Client = Depends(get_supabase)
) -> Optional[Dict[str, Any]]:
    """Optional authentication - returns None if not authenticated"""
    if not credentials:
        return None
    
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        
        if not user_id:
            return None
        
        result = supabase.table("users").select("*").eq("id", user_id).execute()
        return result.data[0] if result.data and len(result.data) > 0 else None
    except:
        return None

# ============= AUTH ENDPOINTS =============

@router.post("/signup", response_model=AuthResponse)
async def signup(
    request: SignupRequest,
    supabase: Client = Depends(get_supabase)
):
    """
    Sign up a new user with email and password
    FastAPI handles authentication, Supabase only stores data
    """
    try:
        # Check if user already exists
        existing = supabase.table("users").select("id").eq("email", request.email).execute()
        
        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Generate user ID
        user_id = str(uuid.uuid4())
        
        # Hash password
        hashed_password = get_password_hash(request.password)
        
        # Create user in database
        user_data = {
            "id": user_id,
            "email": request.email,
            "username": request.username or request.email.split('@')[0],
            "hashed_password": hashed_password,
            "tier": "free",
            "created_at": datetime.utcnow().isoformat(),
            "model_count": 0
        }
        
        result = supabase.table("users").insert(user_data).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        # Create tokens
        access_token = create_access_token(data={"sub": user_id, "email": request.email})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        logger.info(f"New user signed up: {request.email}")
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user={
                "id": user_id,
                "email": request.email,
                "username": user_data["username"],
                "tier": "free"
            },
            message="Signup successful!"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(e)}"
        )

@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    supabase: Client = Depends(get_supabase)
):
    """
    Log in with email and password
    FastAPI validates credentials, Supabase only retrieves data
    """
    try:
        # Get user from database
        result = supabase.table("users").select("*").eq("email", request.email).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user = result.data[0]
        
        # Verify password
        if not verify_password(request.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create tokens
        access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        logger.info(f"User logged in: {request.email}")
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user={
                "id": user["id"],
                "email": user["email"],
                "username": user.get("username", request.email.split('@')[0]),
                "tier": user.get("tier", "free")
            },
            message="Login successful!"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Log out the current user
    Since we use JWT, logout is handled client-side by removing the token
    This endpoint is for logging purposes
    """
    logger.info(f"User logged out: {current_user.get('email')}")
    return MessageResponse(message="Logged out successfully")

@router.get("/me")
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get current user profile"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "username": current_user.get("username"),
        "tier": current_user.get("tier", "free"),
        "model_count": current_user.get("model_count", 0),
        "created_at": current_user.get("created_at")
    }

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    refresh_token: str = Body(..., embed=True),
    supabase: Client = Depends(get_supabase)
):
    """
    Refresh access token using refresh token
    """
    try:
        payload = decode_token(refresh_token)
        
        # Check token type
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Get user from database
        result = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        user = result.data[0]
        
        # Create new tokens
        new_access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
        new_refresh_token = create_refresh_token(data={"sub": user["id"]})
        
        return AuthResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            user={
                "id": user["id"],
                "email": user["email"],
                "username": user.get("username"),
                "tier": user.get("tier", "free")
            },
            message="Token refreshed successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to refresh token"
        )

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    email: EmailStr = Body(..., embed=True),
    supabase: Client = Depends(get_supabase)
):
    """
    Send password reset email
    Note: This would need email service integration (SendGrid, AWS SES, etc.)
    """
    try:
        # Check if user exists
        result = supabase.table("users").select("id").eq("email", email).execute()
        
        if result.data and len(result.data) > 0:
            # TODO: Send password reset email
            # For now, just log it
            logger.info(f"Password reset requested for: {email}")
        
        # Always return success to prevent email enumeration
        return MessageResponse(
            message="If an account exists with this email, you will receive a password reset link."
        )
    
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        # Don't reveal if email exists or not
        return MessageResponse(
            message="If an account exists with this email, you will receive a password reset link."
        )

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Change user password"""
    try:
        # Verify current password
        if not verify_password(current_password, current_user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid current password"
            )
        
        # Hash new password
        new_hashed_password = get_password_hash(new_password)
        
        # Update password in database
        supabase.table("users").update({
            "hashed_password": new_hashed_password
        }).eq("id", current_user["id"]).execute()
        
        logger.info(f"Password changed for user: {current_user['email']}")
        
        return MessageResponse(message="Password changed successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )
