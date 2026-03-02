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
            
            # Prepare data splits
            feature_names = [col for col in df.columns if col != df.columns[-1]]
            target_col = df.columns[-1]
            X = df[feature_names].values
            y = df[target_col].values
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            # Load model once for all analyses - try joblib first, then pickle
            model_obj = None
            try:
                import joblib
                model_obj = joblib.load(model_path)
                logger.info(f"Model loaded successfully with joblib")
            except Exception as e:
                logger.debug(f"joblib load failed: {e}, trying pickle")
                try:
                    import pickle
                    with open(model_path, 'rb') as f:
                        model_obj = pickle.load(f)
                    logger.info(f"Model loaded successfully with pickle")
                except Exception as pickle_err:
                    logger.error(f"Both joblib and pickle failed to load model: {pickle_err}")
                    raise ValueError(
                        f"Cannot load model file. This may be due to Python version mismatch or "
                        f"incompatible scikit-learn version. Please re-upload the model trained with "
                        f"the current environment (Python 3.10, scikit-learn 1.6.x). Error: {pickle_err}"
                    )
            
            # Get predictions for fairness and robustness analysis
            y_pred = np.asarray(model_obj.predict(X_test))
            
            # Calculate dataset statistics for meta evaluator (enhanced for DII)
            dataset_stats = {
                'n_rows': len(df),
                'n_features': len(feature_names),
                'missing_values': df.isnull().sum().sum(),
                'low_variance_fraction': 0.0,
                'imbalance_ratio': 0.5,
                'duplicate_ratio': df.duplicated().sum() / max(len(df), 1),
                'skew_score': 0.0
            }
            
            # Calculate low variance fraction
            numeric_cols = df[feature_names].select_dtypes(include=[np.number]).columns
            if len(numeric_cols) > 0:
                variances = df[numeric_cols].var()
                low_var_count = (variances < 0.01).sum()
                dataset_stats['low_variance_fraction'] = low_var_count / len(numeric_cols)
                
                # Calculate average absolute skewness
                skews = df[numeric_cols].skew().abs()
                dataset_stats['skew_score'] = min(1.0, skews.mean() / 3.0)  # Normalize to [0,1]
            
            # If classification, calculate class imbalance
            if model_type == ModelType.CLASSIFICATION:
                value_counts = df[target_col].value_counts()
                if len(value_counts) > 0:
                    dataset_stats['imbalance_ratio'] = value_counts.max() / len(df)
            
            # Run Fairness Analysis FIRST (needed for meta evaluator trust score)
            fairness_result = None
            try:
                # Production-ready sensitive attribute detection priority:
                # 1) Use `request.sensitive_attribute` if provided and present in dataset
                # 2) Use dataset metadata field 'sensitive_attribute' or metadata->sensitive_attribute
                # 3) Use configured SENSITIVE_ATTRIBUTES list from settings
                # 4) Conservative fallback: skip fairness analysis
                sensitive_attr_col = None

                # 1) explicit from request
                if getattr(request, 'sensitive_attribute', None):
                    candidate = str(request.sensitive_attribute).strip()
                    if candidate in df.columns:
                        sensitive_attr_col = candidate
                    else:
                        logger.warning(f"Requested sensitive attribute '{candidate}' not found in dataset columns")

                # 2) dataset metadata
                if not sensitive_attr_col:
                    ds_meta = dataset.copy() if isinstance(dataset, dict) else {}
                    if ds_meta.get('sensitive_attribute') and ds_meta.get('sensitive_attribute') in df.columns:
                        sensitive_attr_col = ds_meta.get('sensitive_attribute')
                    else:
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

                    if len(candidates) == 1:
                        sensitive_attr_col = candidates[0]
                    elif len(candidates) > 1:
                        best = None
                        best_non_null = -1
                        for c in candidates:
                            non_null = int(df[c].notnull().sum())
                            if non_null > best_non_null:
                                best_non_null = non_null
                                best = c
                        sensitive_attr_col = best

                # 4) Conservative fallback
                if not sensitive_attr_col:
                    logger.info("No clear sensitive attribute detected. Skipping fairness analysis.")

                if sensitive_attr_col:
                    sensitive_attr_test = np.asarray(df[sensitive_attr_col].values[split_idx:])
                    
                    fairness_result = fairness_engine.analyze_fairness(
                        y_true=np.asarray(y_test),
                        y_pred=y_pred,
                        sensitive_attr=sensitive_attr_test,
                        model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression"
                    )
                    
                    if fairness_result.get('analysis_successful'):
                        fairness_result['sensitive_attribute'] = sensitive_attr_col
                        logger.info(f"Fairness analysis completed: overall_score={fairness_result['fairness_metrics'].get('overall_fairness_score')}, F_score={fairness_result['fairness_metrics'].get('fairness_score_F')}")
                    else:
                        logger.warning("Fairness analysis completed but no results")
                        fairness_result = None
                    
            except Exception as e:
                logger.warning(f"Fairness analysis failed: {e}")
                fairness_result = None
            
            # Run Hybrid Trust Meta Evaluator (with fairness results)
            meta_result = meta_evaluator.evaluate(
                metrics=metrics.model_dump(exclude_none=True),
                dataset_stats=dataset_stats,
                model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                train_metrics=None,  # TODO: Pass train metrics if available
                fairness_result=fairness_result
            )
            logger.info(f"Hybrid Trust Evaluator: trust_score={meta_result['trust_score']:.2f}, DII={meta_result['DII']:.4f}, P={meta_result['component_scores']['performance']:.4f}, H={meta_result['component_scores']['health']:.4f}, F={meta_result['component_scores']['fairness']:.4f}, R={meta_result['component_scores']['robustness']:.4f}")
            
            # Run Explainability Analysis
            explainability_result = None
            try:
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
        
        # Save evaluation results with hybrid trust framework data
        eval_data = {
            "model_id": request.id,
            "dataset_id": request.dataset_id,
            "user_id": current_user.get("id"),
            "metrics": metrics.model_dump(exclude_none=True),
            "eval_score": eval_score.eval_score,
            "normalized_metrics": eval_score.normalized_metrics,
            "weight_distribution": eval_score.weight_distribution,
            # Hybrid Trust Framework scores
            "meta_score": meta_result["meta_score"],  # Legacy compatibility
            "trust_score": meta_result["trust_score"],
            "DII": meta_result["DII"],
            "component_scores": meta_result["component_scores"],
            "risk_values": meta_result["risk_values"],
            "hybrid_weights": meta_result["hybrid_weights"],
            "dataset_health_score": meta_result["dataset_health_score"],
            "meta_flags": meta_result["flags"],
            "meta_recommendations": meta_result["recommendations"],
            "meta_verdict": meta_result["verdict"],
            # Explainability
            "feature_importance": explainability_result.get("feature_importance") if explainability_result else None,
            "explainability_method": explainability_result.get("method_used") if explainability_result else None,
            "shap_summary": explainability_result.get("shap_summary") if explainability_result else None,
            # Fairness
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
            # Hybrid Trust Framework scores
            meta_score=evaluation.get("meta_score"),
            trust_score=evaluation.get("trust_score"),
            DII=evaluation.get("DII"),
            component_scores=evaluation.get("component_scores"),
            risk_values=evaluation.get("risk_values"),
            hybrid_weights=evaluation.get("hybrid_weights"),
            dataset_health_score=evaluation.get("dataset_health_score"),
            meta_flags=evaluation.get("meta_flags"),
            meta_recommendations=evaluation.get("meta_recommendations"),
            meta_verdict=evaluation.get("meta_verdict"),
            # Explainability
            feature_importance=evaluation.get("feature_importance"),
            explainability_method=evaluation.get("explainability_method"),
            shap_summary=evaluation.get("shap_summary"),
            # Fairness
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
