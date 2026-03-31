"""
Fairness Analysis Service
=========================
Provides bias detection and fairness metrics for ML models.

Hybrid Trust Framework Integration:
-----------------------------------
This module computes the Fairness score (F) for the trust framework:
    F = 1 - DP

where DP (Demographic Parity difference) is:
    DP = max(PPR_across_groups) - min(PPR_across_groups)

Multi-Group Support:
--------------------
Unlike binary fairness metrics, this implementation supports ANY number of groups:
- 2 groups (binary: male/female)
- 3+ groups (multiclass: race, age_group, etc.)

The fairness metrics are computed as the worst-case gap across all groups.

Auto-Detection:
---------------
When no sensitive attribute is specified, the engine auto-detects potential
sensitive columns based on:
1. Column name keywords (gender, race, age, etc.)
2. Low cardinality categorical columns (2-10 unique values)
3. Numeric columns with few unique values (likely encoded groups)

Supported Fairness Metrics:
---------------------------
Classification:
- Demographic Parity (Statistical Parity)
- Equal Opportunity (TPR equality)
- Equalized Odds (TPR + FPR equality)
- Disparate Impact Ratio (80% rule)
- Predictive Parity (Precision equality)

Regression:
- Demographic Parity (prediction distribution)
- Error Parity (MAE consistency across groups)

References:
-----------
- See documentation/FORMULAS_AND_METHODOLOGIES.md for complete specification
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score
import logging

logger = logging.getLogger(__name__)

# Numerical stability constant
EPSILON = 1e-12

# Keywords for auto-detecting sensitive attributes
SENSITIVE_KEYWORDS = [
    "gender", "sex", "race", "ethnicity", "age", "age_group",
    "religion", "nationality", "disability", "marital", "income_group",
    "education", "country", "region", "native", "citizen", "minority",
    "protected", "demographic", "group"
]


def detect_sensitive_attributes(df: pd.DataFrame, exclude_cols: Optional[List[str]] = None) -> List[str]:
    """
    Auto-detect potential sensitive attributes from a dataset.
    
    Detection strategy:
    1. Column name matches sensitive keywords (e.g., "gender", "race")
    2. Low cardinality categorical columns (2-10 unique values)
    3. Numeric columns with very few unique values (likely encoded groups)
    
    Args:
        df: DataFrame to analyze
        exclude_cols: Columns to exclude from detection (e.g., target column)
    
    Returns:
        List of column names that are likely sensitive attributes
    """
    exclude_cols = set(exclude_cols or [])
    detected = []
    
    for col in df.columns:
        if col in exclude_cols:
            continue
            
        col_lower = col.lower()
        
        # Strategy 1: Check by column name
        if any(kw in col_lower for kw in SENSITIVE_KEYWORDS):
            detected.append(col)
            logger.info(f"Detected sensitive attribute by name: {col}")
            continue
        
        # Strategy 2: Low cardinality categorical
        if df[col].dtype == "object" or str(df[col].dtype) == "category":
            n_unique = df[col].nunique()
            if 2 <= n_unique <= 10:
                detected.append(col)
                logger.info(f"Detected sensitive attribute by cardinality (categorical, {n_unique} groups): {col}")
            continue
        
        # Strategy 3: Numeric with very few unique values (encoded groups)
        if pd.api.types.is_numeric_dtype(df[col]):
            n_unique = df[col].nunique()
            # Only flag as sensitive if it looks like an encoded category
            if 2 <= n_unique <= 5:
                detected.append(col)
                logger.info(f"Detected sensitive attribute by cardinality (numeric, {n_unique} groups): {col}")
    
    return detected


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
        model_type: str = 'classification',
        sensitive_attr_name: str = 'sensitive_feature'
    ) -> Dict[str, Any]:
        """
        Perform comprehensive fairness analysis.
        
        Args:
            y_true: Ground truth labels
            y_pred: Predicted labels
            sensitive_attr: Sensitive attribute values (e.g., gender, race)
            model_type: Type of model ('classification' or 'regression')
            sensitive_attr_name: Name of the sensitive attribute column
        
        Returns:
            Dictionary containing fairness metrics and group-level analysis
        """
        try:
            # Get unique groups
            unique_groups = np.unique(sensitive_attr)
            if len(unique_groups) < 2:
                logger.warning("Need at least 2 groups for fairness analysis")
                return self._empty_result()
            
            # Route to appropriate analysis method
            if model_type == 'regression':
                return self._analyze_regression_fairness(
                    y_true, y_pred, sensitive_attr, unique_groups, sensitive_attr_name
                )
            else:
                # Default to classification
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
                    'sensitive_attribute': sensitive_attr_name,
                    'num_groups': len(unique_groups),
                    'groups': [str(g) for g in unique_groups],
                    'model_type': model_type,
                    'analysis_successful': True
                }
            
        except Exception as e:
            logger.error(f"Error in fairness analysis: {str(e)}")
            return self._empty_result()
    
    def _analyze_regression_fairness(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        sensitive_attr: np.ndarray,
        unique_groups: np.ndarray,
        sensitive_attr_name: str
    ) -> Dict[str, Any]:
        """
        Analyze fairness for regression models.
        
        Metrics:
        - Demographic Parity: Difference in mean predictions across groups
        - Error Parity: Difference in MAE across groups
        """
        group_metrics = []
        group_stats = {}
        
        for group in unique_groups:
            mask = sensitive_attr == group
            y_true_g = y_true[mask]
            y_pred_g = y_pred[mask]
            
            if len(y_true_g) == 0:
                continue
            
            mean_pred = float(np.mean(y_pred_g))
            mean_true = float(np.mean(y_true_g))
            mae = float(np.mean(np.abs(y_true_g - y_pred_g)))
            rmse = float(np.sqrt(np.mean((y_true_g - y_pred_g) ** 2)))
            
            group_stats[group] = {
                'mean_pred': mean_pred,
                'mae': mae
            }
            
            group_metrics.append({
                'group': str(group),
                'sample_count': int(len(y_true_g)),
                'mean_prediction': mean_pred,
                'mean_actual': mean_true,
                'mae': mae,
                'rmse': rmse
            })
        
        # Compute worst-case gaps across all group pairs
        max_pred_gap = 0.0
        max_mae_gap = 0.0
        
        groups_list = list(group_stats.keys())
        for i, g1 in enumerate(groups_list):
            for g2 in groups_list[i+1:]:
                stats1 = group_stats[g1]
                stats2 = group_stats[g2]
                
                # Demographic Parity for regression: gap in mean predictions
                pred_gap = abs(stats1['mean_pred'] - stats2['mean_pred'])
                max_pred_gap = max(max_pred_gap, pred_gap)
                
                # Error Parity: gap in MAE
                mae_gap = abs(stats1['mae'] - stats2['mae'])
                max_mae_gap = max(max_mae_gap, mae_gap)
        
        # Normalize demographic parity by prediction range
        all_preds = np.concatenate([y_pred[sensitive_attr == g] for g in groups_list])
        pred_range = np.ptp(all_preds) if len(all_preds) > 0 else 1.0
        normalized_dp = min(1.0, max_pred_gap / max(pred_range, 1e-10))
        
        # Normalize error parity by mean MAE
        mean_mae = np.mean([group_stats[g]['mae'] for g in groups_list])
        normalized_error_parity = min(1.0, max_mae_gap / max(mean_mae, 1e-10))
        
        # Fairness score F = 1 - normalized_dp (analogous to classification)
        fairness_score_F = max(0.0, 1.0 - normalized_dp)
        
        fairness_metrics = {
            'demographic_parity_difference': float(normalized_dp),
            'fairness_score_F': float(fairness_score_F),
            'error_parity_difference': float(normalized_error_parity),
            'max_prediction_gap': float(max_pred_gap),
            'max_mae_gap': float(max_mae_gap),
            'overall_fairness_score': float((fairness_score_F + (1 - normalized_error_parity)) / 2),
            'num_groups_analyzed': len(group_stats)
        }
        
        return {
            'fairness_metrics': fairness_metrics,
            'group_metrics': group_metrics,
            'sensitive_attribute': sensitive_attr_name,
            'num_groups': len(unique_groups),
            'groups': [str(g) for g in unique_groups],
            'model_type': 'regression',
            'analysis_successful': True
        }
    
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
        """
        Compute various fairness metrics using multi-group approach.
        
        For multi-group fairness, we compute metrics for ALL group pairs and
        report the worst-case (maximum gap) across all pairs. This ensures
        fairness is measured across ALL demographic groups, not just two.
        """
        if len(unique_groups) < 2:
            return {}
        
        # Compute per-group statistics
        group_stats = {}
        for group in unique_groups:
            mask = sensitive_attr == group
            y_true_g = y_true[mask]
            y_pred_g = y_pred[mask]
            
            if len(y_pred_g) == 0:
                continue
            
            # Positive prediction rate (for demographic parity)
            ppr = np.mean(y_pred_g)
            
            # True positive rate (for equal opportunity)
            pos_mask = y_true_g == 1
            tpr = np.mean(y_pred_g[pos_mask]) if np.sum(pos_mask) > 0 else 0
            
            # False positive rate (for equalized odds)
            neg_mask = y_true_g == 0
            fpr = np.mean(y_pred_g[neg_mask]) if np.sum(neg_mask) > 0 else 0
            
            # Precision (for predictive parity)
            prec = precision_score(y_true_g, y_pred_g, zero_division=0)
            
            group_stats[group] = {
                'ppr': ppr,
                'tpr': tpr,
                'fpr': fpr,
                'precision': prec
            }
        
        if len(group_stats) < 2:
            return {}
        
        # Compute worst-case gaps across ALL group pairs
        max_dp_diff = 0.0
        max_eo_diff = 0.0
        max_eq_odds_diff = 0.0
        max_pp_diff = 0.0
        min_disparate_impact = 1.0
        
        groups_list = list(group_stats.keys())
        for i, g1 in enumerate(groups_list):
            for g2 in groups_list[i+1:]:
                stats1 = group_stats[g1]
                stats2 = group_stats[g2]
                
                # Demographic Parity difference
                dp_diff = abs(stats1['ppr'] - stats2['ppr'])
                max_dp_diff = max(max_dp_diff, dp_diff)
                
                # Equal Opportunity difference (TPR gap)
                eo_diff = abs(stats1['tpr'] - stats2['tpr'])
                max_eo_diff = max(max_eo_diff, eo_diff)
                
                # Equalized Odds difference (max of TPR and FPR gaps)
                fpr_diff = abs(stats1['fpr'] - stats2['fpr'])
                eq_odds = max(eo_diff, fpr_diff)
                max_eq_odds_diff = max(max_eq_odds_diff, eq_odds)
                
                # Predictive Parity difference
                pp_diff = abs(stats1['precision'] - stats2['precision'])
                max_pp_diff = max(max_pp_diff, pp_diff)
                
                # Disparate Impact (min ratio across pairs)
                if stats1['ppr'] > 0 and stats2['ppr'] > 0:
                    ratio = min(stats1['ppr'] / stats2['ppr'], stats2['ppr'] / stats1['ppr'])
                    min_disparate_impact = min(min_disparate_impact, ratio)
        
        # Clip values to [0, 1]
        demographic_parity_diff = min(1.0, max(0.0, max_dp_diff))
        equal_opportunity_diff = min(1.0, max(0.0, max_eo_diff))
        equalized_odds_diff = min(1.0, max(0.0, max_eq_odds_diff))
        predictive_parity = max(0.0, 1 - max_pp_diff)
        statistical_parity = max(0.0, 1 - demographic_parity_diff)
        
        # F score for Hybrid Trust Framework: F = 1 - DP
        fairness_score_F = min(1.0, max(0.0, 1.0 - demographic_parity_diff))
        
        return {
            'demographic_parity_difference': float(demographic_parity_diff),
            'fairness_score_F': float(fairness_score_F),  # Trust framework F score
            'equal_opportunity_difference': float(equal_opportunity_diff),
            'disparate_impact_ratio': float(min_disparate_impact),
            'statistical_parity': float(statistical_parity),
            'predictive_parity': float(predictive_parity),
            'equalized_odds_difference': float(equalized_odds_diff),
            'num_groups_analyzed': len(group_stats)
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


def run_fairness_analysis(
    df: pd.DataFrame,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    sensitive_attribute: Optional[str] = None,
    target_column: Optional[str] = None,
    model_type: str = 'classification'
) -> Dict[str, Any]:
    """
    Run fairness analysis with optional auto-detection of sensitive attributes.
    
    This is the main entry point for fairness analysis. It will:
    1. Auto-detect sensitive attributes if none provided
    2. Run fairness analysis for each detected attribute
    3. Return combined results
    
    Args:
        df: DataFrame containing the dataset (for auto-detection)
        y_true: Ground truth labels
        y_pred: Predicted labels
        sensitive_attribute: Optional specific attribute to analyze
        target_column: Target column name to exclude from detection
        model_type: 'classification' or 'regression'
    
    Returns:
        Dictionary with analysis results for each sensitive attribute
    """
    results = {
        'analyses': [],
        'detected_attributes': [],
        'overall_fairness_score': 1.0,
        'analysis_successful': False
    }
    
    # Determine which sensitive attributes to analyze
    if sensitive_attribute and sensitive_attribute in df.columns:
        attrs_to_analyze = [sensitive_attribute]
        results['detected_attributes'] = [sensitive_attribute]
        logger.info(f"Using provided sensitive attribute: {sensitive_attribute}")
    else:
        # Auto-detect sensitive attributes
        exclude_cols = [target_column] if target_column else []
        attrs_to_analyze = detect_sensitive_attributes(df, exclude_cols)
        results['detected_attributes'] = attrs_to_analyze
        logger.info(f"Auto-detected {len(attrs_to_analyze)} sensitive attributes: {attrs_to_analyze}")
    
    if not attrs_to_analyze:
        logger.warning("No sensitive attributes found or provided for fairness analysis")
        return results
    
    # Run analysis for each sensitive attribute
    min_fairness_score = 1.0
    for attr in attrs_to_analyze:
        if attr not in df.columns:
            logger.warning(f"Sensitive attribute '{attr}' not found in dataset")
            continue
        
        sensitive_values = df[attr].values
        analysis = fairness_engine.analyze_fairness(
            y_true=y_true,
            y_pred=y_pred,
            sensitive_attr=sensitive_values,
            model_type=model_type,
            sensitive_attr_name=attr
        )
        
        results['analyses'].append(analysis)
        
        # Track minimum fairness score across all attributes
        if analysis.get('analysis_successful'):
            fairness_score = analysis.get('fairness_metrics', {}).get('fairness_score_F', 1.0)
            min_fairness_score = min(min_fairness_score, fairness_score)
    
    # Overall fairness is the worst case across all sensitive attributes
    results['overall_fairness_score'] = min_fairness_score
    results['analysis_successful'] = len(results['analyses']) > 0
    
    return results


# Global instance
fairness_engine = FairnessEngine()
