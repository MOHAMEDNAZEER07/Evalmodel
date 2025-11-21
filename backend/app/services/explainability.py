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
            # Limit samples for performance
            X_train_sample = X_train[:min(max_samples, len(X_train))]
            X_test_sample = X_test[:min(max_samples, len(X_test))]
            
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
            explainer = self._get_shap_explainer(model, X_train, model_type)
            
            if explainer is None:
                return None
            
            # Calculate SHAP values
            shap_values = explainer.shap_values(X_test)
            
            # Handle different SHAP value formats
            if isinstance(shap_values, list):
                # For classification with multiple classes, use first class or average
                if model_type == "classification":
                    shap_values_array = np.array(shap_values[0]) if len(shap_values) > 0 else np.array(shap_values)
                else:
                    shap_values_array = np.array(shap_values[0])
            else:
                shap_values_array = np.array(shap_values)
            
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
            if hasattr(explainer, 'expected_value'):
                ev = explainer.expected_value
                if isinstance(ev, (list, np.ndarray)):
                    base_value = float(ev[0]) if len(ev) > 0 else None
                elif isinstance(ev, (int, float, np.number)):
                    base_value = float(ev)
            
            shap_summary = {
                "mean_abs_shap": float(np.abs(shap_values_array).mean()),
                "max_shap": float(np.abs(shap_values_array).max()),
                "top_features": [item["feature"] for item in importance_list[:5]],
                "values_shape": list(shap_values_array.shape),
                "base_value": base_value
            }
            
            # Store SHAP values for first few samples (for waterfall charts)
            sample_explanations = []
            for i in range(min(5, len(X_test))):
                sample_explanations.append({
                    "sample_index": i,
                    "shap_values": [float(v) for v in shap_values_array[i]],
                    "feature_values": [float(v) for v in X_test[i]]
                })
            
            return {
                "feature_importance": importance_list,
                "shap_summary": shap_summary,
                "sample_explanations": sample_explanations,
                "explainer_type": type(explainer).__name__
            }
            
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return None
    
    def _get_shap_explainer(self, model: Any, X_train: np.ndarray, model_type: str):
        """Get appropriate SHAP explainer for the model."""
        try:
            # Try TreeExplainer first (fastest for tree-based models)
            try:
                return self.shap.TreeExplainer(model)
            except:
                pass
            
            # Try KernelExplainer (model-agnostic, slower)
            try:
                if model_type == "classification":
                    predict_fn = lambda x: model.predict_proba(x)
                else:
                    predict_fn = model.predict
                
                # Use subset of training data as background
                background = self.shap.sample(X_train, min(50, len(X_train)))
                return self.shap.KernelExplainer(predict_fn, background)
            except:
                pass
            
            # Try LinearExplainer (for linear models)
            try:
                return self.shap.LinearExplainer(model, X_train)
            except:
                pass
            
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
            if model_type == "classification":
                explainer = self.lime_tabular.LimeTabularExplainer(
                    X_train,
                    feature_names=feature_names,
                    mode='classification',
                    discretize_continuous=True
                )
                predict_fn = lambda x: model.predict_proba(x)
            else:
                explainer = self.lime_tabular.LimeTabularExplainer(
                    X_train,
                    feature_names=feature_names,
                    mode='regression'
                )
                predict_fn = model.predict
            
            # Explain first few samples
            lime_explanations = []
            feature_importance_sum = np.zeros(len(feature_names))
            
            for i in range(min(10, len(X_test))):
                exp = explainer.explain_instance(
                    X_test[i],
                    predict_fn,
                    num_features=len(feature_names)
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
            
            # Get prediction
            if model_type == "classification":
                prediction = model.predict(sample)[0]
                if hasattr(model, 'predict_proba'):
                    probabilities = model.predict_proba(sample)[0]
                else:
                    probabilities = None
            else:
                prediction = model.predict(sample)[0]
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
                    explainer = self._get_shap_explainer(model, X_train, model_type)
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
                    if model_type == "classification":
                        explainer = self.lime_tabular.LimeTabularExplainer(
                            X_train,
                            feature_names=feature_names,
                            mode='classification'
                        )
                        predict_fn = lambda x: model.predict_proba(x)
                    else:
                        explainer = self.lime_tabular.LimeTabularExplainer(
                            X_train,
                            feature_names=feature_names,
                            mode='regression'
                        )
                        predict_fn = model.predict
                    
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
