"""
Evaluation Routes - SMCP Pipeline with Meta Evaluator and Explainability
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
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
from app.services.meta_evaluator import meta_evaluator, MetaEvaluator
from app.services.explainability import explainability_engine
from app.services.fairness import fairness_engine, run_fairness_analysis, detect_sensitive_attributes
from app.services.evaluation_cache import build_pair_cache_id, is_cache_fresh
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

        pair_cache_id = build_pair_cache_id(model, dataset)

        # Check for cached evaluation result (skip if force_rerun)
        if not getattr(request, 'force_rerun', False):
            cached_result = supabase.table("evaluations")\
                .select("*")\
                .eq("model_id", request.id)\
                .eq("dataset_id", request.dataset_id)\
                .eq("user_id", current_user.get("id"))\
                .execute()

            if cached_result.data:
                cached = cached_result.data[0]
                if is_cache_fresh(cached, model, dataset, pair_cache_id):
                    logger.info(f"Returning cached evaluation for model={request.id}, dataset={request.dataset_id}")
                    return JSONResponse(
                        content={
                            "id": cached["id"],
                            "model_id": cached["model_id"],
                            "dataset_id": cached["dataset_id"],
                            "metrics": cached.get("metrics", {}),
                            "eval_score": cached.get("eval_score"),
                            "normalized_metrics": cached.get("normalized_metrics", {}),
                            "weight_distribution": cached.get("weight_distribution", {}),
                            # Hybrid Trust Framework scores
                            "trust_score": cached.get("trust_score"),
                            "trust_score_raw": cached.get("trust_score_raw"),
                            "trust_mode": cached.get("trust_mode"),
                            "meta_score": cached.get("meta_score"),
                            "DII": cached.get("DII"),
                            "dii_components": cached.get("dii_components"),
                            "component_scores": cached.get("component_scores"),
                            "risk_values": cached.get("risk_values"),
                            "hybrid_weights": cached.get("hybrid_weights"),
                            "beta_auto": cached.get("beta_auto"),
                            "dataset_health_score": cached.get("dataset_health_score"),
                            # Lambda & Guard System
                            "lambda_value": cached.get("lambda_value"),
                            "lambda_raw": cached.get("lambda_raw"),
                            "lambda_cap": cached.get("lambda_cap"),
                            "guard_threshold": cached.get("guard_threshold"),
                            "guard_triggered": cached.get("guard_triggered"),
                            "guard_failures": cached.get("guard_failures"),
                            "global_penalty_applied": cached.get("global_penalty_applied"),
                            "instability_penalty_value": cached.get("instability_penalty_value"),
                            # Meta Evaluator
                            "meta_flags": cached.get("meta_flags"),
                            "meta_recommendations": cached.get("meta_recommendations"),
                            "meta_verdict": cached.get("meta_verdict"),
                            # Breakdown for transparency panel
                            "breakdown": cached.get("breakdown"),
                            "strict_result": cached.get("strict_result"),
                            # Explainability
                            "feature_importance": cached.get("feature_importance"),
                            "explainability_method": cached.get("explainability_method"),
                            "shap_summary": cached.get("shap_summary"),
                            # Fairness
                            "fairness_metrics": cached.get("fairness_metrics"),
                            "group_metrics": cached.get("group_metrics"),
                            "sensitive_attribute": cached.get("sensitive_attribute"),
                            "evaluated_at": cached.get("evaluated_at"),
                            "pair_cache_id": pair_cache_id,
                            "cache_hit": True,
                            "cache_message": "Returning cached evaluation for identical model+dataset artifacts",
                            "cached": True
                        }
                    )
        
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
            
            # Row-cap sampling for large datasets to prevent OOM
            MAX_EVAL_ROWS = 10_000
            original_row_count = len(df)
            if original_row_count > MAX_EVAL_ROWS:
                df = df.sample(n=MAX_EVAL_ROWS, random_state=42).reset_index(drop=True)
                logger.info(f"Dataset sampled from {original_row_count} to {MAX_EVAL_ROWS} rows")
            
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
            
            # DEBUG: Log computed dataset_stats for DII
            logger.info(f"📊 Dataset stats for DII: n_rows={dataset_stats['n_rows']}, n_features={dataset_stats['n_features']}")
            logger.info(f"📊 DII inputs: missing={dataset_stats['missing_values']}, imbalance_ratio={dataset_stats['imbalance_ratio']:.4f}, duplicate_ratio={dataset_stats['duplicate_ratio']:.4f}, skew={dataset_stats['skew_score']:.4f}")
            
            # Run Fairness Analysis FIRST (needed for meta evaluator trust score)
            # Uses enhanced fairness engine with auto-detection and multi-group support
            fairness_result = None
            try:
                # Determine sensitive attribute from explicit request or dataset metadata
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

                # Use enhanced run_fairness_analysis with auto-detection
                # This will auto-detect sensitive attributes if none provided
                df_test = df.iloc[split_idx:].copy()  # Test portion of dataframe for fairness
                model_type_str = "classification" if model_type == ModelType.CLASSIFICATION else "regression"
                
                fairness_full_result = run_fairness_analysis(
                    df=df_test,
                    y_true=np.asarray(y_test),
                    y_pred=y_pred,
                    sensitive_attribute=sensitive_attr_col,  # None triggers auto-detection
                    target_column=target_col,
                    model_type=model_type_str
                )
                
                if fairness_full_result.get('analysis_successful'):
                    # For backward compatibility, extract first analysis as main result
                    analyses = fairness_full_result.get('analyses', [])
                    if analyses:
                        fairness_result = analyses[0]  # Primary analysis
                        fairness_result['all_analyses'] = analyses  # Include all for transparency
                        fairness_result['detected_attributes'] = fairness_full_result.get('detected_attributes', [])
                        logger.info(f"Fairness analysis completed: "
                                   f"detected_attrs={fairness_result['detected_attributes']}, "
                                   f"num_groups={fairness_result.get('num_groups')}, "
                                   f"F_score={fairness_result['fairness_metrics'].get('fairness_score_F'):.4f}")
                    else:
                        logger.warning("Fairness analysis returned no valid analyses")
                        fairness_result = None
                else:
                    detected = fairness_full_result.get('detected_attributes', [])
                    logger.info(f"No sensitive attributes detected for fairness analysis (auto-detected: {detected})")
                    fairness_result = None
                    
            except Exception as e:
                logger.warning(f"Fairness analysis failed: {e}", exc_info=True)
                fairness_result = None
            
            # Compute train metrics for robustness analysis (auto 80/20 split)
            train_metrics = None
            try:
                y_train_pred = np.asarray(model_obj.predict(X_train))
                if model_type == ModelType.CLASSIFICATION:
                    from sklearn.metrics import accuracy_score, f1_score as sk_f1, precision_score, recall_score
                    train_metrics = {
                        'accuracy': float(accuracy_score(y_train, y_train_pred)),
                        'f1_score': float(sk_f1(y_train, y_train_pred, average='weighted', zero_division=0)),
                        'precision': float(precision_score(y_train, y_train_pred, average='weighted', zero_division=0)),
                        'recall': float(recall_score(y_train, y_train_pred, average='weighted', zero_division=0)),
                    }
                else:
                    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score as sk_r2
                    train_metrics = {
                        'mae': float(mean_absolute_error(y_train, y_train_pred)),
                        'mse': float(mean_squared_error(y_train, y_train_pred)),
                        'r2_score': float(sk_r2(y_train, y_train_pred)),
                    }
                logger.info(f"Train metrics computed: {train_metrics}")
            except Exception as e:
                logger.warning(f"Could not compute train metrics: {e}")
                train_metrics = None
            
            # Run Hybrid Trust Meta Evaluator in BOTH modes for comparison
            eval_args = dict(
                metrics=metrics.model_dump(exclude_none=True),
                dataset_stats=dataset_stats,
                model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                train_metrics=train_metrics,
                fairness_result=fairness_result
            )
            logger.info(f"🔍 eval_args dataset_stats: {dataset_stats}")
            
            # Balanced mode (default)
            balanced_evaluator = MetaEvaluator(trust_mode="balanced")
            meta_result = balanced_evaluator.evaluate(**eval_args)
            
            # DEBUG: Log dii_components from meta_result
            logger.info(f"🔍 meta_result dii_components: {meta_result.get('dii_components')}")
            
            # Strict mode for comparison
            strict_evaluator = MetaEvaluator(trust_mode="strict")
            strict_result = strict_evaluator.evaluate(**eval_args)
            
            logger.info(f"Hybrid Trust Evaluator: balanced={meta_result['trust_score']:.2f}, strict={strict_result['trust_score']:.2f}, DII={meta_result['DII']:.4f}")
            
            # Check for EvalScore vs TrustScore gap - add warning flag if significant
            # This helps users understand when Trust Score appears much higher than EvalScore
            trust_eval_gap = meta_result['trust_score'] - eval_score.eval_score
            if trust_eval_gap > 10:
                gap_warning = f"trust_eval_score_gap_{int(trust_eval_gap)}"
                meta_result['flags'].append(gap_warning)
                
                # Build informative gap warning message
                perf_score = meta_result.get('component_scores', {}).get('performance', 0)
                raw_metrics = metrics.model_dump(exclude_none=True)
                mae = raw_metrics.get('mae', 'N/A')
                rmse = raw_metrics.get('rmse', 'N/A')
                
                meta_result['recommendations'].insert(0, {
                    "action": "Review error magnitudes before production deployment",
                    "why": f"Trust Score ({meta_result['trust_score']:.1f}) is significantly higher than "
                           f"EvalScore ({eval_score.eval_score:.1f}). Trust Score is driven by performance metric "
                           f"(P={perf_score:.2f}) but EvalScore penalizes raw absolute errors. "
                           f"MAE={mae}, RMSE={rmse}. Verify these error magnitudes are acceptable for your use case.",
                    "priority": "high",
                    "component": "performance"
                })
                
                logger.warning(f"⚠️ Trust-Eval gap detected: trust={meta_result['trust_score']:.1f}, eval={eval_score.eval_score:.1f}, gap={trust_eval_gap:.1f}")
            
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
            "trust_score_raw": meta_result.get("trust_score_raw"),
            "trust_mode": meta_result.get("trust_mode", "balanced"),
            "DII": meta_result["DII"],
            "dii_components": meta_result.get("dii_components"),
            "component_scores": meta_result["component_scores"],
            "risk_values": meta_result["risk_values"],
            "hybrid_weights": meta_result["hybrid_weights"],
            "beta_auto": meta_result.get("beta_auto"),
            "lambda_value": meta_result.get("lambda_value"),
            "lambda_raw": meta_result.get("lambda_raw"),
            "lambda_cap": meta_result.get("lambda_cap"),
            "guard_threshold": meta_result.get("guard_threshold"),
            "guard_triggered": meta_result.get("non_compensatory_override"),
            "guard_failures": meta_result.get("non_compensatory_failures"),
            "global_penalty_applied": meta_result.get("global_penalty_applied"),
            "instability_penalty_value": meta_result.get("instability_penalty_value"),
            "breakdown": meta_result.get("breakdown"),
            "dataset_health_score": meta_result["dataset_health_score"],
            "meta_flags": meta_result["flags"],
            "meta_recommendations": meta_result["recommendations"],
            "meta_verdict": meta_result["verdict"],
            # Strict mode comparison (stored for cached retrieval)
            "strict_result": {
                "trust_score": strict_result.get("trust_score"),
                "trust_score_raw": strict_result.get("trust_score_raw"),
                "DII": strict_result.get("DII"),
                "lambda_value": strict_result.get("lambda_value"),
                "component_scores": strict_result.get("component_scores"),
                "risk_values": strict_result.get("risk_values"),
                "hybrid_weights": strict_result.get("hybrid_weights"),
                "guard_threshold": strict_result.get("guard_threshold"),
                "guard_triggered": strict_result.get("non_compensatory_override"),
                "guard_failures": strict_result.get("non_compensatory_failures"),
                "meta_verdict": strict_result.get("verdict"),
                "pair_cache_id": pair_cache_id,
            },
            "cache_hit": False,
            "evaluation_config": {
                "pair_cache_id": pair_cache_id,
                "dataset_file_hash": dataset.get("file_hash"),
                "cache_strategy": "artifact-pair",
                "force_rerun": bool(getattr(request, "force_rerun", False)),
            },
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
            .update({"is_evaluated": True})\
            .eq("id", request.id)\
            .execute()
        
        logger.info(f"Model evaluated: {request.id}")
        
        # Return full evaluation result with research transparency data
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
            sensitive_attribute=evaluation.get("sensitive_attribute"),
            # Research transparency (from live meta_result, not DB)
            trust_mode=meta_result.get("trust_mode"),
            lambda_value=meta_result.get("lambda_value"),
            lambda_raw=meta_result.get("lambda_raw"),
            lambda_cap=meta_result.get("lambda_cap"),
            dii_components=meta_result.get("dii_components"),
            beta_auto=meta_result.get("beta_auto"),
            guard_threshold=meta_result.get("guard_threshold"),
            guard_triggered=meta_result.get("non_compensatory_override"),
            guard_failures=meta_result.get("non_compensatory_failures"),
            trust_score_raw=meta_result.get("trust_score_raw"),
            global_penalty_applied=meta_result.get("global_penalty_applied"),
            instability_penalty_value=meta_result.get("instability_penalty_value"),
            breakdown=meta_result.get("breakdown"),
            # Strict mode comparison
            strict_result={
                "trust_score": strict_result.get("trust_score"),
                "trust_score_raw": strict_result.get("trust_score_raw"),
                "DII": strict_result.get("DII"),
                "lambda_value": strict_result.get("lambda_value"),
                "lambda_raw": strict_result.get("lambda_raw"),
                "component_scores": strict_result.get("component_scores"),
                "risk_values": strict_result.get("risk_values"),
                "hybrid_weights": strict_result.get("hybrid_weights"),
                "guard_threshold": strict_result.get("guard_threshold"),
                "guard_triggered": strict_result.get("non_compensatory_override"),
                "guard_failures": strict_result.get("non_compensatory_failures"),
                "global_penalty_applied": strict_result.get("global_penalty_applied"),
                "instability_penalty_value": strict_result.get("instability_penalty_value"),
                "breakdown": strict_result.get("breakdown"),
                "dii_components": strict_result.get("dii_components"),
                "beta_auto": strict_result.get("beta_auto"),
                "meta_verdict": strict_result.get("verdict"),
            }
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


# =============================================================================
# ASYNC EVALUATION ENDPOINTS
# =============================================================================
# These endpoints provide non-blocking evaluation with progress tracking.
# Use POST /evaluate/async to start, then poll GET /evaluate/status/{job_id}
# =============================================================================

from app.services.evaluation_job_service import evaluation_job_service
from pydantic import BaseModel, ConfigDict
from typing import Optional


class AsyncEvaluationRequest(BaseModel):
    """Request for async evaluation."""
    model_config = ConfigDict(protected_namespaces=())
    
    model_id: str
    dataset_id: str
    sensitive_attribute: Optional[str] = None
    force_rerun: bool = False


class AsyncEvaluationResponse(BaseModel):
    """Response from async evaluation start."""
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    """Response from job status check."""
    id: str
    status: str
    progress: int
    step: str
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.post("/evaluate/async", response_model=AsyncEvaluationResponse)
async def evaluate_model_async(
    request: AsyncEvaluationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Start an async evaluation job and return immediately.
    
    Returns a job_id that can be used to poll for progress via GET /evaluate/status/{job_id}
    
    Benefits:
    - Non-blocking: Returns in <100ms
    - Progress tracking: Real-time updates on evaluation stages
    - No timeouts: Long evaluations won't timeout
    """
    try:
        user_id = current_user.get("id")
        
        # Create job record instantly
        job_id = evaluation_job_service.create_job(
            user_id=user_id,
            model_id=request.model_id,
            dataset_id=request.dataset_id,
            sensitive_attribute=request.sensitive_attribute
        )
        
        # Fire pipeline in background — non-blocking
        background_tasks.add_task(
            evaluation_job_service.run_pipeline,
            job_id=job_id,
            user_id=user_id,
            model_id=request.model_id,
            dataset_id=request.dataset_id,
            sensitive_attribute=request.sensitive_attribute,
            force_rerun=request.force_rerun
        )
        
        logger.info(f"Async evaluation started: job_id={job_id}, model={request.model_id}")
        
        # Return immediately
        return AsyncEvaluationResponse(job_id=job_id, status="pending")
    
    except Exception as e:
        logger.error(f"Failed to start async evaluation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start evaluation: {str(e)}")


@router.get("/evaluate/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get the status of an evaluation job.
    
    Poll this endpoint every 1-2 seconds while status is 'pending' or 'running'.
    
    Statuses:
    - pending: Job queued, not yet started
    - running: Evaluation in progress (check 'progress' and 'step' fields)
    - completed: Done! The 'result' field contains the full evaluation
    - failed: Error occurred. Check 'error' field for details
    """
    user_id = current_user.get("id")
    
    job = evaluation_job_service.get_job_status(job_id, user_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@router.get("/evaluate/jobs")
async def list_evaluation_jobs(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = 20,
    status: Optional[str] = None
):
    """
    List recent evaluation jobs for the current user.
    
    Optionally filter by status (pending, running, completed, failed).
    """
    try:
        query = supabase.table("evaluation_jobs")\
            .select("id, model_id, dataset_id, status, progress, step, error, created_at, updated_at")\
            .eq("user_id", current_user.get("id"))\
            .order("created_at", desc=True)\
            .limit(limit)
        
        if status:
            query = query.eq("status", status)
        
        result = query.execute()
        
        return {"jobs": result.data}
    
    except Exception as e:
        logger.error(f"Error listing evaluation jobs: {e}")
        raise HTTPException(status_code=500, detail="Error listing jobs")
