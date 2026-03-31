"""
Async Evaluation Job Service
============================
Handles background evaluation jobs with progress tracking.
Provides non-blocking evaluation with real-time status updates.

Usage:
------
1. POST /evaluate/async → returns job_id instantly
2. GET /evaluate/status/{job_id} → poll for progress
3. Frontend displays progress bar until completed
"""
import asyncio
import logging
import os
import tempfile
from typing import Any, Dict, Optional
from uuid import uuid4

import numpy as np
import pandas as pd
from supabase import Client

from app.core.supabase_client import SupabaseClient
from app.models.schemas import ModelType, ModelFramework
from app.services.smcp_engine import smcp_engine
from app.services.meta_evaluator import MetaEvaluator
from app.services.explainability import explainability_engine
from app.services.fairness import run_fairness_analysis
from app.services.evaluation_cache import build_pair_cache_id, is_cache_fresh
from app.core.config import settings

logger = logging.getLogger(__name__)


class EvaluationJobService:
    """Service for managing async evaluation jobs."""
    
    def __init__(self):
        self._running_jobs: Dict[str, bool] = {}
    
    def get_supabase(self) -> Client:
        """Get a fresh Supabase admin client for background tasks."""
        return SupabaseClient.get_admin_client()
    
    def create_job(
        self,
        user_id: str,
        model_id: str,
        dataset_id: str,
        sensitive_attribute: Optional[str] = None
    ) -> str:
        """Create a new evaluation job record."""
        job_id = str(uuid4())
        db = self.get_supabase()
        
        db.table("evaluation_jobs").insert({
            "id": job_id,
            "user_id": user_id,
            "model_id": model_id,
            "dataset_id": dataset_id,
            "status": "pending",
            "progress": 0,
            "step": "Queued for evaluation"
        }).execute()
        
        logger.info(f"Created evaluation job {job_id} for model={model_id}, dataset={dataset_id}")
        return job_id
    
    def update_job(
        self,
        job_id: str,
        status: str,
        progress: int,
        step: str,
        result: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        """Update job progress in database."""
        db = self.get_supabase()
        
        update_data = {
            "status": status,
            "progress": progress,
            "step": step,
        }
        
        if result is not None:
            update_data["result"] = result
        if error is not None:
            update_data["error"] = error
        
        db.table("evaluation_jobs").update(update_data).eq("id", job_id).execute()
        logger.debug(f"Job {job_id}: {status} - {progress}% - {step}")
    
    def get_job_status(self, job_id: str, user_id: str) -> Optional[Dict]:
        """Get job status for a user."""
        db = self.get_supabase()
        
        result = db.table("evaluation_jobs") \
            .select("*") \
            .eq("id", job_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()
        
        return result.data if result.data else None
    
    async def run_pipeline(
        self,
        job_id: str,
        user_id: str,
        model_id: str,
        dataset_id: str,
        sensitive_attribute: Optional[str] = None,
        force_rerun: bool = False
    ):
        """
        Run the full evaluation pipeline with progress updates.
        This runs in the background and updates the job table.
        """
        db = self.get_supabase()
        
        try:
            # Mark job as running
            self.update_job(job_id, "running", 5, "Loading model metadata")
            
            # ----- Step 1: Load model metadata -----
            model_result = db.table("models") \
                .select("*") \
                .eq("id", model_id) \
                .eq("user_id", user_id) \
                .single() \
                .execute()
            
            if not model_result.data:
                raise ValueError("Model not found")
            
            model = model_result.data
            self.update_job(job_id, "running", 10, f"Model loaded: {model.get('name', 'Unknown')}")
            
            # ----- Step 2: Load dataset metadata -----
            dataset_result = db.table("datasets") \
                .select("*") \
                .eq("id", dataset_id) \
                .eq("user_id", user_id) \
                .single() \
                .execute()
            
            if not dataset_result.data:
                raise ValueError("Dataset not found")
            
            dataset = dataset_result.data
            self.update_job(job_id, "running", 15, f"Dataset loaded: {dataset.get('name', 'Unknown')}")

            pair_cache_id = build_pair_cache_id(model, dataset)

            # Fast-path cache hit for identical model+dataset artifacts
            if not force_rerun:
                existing_eval = db.table("evaluations") \
                    .select("*") \
                    .eq("model_id", model_id) \
                    .eq("dataset_id", dataset_id) \
                    .eq("user_id", user_id) \
                    .execute()

                if existing_eval.data:
                    cached = existing_eval.data[0]
                    if is_cache_fresh(cached, model, dataset, pair_cache_id):
                        cached_result = dict(cached)
                        cached_result["cache_hit"] = True
                        cached_result["cache_message"] = "Returning cached evaluation for identical model+dataset artifacts"
                        cached_result["cached"] = True
                        cached_result["pair_cache_id"] = pair_cache_id
                        self.update_job(
                            job_id,
                            "completed",
                            100,
                            "Evaluation complete (cached)",
                            result=cached_result,
                        )
                        logger.info(
                            "Job %s served from cache for model=%s, dataset=%s",
                            job_id,
                            model_id,
                            dataset_id,
                        )
                        return
            
            # ----- Step 3: Download files -----
            self.update_job(job_id, "running", 20, "Downloading model and dataset files")
            
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download model
                model_data = db.storage.from_(settings.STORAGE_BUCKET_MODELS) \
                    .download(model["file_path"])
                model_path = os.path.join(temp_dir, "model")
                with open(model_path, "wb") as f:
                    f.write(model_data)
                
                # Download dataset
                dataset_data = db.storage.from_(settings.STORAGE_BUCKET_DATASETS) \
                    .download(dataset["file_path"])
                dataset_path = os.path.join(temp_dir, "dataset.csv")
                with open(dataset_path, "wb") as f:
                    f.write(dataset_data)
                
                self.update_job(job_id, "running", 25, "Files downloaded")
                
                # ----- Step 4: Run SMCP evaluation -----
                self.update_job(job_id, "running", 30, "Computing evaluation metrics (SMCP)")
                
                model_type = ModelType(model["model_type"])
                framework = ModelFramework(model["framework"])
                
                metrics, eval_score = smcp_engine.evaluate_model(
                    model_path=model_path,
                    dataset_path=dataset_path,
                    model_type=model_type,
                    framework=framework
                )
                
                self.update_job(job_id, "running", 45, "SMCP metrics computed")
                
                # ----- Step 5: Prepare data for meta evaluator -----
                self.update_job(job_id, "running", 48, "Preparing data analysis")
                
                df = pd.read_csv(dataset_path)
                
                # Row-cap sampling for large datasets
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
                
                # Load model object
                model_obj = self._load_model_object(model_path)
                # Wrap in DataFrame to preserve feature names and suppress sklearn warnings
                X_test_df = pd.DataFrame(X_test, columns=feature_names)
                y_pred = np.asarray(model_obj.predict(X_test_df))
                
                self.update_job(job_id, "running", 52, "Data prepared")
                
                # ----- Step 6: Calculate dataset statistics -----
                self.update_job(job_id, "running", 55, "Computing dataset health metrics")
                
                dataset_stats = self._compute_dataset_stats(df, feature_names, target_col, model_type)
                
                # ----- Step 7: Fairness analysis -----
                self.update_job(job_id, "running", 60, "Running fairness analysis")
                
                fairness_result = self._run_fairness(
                    df, split_idx, target_col, y_test, y_pred,
                    sensitive_attribute, dataset, model_type
                )
                
                self.update_job(job_id, "running", 70, "Fairness analysis complete")
                
                # ----- Step 8: Compute train metrics for robustness -----
                self.update_job(job_id, "running", 72, "Computing robustness metrics")
                
                train_metrics = self._compute_train_metrics(model_obj, X_train, y_train, model_type, feature_names)
                
                # ----- Step 9: Run Meta Evaluator (both modes) -----
                self.update_job(job_id, "running", 75, "Computing trust framework (Balanced mode)")
                
                eval_args = dict(
                    metrics=metrics.model_dump(exclude_none=True),
                    dataset_stats=dataset_stats,
                    model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                    train_metrics=train_metrics,
                    fairness_result=fairness_result
                )
                
                balanced_evaluator = MetaEvaluator(trust_mode="balanced")
                meta_result = balanced_evaluator.evaluate(**eval_args)
                
                self.update_job(job_id, "running", 80, "Computing trust framework (Strict mode)")
                
                strict_evaluator = MetaEvaluator(trust_mode="strict")
                strict_result = strict_evaluator.evaluate(**eval_args)
                
                self.update_job(job_id, "running", 85, "Trust framework complete")
                
                # ----- Step 10: Explainability -----
                self.update_job(job_id, "running", 87, "Computing SHAP values")
                
                explainability_result = self._run_explainability(
                    model_obj, X_train, X_test, feature_names, model_type
                )
                
                self.update_job(job_id, "running", 93, "Explainability complete")
                
                # ----- Step 11: Save to evaluations table -----
                self.update_job(job_id, "running", 95, "Saving results")
                
                eval_data = self._build_eval_data(
                    model_id, dataset_id, user_id,
                    metrics, eval_score, meta_result, strict_result,
                    explainability_result, fairness_result,
                    pair_cache_id,
                    dataset.get("file_hash")
                )
                
                # Check if evaluation exists, update or insert
                existing = db.table("evaluations") \
                    .select("id") \
                    .eq("model_id", model_id) \
                    .eq("dataset_id", dataset_id) \
                    .execute()
                
                if existing.data:
                    result = db.table("evaluations") \
                        .update(eval_data) \
                        .eq("id", existing.data[0]["id"]) \
                        .execute()
                else:
                    result = db.table("evaluations") \
                        .insert(eval_data) \
                        .execute()
                
                # Update model evaluation status
                db.table("models").update({"is_evaluated": True}).eq("id", model_id).execute()
                
                # ----- Step 12: Complete! -----
                evaluation = result.data[0]
                final_result = self._build_final_result(
                    evaluation, metrics, eval_score, meta_result, strict_result,
                    explainability_result, fairness_result
                )
                
                self.update_job(job_id, "completed", 100, "Evaluation complete", result=final_result)
                logger.info(f"Job {job_id} completed successfully. Trust Score: {meta_result['trust_score']:.2f}")
                
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)
            self.update_job(job_id, "failed", 0, "Evaluation failed", error=str(e))
            raise
    
    def _load_model_object(self, model_path: str):
        """Load model from file using joblib or pickle."""
        try:
            import joblib
            return joblib.load(model_path)
        except Exception:
            import pickle
            with open(model_path, 'rb') as f:
                return pickle.load(f)
    
    def _compute_dataset_stats(
        self, df: pd.DataFrame, feature_names: list,
        target_col: str, model_type: ModelType
    ) -> Dict[str, Any]:
        """Compute dataset statistics for DII calculation."""
        stats = {
            'n_rows': len(df),
            'n_features': len(feature_names),
            'missing_values': df.isnull().sum().sum(),
            'low_variance_fraction': 0.0,
            'imbalance_ratio': 0.5,
            'duplicate_ratio': df.duplicated().sum() / max(len(df), 1),
            'skew_score': 0.0
        }
        
        numeric_cols = df[feature_names].select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            variances = df[numeric_cols].var()
            low_var_count = (variances < 0.01).sum()
            stats['low_variance_fraction'] = low_var_count / len(numeric_cols)
            skews = df[numeric_cols].skew().abs()
            stats['skew_score'] = min(1.0, skews.mean() / 3.0)
        
        if model_type == ModelType.CLASSIFICATION:
            value_counts = df[target_col].value_counts()
            if len(value_counts) > 0:
                stats['imbalance_ratio'] = value_counts.max() / len(df)
        
        return stats
    
    def _run_fairness(
        self, df: pd.DataFrame, split_idx: int, target_col: str,
        y_test: np.ndarray, y_pred: np.ndarray,
        sensitive_attribute: Optional[str], dataset: Dict, model_type: ModelType
    ) -> Optional[Dict]:
        """Run fairness analysis with auto-detection support."""
        try:
            sensitive_attr_col = None
            
            if sensitive_attribute and sensitive_attribute in df.columns:
                sensitive_attr_col = sensitive_attribute
            
            if not sensitive_attr_col:
                ds_meta = dataset.copy() if isinstance(dataset, dict) else {}
                if ds_meta.get('sensitive_attribute') and ds_meta.get('sensitive_attribute') in df.columns:
                    sensitive_attr_col = ds_meta.get('sensitive_attribute')
                else:
                    metadata = ds_meta.get('metadata') if isinstance(ds_meta.get('metadata'), dict) else {}
                    if metadata and metadata.get('sensitive_attribute') and metadata.get('sensitive_attribute') in df.columns:
                        sensitive_attr_col = metadata.get('sensitive_attribute')
            
            df_test = df.iloc[split_idx:].copy()
            model_type_str = "classification" if model_type == ModelType.CLASSIFICATION else "regression"
            
            fairness_full_result = run_fairness_analysis(
                df=df_test,
                y_true=np.asarray(y_test),
                y_pred=y_pred,
                sensitive_attribute=sensitive_attr_col,
                target_column=target_col,
                model_type=model_type_str
            )
            
            if fairness_full_result.get('analysis_successful'):
                analyses = fairness_full_result.get('analyses', [])
                if analyses:
                    fairness_result = analyses[0]
                    fairness_result['all_analyses'] = analyses
                    fairness_result['detected_attributes'] = fairness_full_result.get('detected_attributes', [])
                    return fairness_result
            
            return None
        except Exception as e:
            logger.warning(f"Fairness analysis failed: {e}")
            return None
    
    def _compute_train_metrics(
        self, model_obj, X_train: np.ndarray, y_train: np.ndarray, model_type: ModelType,
        feature_names: Optional[list] = None
    ) -> Optional[Dict]:
        """Compute training metrics for robustness analysis."""
        try:
            # Wrap in DataFrame if feature_names provided to suppress sklearn warnings
            if feature_names is not None:
                X_train_input = pd.DataFrame(X_train, columns=feature_names)
            else:
                X_train_input = X_train
            y_train_pred = np.asarray(model_obj.predict(X_train_input))
            
            if model_type == ModelType.CLASSIFICATION:
                from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
                return {
                    'accuracy': float(accuracy_score(y_train, y_train_pred)),
                    'f1_score': float(f1_score(y_train, y_train_pred, average='weighted', zero_division=0)),
                    'precision': float(precision_score(y_train, y_train_pred, average='weighted', zero_division=0)),
                    'recall': float(recall_score(y_train, y_train_pred, average='weighted', zero_division=0)),
                }
            else:
                from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
                return {
                    'mae': float(mean_absolute_error(y_train, y_train_pred)),
                    'mse': float(mean_squared_error(y_train, y_train_pred)),
                    'r2_score': float(r2_score(y_train, y_train_pred)),
                }
        except Exception as e:
            logger.warning(f"Could not compute train metrics: {e}")
            return None
    
    def _run_explainability(
        self, model_obj, X_train: np.ndarray, X_test: np.ndarray,
        feature_names: list, model_type: ModelType
    ) -> Optional[Dict]:
        """Run explainability analysis."""
        try:
            return explainability_engine.explain_model(
                model=model_obj,
                X_train=X_train,
                X_test=X_test,
                feature_names=feature_names,
                model_type="classification" if model_type == ModelType.CLASSIFICATION else "regression",
                max_samples=100
            )
        except Exception as e:
            logger.warning(f"Explainability analysis failed: {e}")
            return {"error": str(e), "method_used": None}
    
    def _build_eval_data(
        self, model_id: str, dataset_id: str, user_id: str,
        metrics, eval_score, meta_result: Dict, strict_result: Dict,
        explainability_result: Optional[Dict], fairness_result: Optional[Dict],
        pair_cache_id: str,
        dataset_file_hash: Optional[str] = None,
    ) -> Dict:
        """Build evaluation data for database storage."""
        return {
            "model_id": model_id,
            "dataset_id": dataset_id,
            "user_id": user_id,
            "metrics": metrics.model_dump(exclude_none=True),
            "eval_score": eval_score.eval_score,
            "normalized_metrics": eval_score.normalized_metrics,
            "weight_distribution": eval_score.weight_distribution,
            "meta_score": meta_result["meta_score"],
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
                "dataset_file_hash": dataset_file_hash,
                "cache_strategy": "artifact-pair",
            },
            "feature_importance": explainability_result.get("feature_importance") if explainability_result else None,
            "explainability_method": explainability_result.get("method_used") if explainability_result else None,
            "shap_summary": explainability_result.get("shap_summary") if explainability_result else None,
            "fairness_metrics": fairness_result.get("fairness_metrics") if fairness_result else None,
            "group_metrics": fairness_result.get("group_metrics") if fairness_result else None,
            "sensitive_attribute": fairness_result.get("sensitive_attribute") if fairness_result else None
        }
    
    def _build_final_result(
        self, evaluation: Dict, metrics, eval_score, meta_result: Dict, strict_result: Dict,
        explainability_result: Optional[Dict], fairness_result: Optional[Dict]
    ) -> Dict:
        """Build final result for job completion."""
        return {
            "id": evaluation["id"],
            "model_id": evaluation["model_id"],
            "dataset_id": evaluation["dataset_id"],
            "metrics": evaluation.get("metrics", {}),
            "eval_score": evaluation.get("eval_score"),
            "normalized_metrics": evaluation.get("normalized_metrics", {}),
            "weight_distribution": evaluation.get("weight_distribution", {}),
            "trust_score": evaluation.get("trust_score"),
            "trust_score_raw": evaluation.get("trust_score_raw"),
            "trust_mode": evaluation.get("trust_mode"),
            "meta_score": evaluation.get("meta_score"),
            "DII": evaluation.get("DII"),
            "dii_components": meta_result.get("dii_components"),
            "component_scores": evaluation.get("component_scores"),
            "risk_values": meta_result.get("risk_values"),
            "hybrid_weights": evaluation.get("hybrid_weights"),
            "beta_auto": meta_result.get("beta_auto"),
            "dataset_health_score": evaluation.get("dataset_health_score"),
            "lambda_value": meta_result.get("lambda_value"),
            "lambda_raw": meta_result.get("lambda_raw"),
            "lambda_cap": meta_result.get("lambda_cap"),
            "guard_threshold": meta_result.get("guard_threshold"),
            "guard_triggered": meta_result.get("non_compensatory_override"),
            "guard_failures": meta_result.get("non_compensatory_failures"),
            "global_penalty_applied": meta_result.get("global_penalty_applied"),
            "instability_penalty_value": meta_result.get("instability_penalty_value"),
            "meta_flags": evaluation.get("meta_flags"),
            "meta_recommendations": evaluation.get("meta_recommendations"),
            "meta_verdict": evaluation.get("meta_verdict"),
            "breakdown": meta_result.get("breakdown"),
            "strict_result": evaluation.get("strict_result"),
            "feature_importance": evaluation.get("feature_importance"),
            "explainability_method": evaluation.get("explainability_method"),
            "shap_summary": evaluation.get("shap_summary"),
            "fairness_metrics": evaluation.get("fairness_metrics"),
            "group_metrics": evaluation.get("group_metrics"),
            "sensitive_attribute": evaluation.get("sensitive_attribute"),
            "evaluated_at": evaluation.get("evaluated_at"),
            "cache_hit": False,
            "cached": False
        }


# Singleton instance
evaluation_job_service = EvaluationJobService()
