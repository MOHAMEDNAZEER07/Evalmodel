"""
Fairness Analysis Service
Provides bias detection and fairness metrics for ML models
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score
import logging

logger = logging.getLogger(__name__)


class FairnessEngine:
    """
    Comprehensive fairness analysis engine for ML models.
    Computes various fairness metrics to detect bias across demographic groups.
    """
    
    def __init__(self):
        self.supported_metrics = [
            'demographic_parity',
            'equal_opportunity',
            'disparate_impact',
            'equalized_odds',
            'statistical_parity',
            'predictive_parity'
        ]
    
    def analyze_fairness(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        sensitive_attr: np.ndarray,
        model_type: str = 'classification'
    ) -> Dict[str, Any]:
        """
        Perform comprehensive fairness analysis.
        
        Args:
            y_true: Ground truth labels
            y_pred: Predicted labels
            sensitive_attr: Sensitive attribute values (e.g., gender, race)
            model_type: Type of model ('classification' or 'regression')
        
        Returns:
            Dictionary containing fairness metrics and group-level analysis
        """
        try:
            if model_type != 'classification':
                logger.warning("Fairness analysis is currently only supported for classification tasks")
                return self._empty_result()
            
            # Get unique groups
            unique_groups = np.unique(sensitive_attr)
            if len(unique_groups) < 2:
                logger.warning("Need at least 2 groups for fairness analysis")
                return self._empty_result()
            
            # Compute group-level metrics
            group_metrics = self._compute_group_metrics(y_true, y_pred, sensitive_attr, unique_groups)
            
            # Compute fairness metrics
            fairness_metrics = self._compute_fairness_metrics(y_true, y_pred, sensitive_attr, unique_groups)
            
            # Compute overall fairness score
            overall_score = self._compute_overall_fairness_score(fairness_metrics)
            fairness_metrics['overall_fairness_score'] = overall_score
            
            return {
                'fairness_metrics': fairness_metrics,
                'group_metrics': group_metrics,
                'sensitive_attribute': 'sensitive_feature',
                'num_groups': len(unique_groups),
                'analysis_successful': True
            }
            
        except Exception as e:
            logger.error(f"Error in fairness analysis: {str(e)}")
            return self._empty_result()
    
    def _compute_group_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        sensitive_attr: np.ndarray,
        unique_groups: np.ndarray
    ) -> List[Dict[str, Any]]:
        """Compute performance metrics for each demographic group."""
        group_metrics = []
        
        for group in unique_groups:
            # Get indices for this group
            group_mask = sensitive_attr == group
            y_true_group = y_true[group_mask]
            y_pred_group = y_pred[group_mask]
            
            if len(y_true_group) == 0:
                continue
            
            # Compute confusion matrix
            try:
                tn, fp, fn, tp = confusion_matrix(y_true_group, y_pred_group, labels=[0, 1]).ravel()
            except ValueError:
                # Handle case where only one class is present
                tn = fp = fn = tp = 0
                if len(np.unique(y_true_group)) == 1:
                    if y_true_group[0] == 0:
                        tn = np.sum(y_pred_group == 0)
                        fp = np.sum(y_pred_group == 1)
                    else:
                        tp = np.sum(y_pred_group == 1)
                        fn = np.sum(y_pred_group == 0)
            
            # Compute metrics
            accuracy = accuracy_score(y_true_group, y_pred_group)
            precision = precision_score(y_true_group, y_pred_group, zero_division=0)
            recall = recall_score(y_true_group, y_pred_group, zero_division=0)
            f1 = f1_score(y_true_group, y_pred_group, zero_division=0)
            
            # Compute rates
            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0  # True Positive Rate (Recall)
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Positive Rate
            ppr = (tp + fp) / len(y_pred_group) if len(y_pred_group) > 0 else 0  # Positive Prediction Rate
            
            group_metrics.append({
                'group': str(group),
                'sample_count': int(len(y_true_group)),
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'true_positive_rate': float(tpr),
                'false_positive_rate': float(fpr),
                'positive_prediction_rate': float(ppr),
                'true_positives': int(tp),
                'false_positives': int(fp),
                'true_negatives': int(tn),
                'false_negatives': int(fn)
            })
        
        return group_metrics
    
    def _compute_fairness_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        sensitive_attr: np.ndarray,
        unique_groups: np.ndarray
    ) -> Dict[str, float]:
        """Compute various fairness metrics."""
        
        # For simplicity, compare first two groups (can be extended)
        if len(unique_groups) < 2:
            return {}
        
        group_0 = unique_groups[0]
        group_1 = unique_groups[1]
        
        # Get predictions and labels for each group
        mask_0 = sensitive_attr == group_0
        mask_1 = sensitive_attr == group_1
        
        y_true_0, y_pred_0 = y_true[mask_0], y_pred[mask_0]
        y_true_1, y_pred_1 = y_true[mask_1], y_pred[mask_1]
        
        # Demographic Parity (Statistical Parity)
        ppr_0 = np.mean(y_pred_0) if len(y_pred_0) > 0 else 0
        ppr_1 = np.mean(y_pred_1) if len(y_pred_1) > 0 else 0
        demographic_parity_diff = abs(ppr_0 - ppr_1)
        statistical_parity = 1 - demographic_parity_diff  # Convert to score (higher is better)
        
        # Disparate Impact Ratio
        disparate_impact = (ppr_1 / ppr_0) if ppr_0 > 0 else 1.0
        
        # Equal Opportunity (True Positive Rate equality)
        pos_mask_0 = y_true_0 == 1
        pos_mask_1 = y_true_1 == 1
        
        tpr_0 = np.mean(y_pred_0[pos_mask_0]) if np.sum(pos_mask_0) > 0 else 0
        tpr_1 = np.mean(y_pred_1[pos_mask_1]) if np.sum(pos_mask_1) > 0 else 0
        equal_opportunity_diff = abs(tpr_0 - tpr_1)
        
        # Equalized Odds (TPR and FPR equality)
        neg_mask_0 = y_true_0 == 0
        neg_mask_1 = y_true_1 == 0
        
        fpr_0 = np.mean(y_pred_0[neg_mask_0]) if np.sum(neg_mask_0) > 0 else 0
        fpr_1 = np.mean(y_pred_1[neg_mask_1]) if np.sum(neg_mask_1) > 0 else 0
        
        equalized_odds_diff = max(abs(tpr_0 - tpr_1), abs(fpr_0 - fpr_1))
        
        # Predictive Parity (Precision equality)
        precision_0 = precision_score(y_true_0, y_pred_0, zero_division=0)
        precision_1 = precision_score(y_true_1, y_pred_1, zero_division=0)
        predictive_parity = 1 - abs(precision_0 - precision_1)
        
        return {
            'demographic_parity_difference': float(demographic_parity_diff),
            'equal_opportunity_difference': float(equal_opportunity_diff),
            'disparate_impact_ratio': float(disparate_impact),
            'statistical_parity': float(statistical_parity),
            'predictive_parity': float(predictive_parity),
            'equalized_odds_difference': float(equalized_odds_diff)
        }
    
    def _compute_overall_fairness_score(self, fairness_metrics: Dict[str, float]) -> float:
        """
        Compute an overall fairness score (0-1, higher is better).
        Combines multiple fairness metrics into a single score.
        """
        if not fairness_metrics:
            return 0.0
        
        scores = []
        
        # For difference metrics (lower is better), convert to scores
        if 'demographic_parity_difference' in fairness_metrics:
            scores.append(1 - min(fairness_metrics['demographic_parity_difference'], 1.0))
        
        if 'equal_opportunity_difference' in fairness_metrics:
            scores.append(1 - min(fairness_metrics['equal_opportunity_difference'], 1.0))
        
        if 'equalized_odds_difference' in fairness_metrics:
            scores.append(1 - min(fairness_metrics['equalized_odds_difference'], 1.0))
        
        # For ratio metrics, check if close to 1.0
        if 'disparate_impact_ratio' in fairness_metrics:
            ratio = fairness_metrics['disparate_impact_ratio']
            # Score is 1.0 when ratio is 1.0, decreases as it moves away
            ratio_score = 1 - min(abs(ratio - 1.0), 1.0)
            scores.append(ratio_score)
        
        # For direct scores (higher is better)
        if 'statistical_parity' in fairness_metrics:
            scores.append(fairness_metrics['statistical_parity'])
        
        if 'predictive_parity' in fairness_metrics:
            scores.append(fairness_metrics['predictive_parity'])
        
        # Return average of all scores
        return float(np.mean(scores)) if scores else 0.0
    
    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result structure when analysis fails."""
        return {
            'fairness_metrics': {},
            'group_metrics': [],
            'sensitive_attribute': None,
            'num_groups': 0,
            'analysis_successful': False
        }
    
    def get_fairness_recommendations(self, fairness_metrics: Dict[str, float]) -> List[str]:
        """Generate recommendations based on fairness metrics."""
        recommendations = []
        
        if not fairness_metrics:
            return ["Unable to generate recommendations without fairness metrics."]
        
        dpd = fairness_metrics.get('demographic_parity_difference', 0)
        if dpd > 0.2:
            recommendations.append(
                "High demographic parity difference detected. Consider rebalancing your training data "
                "or applying fairness constraints during model training."
            )
        
        eod = fairness_metrics.get('equal_opportunity_difference', 0)
        if eod > 0.2:
            recommendations.append(
                "Significant equal opportunity difference found. The model has different true positive "
                "rates across groups. Consider post-processing techniques to equalize opportunities."
            )
        
        di_ratio = fairness_metrics.get('disparate_impact_ratio', 1.0)
        if di_ratio < 0.8 or di_ratio > 1.25:
            recommendations.append(
                "Disparate impact detected. The ratio of positive predictions differs significantly "
                "between groups. Review feature selection and consider bias mitigation techniques."
            )
        
        if not recommendations:
            recommendations.append(
                "Your model shows good fairness characteristics. Continue monitoring fairness "
                "metrics as you retrain or update the model."
            )
        
        return recommendations


# Global instance
fairness_engine = FairnessEngine()
