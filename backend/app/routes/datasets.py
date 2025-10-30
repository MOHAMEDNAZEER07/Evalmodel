"""
Dataset Management Routes
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
import os
import uuid
from datetime import datetime
import pandas as pd
import logging

from app.core.supabase_client import get_supabase
from app.core.config import settings
from app.models.schemas import DatasetMetadata, ErrorResponse
from app.routes.auth import get_current_user
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/upload", response_model=DatasetMetadata)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Upload a dataset (CSV file)"""
    try:
        # Validate file type
        if not file.filename or not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Check file size
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB"
            )
        
        # Parse CSV to get row/column count
        try:
            import io
            df = pd.read_csv(io.BytesIO(content))
            row_count = len(df)
            column_count = len(df.columns)
        except Exception as e:
            logger.warning(f"Could not parse CSV for stats: {e}")
            row_count = None
            column_count = None
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}.csv"
        storage_path = f"{current_user.get('id')}/{unique_filename}"
        
        # Upload to Supabase Storage
        supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS).upload(
            storage_path,
            content,
            {"content-type": "text/csv"}
        )
        
        # Save metadata
        dataset_data = {
            "user_id": current_user.get("id"),
            "name": name,
            "description": description,
            "file_path": storage_path,
            "file_size": file_size,
            "row_count": row_count,
            "column_count": column_count,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("datasets").insert(dataset_data).execute()
        
        logger.info(f"Dataset uploaded: {name} by user {current_user.get('id')}")
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading dataset: {str(e)}")

@router.get("/")
async def list_datasets(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """List all datasets for current user"""
    try:
        result = supabase.table("datasets")\
            .select("*")\
            .eq("user_id", current_user.get("id"))\
            .order("uploaded_at", desc=True)\
            .execute()
        
        return {"datasets": result.data}
    
    except Exception as e:
        logger.error(f"Error listing datasets: {e}")
        raise HTTPException(status_code=500, detail="Error fetching datasets")

@router.get("/{dataset_id}", response_model=DatasetMetadata)
async def get_dataset(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Get a specific dataset by ID"""
    try:
        result = supabase.table("datasets")\
            .select("*")\
            .eq("id", dataset_id)\
            .eq("user_id", current_user.get("id"))\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        return result.data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching dataset: {e}")
        raise HTTPException(status_code=500, detail="Error fetching dataset")

@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    rows: int = 10
):
    """Preview first N rows of a dataset"""
    try:
        # Get dataset metadata
        dataset = supabase.table("datasets")\
            .select("*")\
            .eq("id", dataset_id)\
            .eq("user_id", current_user.get("id"))\
            .single()\
            .execute()
        
        if not dataset.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Download and parse CSV
        file_data = supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS)\
            .download(dataset.data["file_path"])
        
        import io
        df = pd.read_csv(io.BytesIO(file_data))
        preview = df.head(rows)
        
        return {
            "columns": list(df.columns),
            "rows": preview.to_dict(orient="records"),
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "stats": {
                "dtypes": df.dtypes.astype(str).to_dict(),
                "missing_values": df.isnull().sum().to_dict()
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing dataset: {e}")
        raise HTTPException(status_code=500, detail="Error previewing dataset")

@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Delete a dataset"""
    try:
        # Get dataset info
        dataset = supabase.table("datasets")\
            .select("*")\
            .eq("id", dataset_id)\
            .eq("user_id", current_user.get("id"))\
            .single()\
            .execute()
        
        if not dataset.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Delete from storage
        supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS).remove([dataset.data["file_path"]])
        
        # Delete from database
        supabase.table("datasets").delete().eq("id", dataset_id).execute()
        
        logger.info(f"Dataset deleted: {dataset_id} by user {current_user.get('id')}")
        return {"message": "Dataset deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dataset: {e}")
        raise HTTPException(status_code=500, detail="Error deleting dataset")
