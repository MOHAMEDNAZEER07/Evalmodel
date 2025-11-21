"""
Meta Evaluator - Unified model quality assessment engine
Combines metrics, dataset health, and complexity into a single Meta Score
"""
import logging
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


class MetaEvaluator:
    """
    Meta Evaluator that produces:
    - Meta Score (0-100)
    - Dataset Health Score
    - Model Complexity Adjustment
    - Detailed recommendations
    """
    
    # Weights for meta score calculation
    METRIC_WEIGHT = 0.65
    DATASET_WEIGHT = 0.25
    COMPLEXITY_WEIGHT = 0.10
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def evaluate(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        model_type: str,
        train_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main evaluation function
        
        Args:
            metrics: Raw evaluation metrics (accuracy, f1, mse, etc.)
            dataset_stats: Dataset statistics (rows, missing, imbalance, etc.)
            model_type: 'classification' or 'regression'
            train_metrics: Optional training metrics for overfitting check
        
        Returns:
            Dict with meta_score, health_score, recommendations, etc.
        """
        try:
            # Step 1: Calculate dataset health score
            dataset_health = self._calculate_dataset_health(dataset_stats)
            
            # Step 2: Normalize primary metric
            primary_metric_norm = self._normalize_primary_metric(metrics, model_type)
            
            # Step 3: Calculate model complexity adjustment
            complexity_adj = self._calculate_complexity_adjustment(
                metrics, train_metrics, model_type
            )
            
            # Step 4: Calculate final meta score
            meta_score = self._calculate_meta_score(
                primary_metric_norm,
                dataset_health,
                complexity_adj
            )
            
            # Step 5: Generate flags and recommendations
            flags = self._generate_flags(metrics, dataset_stats, train_metrics, model_type)
            recommendations = self._generate_recommendations(flags, metrics, dataset_stats)
            
            # Step 6: Final verdict
            verdict = self._generate_verdict(meta_score, flags)
            
            return {
                "meta_score": round(meta_score, 2),
                "dataset_health_score": round(dataset_health, 2),
                "primary_metric_normalized": round(primary_metric_norm, 2),
                "model_complexity_adjustment": round(complexity_adj, 2),
                "flags": flags,
                "recommendations": recommendations,
                "verdict": verdict,
                "breakdown": {
                    "metric_contribution": round(self.METRIC_WEIGHT * primary_metric_norm, 2),
                    "dataset_contribution": round(self.DATASET_WEIGHT * dataset_health, 2),
                    "complexity_contribution": round(self.COMPLEXITY_WEIGHT * (100 + complexity_adj), 2)
                }
            }
        except Exception as e:
            self.logger.error(f"Meta evaluation failed: {e}")
            raise
    
    def _calculate_dataset_health(self, stats: Dict[str, Any]) -> float:
        """
        Calculate dataset health score (0-100)
        
        Penalties for:
        - Missing values
        - Class imbalance
        - Small sample size
        - Low variance features
        """
        score = 100.0
        
        # Missing values penalty (up to -30 points)
        n_rows = stats.get('n_rows', 1)
        missing_values = stats.get('missing_values', 0)
        if n_rows > 0:
            missing_ratio = missing_values / (n_rows * stats.get('n_features', 1))
            score -= min(missing_ratio * 100, 30)
        
        # Class imbalance penalty (for classification)
        imbalance_ratio = stats.get('imbalance_ratio', 0.5)
        if imbalance_ratio > 0.6:
            score -= (imbalance_ratio - 0.5) * 80
        
        # Small sample penalty
        if n_rows < 100:
            score -= (1 - n_rows / 100) * 20
        
        # Low variance features penalty
        low_var_fraction = stats.get('low_variance_fraction', 0)
        score -= low_var_fraction * 10
        
        return max(0, min(100, score))
    
    def _normalize_primary_metric(self, metrics: Dict[str, Any], model_type: str) -> float:
        """
        Normalize primary metric to 0-100 scale
        
        For classification: Use F1 macro or balanced accuracy
        For regression: Use R² (clipped at 0)
        """
        if model_type == "classification":
            # Prefer F1 macro, fall back to accuracy
            if 'f1_score' in metrics:
                return metrics['f1_score'] * 100
            elif 'accuracy' in metrics:
                return metrics['accuracy'] * 100
            else:
                return 50.0  # Default
        
        elif model_type == "regression":
            # Use R² score, clipped at 0
            if 'r2_score' in metrics:
                r2 = metrics['r2_score']
                return max(0, r2) * 100
            elif 'mse' in metrics and 'mae' in metrics:
                # Heuristic: lower MSE/MAE is better
                mse = metrics.get('mse', 1.0)
                mae = metrics.get('mae', 1.0)
                # Normalize: assume good model has MSE < 0.1, MAE < 0.3
                mse_norm = max(0, (0.1 - mse) / 0.1 * 100)
                mae_norm = max(0, (0.3 - mae) / 0.3 * 100)
                return (mse_norm + mae_norm) / 2
            else:
                return 50.0
        
        return 50.0
    
    def _calculate_complexity_adjustment(
        self,
        test_metrics: Dict[str, Any],
        train_metrics: Optional[Dict[str, Any]],
        model_type: str
    ) -> float:
        """
        Calculate complexity adjustment (penalty for overfitting)
        
        Returns negative value if overfitting detected
        """
        if not train_metrics:
            return 0.0
        
        # Check train-test gap
        if model_type == "classification":
            train_metric = train_metrics.get('f1_score', train_metrics.get('accuracy', 0))
            test_metric = test_metrics.get('f1_score', test_metrics.get('accuracy', 0))
        else:
            train_metric = train_metrics.get('r2_score', 0)
            test_metric = test_metrics.get('r2_score', 0)
        
        gap = abs(train_metric - test_metric)
        
        # Penalize if gap > 0.1 (10%)
        if gap > 0.1:
            return -gap * 100 * 0.3  # Max -30 points
        
        return 0.0
    
    def _calculate_meta_score(
        self,
        primary_norm: float,
        dataset_health: float,
        complexity_adj: float
    ) -> float:
        """
        Calculate final meta score using weighted formula
        """
        score = (
            self.METRIC_WEIGHT * primary_norm +
            self.DATASET_WEIGHT * dataset_health +
            self.COMPLEXITY_WEIGHT * (100 + complexity_adj)
        )
        return max(0, min(100, score))
    
    def _generate_flags(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        train_metrics: Optional[Dict[str, Any]],
        model_type: str
    ) -> List[str]:
        """
        Generate warning flags based on analysis
        """
        flags = []
        
        # Dataset flags
        missing_ratio = dataset_stats.get('missing_values', 0) / max(1, dataset_stats.get('n_rows', 1))
        if missing_ratio > 0.05:
            flags.append("high_missing_values")
        
        imbalance = dataset_stats.get('imbalance_ratio', 0.5)
        if imbalance > 0.7:
            flags.append("severe_class_imbalance")
        elif imbalance > 0.6:
            flags.append("moderate_class_imbalance")
        
        if dataset_stats.get('n_rows', 0) < 100:
            flags.append("small_sample_size")
        
        low_var = dataset_stats.get('low_variance_fraction', 0)
        if low_var > 0.3:
            flags.append("many_low_variance_features")
        
        # Model performance flags
        if model_type == "classification":
            precision = metrics.get('precision', 0)
            recall = metrics.get('recall', 0)
            
            if abs(precision - recall) > 0.15:
                flags.append("precision_recall_imbalance")
            
            accuracy = metrics.get('accuracy', 0)
            if accuracy < 0.7:
                flags.append("low_accuracy")
        
        elif model_type == "regression":
            r2 = metrics.get('r2_score', 0)
            if r2 < 0.5:
                flags.append("low_r2_score")
            
            if r2 < 0:
                flags.append("negative_r2_warning")
        
        # Overfitting check
        if train_metrics:
            if model_type == "classification":
                train_perf = train_metrics.get('accuracy', 0)
                test_perf = metrics.get('accuracy', 0)
            else:
                train_perf = train_metrics.get('r2_score', 0)
                test_perf = metrics.get('r2_score', 0)
            
            gap = train_perf - test_perf
            if gap > 0.1:
                flags.append("overfitting_detected")
            elif gap > 0.05:
                flags.append("mild_overfitting")
        
        return flags
    
    def _generate_recommendations(
        self,
        flags: List[str],
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """
        Generate actionable recommendations based on flags
        """
        recommendations = []
        
        flag_recommendations = {
            "high_missing_values": {
                "action": "Handle missing values with imputation or removal",
                "why": "Missing values can bias model predictions",
                "priority": "high"
            },
            "severe_class_imbalance": {
                "action": "Apply SMOTE or class weighting",
                "why": "Severe imbalance leads to biased predictions",
                "priority": "high"
            },
            "moderate_class_imbalance": {
                "action": "Consider stratified sampling or cost-sensitive learning",
                "why": "Moderate imbalance may affect minority class performance",
                "priority": "medium"
            },
            "small_sample_size": {
                "action": "Collect more data or use data augmentation",
                "why": "Small datasets lead to unreliable models",
                "priority": "high"
            },
            "many_low_variance_features": {
                "action": "Remove or transform low-variance features",
                "why": "Low variance features don't contribute to predictions",
                "priority": "low"
            },
            "precision_recall_imbalance": {
                "action": "Adjust classification threshold or rebalance classes",
                "why": "Imbalanced precision/recall indicates bias",
                "priority": "medium"
            },
            "low_accuracy": {
                "action": "Try hyperparameter tuning or feature engineering",
                "why": "Low accuracy suggests model needs improvement",
                "priority": "high"
            },
            "low_r2_score": {
                "action": "Feature engineering or try different model architecture",
                "why": "Low R² indicates poor fit to data",
                "priority": "high"
            },
            "negative_r2_warning": {
                "action": "Review model and data - model performs worse than baseline",
                "why": "Negative R² means model is worse than predicting mean",
                "priority": "critical"
            },
            "overfitting_detected": {
                "action": "Apply regularization or increase training data",
                "why": "Large train-test gap indicates overfitting",
                "priority": "high"
            },
            "mild_overfitting": {
                "action": "Monitor train-test gap and consider validation",
                "why": "Slight overfitting may degrade generalization",
                "priority": "medium"
            }
        }
        
        for flag in flags:
            if flag in flag_recommendations:
                recommendations.append(flag_recommendations[flag])
        
        # Always add monitoring recommendation for production
        if len(flags) == 0:
            recommendations.append({
                "action": "Monitor model drift periodically",
                "why": "Even good models degrade over time",
                "priority": "low"
            })
        
        return recommendations
    
    def _generate_verdict(self, meta_score: float, flags: List[str]) -> Dict[str, Any]:
        """
        Generate final verdict based on meta score and flags
        """
        if meta_score >= 85:
            status = "production_ready"
            message = "✅ Model is production-ready with high confidence"
        elif meta_score >= 70:
            status = "production_ready_with_monitoring"
            message = "✅ Model is production-ready but requires monitoring"
        elif meta_score >= 50:
            status = "needs_improvement"
            message = "⚠️ Model needs improvements before production"
        else:
            status = "not_recommended"
            message = "❌ Model not recommended for production use"
        
        critical_flags = [f for f in flags if any(
            x in f for x in ['severe', 'critical', 'negative', 'low_accuracy']
        )]
        
        if critical_flags:
            status = "needs_improvement"
            message = "⚠️ Critical issues detected - address before deployment"
        
        return {
            "status": status,
            "message": message,
            "confidence": meta_score,
            "critical_issues": len(critical_flags),
            "total_issues": len(flags)
        }


# Singleton instance
meta_evaluator = MetaEvaluator()
