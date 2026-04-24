"""
Dataset Management Routes
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
import hashlib
import uuid
from datetime import datetime
import io
import pandas as pd
import logging

from app.core.supabase_client import get_supabase
from app.core.config import settings
from app.models.schemas import DatasetMetadata, ErrorResponse
from app.core.dependencies import get_current_user
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


def _compute_file_hash(content: bytes) -> str:
    """Compute SHA-256 hash for exact-file deduplication."""
    return hashlib.sha256(content).hexdigest()


def _compute_dataset_fingerprint(df: pd.DataFrame) -> dict:
    """Compute structural/content fingerprint for traceability."""
    checksum = hashlib.md5(pd.util.hash_pandas_object(df, index=True).values.tobytes()).hexdigest()
    return {
        "row_count": len(df),
        "col_count": len(df.columns),
        "columns": sorted([str(c) for c in df.columns]),
        "dtypes": {str(col): str(dtype) for col, dtype in df.dtypes.items()},
        "null_count": int(df.isnull().sum().sum()),
        "checksum": checksum,
    }

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
        file_hash = _compute_file_hash(content)

        # Exact-file dedupe per user: return existing dataset row instantly
        existing = supabase.table("datasets")\
            .select("*")\
            .eq("user_id", current_user.get("id"))\
            .eq("file_hash", file_hash)\
            .order("uploaded_at", desc=True)\
            .limit(1)\
            .execute()

        if existing.data:
            logger.info(
                "Dataset dedupe hit for user=%s, hash=%s",
                current_user.get("id"),
                file_hash[:12],
            )
            return existing.data[0]
        
        # Check file size
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB"
            )
        
        # Parse CSV to get row/column count
        try:
            df = pd.read_csv(io.BytesIO(content))
            row_count = len(df)
            column_count = len(df.columns)
            fingerprint = _compute_dataset_fingerprint(df)
        except Exception as e:
            logger.warning(f"Could not parse CSV for stats: {e}")
            row_count = None
            column_count = None
            fingerprint = None

        # If same name exists but with different hash, generate a unique versioned name
        effective_name = name
        existing_name = supabase.table("datasets")\
            .select("id")\
            .eq("user_id", current_user.get("id"))\
            .eq("name", name)\
            .limit(1)\
            .execute()
        if existing_name.data:
            suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            effective_name = f"{name} ({suffix})"
        
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
            "name": effective_name,
            "description": description,
            "file_path": storage_path,
            "file_size": file_size,
            "file_size_bytes": file_size,
            "file_hash": file_hash,
            "fingerprint": fingerprint,
            "row_count": row_count,
            "column_count": column_count,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("datasets").insert(dataset_data).execute()
        
        logger.info(f"Dataset uploaded: {effective_name} by user {current_user.get('id')}")
        return result.data[0]
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading dataset: {e}")
        raise HTTPException(status_code=500, detail="Error uploading dataset")

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
        
        # Fast path: parse only preview rows to avoid expensive full-file scans.
        preview_df = pd.read_csv(io.BytesIO(file_data), nrows=max(rows, 1))
        total_rows = dataset.data.get("row_count")
        total_columns = dataset.data.get("column_count")

        # Fallback only if metadata is missing.
        if total_rows is None:
            total_rows = sum(1 for _ in io.BytesIO(file_data).read().splitlines()) - 1
        if total_columns is None:
            total_columns = len(preview_df.columns)
        
        return {
            "columns": list(preview_df.columns),
            "rows": preview_df.to_dict(orient="records"),
            "total_rows": int(total_rows),
            "total_columns": int(total_columns),
            "stats": {
                # Preview-oriented stats to keep endpoint responsive.
                "dtypes": preview_df.dtypes.astype(str).to_dict(),
                "missing_values": preview_df.isnull().sum().to_dict()
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
