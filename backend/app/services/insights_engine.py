"""
Data Insights Engine
Provides data quality analysis, outlier detection, and feature correlation analysis
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from scipy import stats
from scipy.stats import pearsonr, spearmanr
import logging

logger = logging.getLogger(__name__)


class InsightsEngine:
    """Engine for analyzing datasets and providing insights"""
    
    @staticmethod
    def analyze_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze data quality metrics
        
        Args:
            df: Pandas DataFrame to analyze
            
        Returns:
            Dictionary containing quality metrics
        """
        try:
            total_cells = df.shape[0] * df.shape[1]
            
            # Completeness: percentage of non-null values
            non_null_cells = df.count().sum()
            completeness = (non_null_cells / total_cells * 100) if total_cells > 0 else 0
            
            # Validity: percentage of valid data types (no mixed types)
            validity_scores = []
            for col in df.columns:
                # Check if column has consistent type
                non_null_values = df[col].dropna()
                if len(non_null_values) == 0:
                    continue
                    
                # Numeric columns should be all numeric
                if pd.api.types.is_numeric_dtype(df[col]):
                    validity_scores.append(100.0)
                else:
                    # String columns - check for consistency
                    try:
                        # If it can be converted to numeric, it's valid
                        pd.to_numeric(non_null_values, errors='raise')
                        validity_scores.append(100.0)
                    except:
                        # It's a string column, that's valid too
                        validity_scores.append(100.0)
            
            validity = np.mean(validity_scores) if validity_scores else 100.0
            
            # Uniqueness: average percentage of unique values per column
            uniqueness_scores = []
            for col in df.columns:
                unique_ratio = (df[col].nunique() / len(df) * 100) if len(df) > 0 else 0
                uniqueness_scores.append(unique_ratio)
            
            uniqueness = np.mean(uniqueness_scores) if uniqueness_scores else 0
            
            # Consistency: check for outliers/anomalies
            # Using IQR method for numeric columns
            consistency_scores = []
            for col in df.select_dtypes(include=[np.number]).columns:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outliers = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
                consistency = ((len(df) - outliers) / len(df) * 100) if len(df) > 0 else 100
                consistency_scores.append(consistency)
            
            consistency = np.mean(consistency_scores) if consistency_scores else 100.0
            
            # Overall quality score
            overall_score = (completeness + validity + min(uniqueness, 100) + consistency) / 4
            
            return {
                "completeness": round(completeness, 1),
                "validity": round(validity, 1),
                "uniqueness": round(min(uniqueness, 100), 1),  # Cap at 100%
                "consistency": round(consistency, 1),
                "overall_score": round(overall_score, 1),
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "missing_values": int(df.isnull().sum().sum()),
                "status": "good" if overall_score >= 80 else "warning" if overall_score >= 60 else "poor"
            }
            
        except Exception as e:
            logger.error(f"Error analyzing data quality: {e}")
            raise
    
    @staticmethod
    def detect_outliers(df: pd.DataFrame, method: str = "iqr") -> Dict[str, Any]:
        """
        Detect outliers in numeric columns
        
        Args:
            df: Pandas DataFrame
            method: Detection method ('iqr' or 'zscore')
            
        Returns:
            Dictionary with outlier information per feature
        """
        try:
            outliers = []
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            
            for col in numeric_cols:
                col_data = df[col].dropna()
                
                if len(col_data) < 3:  # Need at least 3 points
                    continue
                
                if method == "iqr":
                    Q1 = col_data.quantile(0.25)
                    Q3 = col_data.quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
                    
                elif method == "zscore":
                    z_scores = np.abs(stats.zscore(col_data))
                    outlier_mask = z_scores > 3
                    lower_bound = col_data.mean() - 3 * col_data.std()
                    upper_bound = col_data.mean() + 3 * col_data.std()
                else:
                    continue
                
                outlier_count = outlier_mask.sum()
                
                if outlier_count > 0:
                    # Determine impact based on percentage of outliers
                    outlier_percentage = (outlier_count / len(df)) * 100
                    if outlier_percentage > 10:
                        impact = "high"
                    elif outlier_percentage > 5:
                        impact = "medium"
                    else:
                        impact = "low"
                    
                    outliers.append({
                        "feature": col,
                        "count": int(outlier_count),
                        "percentage": round(outlier_percentage, 2),
                        "impact": impact,
                        "lower_bound": float(lower_bound),
                        "upper_bound": float(upper_bound),
                        "min_value": float(col_data.min()),
                        "max_value": float(col_data.max()),
                        "mean": float(col_data.mean()),
                        "std": float(col_data.std())
                    })
            
            # Sort by impact and count
            impact_order = {"high": 0, "medium": 1, "low": 2}
            outliers.sort(key=lambda x: (impact_order[x["impact"]], -x["count"]))
            
            return {
                "outliers": outliers,
                "total_outliers": sum(o["count"] for o in outliers),
                "affected_features": len(outliers),
                "method": method
            }
            
        except Exception as e:
            logger.error(f"Error detecting outliers: {e}")
            raise
    
    @staticmethod
    def calculate_correlations(df: pd.DataFrame, method: str = "pearson", threshold: float = 0.5) -> Dict[str, Any]:
        """
        Calculate feature correlations
        
        Args:
            df: Pandas DataFrame
            method: Correlation method ('pearson' or 'spearman')
            threshold: Minimum correlation threshold to include
            
        Returns:
            Dictionary with correlation pairs and matrix
        """
        try:
            numeric_df = df.select_dtypes(include=[np.number])
            
            if len(numeric_df.columns) < 2:
                return {
                    "correlations": [],
                    "strong_correlations": [],
                    "correlation_matrix": {},
                    "message": "Insufficient numeric columns for correlation analysis"
                }
            
            # Calculate correlation matrix
            if method == "pearson":
                corr_matrix = numeric_df.corr(method='pearson')
            else:
                corr_matrix = numeric_df.corr(method='spearman')
            
            # Extract correlation pairs
            correlations = []
            strong_correlations = []
            
            # Get upper triangle of correlation matrix (avoid duplicates)
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    feat1 = corr_matrix.columns[i]
                    feat2 = corr_matrix.columns[j]
                    corr_value = corr_matrix.iloc[i, j]
                    
                    if pd.isna(corr_value):
                        continue
                    
                    # Convert correlation value to float
                    # Pandas corr() returns numeric types (float64, int64, etc.)
                    try:
                        # Direct conversion for most cases
                        corr_float = float(corr_value)  # type: ignore
                    except (TypeError, ValueError):
                        # Skip if conversion fails (shouldn't happen with numeric data)
                        logger.debug(f"Skipping non-numeric correlation between {feat1} and {feat2}")
                        continue
                    
                    corr_abs = abs(corr_float)
                    
                    if corr_abs >= threshold:
                        # Determine strength
                        if corr_abs >= 0.8:
                            strength = "very_strong"
                        elif corr_abs >= 0.6:
                            strength = "strong"
                        else:
                            strength = "moderate"
                        
                        corr_data = {
                            "feature1": feat1,
                            "feature2": feat2,
                            "correlation": round(corr_float, 4),
                            "abs_correlation": round(corr_abs, 4),
                            "strength": strength,
                            "direction": "positive" if corr_float > 0 else "negative"
                        }
                        
                        correlations.append(corr_data)
                        
                        if corr_abs >= 0.7:
                            strong_correlations.append(corr_data)
            
            # Sort by absolute correlation (strongest first)
            correlations.sort(key=lambda x: x["abs_correlation"], reverse=True)
            strong_correlations.sort(key=lambda x: x["abs_correlation"], reverse=True)
            
            # Convert correlation matrix to dict
            corr_matrix_dict = corr_matrix.round(4).to_dict()
            
            return {
                "correlations": correlations[:20],  # Top 20
                "strong_correlations": strong_correlations,
                "total_pairs": len(correlations),
                "correlation_matrix": corr_matrix_dict,
                "method": method,
                "features_analyzed": list(numeric_df.columns)
            }
            
        except Exception as e:
            logger.error(f"Error calculating correlations: {e}")
            raise
    
    @staticmethod
    def generate_insights_summary(
        quality_metrics: Dict[str, Any],
        outliers: Dict[str, Any],
        correlations: Dict[str, Any]
    ) -> str:
        """
        Generate AI-like summary of insights
        
        Args:
            quality_metrics: Data quality analysis results
            outliers: Outlier detection results
            correlations: Correlation analysis results
            
        Returns:
            Human-readable summary string
        """
        summary_parts = []
        
        # Quality assessment
        overall_score = quality_metrics.get("overall_score", 0)
        if overall_score >= 90:
            summary_parts.append(f"Your dataset shows excellent quality with a {overall_score:.1f}% overall score.")
        elif overall_score >= 75:
            summary_parts.append(f"Your dataset shows good quality with a {overall_score:.1f}% overall score.")
        elif overall_score >= 60:
            summary_parts.append(f"Your dataset has moderate quality ({overall_score:.1f}% score) and could benefit from improvements.")
        else:
            summary_parts.append(f"Your dataset needs attention with a {overall_score:.1f}% quality score.")
        
        # Outlier insights
        total_outliers = outliers.get("total_outliers", 0)
        if total_outliers > 0:
            affected = outliers.get("affected_features", 0)
            summary_parts.append(f"Found {total_outliers} outliers across {affected} features.")
            
            high_impact = [o for o in outliers.get("outliers", []) if o["impact"] == "high"]
            if high_impact:
                summary_parts.append(f"High-impact outliers detected in: {', '.join([o['feature'] for o in high_impact[:3]])}.")
        
        # Correlation insights
        strong_corrs = correlations.get("strong_correlations", [])
        if strong_corrs:
            top_corr = strong_corrs[0]
            summary_parts.append(
                f"Strong {top_corr['direction']} correlation ({top_corr['correlation']:.2f}) "
                f"found between {top_corr['feature1']} and {top_corr['feature2']}."
            )
        
        # Recommendations
        if quality_metrics.get("completeness", 100) < 95:
            summary_parts.append("Consider handling missing values to improve data completeness.")
        
        total_rows = quality_metrics.get("total_rows", 1)
        if total_outliers > total_rows * 0.05:
            summary_parts.append("Review and potentially remove or transform outliers before model training.")
        
        return " ".join(summary_parts)
