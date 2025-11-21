"""
Insights API Routes
Endpoints for data quality analysis, outlier detection, and correlation analysis
VERSION: 2024-11-05-v3
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from typing import Optional, Dict, Any
import pandas as pd
import io
import logging
import os
import tempfile

from app.core.dependencies import get_current_user, get_supabase
from app.core.config import settings
from app.services.insights_engine import InsightsEngine

logger = logging.getLogger(__name__)

router = APIRouter()


async def load_dataset_dataframe(dataset_id: str, user_id: str, supabase: Client) -> pd.DataFrame:
    """Helper function to load dataset into pandas DataFrame - using evaluation page pattern"""
    try:
        # Get dataset metadata
        dataset_result = supabase.table("datasets")\
            .select("*")\
            .eq("id", dataset_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not dataset_result.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        dataset = dataset_result.data
        file_path = dataset["file_path"]
        
        logger.info(f"Loading dataset: {dataset['name']} (ID: {dataset_id})")
        logger.info(f"File path: {file_path}")
        
        # Download dataset file from storage (same pattern as evaluation.py)
        dataset_data = supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS)\
            .download(file_path)
        
        # Load into DataFrame directly from bytes
        df = pd.read_csv(io.BytesIO(dataset_data))
        
        logger.info(f"Successfully loaded dataset: {len(df)} rows, {len(df.columns)} columns")
        
        return df
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading dataset: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading dataset: {str(e)}")


@router.get("/data-quality/{dataset_id}")
async def analyze_data_quality(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Analyze data quality metrics for a dataset
    
    Returns:
    - Completeness (% non-null values)
    - Validity (% valid data types)
    - Uniqueness (% unique values)
    - Consistency (% values without outliers)
    - Overall quality score
    """
    try:
        logger.info(f"Analyzing data quality for dataset {dataset_id}")
        
        # Load dataset
        df = await load_dataset_dataframe(dataset_id, current_user["id"], supabase)
        
        # Analyze quality
        quality_metrics = InsightsEngine.analyze_data_quality(df)
        
        return {
            "dataset_id": dataset_id,
            "quality_metrics": quality_metrics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing data quality: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outliers/{dataset_id}")
async def detect_outliers(
    dataset_id: str,
    method: str = Query("iqr", regex="^(iqr|zscore)$"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Detect outliers in numeric features
    
    Args:
    - dataset_id: Dataset ID
    - method: Detection method ('iqr' or 'zscore')
    
    Returns:
    - List of features with outliers
    - Outlier counts and statistics
    - Impact assessment
    """
    try:
        logger.info(f"Detecting outliers in dataset {dataset_id} using {method} method")
        
        # Load dataset
        df = await load_dataset_dataframe(dataset_id, current_user["id"], supabase)
        
        # Detect outliers
        outlier_info = InsightsEngine.detect_outliers(df, method=method)
        
        return {
            "dataset_id": dataset_id,
            **outlier_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting outliers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/correlations/{dataset_id}")
async def calculate_correlations(
    dataset_id: str,
    method: str = Query("pearson", regex="^(pearson|spearman)$"),
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Calculate feature correlations
    
    Args:
    - dataset_id: Dataset ID
    - method: Correlation method ('pearson' or 'spearman')
    - threshold: Minimum correlation threshold (0.0 - 1.0)
    
    Returns:
    - Correlation pairs above threshold
    - Strong correlations (>0.7)
    - Full correlation matrix
    """
    try:
        logger.info(f"Calculating correlations for dataset {dataset_id} using {method} method")
        
        # Load dataset
        df = await load_dataset_dataframe(dataset_id, current_user["id"], supabase)
        
        # Calculate correlations
        corr_info = InsightsEngine.calculate_correlations(df, method=method, threshold=threshold)
        
        return {
            "dataset_id": dataset_id,
            **corr_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating correlations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{dataset_id}")
async def get_insights_summary(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get comprehensive insights summary for a dataset
    
    Includes:
    - Data quality metrics
    - Outlier detection
    - Feature correlations
    - AI-generated summary
    """
    try:
        logger.info(f"Generating insights summary for dataset {dataset_id}")
        
        # Load dataset
        df = await load_dataset_dataframe(dataset_id, current_user["id"], supabase)
        
        # Run all analyses
        quality_metrics = InsightsEngine.analyze_data_quality(df)
        outliers = InsightsEngine.detect_outliers(df, method="iqr")
        correlations = InsightsEngine.calculate_correlations(df, method="pearson", threshold=0.5)
        
        # Generate summary
        summary = InsightsEngine.generate_insights_summary(
            quality_metrics, outliers, correlations
        )
        
        return {
            "dataset_id": dataset_id,
            "quality_metrics": quality_metrics,
            "outliers": outliers,
            "correlations": {
                "top_correlations": correlations["correlations"][:10],
                "strong_correlations": correlations["strong_correlations"],
                "total_pairs": correlations["total_pairs"]
            },
            "summary": summary,
            "features_analyzed": len(df.columns),
            "rows_analyzed": len(df)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating insights summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
