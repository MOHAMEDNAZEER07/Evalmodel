"""
SMCP - Standardized Model Comparison Pipeline
==============================================
Core evaluation engine for universal ML model evaluation.

This module provides framework-agnostic model evaluation capabilities,
computing standardized metrics that feed into the Hybrid Trust Framework.

Supported Frameworks:
---------------------
- scikit-learn (.pkl, .joblib)
- PyTorch (.pt, .pth)  
- Keras/TensorFlow (.h5)
- ONNX (.onnx) - Recommended for production

EvalScore Calculation:
----------------------
EvalScore = 100 × Σ(weight_i × normalized_metric_i)

Classification weights: accuracy=0.25, precision=0.25, recall=0.25, f1=0.25
Regression weights: R²=0.40, MAE=0.30, RMSE=0.30

Normalization:
- Benefit metrics (accuracy, R²): clip to [0, 1]
- Cost metrics (MSE, MAE): transform via 1/(1+value)

Mathematical Guarantees:
------------------------
- EvalScore ∈ [0, 100]
- All normalized metrics ∈ [0, 1]
- Weights sum to 1.0

References:
-----------
- See documentation/FORMULAS_AND_METHODOLOGIES.md for complete specification
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, TYPE_CHECKING, List
import pickle
import joblib
import json
import os
from pathlib import Path
import torch
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_absolute_error, mean_squared_error, r2_score
)
from app.models.schemas import ModelType, ModelFramework, MetricsResult, EvalScoreResult
import logging

logger = logging.getLogger(__name__)


def _get_allowed_model_formats() -> set[str]:
    """Return allowed model file formats from env (default: onnx)."""
    raw_value = os.getenv("ALLOWED_MODEL_FORMATS", "onnx")
    return {
        item.strip().lower().lstrip(".")
        for item in raw_value.split(",")
        if item.strip()
    }


def _enforce_allowed_model_format(file_path: str) -> None:
    """Fail closed for model files not in ALLOWED_MODEL_FORMATS."""
    extension = Path(file_path).suffix.lower().lstrip(".")
    allowed_formats = _get_allowed_model_formats()

    if extension not in allowed_formats:
        raise ValueError(
            f"Model format '.{extension or 'unknown'}' is blocked. "
            f"Allowed formats: {', '.join(sorted(allowed_formats)) or 'none'}"
        )

# Numerical stability constant
EPSILON = 1e-12

if TYPE_CHECKING:
	# Helpful for type checkers / IDEs when onnxruntime is installed locally.
	# This will not execute at runtime and won't cause import errors in environments
	# where onnxruntime isn't installed.
	import onnxruntime as ort  # type: ignore


class ONNXModelWrapper:
    """
    Wrapper for ONNX models to provide sklearn-like predict() interface.
    
    ONNX models are framework-agnostic and version-independent, making them
    ideal for long-term model storage and cross-platform deployment.
    
    Benefits over pickle/joblib:
    - Works across Python versions
    - Works without scikit-learn installed
    - Fast, optimized inference via onnxruntime
    - Stable long-term storage
    """
    
    def __init__(self, session, feature_order: Optional[List[str]] = None):
        """
        Initialize ONNX model wrapper.
        
        Args:
            session: onnxruntime.InferenceSession
            feature_order: Optional list of feature names in correct order
        """
        self.session = session
        self.feature_order = feature_order
        self.input_name = session.get_inputs()[0].name
        self.output_names = [o.name for o in session.get_outputs()]
        
        # Log model info
        logger.info(f"ONNX model loaded - Input: {self.input_name}, Outputs: {self.output_names}")
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Make predictions using the ONNX model.
        
        Args:
            X: Input features as numpy array (must be float32)
            
        Returns:
            Predictions as numpy array
        """
        # Ensure correct dtype (ONNX requires float32)
        X = np.asarray(X, dtype=np.float32)
        
        # Run inference
        outputs = self.session.run(None, {self.input_name: X})
        
        # First output is typically the prediction (label for classifiers)
        return np.array(outputs[0]).ravel()
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Get prediction probabilities for classification models.
        
        Args:
            X: Input features as numpy array
            
        Returns:
            Probability array of shape (n_samples, n_classes)
        """
        X = np.asarray(X, dtype=np.float32)
        outputs = self.session.run(None, {self.input_name: X})
        
        # Second output is typically probabilities for sklearn classifiers
        if len(outputs) > 1:
            proba = outputs[1]
            # Handle ZipMap output format (list of dicts)
            if isinstance(proba, list) and len(proba) > 0 and isinstance(proba[0], dict):
                # Convert list of dicts to numpy array
                classes = sorted(proba[0].keys())
                proba = np.array([[p[c] for c in classes] for p in proba])
            return np.array(proba)
        
        # Fallback: return predictions as one-hot if no proba output
        preds = outputs[0]
        return np.array(preds)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get ONNX model metadata."""
        return {
            "input_name": self.input_name,
            "output_names": self.output_names,
            "input_shape": self.session.get_inputs()[0].shape,
            "feature_order": self.feature_order
        }


class SMCPEngine:
    """Standardized Model Comparison Pipeline Engine"""
    
    # Metric weights for EvalScore calculation (0-1)
    METRIC_WEIGHTS = {
        ModelType.CLASSIFICATION: {
            "accuracy": 0.25,
            "precision": 0.25,
            "recall": 0.25,
            "f1_score": 0.25
        },
        ModelType.REGRESSION: {
            "r2_score": 0.4,
            "mae": 0.3,  # Inverted (lower is better)
            "rmse": 0.3   # Inverted (lower is better)
        },
        ModelType.NLP: {
            "bleu_score": 0.4,
            "rouge_score": 0.4,
            "perplexity": 0.2  # Inverted (lower is better)
        },
        ModelType.COMPUTER_VISION: {
            "accuracy": 0.3,
            "iou": 0.35,
            "dice_coefficient": 0.35
        }
    }
    
    def __init__(self):
        self.supported_extensions = {
            ".pkl": ModelFramework.SKLEARN,
            ".joblib": ModelFramework.SKLEARN,
            ".pt": ModelFramework.PYTORCH,
            ".pth": ModelFramework.PYTORCH,
            ".h5": ModelFramework.KERAS,
            ".onnx": ModelFramework.ONNX
        }
    
    def detect_model_framework(self, file_path: str) -> Optional[ModelFramework]:
        """Detect model framework from file extension"""
        import os
        ext = os.path.splitext(file_path)[1].lower()
        return self.supported_extensions.get(ext)
    
    def load_model(self, file_path: str, framework: ModelFramework):
        """Load model based on framework with multiple fallback methods"""
        import os
        _enforce_allowed_model_format(file_path)

        try:
            if framework == ModelFramework.SKLEARN:
                # Try multiple loading methods for maximum compatibility
                errors = []
                ext = os.path.splitext(file_path)[1].lower()
                
                # Method 0: Joblib (preferred for sklearn, better compression & slightly better compatibility)
                try:
                    return joblib.load(file_path)
                except Exception as e0:
                    errors.append(f"Joblib: {str(e0)}")
                    logger.warning(f"Joblib load failed: {e0}, trying standard pickle")
                
                # Method 1: Standard pickle
                try:
                    with open(file_path, 'rb') as f:
                        return pickle.load(f)
                except Exception as e1:
                    errors.append(f"Standard pickle: {str(e1)}")
                    logger.warning(f"Standard pickle load failed: {e1}, trying with encoding='latin1'")
                
                # Method 2: Latin1 encoding (Python 2 → 3)
                try:
                    with open(file_path, 'rb') as f:
                        return pickle.load(f, encoding='latin1')
                except Exception as e2:
                    errors.append(f"Latin1 encoding: {str(e2)}")
                    logger.warning(f"Latin1 encoding failed: {e2}, trying with encoding='bytes'")
                
                # Method 3: Bytes encoding
                try:
                    with open(file_path, 'rb') as f:
                        return pickle.load(f, encoding='bytes')
                except Exception as e3:
                    errors.append(f"Bytes encoding: {str(e3)}")
                    logger.warning(f"Bytes encoding failed: {e3}, trying fix_imports=True")
                
                # Method 4: With fix_imports (handles Python 2 → 3 module renames)
                try:
                    with open(file_path, 'rb') as f:
                        return pickle.load(f, fix_imports=True, encoding='latin1')
                except Exception as e4:
                    errors.append(f"Fix imports: {str(e4)}")
                    logger.error(f"All loading methods failed")
                    
                    # If all methods fail, provide detailed error
                    error_msg = "Failed to load model file. Attempts:\n" + "\n".join(f"  - {err}" for err in errors)
                    raise ValueError(
                        f"{error_msg}\n\n"
                        f"The model file may be:\n"
                        f"  1. Created with an incompatible Python version\n"
                        f"  2. Corrupted during upload\n"
                        f"  3. Not a valid scikit-learn model file\n\n"
                        f"Solutions:\n"
                        f"  - Save with joblib: joblib.dump(model, 'model.joblib')\n"
                        f"  - Use ONNX format for best cross-version compatibility\n"
                        f"  - Ensure same Python & scikit-learn versions as the backend"
                    )
            
            elif framework == ModelFramework.PYTORCH:
                return torch.load(file_path, map_location='cpu', weights_only=False)
            
            elif framework in [ModelFramework.KERAS, ModelFramework.TENSORFLOW]:
                try:
                    import keras
                    return keras.models.load_model(file_path)
                except ImportError:
                    # Fallback for older TensorFlow versions
                    import tensorflow as tf
                    return tf.keras.models.load_model(file_path)  # type: ignore
            
            elif framework == ModelFramework.ONNX:
                # Use dynamic import so static analyzers won't fail when onnxruntime
                # is not installed in the environment. Provide a clear error if missing.
                try:
                    import onnxruntime as ort
                except ImportError as e:
                    logger.error("onnxruntime is not installed or could not be imported.")
                    raise ValueError(
                        "onnxruntime is required to load ONNX models. "
                        "Install it in your environment with: pip install onnxruntime"
                    ) from e
                
                # Create inference session with optimizations
                sess_options = ort.SessionOptions()
                sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                
                session = ort.InferenceSession(file_path, sess_options)
                
                # Return a wrapper that provides predict() interface for compatibility
                return ONNXModelWrapper(session)
            
            else:
                raise ValueError(f"Unsupported framework: {framework}")
        
        except Exception as e:
            if isinstance(e, ValueError):
                raise  # Re-raise ValueError with our custom message
            logger.error(f"Error loading model from {file_path}: {e}")
            raise ValueError(f"Failed to load model: {str(e)}")
    
    def load_dataset(self, file_path: str) -> pd.DataFrame:
        """Load dataset from CSV"""
        try:
            return pd.read_csv(file_path)
        except Exception as e:
            logger.error(f"Error loading dataset from {file_path}: {e}")
            raise
    
    def evaluate_classification(
        self,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray,
        framework: ModelFramework,
        feature_names: Optional[List[str]] = None
    ) -> MetricsResult:
        """Evaluate classification model"""
        try:
            # Get predictions based on framework
            if framework == ModelFramework.SKLEARN:
                # Wrap in DataFrame to preserve feature names and suppress sklearn warnings
                if feature_names is not None:
                    X_input = pd.DataFrame(X_test, columns=feature_names)
                else:
                    X_input = X_test
                y_pred = model.predict(X_input)
            
            elif framework == ModelFramework.ONNX:
                # ONNX models use the wrapper with predict() interface
                # Ensure float32 dtype for ONNX
                X_test = np.asarray(X_test, dtype=np.float32)
                y_pred = model.predict(X_test)
            
            elif framework == ModelFramework.PYTORCH:
                model.eval()
                with torch.no_grad():
                    X_tensor = torch.FloatTensor(X_test)
                    outputs = model(X_tensor)
                    y_pred = torch.argmax(outputs, dim=1).numpy()
            
            elif framework in [ModelFramework.KERAS, ModelFramework.TENSORFLOW]:
                predictions = model.predict(X_test)
                y_pred = np.argmax(predictions, axis=1)
            
            else:
                raise ValueError(f"Framework {framework} not supported for classification")
            
            # Calculate metrics
            return MetricsResult(
                accuracy=float(accuracy_score(y_test, y_pred)),
                precision=float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
                recall=float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
                f1_score=float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
            )
        
        except Exception as e:
            logger.error(f"Error evaluating classification model: {e}")
            raise
    
    def evaluate_regression(
        self,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray,
        framework: ModelFramework,
        feature_names: Optional[List[str]] = None
    ) -> MetricsResult:
        """Evaluate regression model"""
        try:
            # Get predictions
            if framework == ModelFramework.SKLEARN:
                # Wrap in DataFrame to preserve feature names and suppress sklearn warnings
                if feature_names is not None:
                    X_input = pd.DataFrame(X_test, columns=feature_names)
                else:
                    X_input = X_test
                y_pred = model.predict(X_input)
            
            elif framework == ModelFramework.ONNX:
                # ONNX models use the wrapper with predict() interface
                X_test = np.asarray(X_test, dtype=np.float32)
                y_pred = model.predict(X_test)
            
            elif framework == ModelFramework.PYTORCH:
                model.eval()
                with torch.no_grad():
                    X_tensor = torch.FloatTensor(X_test)
                    y_pred = model(X_tensor).numpy()
            
            elif framework in [ModelFramework.KERAS, ModelFramework.TENSORFLOW]:
                y_pred = model.predict(X_test).flatten()
            
            else:
                raise ValueError(f"Framework {framework} not supported for regression")
            
            # Calculate metrics
            mae = float(mean_absolute_error(y_test, y_pred))
            mse = float(mean_squared_error(y_test, y_pred))
            
            return MetricsResult(
                mae=mae,
                mse=mse,
                rmse=float(np.sqrt(mse)),
                r2_score=float(r2_score(y_test, y_pred))
            )
        
        except Exception as e:
            logger.error(f"Error evaluating regression model: {e}")
            raise
    
    def evaluate_nlp(
        self,
        model,
        test_data: pd.DataFrame,
        framework: ModelFramework
    ) -> MetricsResult:
        """Evaluate NLP model (placeholder - requires specific implementation)"""
        # This is a simplified version - real NLP evaluation needs more context
        # about the specific task (translation, summarization, etc.)
        try:
            from sacrebleu import corpus_bleu
            from rouge_score import rouge_scorer
            
            # Placeholder: assumes test_data has 'predictions' and 'references' columns
            predictions = test_data['predictions'].tolist()
            references = [[ref] for ref in test_data['references'].tolist()]
            
            # BLEU score
            bleu = corpus_bleu(predictions, references)
            
            # ROUGE score
            scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
            rouge_scores = [scorer.score(ref[0], pred) for ref, pred in zip(references, predictions)]
            avg_rouge = {
                'rouge1': float(np.mean([s['rouge1'].fmeasure for s in rouge_scores])),
                'rouge2': float(np.mean([s['rouge2'].fmeasure for s in rouge_scores])),
                'rougeL': float(np.mean([s['rougeL'].fmeasure for s in rouge_scores]))
            }
            
            return MetricsResult(
                bleu_score=float(bleu.score),
                rouge_score=avg_rouge
            )
        
        except Exception as e:
            logger.error(f"Error evaluating NLP model: {e}")
            raise
    
    def evaluate_cv(
        self,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray,
        framework: ModelFramework
    ) -> MetricsResult:
        """Evaluate Computer Vision model"""
        try:
            # Get predictions
            if framework == ModelFramework.PYTORCH:
                model.eval()
                with torch.no_grad():
                    X_tensor = torch.FloatTensor(X_test)
                    outputs = model(X_tensor)
                    y_pred = torch.argmax(outputs, dim=1).numpy()
            
            elif framework in [ModelFramework.KERAS, ModelFramework.TENSORFLOW]:
                predictions = model.predict(X_test)
                y_pred = np.argmax(predictions, axis=1)
            
            else:
                raise ValueError(f"Framework {framework} not supported for CV")
            
            # Calculate CV-specific metrics
            accuracy = float(accuracy_score(y_test, y_pred))
            
            # IoU and Dice (for segmentation - simplified)
            intersection = np.sum(y_test == y_pred)
            union = len(y_test)
            iou = float(intersection / union) if union > 0 else 0.0
            
            dice = float(2 * intersection / (len(y_test) + len(y_pred))) if (len(y_test) + len(y_pred)) > 0 else 0.0
            
            return MetricsResult(
                pixel_accuracy=accuracy,
                iou=iou,
                dice_coefficient=dice
            )
        
        except Exception as e:
            logger.error(f"Error evaluating CV model: {e}")
            raise
    
    def calculate_eval_score(
        self,
        metrics: MetricsResult,
        model_type: ModelType,
        y_true: Optional[np.ndarray] = None,
        std_y: Optional[float] = None,
    ) -> EvalScoreResult:
        """
        Calculate unified EvalScore (0-100) from metrics.

        Formula:
            EvalScore = 100 × Σ(weight_i × normalized_metric_i)

        Normalization:
            - Benefit metrics (higher is better): clip to [0, 1]
            - Cost metrics (lower is better): 1/(1 + value/scale)
              where scale = std(y_true), falling back to range(y)/4 for
              near-constant targets, then to 1.0 as last resort.

        Args:
            metrics:    MetricsResult containing raw metric values
            model_type: Type of model for weight selection
            y_true:     Raw target array — used to derive the scale factor
                        for scale-invariant MAE/RMSE normalization.
            std_y:      Pre-computed std(y) — ignored when y_true is given.

        Returns:
            EvalScoreResult with eval_score in [0, 100]
        """
        # Derive scale factor from y_true when available (preferred)
        if y_true is not None and len(y_true) > 1:
            _std = float(np.std(y_true))
            if _std < 1e-10:
                _range = float(np.max(y_true) - np.min(y_true))
                std_y = _range / 4.0 if _range > 1e-10 else None
            else:
                std_y = _std
        weights = self.METRIC_WEIGHTS.get(model_type, {})
        normalized_metrics = {}
        total_score = 0.0
        
        metrics_dict = metrics.model_dump(exclude_none=True)
        
        for metric_name, weight in weights.items():
            if metric_name in metrics_dict:
                value = metrics_dict[metric_name]
                
                # Handle dict values (like rouge_score)
                if isinstance(value, dict):
                    value = np.mean(list(value.values()))
                
                # Normalize metric to 0-1 range
                if metric_name in ['mae', 'mse', 'rmse', 'perplexity']:
                    # Lower is better — scale-invariant: 1/(1 + value/scale)
                    # Guarantees output in (0, 1]: 1.0 when value=0, →0 as value→∞
                    if value >= 0:
                        divisor = std_y if std_y and std_y > 1e-10 else 1.0
                        # MSE is in squared units, so scale factor is std_y²
                        if metric_name == 'mse':
                            divisor = divisor ** 2
                        normalized = min(1.0, max(0.0, 1.0 / (1.0 + value / divisor)))
                    else:
                        normalized = 0.0
                else:
                    # Higher is better — clip to [0, 1]
                    normalized = min(1.0, max(0.0, float(value)))
                
                # Validate normalized value is in valid range
                if not (0.0 <= normalized <= 1.0):
                    raise ValueError(f"Normalized metric {metric_name} out of range [0,1]: {normalized}")
                
                normalized_metrics[metric_name] = float(normalized)
                total_score += normalized * weight
        
        # Scale to 0-100 and clip for safety
        eval_score = min(100.0, max(0.0, total_score * 100))
        
        # Validate eval_score is in valid range
        if not (0.0 <= eval_score <= 100.0):
            raise ValueError(f"EvalScore out of range [0,100]: {eval_score}")
        
        return EvalScoreResult(
            eval_score=float(round(eval_score, 2)),
            normalized_metrics=normalized_metrics,
            weight_distribution=weights
        )
    
    def evaluate_model(
        self,
        model_path: str,
        dataset_path: str,
        model_type: ModelType,
        framework: ModelFramework,
        target_column: str = "target"
    ) -> Tuple[MetricsResult, EvalScoreResult]:
        """
        Main evaluation method - orchestrates the full SMCP pipeline
        """
        try:
            # Load model
            model = self.load_model(model_path, framework)
            
            # Load dataset
            df = self.load_dataset(dataset_path)
            
            # Prepare data (basic split - assumes last column is target)
            if target_column not in df.columns:
                # Assume last column is target if not specified
                target_column = df.columns[-1]
            
            feature_names = [col for col in df.columns if col != target_column]
            X = np.asarray(df[feature_names].values, dtype=np.float64)
            y = np.asarray(df[target_column].values)
            
            # Evaluate based on model type
            if model_type == ModelType.CLASSIFICATION:
                metrics = self.evaluate_classification(model, X, y, framework, feature_names)
            
            elif model_type == ModelType.REGRESSION:
                metrics = self.evaluate_regression(model, X, y, framework, feature_names)
            
            elif model_type == ModelType.NLP:
                metrics = self.evaluate_nlp(model, df, framework)
            
            elif model_type == ModelType.COMPUTER_VISION:
                metrics = self.evaluate_cv(model, X, y, framework)
            
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            
            # Calculate EvalScore with scale-invariant normalization.
            # Pass y_true so calculate_eval_score can derive std(y) with the
            # range/4 fallback for near-constant targets.
            eval_score = self.calculate_eval_score(metrics, model_type, y_true=y)
            
            return metrics, eval_score
        
        except Exception as e:
            logger.error(f"Error in SMCP evaluation pipeline: {e}")
            raise

# Singleton instance
smcp_engine = SMCPEngine()
