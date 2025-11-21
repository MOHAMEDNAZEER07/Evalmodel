"""
Evaluation Routes - SMCP Pipeline with Meta Evaluator and Explainability
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
import os
import tempfile
import logging
import pandas as pd
import numpy as np

from app.core.supabase_client import get_supabase
from app.core.config import settings
from app.models.schemas import (
    EvaluationRequest, EvaluationResult, ComparisonRequest, ComparisonResult,
    ModelType, ModelFramework, EvalScoreResult
)
from app.routes.auth import get_current_user
from app.services.smcp_engine import smcp_engine
from app.services.meta_evaluator import meta_evaluator
from app.services.explainability import explainability_engine
from app.services.fairness import fairness_engine
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
            .eq("id", request.id)\
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
            
            # Load dataset for meta evaluator statistics
            df = pd.read_csv(dataset_path)
            
            # Calculate dataset statistics for meta evaluator
            dataset_stats = {
                'n_rows': len(df),
                'n_features': len(df.columns) - 1,  # Exclude target
                'missing_values': df.isnull().sum().sum(),
                'low_variance_fraction': 0.0,  # TODO: Calculate properly
                'imbalance_ratio': 0.5  # TODO: Calculate for classification
            }
            
            # If classification, calculate class imbalance
            if model_type == ModelType.CLASSIFICATION:
                # Assume last column is target
                target_col = df.columns[-1]
                value_counts = df[target_col].value_counts()
                if len(value_counts) > 0:
                    dataset_stats['imbalance_ratio'] = value_counts.max() / len(df)
            
            # Run Meta Evaluator
            meta_result = meta_evaluator.evaluate(
                metrics=metrics.model_dump(exclude_none=True),
                dataset_stats=dataset_stats,
                model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                train_metrics=None  # TODO: Pass train metrics if available
            )
            logger.info(f"Meta Evaluator result: meta_score={meta_result['meta_score']}, dataset_health={meta_result['dataset_health_score']}")
            
            # Prepare data for explainability and fairness analyses
            feature_names = [col for col in df.columns if col != df.columns[-1]]
            X = df[feature_names].values
            split_idx = int(len(X) * 0.8)
            X_train = X[:split_idx]
            X_test = X[split_idx:]
            
            # Run Explainability Analysis
            explainability_result = None
            try:
                # Load the model object for explainability
                import pickle
                with open(model_path, 'rb') as f:
                    model_obj = pickle.load(f)
                
                explainability_result = explainability_engine.explain_model(
                    model=model_obj,
                    X_train=X_train,
                    X_test=X_test,
                    feature_names=feature_names,
                    model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                    max_samples=100
                )
                logger.info(f"Explainability analysis completed: method={explainability_result.get('method_used')}")
            except Exception as e:
                logger.warning(f"Explainability analysis failed: {e}")
                explainability_result = {"error": str(e), "method_used": None}
            
            # Run Fairness Analysis (if sensitive attribute is available)
            fairness_result = None
            try:
                # Production-ready sensitive attribute detection priority:
                # 1) Use `request.sensitive_attribute` if provided and present in dataset
                # 2) Use dataset metadata field 'sensitive_attribute' or metadata->sensitive_attribute (if stored)
                # 3) Use configured SENSITIVE_ATTRIBUTES list from settings (case-insensitive exact match)
                # 4) Conservative fallback: do not auto-pick ambiguous categorical columns; log candidates and skip fairness
                sensitive_attr_col = None

                # 1) explicit from request
                if getattr(request, 'sensitive_attribute', None):
                    candidate = str(request.sensitive_attribute).strip()
                    if candidate in df.columns:
                        sensitive_attr_col = candidate
                    else:
                        logger.warning(f"Requested sensitive attribute '{candidate}' not found in dataset columns")

                # 2) dataset metadata (supports `sensitive_attribute` field or JSON metadata)
                if not sensitive_attr_col:
                    # dataset may include direct column or a metadata json with sensitive_attribute key
                    ds_meta = dataset.copy() if isinstance(dataset, dict) else {}
                    # check top-level key
                    if ds_meta.get('sensitive_attribute') and ds_meta.get('sensitive_attribute') in df.columns:
                        sensitive_attr_col = ds_meta.get('sensitive_attribute')
                    else:
                        # check metadata json field if present
                        metadata = ds_meta.get('metadata') if isinstance(ds_meta.get('metadata'), dict) else {}
                        if metadata and metadata.get('sensitive_attribute') and metadata.get('sensitive_attribute') in df.columns:
                            sensitive_attr_col = metadata.get('sensitive_attribute')

                # 3) configured sensitive attributes list from settings
                if not sensitive_attr_col:
                    candidates = []
                    configured = settings.sensitive_attributes
                    for col in df.columns:
                        if str(col).strip().lower() in configured:
                            candidates.append(col)

                    # If exactly one candidate matches the configured list, pick it. If multiple, choose the one with most non-null values.
                    if len(candidates) == 1:
                        sensitive_attr_col = candidates[0]
                    elif len(candidates) > 1:
                        # pick candidate with most non-null entries as heuristic
                        best = None
                        best_non_null = -1
                        for c in candidates:
                            non_null = int(df[c].notnull().sum())
                            if non_null > best_non_null:
                                best_non_null = non_null
                                best = c
                        sensitive_attr_col = best

                # 4) Conservative fallback: do not auto-select ambiguous categorical columns in production
                if not sensitive_attr_col:
                    logger.info("No clear sensitive attribute detected via request, dataset metadata, or configured attributes. Skipping fairness analysis.")

                if sensitive_attr_col:
                    # Get predictions (need to reload or get from evaluation)
                    target_col = df.columns[-1]
                    y_true = np.asarray(df[target_col].values[split_idx:])
                    
                    # Get predictions from model
                    import pickle
                    with open(model_path, 'rb') as f:
                        model_obj = pickle.load(f)
                    
                    y_pred = np.asarray(model_obj.predict(X_test))
                    
                    # Get sensitive attribute for test set
                    sensitive_attr_test = np.asarray(df[sensitive_attr_col].values[split_idx:])
                    
                    # Run fairness analysis
                    fairness_result = fairness_engine.analyze_fairness(
                        y_true=y_true,
                        y_pred=y_pred,
                        sensitive_attr=sensitive_attr_test,
                        model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression"
                    )
                    
                    if fairness_result.get('analysis_successful'):
                        fairness_result['sensitive_attribute'] = sensitive_attr_col
                        logger.info(f"Fairness analysis completed: overall_score={fairness_result['fairness_metrics'].get('overall_fairness_score')}")
                    else:
                        logger.warning("Fairness analysis completed but no results")
                        fairness_result = None
                else:
                    # sensitive_attr_col was not set; fairness_result already None
                    fairness_result = None
                    
            except Exception as e:
                logger.warning(f"Fairness analysis failed: {e}")
                fairness_result = None
        
        # Save evaluation results with meta evaluator, explainability, and fairness data
        eval_data = {
            "model_id": request.id,
            "dataset_id": request.dataset_id,
            "user_id": current_user.get("id"),
            "metrics": metrics.model_dump(exclude_none=True),
            "eval_score": eval_score.eval_score,
            "normalized_metrics": eval_score.normalized_metrics,
            "weight_distribution": eval_score.weight_distribution,
            "meta_score": meta_result["meta_score"],
            "dataset_health_score": meta_result["dataset_health_score"],
            "meta_flags": meta_result["flags"],
            "meta_recommendations": meta_result["recommendations"],
            "meta_verdict": meta_result["verdict"],
            "feature_importance": explainability_result.get("feature_importance") if explainability_result else None,
            "explainability_method": explainability_result.get("method_used") if explainability_result else None,
            "shap_summary": explainability_result.get("shap_summary") if explainability_result else None,
            "fairness_metrics": fairness_result.get("fairness_metrics") if fairness_result else None,
            "group_metrics": fairness_result.get("group_metrics") if fairness_result else None,
            "sensitive_attribute": fairness_result.get("sensitive_attribute") if fairness_result else None
        }
        
        # Check if evaluation exists, update or insert
        existing = supabase.table("evaluations")\
            .select("id")\
            .eq("model_id", request.id)\
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
            .update({"evaluated": True})\
            .eq("id", request.id)\
            .execute()
        
        logger.info(f"Model evaluated: {request.id}")
        
        # Return full evaluation result
        evaluation = result.data[0]
        return EvaluationResult(
            id=evaluation["id"],
            model_id=evaluation["model_id"],
            dataset_id=evaluation["dataset_id"],
            type=model_type,
            metrics=metrics,
            eval_score=eval_score,
            evaluated_at=evaluation["evaluated_at"],
            meta_score=evaluation.get("meta_score"),
            dataset_health_score=evaluation.get("dataset_health_score"),
            meta_flags=evaluation.get("meta_flags"),
            meta_recommendations=evaluation.get("meta_recommendations"),
            meta_verdict=evaluation.get("meta_verdict"),
            feature_importance=evaluation.get("feature_importance"),
            explainability_method=evaluation.get("explainability_method"),
            shap_summary=evaluation.get("shap_summary"),
            fairness_metrics=evaluation.get("fairness_metrics"),
            group_metrics=evaluation.get("group_metrics"),
            sensitive_attribute=evaluation.get("sensitive_attribute")
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
        for model_id in request.ids:
            model_result = supabase.table("models")\
                .select("*")\
                .eq("id", model_id)\
                .eq("user_id", current_user.get("id"))\
                .single()\
                .execute()
            
            if model_result.data:
                models.append(model_result.data)
        
        if len(models) != len(request.ids):
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
                    id=model["id"],
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
                type=ModelType(model["model_type"]),
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
