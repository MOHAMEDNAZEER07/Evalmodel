"""
Model Management Routes
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from typing import Optional, List, Any, cast
import os
import uuid
from datetime import datetime
import logging

from app.core.supabase_client import get_supabase
from app.core.config import settings
from app.models.schemas import (
    ModelType, ModelFramework, ModelMetadata, ModelListResponse, ErrorResponse
)
from app.routes.auth import get_current_user
from app.services.smcp_engine import smcp_engine
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.pkl', '.pt', '.pth', '.h5', '.onnx'}

def validate_model_file(filename: Optional[str]) -> bool:
    """Validate model file extension (accept Optional filename for type-safety)"""
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS

@router.post("/upload", response_model=ModelMetadata)
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    type: ModelType = Form(...),
    framework: ModelFramework = Form(...),
    description: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Upload a new model"""
    try:
        # Validate file
        if not validate_model_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}"
            )
        
        # Check file size
        content = await file.read()
        file_size = len(content)
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB"
            )
        
        # Generate unique filename (use a local non-Optional variable for type-safety)
        filename = file.filename or ""
        file_ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        storage_path = f"{current_user['id']}/{unique_filename}"
        
        # Upload to Supabase Storage
        supabase.storage.from_(settings.STORAGE_BUCKET_MODELS).upload(
            storage_path,
            content,
            {"content-type": file.content_type or "application/octet-stream"}
        )
        
        # Save metadata to database
        model_data = {
            "user_id": current_user['id'],
            "name": name,
            "description": description,
            "model_type": type.value,
            "framework": framework.value,
            "file_path": storage_path,
            "file_size": file_size,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("models").insert(model_data).execute()
        
        logger.info(f"Model uploaded: {name} by user {current_user['id']}")
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading model: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading model: {str(e)}")

@router.get("/", response_model=ModelListResponse)
async def list_models(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = 100,
    offset: int = 0
):
    """List all models for the current user"""
    try:
        result = supabase.table("models")\
            .select("*")\
            .eq("user_id", current_user['id'])\
            .order("uploaded_at", desc=True)\
            .limit(limit)\
            .offset(offset)\
            .execute()
        
        # Cast the count argument to Any to satisfy the type checker while keeping runtime "exact" behavior
        count_result = supabase.table("models")\
            .select("*", count=cast(Any, "exact"))\
            .eq("user_id", current_user['id'])\
            .execute()
        
        return {
            "models": result.data,
            "total": count_result.count
        }
    
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail="Error fetching models")

@router.get("/{model_id}", response_model=ModelMetadata)
async def get_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Get a specific model by ID"""
    try:
        result = supabase.table("models")\
            .select("*")\
            .eq("id", model_id)\
            .eq("user_id", current_user['id'])\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return result.data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching model: {e}")
        raise HTTPException(status_code=500, detail="Error fetching model")


@router.get("/{model_id}/versions")
async def list_model_versions(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = 100,
    offset: int = 0,
):
    """List versions for a given model"""
    try:
        # Ensure model belongs to user
        model = supabase.table("models")\
            .select("id,user_id")\
            .eq("id", model_id)\
            .single()\
            .execute()

        if not model.data or model.data.get("user_id") != current_user['id']:
            raise HTTPException(status_code=404, detail="Model not found")

        resp = supabase.table("model_versions")\
            .select("*")\
            .eq("model_id", model_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .offset(offset)\
            .execute()

        return {"versions": resp.data or []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing versions: {e}")
        raise HTTPException(status_code=500, detail="Error listing versions")


@router.post("/{model_id}/versions/{version}/promote")
async def promote_model_version(
    model_id: str,
    version: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Promote a specific version to production for the given model"""
    try:
        # Verify model ownership
        model = supabase.table("models")\
            .select("id,user_id")\
            .eq("id", model_id)\
            .single()\
            .execute()

        if not model.data or model.data.get("user_id") != current_user['id']:
            raise HTTPException(status_code=404, detail="Model not found")

        # Set all versions' is_production = false for this model
        supabase.table("model_versions").update({"is_production": False}).eq("model_id", model_id).execute()

        # Set the requested version's is_production = true
        resp = supabase.table("model_versions").update({"is_production": True}).match({"model_id": model_id, "version": version}).execute()

        # Update the models table production_version field for quick lookup
        supabase.table("models").update({"production_version": version}).eq("id", model_id).execute()

        logger.info(f"Promoted version {version} to production for model {model_id} by user {current_user['id']}")

        return {"message": "Promoted to production", "version": version, "updated": resp.data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error promoting version: {e}")
        raise HTTPException(status_code=500, detail="Error promoting version")


@router.post("/{model_id}/versions/upload", response_model=ModelMetadata)
async def upload_model_version(
    model_id: str,
    file: UploadFile = File(...),
    version: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Upload a new model version and create a model_versions record"""
    try:
        # Validate model ownership
        model = supabase.table("models")\
            .select("id,user_id")\
            .eq("id", model_id)\
            .single()\
            .execute()

        if not model.data or model.data.get("user_id") != current_user['id']:
            raise HTTPException(status_code=404, detail="Model not found")

        # Validate file
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}")

        content = await file.read()
        file_size = len(content)
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(status_code=400, detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB")

        unique_filename = f"{uuid.uuid4()}{ext}"
        storage_path = f"{current_user['id']}/{model_id}/{unique_filename}"

        # Upload to Supabase storage
        supabase.storage.from_(settings.STORAGE_BUCKET_MODELS).upload(
            storage_path,
            content,
            {"content-type": file.content_type or "application/octet-stream"}
        )

        # Parse tags (comma-separated)
        tags_list = []
        if tags:
            tags_list = [t.strip() for t in tags.split(",") if t.strip()]

        version_record = {
            "model_id": model_id,
            "version": version,
            "description": description,
            "file_path": storage_path,
            "file_size": file_size,
            "tags": tags_list,
            "is_production": False,
            "is_archived": False,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": current_user['id'],
        }

        insert = supabase.table("model_versions").insert(version_record).execute()

        # Update models table latest file info
        supabase.table("models").update({
            "file_path": storage_path,
            "file_size": file_size,
            "uploaded_at": datetime.utcnow().isoformat()
        }).eq("id", model_id).execute()

        logger.info(f"Uploaded version {version} for model {model_id} by user {current_user['id']}")
        return insert.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading version: {e}")
        raise HTTPException(status_code=500, detail="Error uploading model version")


@router.get("/{model_id}/versions/download_url")
async def get_version_download_url(
    model_id: str,
    file_path: str,
    expires: int = 60,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Generate a signed download URL for a model version file"""
    try:
        # Verify model ownership
        model = supabase.table("models")\
            .select("id,user_id")\
            .eq("id", model_id)\
            .single()\
            .execute()

        if not model.data or model.data.get("user_id") != current_user['id']:
            raise HTTPException(status_code=404, detail="Model not found")

        # Create signed URL
        signed = supabase.storage.from_(settings.STORAGE_BUCKET_MODELS).create_signed_url(file_path, expires)
        return {"signed_url": signed.get('signedURL') or signed}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating signed URL: {e}")
        raise HTTPException(status_code=500, detail="Error creating signed URL")

@router.delete("/{model_id}")
async def delete_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Delete a model"""
    try:
        # Get model info
        model = supabase.table("models")\
            .select("*")\
            .eq("id", model_id)\
            .eq("user_id", current_user['id'])\
            .single()\
            .execute()
        
        if not model.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Delete from storage
        supabase.storage.from_(settings.STORAGE_BUCKET_MODELS).remove([model.data["file_path"]])
        
        # Delete from database
        supabase.table("models").delete().eq("id", model_id).execute()
        
        logger.info(f"Model deleted: {model_id} by user {current_user['id']}")
        return {"message": "Model deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        raise HTTPException(status_code=500, detail="Error deleting model")
