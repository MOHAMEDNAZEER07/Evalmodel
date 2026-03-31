"""
Explainability Service - SHAP and LIME Integration
Provides model interpretability through feature importance, prediction explanations, and visualizations.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ExplainabilityEngine:
    """
    Handles model explainability using SHAP (SHapley Additive exPlanations) and LIME (Local Interpretable Model-agnostic Explanations).
    
    Features:
    - Global feature importance (SHAP summary)
    - Local prediction explanations (SHAP/LIME for individual predictions)
    - Waterfall charts data
    - Force plot data
    - Decision plot data
    """

    # SHAP performance caps — prevent KernelExplainer from hanging on large datasets
    SHAP_BACKGROUND_SIZE = 50    # kmeans clusters for KernelExplainer background
    SHAP_EXPLAIN_SIZE    = 200   # max test samples to explain
    SHAP_KERNEL_NSAMPLES = 100   # KernelExplainer internal perturbations per sample
    
    def __init__(self):
        self.shap_available = False
        self.lime_available = False
        
        # Try importing SHAP
        try:
            import shap
            self.shap = shap
            self.shap_available = True
            logger.info("SHAP library loaded successfully")
        except ImportError:
            logger.warning("SHAP not available. Install with: pip install shap")
        
        # Try importing LIME
        try:
            import lime
            import lime.lime_tabular
            self.lime = lime
            self.lime_tabular = lime.lime_tabular
            self.lime_available = True
            logger.info("LIME library loaded successfully")
        except ImportError:
            logger.warning("LIME not available. Install with: pip install lime")
    
    def explain_model(
        self,
        model: Any,
        X_train: np.ndarray,
        X_test: np.ndarray,
        feature_names: List[str],
        model_type: str = "classification",
        max_samples: int = 100
    ) -> Dict[str, Any]:
        """
        Generate comprehensive model explanations.
        
        Args:
            model: Trained ML model
            X_train: Training features (for background data)
            X_test: Test features (for explanations)
            feature_names: Names of features
            model_type: "classification" or "regression"
            max_samples: Maximum samples to use for SHAP
            
        Returns:
            Dictionary with explanation results
        """
        results = {
            "feature_importance": None,
            "shap_summary": None,
            "lime_available": self.lime_available,
            "shap_available": self.shap_available,
            "method_used": None,
            "error": None
        }
        
        try:
            # Limit samples for performance — cap test set to 200 rows max
            # to prevent KernelExplainer timeouts on large datasets
            shap_max = min(max_samples, 200)
            X_train_sample = X_train[:min(max_samples, len(X_train))]
            X_test_sample = X_test[:min(shap_max, len(X_test))]
            
            # Try SHAP first (more comprehensive)
            if self.shap_available:
                shap_results = self._explain_with_shap(
                    model, X_train_sample, X_test_sample, feature_names, model_type
                )
                if shap_results:
                    results.update(shap_results)
                    results["method_used"] = "SHAP"
                    return results
            
            # Fallback to LIME if SHAP fails or unavailable
            if self.lime_available:
                lime_results = self._explain_with_lime(
                    model, X_train_sample, X_test_sample, feature_names, model_type
                )
                if lime_results:
                    results.update(lime_results)
                    results["method_used"] = "LIME"
                    return results
            
            # If both fail, use basic feature importance
            basic_importance = self._get_basic_feature_importance(model, feature_names)
            if basic_importance:
                results["feature_importance"] = basic_importance
                results["method_used"] = "basic"
                return results
            
            results["error"] = "No explainability method available"
            
        except Exception as e:
            logger.error(f"Error in explain_model: {e}")
            results["error"] = str(e)
        
        return results
    
    def _explain_with_shap(
        self,
        model: Any,
        X_train: np.ndarray,
        X_test: np.ndarray,
        feature_names: List[str],
        model_type: str
    ) -> Optional[Dict[str, Any]]:
        """Generate SHAP explanations."""
        try:
            # Choose appropriate explainer
            explainer = self._get_shap_explainer(model, X_train, feature_names, model_type)
            
            if explainer is None:
                return None
            
            explainer_type = type(explainer).__name__
            logger.debug(f"Using SHAP explainer: {explainer_type}")
            
            # Calculate SHAP values using appropriate API for each explainer type
            # SHAP 0.40+ uses callable explainer for TreeExplainer (returns Explanation object)
            # KernelExplainer still uses .shap_values() method
            if isinstance(explainer, self.shap.KernelExplainer):
                shap_values = explainer.shap_values(X_test, nsamples=self.SHAP_KERNEL_NSAMPLES)
            elif isinstance(explainer, self.shap.TreeExplainer):
                # Use new API: call explainer directly to get Explanation object
                try:
                    explanation = explainer(X_test, check_additivity=False)
                    shap_values = explanation  # Explanation object with .values attribute
                except Exception as e:
                    logger.debug(f"New TreeExplainer API failed: {e}, trying legacy shap_values()")
                    shap_values = explainer.shap_values(X_test)
            else:
                # LinearExplainer or other - try new API first, fallback to old
                try:
                    explanation = explainer(X_test)
                    shap_values = explanation
                except Exception:
                    shap_values = explainer.shap_values(X_test)
            
            # Debug logging to understand SHAP output format
            logger.debug(f"SHAP values type: {type(shap_values)}, hasattr values: {hasattr(shap_values, 'values')}")
            if isinstance(shap_values, list):
                logger.debug(f"SHAP values is list of length {len(shap_values)}, first element type: {type(shap_values[0]) if shap_values else 'N/A'}")
            elif hasattr(shap_values, 'shape'):
                logger.debug(f"SHAP values shape: {shap_values.shape}")
            
            # Handle different SHAP value formats (supports both old and new SHAP API)
            # New SHAP (0.40+) may return Explanation objects; old versions return arrays/lists
            try:
                if hasattr(shap_values, 'values'):
                    # New SHAP Explanation object
                    shap_values_array = np.asarray(shap_values.values)
                    # For multi-class, take first class or average
                    if len(shap_values_array.shape) == 3:
                        shap_values_array = shap_values_array[:, :, 0]  # First class
                elif isinstance(shap_values, list) and len(shap_values) > 0:
                    # Old API: list of arrays for each class
                    first_val = shap_values[0]
                    # Handle case where first element is also nested or scalar
                    if isinstance(first_val, np.ndarray):
                        shap_values_array = np.asarray(first_val)
                    else:
                        # Might be a single value or nested structure
                        shap_values_array = np.asarray(shap_values)
                        if shap_values_array.ndim == 0:
                            # 0-d array, expand to 2D
                            shap_values_array = shap_values_array.reshape(1, 1)
                else:
                    shap_values_array = np.asarray(shap_values)
                    
                # Handle 0-d arrays (scalars wrapped in numpy)
                if shap_values_array.ndim == 0:
                    shap_values_array = shap_values_array.reshape(1, 1)
            except (IndexError, TypeError) as e:
                logger.warning(f"Error parsing SHAP values format: {e}, trying fallback")
                # Fallback: try to convert whatever we have
                shap_values_array = np.atleast_2d(np.asarray(shap_values))
            
            # Ensure 2D array (samples x features)
            if len(shap_values_array.shape) == 1:
                shap_values_array = shap_values_array.reshape(1, -1)
            
            # Validate shape matches feature count
            if shap_values_array.shape[1] != len(feature_names):
                logger.warning(f"SHAP values shape {shap_values_array.shape} doesn't match feature count {len(feature_names)}")
                # Try to truncate or pad if close
                if shap_values_array.shape[1] > len(feature_names):
                    shap_values_array = shap_values_array[:, :len(feature_names)]
            
            # Calculate feature importance (mean absolute SHAP values)
            feature_importance = np.abs(shap_values_array).mean(axis=0)
            
            # Sort features by importance
            sorted_indices = np.argsort(feature_importance)[::-1]
            
            # Create feature importance list
            importance_list = [
                {
                    "feature": feature_names[i],
                    "importance": float(feature_importance[i]),
                    "rank": rank + 1
                }
                for rank, i in enumerate(sorted_indices)
            ]
            
            # Calculate SHAP summary statistics
            base_value = None
            # Try to get base_value from Explanation object first (new API)
            if hasattr(shap_values, 'base_values'):
                bv = shap_values.base_values
                try:
                    if isinstance(bv, np.ndarray):
                        if bv.ndim == 0:
                            base_value = float(bv)
                        elif bv.size > 0:
                            base_value = float(bv.flat[0])
                    elif isinstance(bv, (int, float, np.number)):
                        base_value = float(bv)
                except (IndexError, TypeError, ValueError) as e:
                    logger.debug(f"Could not extract base_value from Explanation.base_values: {e}")
            
            # Fallback: try explainer.expected_value (old API)
            if base_value is None and hasattr(explainer, 'expected_value'):
                ev = explainer.expected_value
                try:
                    if isinstance(ev, np.ndarray):
                        # Handle both 0-d and 1-d+ arrays
                        if ev.ndim == 0:
                            base_value = float(ev)
                        elif ev.size > 0:
                            base_value = float(ev.flat[0])
                    elif isinstance(ev, list) and len(ev) > 0:
                        base_value = float(ev[0])
                    elif isinstance(ev, (int, float, np.number)):
                        base_value = float(ev)
                except (IndexError, TypeError, ValueError) as e:
                    logger.debug(f"Could not extract base_value from expected_value: {e}")
            
            shap_summary = {
                "mean_abs_shap": float(np.abs(shap_values_array).mean()),
                "max_shap": float(np.abs(shap_values_array).max()),
                "top_features": [item["feature"] for item in importance_list[:5]],
                "values_shape": list(shap_values_array.shape),
                "base_value": base_value
            }
            
            # Store SHAP values for first few samples (for waterfall charts)
            sample_explanations = []
            n_samples = min(5, shap_values_array.shape[0], len(X_test))
            for i in range(n_samples):
                try:
                    sample_explanations.append({
                        "sample_index": i,
                        "shap_values": [float(v) for v in shap_values_array[i]],
                        "feature_values": [float(v) for v in X_test[i]]
                    })
                except (IndexError, ValueError) as e:
                    logger.debug(f"Could not extract sample explanation {i}: {e}")
                    break
            
            return {
                "feature_importance": importance_list,
                "shap_summary": shap_summary,
                "sample_explanations": sample_explanations,
                "explainer_type": type(explainer).__name__
            }
            
        except Exception as e:
            import traceback
            logger.error(f"SHAP explanation failed: {e}\n{traceback.format_exc()}")
            return None
    
    def _get_shap_explainer(self, model: Any, X_train: np.ndarray, feature_names: List[str], model_type: str):
        """Get appropriate SHAP explainer for the model.
        Fallback order: TreeExplainer → LinearExplainer → KernelExplainer (slowest).
        KernelExplainer always uses kmeans-compressed background + nsamples cap.
        """
        try:
            # Attempt 1: TreeExplainer (fastest — tree-based models)
            try:
                explainer = self.shap.TreeExplainer(model)
                # Smoke test with new API (SHAP 0.40+)
                _ = explainer(X_train[:1], check_additivity=False)
                logger.debug("TreeExplainer smoke test passed")
                return explainer
            except Exception as e:
                logger.debug(f"TreeExplainer failed: {e}")

            # Attempt 2: LinearExplainer (linear models — fast, before Kernel)
            try:
                background = self.shap.maskers.Independent(
                    X_train, max_samples=self.SHAP_BACKGROUND_SIZE
                )
                return self.shap.LinearExplainer(model, background)
            except Exception as e:
                logger.debug(f"LinearExplainer failed: {e}")

            # Attempt 3: KernelExplainer (universal, slowest)
            # CRITICAL: always compress background with kmeans to cap cost
            try:
                # Wrap input in DataFrame to preserve feature names and suppress sklearn warnings
                def _wrap_predict(x):
                    x_df = pd.DataFrame(x, columns=feature_names)
                    if model_type == "classification":
                        return model.predict_proba(x_df)
                    return model.predict(x_df)

                k = min(self.SHAP_BACKGROUND_SIZE, len(X_train))
                background = self.shap.kmeans(X_train, k)
                return self.shap.KernelExplainer(_wrap_predict, background)
            except Exception as e:
                logger.debug(f"KernelExplainer failed: {e}")

            return None

        except Exception as e:
            logger.error(f"Failed to create SHAP explainer: {e}")
            return None
    
    def _explain_with_lime(
        self,
        model: Any,
        X_train: np.ndarray,
        X_test: np.ndarray,
        feature_names: List[str],
        model_type: str
    ) -> Optional[Dict[str, Any]]:
        """Generate LIME explanations."""
        try:
            # Wrap input in DataFrame to preserve feature names and suppress sklearn warnings
            def _wrap_predict(x):
                x_df = pd.DataFrame(x, columns=feature_names)
                if model_type == "classification":
                    return model.predict_proba(x_df)
                return model.predict(x_df)

            if model_type == "classification":
                explainer = self.lime_tabular.LimeTabularExplainer(
                    X_train,
                    feature_names=feature_names,
                    mode='classification',
                    discretize_continuous=True,
                    random_state=42
                )
            else:
                explainer = self.lime_tabular.LimeTabularExplainer(
                    X_train,
                    feature_names=feature_names,
                    mode='regression',
                    random_state=42
                )
            predict_fn = _wrap_predict
            
            # Explain samples — use 50 for statistical stability (not 10)
            # Fixed random_state for reproducibility across runs
            n_lime_samples = min(50, len(X_test))
            rng = np.random.RandomState(42)
            sample_indices = rng.choice(len(X_test), size=n_lime_samples, replace=False) if len(X_test) > n_lime_samples else np.arange(len(X_test))
            
            lime_explanations = []
            feature_importance_sum = np.zeros(len(feature_names))
            
            for i in sample_indices:
                exp = explainer.explain_instance(
                    X_test[i],
                    predict_fn,
                    num_features=len(feature_names),
                    num_samples=1000
                )
                
                # Extract feature importance
                exp_list = exp.as_list()
                lime_explanations.append({
                    "sample_index": i,
                    "explanation": exp_list[:10],  # Top 10 features
                    "prediction": float(predict_fn(X_test[i:i+1])[0])
                })
                
                # Accumulate importance
                for feat_desc, importance in exp_list:
                    # Extract feature name from description
                    for j, fname in enumerate(feature_names):
                        if fname in feat_desc:
                            feature_importance_sum[j] += abs(importance)
            
            # Calculate average feature importance
            feature_importance = feature_importance_sum / len(lime_explanations)
            sorted_indices = np.argsort(feature_importance)[::-1]
            
            importance_list = [
                {
                    "feature": feature_names[i],
                    "importance": float(feature_importance[i]),
                    "rank": rank + 1
                }
                for rank, i in enumerate(sorted_indices)
            ]
            
            return {
                "feature_importance": importance_list,
                "lime_explanations": lime_explanations,
                "top_features": [item["feature"] for item in importance_list[:5]]
            }
            
        except Exception as e:
            logger.error(f"LIME explanation failed: {e}")
            return None
    
    def _get_basic_feature_importance(
        self,
        model: Any,
        feature_names: List[str]
    ) -> Optional[List[Dict[str, Any]]]:
        """Extract basic feature importance from model (if available)."""
        try:
            importance = None
            
            # Try different model attributes
            if hasattr(model, 'feature_importances_'):
                importance = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importance = np.abs(model.coef_).flatten()
            
            if importance is not None and len(importance) == len(feature_names):
                sorted_indices = np.argsort(importance)[::-1]
                return [
                    {
                        "feature": feature_names[i],
                        "importance": float(importance[i]),
                        "rank": rank + 1
                    }
                    for rank, i in enumerate(sorted_indices)
                ]
            
        except Exception as e:
            logger.error(f"Basic feature importance failed: {e}")
        
        return None
    
    def explain_prediction(
        self,
        model: Any,
        X_train: np.ndarray,
        sample: np.ndarray,
        feature_names: List[str],
        model_type: str = "classification"
    ) -> Dict[str, Any]:
        """
        Explain a single prediction.
        
        Args:
            model: Trained model
            X_train: Training data for background
            sample: Single sample to explain (1D array)
            feature_names: Feature names
            model_type: "classification" or "regression"
            
        Returns:
            Dictionary with prediction explanation
        """
        try:
            # Reshape sample if needed
            if len(sample.shape) == 1:
                sample = sample.reshape(1, -1)
            
            # Wrap sample in DataFrame to preserve feature names and suppress sklearn warnings
            sample_df = pd.DataFrame(sample, columns=feature_names)
            
            # Get prediction
            if model_type == "classification":
                prediction = model.predict(sample_df)[0]
                if hasattr(model, 'predict_proba'):
                    probabilities = model.predict_proba(sample_df)[0]
                else:
                    probabilities = None
            else:
                prediction = model.predict(sample_df)[0]
                probabilities = None
            
            result = {
                "prediction": float(prediction),
                "probabilities": [float(p) for p in probabilities] if probabilities is not None else None,
                "feature_contributions": [],
                "method": None
            }
            
            # Try SHAP explanation
            if self.shap_available:
                try:
                    explainer = self._get_shap_explainer(model, X_train, feature_names, model_type)
                    if explainer:
                        shap_values = explainer.shap_values(sample)
                        
                        # Check if shap_values is None
                        if shap_values is None:
                            raise ValueError("SHAP values could not be computed")
                        
                        if isinstance(shap_values, list):
                            shap_values = shap_values[0]
                        
                        # Additional check after list handling
                        if shap_values is None:
                            raise ValueError("SHAP values are None after list handling")
                        
                        contributions = [
                            {
                                "feature": feature_names[i],
                                "value": float(sample[0, i]),
                                "contribution": float(shap_values[0, i])
                            }
                            for i in range(len(feature_names))
                        ]
                        
                        # Sort by absolute contribution
                        contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
                        
                        result["feature_contributions"] = contributions
                        result["method"] = "SHAP"
                        
                        base_value = None
                        if hasattr(explainer, 'expected_value'):
                            ev = explainer.expected_value
                            if isinstance(ev, (list, np.ndarray)):
                                base_value = float(ev[0]) if len(ev) > 0 else None
                            elif isinstance(ev, (int, float, np.number)):
                                base_value = float(ev)
                        
                        result["base_value"] = base_value
                        return result
                except Exception as e:
                    logger.error(f"SHAP single prediction failed: {e}")
            
            # Fallback to LIME
            if self.lime_available:
                try:
                    # Wrap input in DataFrame to preserve feature names and suppress sklearn warnings
                    def _wrap_predict(x):
                        x_df = pd.DataFrame(x, columns=feature_names)
                        if model_type == "classification":
                            return model.predict_proba(x_df)
                        return model.predict(x_df)

                    if model_type == "classification":
                        explainer = self.lime_tabular.LimeTabularExplainer(
                            X_train,
                            feature_names=feature_names,
                            mode='classification',
                            random_state=42
                        )
                    else:
                        explainer = self.lime_tabular.LimeTabularExplainer(
                            X_train,
                            feature_names=feature_names,
                            mode='regression',
                            random_state=42
                        )
                    predict_fn = _wrap_predict
                    
                    exp = explainer.explain_instance(sample[0], predict_fn, num_features=len(feature_names))
                    
                    contributions = []
                    for feat_desc, importance in exp.as_list():
                        for i, fname in enumerate(feature_names):
                            if fname in feat_desc:
                                contributions.append({
                                    "feature": fname,
                                    "value": float(sample[0, i]),
                                    "contribution": float(importance)
                                })
                    
                    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
                    result["feature_contributions"] = contributions
                    result["method"] = "LIME"
                    return result
                    
                except Exception as e:
                    logger.error(f"LIME single prediction failed: {e}")
            
            result["error"] = "No explainability method available"
            return result
            
        except Exception as e:
            logger.error(f"Error explaining prediction: {e}")
            return {"error": str(e)}


# Global instance
explainability_engine = ExplainabilityEngine()
