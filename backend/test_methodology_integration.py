"""
Integration tests for the research methodology implementations.
Tests fairness assertions, SMCP engine, and lambda sensitivity analysis.
"""
import pytest
from app.services.smcp_engine import smcp_engine
from app.services.meta_evaluator import meta_evaluator
from app.models.schemas import MetricsResult


class TestSMCPEngineAssertions:
    """Test SMCP engine assertions and score bounds."""
    
    def test_eval_score_in_valid_range(self):
        """EvalScore must be in [0, 1]."""
        metrics = MetricsResult(
            accuracy=0.85,
            f1_score=0.82,
            precision=0.84,
            recall=0.80,
            roc_auc=0.90
        )
        
        result = smcp_engine.calculate_eval_score(metrics, 'classification')
        eval_score = result.eval_score
        assert 0.0 <= eval_score <= 100.0, f"EvalScore out of range: {eval_score}"
    
    def test_eval_score_regression(self):
        """EvalScore for regression must be in [0, 100]."""
        metrics = MetricsResult(
            mse=0.05,
            rmse=0.22,
            mae=0.15,
            r2=0.85
        )
        
        result = smcp_engine.calculate_eval_score(metrics, 'regression')
        eval_score = result.eval_score
        assert 0.0 <= eval_score <= 100.0, f"EvalScore out of range: {eval_score}"
    
    def test_eval_score_with_extreme_values(self):
        """EvalScore should handle extreme metric values."""
        # Perfect model
        perfect_metrics = MetricsResult(
            accuracy=1.0,
            f1_score=1.0,
            precision=1.0,
            recall=1.0
        )
        result_perfect = smcp_engine.calculate_eval_score(perfect_metrics, 'classification')
        assert 0.0 <= result_perfect.eval_score <= 100.0
        
        # Poor model
        poor_metrics = MetricsResult(
            accuracy=0.0,
            f1_score=0.0,
            precision=0.0,
            recall=0.0
        )
        result_poor = smcp_engine.calculate_eval_score(poor_metrics, 'classification')
        assert 0.0 <= result_poor.eval_score <= 100.0


class TestLambdaSensitivityIntegration:
    """Integration tests for lambda sensitivity analysis."""
    
    def test_sensitivity_analysis_completes(self):
        """Lambda sensitivity analysis should complete without errors."""
        result = meta_evaluator.evaluate_lambda_sensitivity(
            metrics={'accuracy': 0.85, 'f1_score': 0.82},
            dataset_stats={
                'n_rows': 5000,
                'n_features': 15,
                'missing_values': 100,
                'imbalance_ratio': 0.6,
                'duplicate_ratio': 0.02,
                'skew_score': 0.2
            }
        )
        
        assert result is not None
        assert 'sensitivity_analysis' in result
        assert 'results' in result
    
    def test_sensitivity_scores_ordered(self):
        """Higher lambda exponents should generally produce different trust scores."""
        result = meta_evaluator.evaluate_lambda_sensitivity(
            metrics={'accuracy': 0.75, 'f1_score': 0.70},
            dataset_stats={
                'n_rows': 1000,
                'n_features': 20,
                'missing_values': 200,
                'imbalance_ratio': 0.8,
                'duplicate_ratio': 0.1,
                'skew_score': 0.5
            }
        )
        
        # With high DII, different exponents should produce measurable differences
        scores = [result['results'][exp]['trust_score'] for exp in [1.0, 1.2, 1.5, 2.0]]
        assert len(set(scores)) > 1, "All trust scores are identical - no sensitivity"


class TestMathematicalInvariants:
    """Test mathematical invariants across the trust framework."""
    
    def test_component_scores_bounded(self):
        """All component scores must be in [0, 1]."""
        result = meta_evaluator.evaluate(
            metrics={'accuracy': 0.85, 'f1_score': 0.82},
            dataset_stats={
                'n_rows': 5000,
                'n_features': 15,
                'missing_values': 100,
                'imbalance_ratio': 0.6,
                'duplicate_ratio': 0.02,
                'skew_score': 0.2
            },
            model_type='classification'
        )
        
        for name, score in result['component_scores'].items():
            assert 0.0 <= score <= 1.0, f"Component {name} out of [0,1]: {score}"
    
    def test_trust_score_bounded(self):
        """Trust score must be in [0, 100]."""
        result = meta_evaluator.evaluate(
            metrics={'accuracy': 0.85, 'f1_score': 0.82},
            dataset_stats={
                'n_rows': 5000,
                'n_features': 15,
                'missing_values': 100,
                'imbalance_ratio': 0.6,
                'duplicate_ratio': 0.02,
                'skew_score': 0.2
            },
            model_type='classification'
        )
        
        assert 0.0 <= result['trust_score'] <= 100.0
    
    def test_dii_bounded(self):
        """DII must be in [0, 1]."""
        result = meta_evaluator.evaluate(
            metrics={'accuracy': 0.85, 'f1_score': 0.82},
            dataset_stats={
                'n_rows': 5000,
                'n_features': 15,
                'missing_values': 100,
                'imbalance_ratio': 0.6,
                'duplicate_ratio': 0.02,
                'skew_score': 0.2
            },
            model_type='classification'
        )
        
        assert 0.0 <= result['DII'] <= 1.0
    
    def test_lambda_bounded(self):
        """Lambda must be in [0, 1]."""
        result = meta_evaluator.evaluate(
            metrics={'accuracy': 0.85, 'f1_score': 0.82},
            dataset_stats={
                'n_rows': 5000,
                'n_features': 15,
                'missing_values': 100,
                'imbalance_ratio': 0.6,
                'duplicate_ratio': 0.02,
                'skew_score': 0.2
            },
            model_type='classification'
        )
        
        assert 0.0 <= result['lambda_value'] <= 1.0


if __name__ == "__main__":
    pytest.main([__file__, '-v'])
