"""
Evaluation Routes - SMCP Pipeline
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
import os
import tempfile
import logging

from app.core.supabase_client import get_supabase
from app.core.config import settings
from app.models.schemas import (
    EvaluationRequest, EvaluationResult, ComparisonRequest, ComparisonResult,
    ModelType, ModelFramework, EvalScoreResult
)
from app.routes.auth import get_current_user
from app.services.smcp_engine import smcp_engine
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate_model(
    request: EvaluationRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Evaluate a single model using the SMCP pipeline
    """
    try:
        # Get model metadata
        model_result = supabase.table("models")\
            .select("*")\
            .eq("id", request.model_id)\
            .eq("user_id", current_user.get("id"))\
            .single()\
            .execute()
        
        if not model_result.data:
            raise HTTPException(status_code=404, detail="Model not found")
        
        model = model_result.data
        
        # Get dataset metadata
        dataset_result = supabase.table("datasets")\
            .select("*")\
            .eq("id", request.dataset_id)\
            .eq("user_id", current_user.get("id"))\
            .single()\
            .execute()
        
        if not dataset_result.data:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        dataset = dataset_result.data
        
        # Download model and dataset files to temp location
        with tempfile.TemporaryDirectory() as temp_dir:
            # Download model
            model_data = supabase.storage.from_(settings.STORAGE_BUCKET_MODELS)\
                .download(model["file_path"])
            model_path = os.path.join(temp_dir, "model")
            with open(model_path, "wb") as f:
                f.write(model_data)
            
            # Download dataset
            dataset_data = supabase.storage.from_(settings.STORAGE_BUCKET_DATASETS)\
                .download(dataset["file_path"])
            dataset_path = os.path.join(temp_dir, "dataset.csv")
            with open(dataset_path, "wb") as f:
                f.write(dataset_data)
            
            # Run SMCP evaluation
            model_type = ModelType(model["model_type"])
            framework = ModelFramework(model["framework"])
            
            metrics, eval_score = smcp_engine.evaluate_model(
                model_path=model_path,
                dataset_path=dataset_path,
                model_type=model_type,
                framework=framework
            )
        
        # Save evaluation results
        eval_data = {
            "model_id": request.model_id,
            "dataset_id": request.dataset_id,
            "user_id": current_user.get("id"),
            "metrics": metrics.model_dump(exclude_none=True),
            "eval_score": eval_score.eval_score,
            "normalized_metrics": eval_score.normalized_metrics,
            "weight_distribution": eval_score.weight_distribution
        }
        
        # Check if evaluation exists, update or insert
        existing = supabase.table("evaluations")\
            .select("id")\
            .eq("model_id", request.model_id)\
            .eq("dataset_id", request.dataset_id)\
            .execute()
        
        if existing.data:
            result = supabase.table("evaluations")\
                .update(eval_data)\
                .eq("id", existing.data[0]["id"])\
                .execute()
        else:
            result = supabase.table("evaluations")\
                .insert(eval_data)\
                .execute()
        
        # Update model evaluation status
        supabase.table("models")\
            .update({"is_evaluated": True})\
            .eq("id", request.model_id)\
            .execute()
        
        logger.info(f"Model evaluated: {request.model_id}")
        
        # Return full evaluation result
        evaluation = result.data[0]
        return EvaluationResult(
            id=evaluation["id"],
            model_id=evaluation["model_id"],
            dataset_id=evaluation["dataset_id"],
            model_type=model_type,
            metrics=metrics,
            eval_score=eval_score,
            evaluated_at=evaluation["evaluated_at"]
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        # Model loading or compatibility errors
        logger.error(f"Model compatibility error: {e}")
        raise HTTPException(
            status_code=400, 
            detail=f"Model compatibility issue: {str(e)}. Please ensure your model file is saved with a compatible Python version and framework."
        )
    except Exception as e:
        logger.error(f"Error during evaluation: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Evaluation failed: {str(e)}"
        )

@router.post("/compare", response_model=ComparisonResult)
async def compare_models(
    request: ComparisonRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Compare multiple models using the SMCP pipeline
    """
    try:
        # Get all models
        models = []
        for model_id in request.model_ids:
            model_result = supabase.table("models")\
                .select("*")\
                .eq("id", model_id)\
                .eq("user_id", current_user.get("id"))\
                .single()\
                .execute()
            
            if model_result.data:
                models.append(model_result.data)
        
        if len(models) != len(request.model_ids):
            raise HTTPException(status_code=404, detail="One or more models not found")
        
        # Evaluate each model if not already evaluated
        evaluations = []
        for model in models:
            # Check if evaluation exists
            eval_result = supabase.table("evaluations")\
                .select("*")\
                .eq("model_id", model["id"])\
                .eq("dataset_id", request.dataset_id)\
                .execute()
            
            if eval_result.data:
                evaluations.append(eval_result.data[0])
            else:
                # Trigger evaluation
                eval_request = EvaluationRequest(
                    model_id=model["id"],
                    dataset_id=request.dataset_id
                )
                eval_response = await evaluate_model(eval_request, current_user, supabase)
                
                # Fetch the saved evaluation
                eval_result = supabase.table("evaluations")\
                    .select("*")\
                    .eq("model_id", model["id"])\
                    .eq("dataset_id", request.dataset_id)\
                    .single()\
                    .execute()
                evaluations.append(eval_result.data)
        
        # Create leaderboard sorted by eval_score
        leaderboard = []
        for i, evaluation in enumerate(sorted(evaluations, key=lambda x: x["eval_score"], reverse=True)):
            model = next(m for m in models if m["id"] == evaluation["model_id"])
            leaderboard.append({
                "rank": i + 1,
                "model_id": model["id"],
                "model_name": model["name"],
                "model_type": model["model_type"],
                "framework": model["framework"],
                "eval_score": evaluation["eval_score"],
                "metrics": evaluation["metrics"]
            })
        
        # Convert evaluations to EvaluationResult objects
        evaluation_results = []
        for evaluation in evaluations:
            model = next(m for m in models if m["id"] == evaluation["model_id"])
            from app.models.schemas import MetricsResult
            
            evaluation_results.append(EvaluationResult(
                id=evaluation["id"],
                model_id=evaluation["model_id"],
                dataset_id=evaluation["dataset_id"],
                model_type=ModelType(model["model_type"]),
                metrics=MetricsResult(**evaluation["metrics"]),
                eval_score=EvalScoreResult(
                    eval_score=evaluation["eval_score"],
                    normalized_metrics=evaluation["normalized_metrics"],
                    weight_distribution=evaluation["weight_distribution"]
                ),
                evaluated_at=evaluation["evaluated_at"]
            ))
        
        return ComparisonResult(
            models=models,
            evaluations=evaluation_results,
            leaderboard=leaderboard
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing models: {e}")
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@router.get("/history")
async def get_evaluation_history(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = 50
):
    """Get evaluation history for current user"""
    try:
        result = supabase.table("evaluations")\
            .select("*, models(name), datasets(name)")\
            .eq("user_id", current_user.get("id"))\
            .order("evaluated_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return {"evaluations": result.data}
    
    except Exception as e:
        logger.error(f"Error fetching evaluation history: {e}")
        raise HTTPException(status_code=500, detail="Error fetching history")
