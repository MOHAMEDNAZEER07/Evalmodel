"""
Direct test endpoint to debug storage download
"""
from fastapi import APIRouter, Depends
from supabase import Client
import pandas as pd
import io

from app.core.dependencies import get_current_user
from app.core.supabase_client import get_supabase
from app.core.config import settings

router = APIRouter()

@router.get("/test-download/{dataset_id}")
async def test_download(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Test endpoint to debug storage download"""
    
    # Get dataset metadata
    result = supabase.table("datasets")\
        .select("*")\
        .eq("id", dataset_id)\
        .eq("user_id", current_user["id"])\
        .single()\
        .execute()
    
    if not result.data:
        return {"error": "Dataset not found"}
    
    dataset = result.data
    file_path = dataset["file_path"]
    
    response = {
        "dataset_id": dataset_id,
        "file_path": file_path,
        "bucket": settings.STORAGE_BUCKET_DATASETS,
        "attempts": []
    }
    
    # Method 1: Standard download
    try:
        file_data = supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS).download(file_path)
        df = pd.read_csv(io.BytesIO(file_data))
        response["attempts"].append({
            "method": "Standard download with full path",
            "status": "SUCCESS",
            "bytes": len(file_data),
            "rows": len(df),
            "columns": len(df.columns)
        })
        response["success"] = True
        return response
    except Exception as e:
        response["attempts"].append({
            "method": "Standard download with full path",
            "status": "FAILED",
            "error": str(e),
            "error_type": type(e).__name__
        })
    
    # Method 2: Just filename
    try:
        filename = file_path.split('/')[-1]
        file_data = supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS).download(filename)
        df = pd.read_csv(io.BytesIO(file_data))
        response["attempts"].append({
            "method": "Download with filename only",
            "status": "SUCCESS",
            "bytes": len(file_data),
            "rows": len(df),
            "columns": len(df.columns)
        })
        response["success"] = True
        return response
    except Exception as e:
        response["attempts"].append({
            "method": "Download with filename only",
            "status": "FAILED",
            "error": str(e),
            "error_type": type(e).__name__
        })
    
    response["success"] = False
    return response
