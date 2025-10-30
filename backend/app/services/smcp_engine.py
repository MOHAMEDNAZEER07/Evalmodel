"""
SMCP - Standardized Model Comparison Pipeline
Core evaluation engine for universal ML model evaluation
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, TYPE_CHECKING
import pickle
import torch
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_absolute_error, mean_squared_error, r2_score
)
from app.models.schemas import ModelType, ModelFramework, MetricsResult, EvalScoreResult
import logging

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
	# Helpful for type checkers / IDEs when onnxruntime is installed locally.
	# This will not execute at runtime and won't cause import errors in environments
	# where onnxruntime isn't installed.
	import onnxruntime as ort  # type: ignore

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
        try:
            if framework == ModelFramework.SKLEARN:
                # Try multiple pickle loading methods for maximum compatibility
                errors = []
                
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
                    logger.error(f"All pickle loading methods failed")
                    
                    # If all methods fail, provide detailed error
                    error_msg = "Failed to load pickle file. Attempts:\n" + "\n".join(f"  - {err}" for err in errors)
                    raise ValueError(
                        f"{error_msg}\n\n"
                        f"The model file may be:\n"
                        f"  1. Created with an incompatible Python version\n"
                        f"  2. Corrupted during upload\n"
                        f"  3. Not a valid scikit-learn pickle file\n\n"
                        f"Solution: Create a new model file with Python 3.11 and re-upload.\n"
                        f"You can use the 'create_test_model.py' script in the backend folder."
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
                    import importlib
                    ort = importlib.import_module("onnxruntime")
                except Exception as e:
                    logger.error("onnxruntime is not installed or could not be imported.")
                    raise ValueError(
                        "onnxruntime is required to load ONNX models. "
                        "Install it in your environment with: pip install onnxruntime"
                    ) from e
                return ort.InferenceSession(file_path)
            
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
        framework: ModelFramework
    ) -> MetricsResult:
        """Evaluate classification model"""
        try:
            # Get predictions based on framework
            if framework == ModelFramework.SKLEARN:
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
        framework: ModelFramework
    ) -> MetricsResult:
        """Evaluate regression model"""
        try:
            # Get predictions
            if framework == ModelFramework.SKLEARN:
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
        model_type: ModelType
    ) -> EvalScoreResult:
        """
        Calculate unified EvalScore (0-100) from metrics
        Normalizes and weights metrics based on model type
        """
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
                    # Lower is better - invert and cap
                    normalized = 1 / (1 + value) if value >= 0 else 0
                else:
                    # Higher is better - already 0-1 range typically
                    normalized = min(max(value, 0), 1)
                
                normalized_metrics[metric_name] = float(normalized)
                total_score += normalized * weight
        
        # Scale to 0-100
        eval_score = total_score * 100
        
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
            
            X = np.asarray(df.drop(columns=[target_column]).values, dtype=np.float64)
            y = np.asarray(df[target_column].values)
            
            # Evaluate based on model type
            if model_type == ModelType.CLASSIFICATION:
                metrics = self.evaluate_classification(model, X, y, framework)
            
            elif model_type == ModelType.REGRESSION:
                metrics = self.evaluate_regression(model, X, y, framework)
            
            elif model_type == ModelType.NLP:
                metrics = self.evaluate_nlp(model, df, framework)
            
            elif model_type == ModelType.COMPUTER_VISION:
                metrics = self.evaluate_cv(model, X, y, framework)
            
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            
            # Calculate EvalScore
            eval_score = self.calculate_eval_score(metrics, model_type)
            
            return metrics, eval_score
        
        except Exception as e:
            logger.error(f"Error in SMCP evaluation pipeline: {e}")
            raise

# Singleton instance
smcp_engine = SMCPEngine()
