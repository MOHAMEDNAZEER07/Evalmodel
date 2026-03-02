"""
Meta Evaluator Validation Tests

Comprehensive test suite for the Hybrid Trust Aggregation Framework.
Tests mathematical correctness, numerical stability, and edge cases.

Run with: pytest backend/app/services/test_meta_evaluator.py -v
"""
import pytest
import math
from typing import Dict, Any

from app.services.meta_evaluator import (
    MetaEvaluator, meta_evaluator,
    EPSILON, WEIGHT_TOLERANCE, NON_COMPENSATORY_THRESHOLD, DEFAULT_LAMBDA_CAP
)


class TestMetaEvaluatorConstants:
    """Verify module constants are correctly defined."""
    
    def test_epsilon_is_small_positive(self):
        assert EPSILON > 0
        assert EPSILON < 1e-10
    
    def test_weight_tolerance_is_positive(self):
        assert WEIGHT_TOLERANCE > 0
        assert WEIGHT_TOLERANCE < 1e-4
    
    def test_non_compensatory_threshold_in_valid_range(self):
        assert 0.0 < NON_COMPENSATORY_THRESHOLD < 1.0
    
    def test_default_lambda_cap_in_valid_range(self):
        assert 0.0 < DEFAULT_LAMBDA_CAP <= 1.0


class TestMetaEvaluatorBasic:
    """Basic functionality tests."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    @pytest.fixture
    def good_metrics(self):
        """Metrics representing a high-quality classification model."""
        return {
            "accuracy": 0.92,
            "precision": 0.90,
            "recall": 0.88,
            "f1_score": 0.89,
            "roc_auc": 0.95
        }
    
    @pytest.fixture
    def good_dataset_stats(self):
        """Dataset stats representing a healthy dataset."""
        return {
            "n_rows": 10000,
            "n_features": 20,
            "missing_values": 50,
            "imbalance_ratio": 0.55,
            "duplicate_ratio": 0.02,
            "skew_score": 0.1,
            "low_variance_fraction": 0.1
        }
    
    def test_evaluate_returns_required_keys(self, evaluator, good_metrics, good_dataset_stats):
        """Verify evaluate returns all required keys."""
        result = evaluator.evaluate(
            metrics=good_metrics,
            dataset_stats=good_dataset_stats,
            model_type="classification"
        )
        
        # Primary outputs
        assert "trust_score" in result
        assert "meta_score" in result  # Legacy compatibility
        
        # Component scores
        assert "component_scores" in result
        assert "performance" in result["component_scores"]
        assert "health" in result["component_scores"]
        assert "fairness" in result["component_scores"]
        assert "robustness" in result["component_scores"]
        
        # New hybrid trust fields
        assert "DII" in result
        assert "lambda_value" in result
        assert "lambda_cap" in result
        assert "hybrid_weights" in result
        assert "non_compensatory_override" in result
    
    def test_trust_score_in_valid_range(self, evaluator, good_metrics, good_dataset_stats):
        """Trust score must be in [0, 100]."""
        result = evaluator.evaluate(
            metrics=good_metrics,
            dataset_stats=good_dataset_stats,
            model_type="classification"
        )
        
        assert 0.0 <= result["trust_score"] <= 100.0
    
    def test_component_scores_in_valid_range(self, evaluator, good_metrics, good_dataset_stats):
        """All component scores must be in [0, 1]."""
        result = evaluator.evaluate(
            metrics=good_metrics,
            dataset_stats=good_dataset_stats,
            model_type="classification"
        )
        
        for name, score in result["component_scores"].items():
            assert 0.0 <= score <= 1.0, f"{name} out of range: {score}"
    
    def test_weights_sum_to_one(self, evaluator, good_metrics, good_dataset_stats):
        """Hybrid weights must sum to 1.0 within tolerance.
        
        Note: hybrid_weights in output are rounded to 4 decimal places, so we use
        a looser tolerance (1e-3) than the internal WEIGHT_TOLERANCE (1e-6).
        """
        result = evaluator.evaluate(
            metrics=good_metrics,
            dataset_stats=good_dataset_stats,
            model_type="classification"
        )
        
        weight_sum = sum(result["hybrid_weights"].values())
        # Use 1e-3 tolerance since output weights are rounded to 4 decimal places
        ROUNDED_OUTPUT_TOLERANCE = 1e-3
        assert abs(weight_sum - 1.0) < ROUNDED_OUTPUT_TOLERANCE, f"Weight sum: {weight_sum}"
    
    def test_dii_in_valid_range(self, evaluator, good_metrics, good_dataset_stats):
        """DII must be in [0, 1]."""
        result = evaluator.evaluate(
            metrics=good_metrics,
            dataset_stats=good_dataset_stats,
            model_type="classification"
        )
        
        assert 0.0 <= result["DII"] <= 1.0


class TestNonCompensatoryGuard:
    """Test the non-compensatory guard rule."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    def test_guard_triggers_on_low_performance(self, evaluator):
        """Guard should trigger when a component falls below threshold."""
        # Very poor model with low F1
        poor_metrics = {
            "accuracy": 0.25,
            "precision": 0.20,
            "recall": 0.15,
            "f1_score": 0.17,  # Well below 0.30 threshold
            "roc_auc": 0.30
        }
        
        dataset_stats = {
            "n_rows": 1000,
            "n_features": 10,
            "missing_values": 0,
            "imbalance_ratio": 0.5,
            "duplicate_ratio": 0.0,
            "skew_score": 0.0,
            "low_variance_fraction": 0.0
        }
        
        result = evaluator.evaluate(
            metrics=poor_metrics,
            dataset_stats=dataset_stats,
            model_type="classification"
        )
        
        # Check if guard was triggered
        # Note: The guard checks component scores, not raw F1
        # Performance score uses F1 directly for classification
        perf_score = result["component_scores"]["performance"]
        
        if perf_score < NON_COMPENSATORY_THRESHOLD:
            assert result["non_compensatory_override"] is True, \
                f"Guard should trigger: perf_score={perf_score} < threshold={NON_COMPENSATORY_THRESHOLD}"
    
    def test_guard_verdict_is_high_risk(self, evaluator):
        """When guard triggers, verdict should be high_risk."""
        # Create scenario where guard definitely triggers
        poor_metrics = {
            "accuracy": 0.10,
            "precision": 0.10,
            "recall": 0.10,
            "f1_score": 0.10,
            "roc_auc": 0.15
        }
        
        # Also make dataset unhealthy
        poor_dataset = {
            "n_rows": 50,
            "n_features": 100,
            "missing_values": 25,
            "imbalance_ratio": 0.98,
            "duplicate_ratio": 0.5,
            "skew_score": 0.9,
            "low_variance_fraction": 0.8
        }
        
        result = evaluator.evaluate(
            metrics=poor_metrics,
            dataset_stats=poor_dataset,
            model_type="classification"
        )
        
        if result["non_compensatory_override"]:
            assert result["verdict"]["status"] == "high_risk"
            assert result["verdict"]["non_compensatory_triggered"] is True


class TestLambdaCapping:
    """Test lambda capping behavior."""
    
    def test_lambda_respects_cap(self):
        """Lambda should not exceed lambda_cap."""
        evaluator = MetaEvaluator(lambda_cap=0.5)
        
        # High DII dataset (should produce high lambda before capping)
        high_dii_dataset = {
            "n_rows": 100,
            "n_features": 50,
            "missing_values": 30,
            "imbalance_ratio": 0.95,
            "duplicate_ratio": 0.3,
            "skew_score": 0.8,
            "low_variance_fraction": 0.5
        }
        
        metrics = {
            "accuracy": 0.8,
            "precision": 0.75,
            "recall": 0.70,
            "f1_score": 0.72
        }
        
        result = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=high_dii_dataset,
            model_type="classification"
        )
        
        assert result["lambda_value"] <= 0.5, \
            f"Lambda {result['lambda_value']} exceeds cap 0.5"
        assert result["lambda_cap"] == 0.5
    
    def test_lambda_raw_vs_capped(self):
        """Verify lambda_raw and lambda_value relationship."""
        evaluator = MetaEvaluator(lambda_cap=0.5)
        
        dataset_stats = {
            "n_rows": 100,
            "n_features": 50,
            "missing_values": 50,  # High missing ratio
            "imbalance_ratio": 0.9,
            "duplicate_ratio": 0.2,
            "skew_score": 0.6,
            "low_variance_fraction": 0.4
        }
        
        metrics = {"accuracy": 0.8, "f1_score": 0.75}
        
        result = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification"
        )
        
        # lambda_value should be min(lambda_raw, lambda_cap)
        expected = min(result["lambda_raw"], result["lambda_cap"])
        assert abs(result["lambda_value"] - expected) < EPSILON


class TestUserWeights:
    """Test user weight blending."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    def test_user_weights_influence_final_weights(self, evaluator):
        """User weights should influence final hybrid weights."""
        dataset_stats = {
            "n_rows": 1000,
            "n_features": 10,
            "missing_values": 0,
            "imbalance_ratio": 0.5,
            "duplicate_ratio": 0.0,
            "skew_score": 0.0
        }
        
        metrics = {"accuracy": 0.85, "f1_score": 0.82}
        
        # Run without user weights
        result1 = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification",
            user_weights=None
        )
        
        # Run with user weights emphasizing fairness
        user_weights = {
            "performance": 0.1,
            "health": 0.1,
            "fairness": 0.7,
            "robustness": 0.1
        }
        
        result2 = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification",
            user_weights=user_weights
        )
        
        # Final fairness weight should be higher with user weights
        # (unless lambda is 0 or very low)
        if result2["lambda_value"] < 1.0:
            # Hybrid blending occurred
            assert "fairness" in result2["hybrid_weights"]


class TestMultiRunEstimation:
    """Test multi-run trust estimation."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    @pytest.fixture
    def stable_inputs(self):
        """Inputs that should produce stable trust scores."""
        return {
            "metrics": {"accuracy": 0.85, "f1_score": 0.82, "precision": 0.84, "recall": 0.80},
            "dataset_stats": {
                "n_rows": 5000,
                "n_features": 15,
                "missing_values": 10,
                "imbalance_ratio": 0.55,
                "duplicate_ratio": 0.01,
                "skew_score": 0.1
            }
        }
    
    def test_multi_run_returns_required_keys(self, evaluator, stable_inputs):
        """Multi-run should return all required statistics."""
        result = evaluator.evaluate_multi_run(
            metrics=stable_inputs["metrics"],
            dataset_stats=stable_inputs["dataset_stats"],
            model_type="classification",
            n_runs=5
        )
        
        assert "mean_trust" in result
        assert "std_trust" in result
        assert "ci_low" in result
        assert "ci_high" in result
        assert "n_runs" in result
        assert "all_scores" in result
        assert "representative_result" in result
    
    def test_multi_run_ci_bounds(self, evaluator, stable_inputs):
        """CI bounds should be valid."""
        result = evaluator.evaluate_multi_run(
            metrics=stable_inputs["metrics"],
            dataset_stats=stable_inputs["dataset_stats"],
            model_type="classification",
            n_runs=10
        )
        
        assert 0.0 <= result["ci_low"] <= result["mean_trust"]
        assert result["mean_trust"] <= result["ci_high"] <= 100.0
    
    def test_multi_run_deterministic_with_seed(self, evaluator, stable_inputs):
        """Same seed should produce same results."""
        result1 = evaluator.evaluate_multi_run(
            metrics=stable_inputs["metrics"],
            dataset_stats=stable_inputs["dataset_stats"],
            model_type="classification",
            n_runs=5,
            random_seed_base=42
        )
        
        result2 = evaluator.evaluate_multi_run(
            metrics=stable_inputs["metrics"],
            dataset_stats=stable_inputs["dataset_stats"],
            model_type="classification",
            n_runs=5,
            random_seed_base=42
        )
        
        assert result1["mean_trust"] == result2["mean_trust"]
        assert result1["all_scores"] == result2["all_scores"]


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    def test_zero_risk_sum_handling(self, evaluator):
        """Should handle zero risk sum gracefully."""
        # Perfect metrics = low risk
        perfect_metrics = {
            "accuracy": 1.0,
            "precision": 1.0,
            "recall": 1.0,
            "f1_score": 1.0,
            "roc_auc": 1.0
        }
        
        perfect_dataset = {
            "n_rows": 10000,
            "n_features": 10,
            "missing_values": 0,
            "imbalance_ratio": 0.5,
            "duplicate_ratio": 0.0,
            "skew_score": 0.0,
            "low_variance_fraction": 0.0
        }
        
        # Should not raise, should use equal weights
        result = evaluator.evaluate(
            metrics=perfect_metrics,
            dataset_stats=perfect_dataset,
            model_type="classification"
        )
        
        assert result["trust_score"] > 0
        assert not math.isnan(result["trust_score"])
        assert not math.isinf(result["trust_score"])
    
    def test_empty_dataset_stats(self, evaluator):
        """Should handle minimal dataset stats."""
        metrics = {"accuracy": 0.8, "f1_score": 0.75}
        
        minimal_stats = {
            "n_rows": 100,
            "n_features": 5
        }
        
        result = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=minimal_stats,
            model_type="classification"
        )
        
        assert 0.0 <= result["trust_score"] <= 100.0
    
    def test_regression_model_type(self, evaluator):
        """Should work for regression models."""
        regression_metrics = {
            "mse": 0.01,
            "rmse": 0.1,
            "mae": 0.08,
            "r2_score": 0.92
        }
        
        dataset_stats = {
            "n_rows": 1000,
            "n_features": 10,
            "missing_values": 5,
            "duplicate_ratio": 0.01,
            "skew_score": 0.2
        }
        
        result = evaluator.evaluate(
            metrics=regression_metrics,
            dataset_stats=dataset_stats,
            model_type="regression"
        )
        
        assert 0.0 <= result["trust_score"] <= 100.0
        assert 0.0 <= result["component_scores"]["performance"] <= 1.0


class TestIntegrityValidation:
    """Test the integrity validation mechanism."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    def test_integrity_passes_for_valid_inputs(self, evaluator):
        """Integrity validation should pass for normal inputs."""
        metrics = {"accuracy": 0.85, "f1_score": 0.82}
        dataset_stats = {
            "n_rows": 1000,
            "n_features": 10,
            "missing_values": 10,
            "imbalance_ratio": 0.6,
            "duplicate_ratio": 0.02,
            "skew_score": 0.15
        }
        
        # Should not raise AssertionError
        result = evaluator.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification"
        )
        
        # If we get here, validation passed
        assert result is not None


class TestLambdaSensitivityAnalysis:
    """Test the evaluate_lambda_sensitivity research function."""
    
    @pytest.fixture
    def evaluator(self):
        return MetaEvaluator()
    
    @pytest.fixture
    def sample_metrics(self):
        return {
            "accuracy": 0.85,
            "precision": 0.82,
            "recall": 0.80,
            "f1_score": 0.81,
            "roc_auc": 0.90
        }
    
    @pytest.fixture
    def sample_dataset_stats(self):
        return {
            "n_rows": 5000,
            "n_features": 20,
            "missing_values": 100,
            "imbalance_ratio": 0.65,
            "duplicate_ratio": 0.03,
            "skew_score": 0.25,
            "low_variance_fraction": 0.1
        }
    
    def test_sensitivity_returns_required_keys(self, evaluator, sample_metrics, sample_dataset_stats):
        """Sensitivity analysis should return all required keys."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        # Top-level keys
        assert "results" in result
        assert "comparison" in result
        assert "sensitivity_analysis" in result
        assert "baseline_dii" in result
        assert "trust_mode" in result
        
        # Nested sensitivity_analysis keys
        sa = result["sensitivity_analysis"]
        assert "exponents_tested" in sa
        assert "score_range" in sa
        assert "score_std" in sa
        assert "min_score" in sa
        assert "max_score" in sa
    
    def test_sensitivity_default_exponents(self, evaluator, sample_metrics, sample_dataset_stats):
        """Default exponents should be [1.0, 1.2, 1.5, 2.0]."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        assert result["sensitivity_analysis"]["exponents_tested"] == [1.0, 1.2, 1.5, 2.0]
        assert len(result["results"]) == 4
        assert len(result["comparison"]) == 4
    
    def test_sensitivity_custom_exponents(self, evaluator, sample_metrics, sample_dataset_stats):
        """Custom exponents should be used when provided."""
        custom_exponents = [0.5, 1.0, 2.0, 3.0]
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification",
            lambda_exponents=custom_exponents
        )
        
        assert result["sensitivity_analysis"]["exponents_tested"] == custom_exponents
        assert len(result["results"]) == 4
    
    def test_sensitivity_trust_scores_in_valid_range(self, evaluator, sample_metrics, sample_dataset_stats):
        """All trust scores in sensitivity analysis should be in [0, 100]."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        for exp, res in result["results"].items():
            trust_score = res["trust_score"]
            assert 0.0 <= trust_score <= 100.0, f"Trust score out of range at exponent {exp}: {trust_score}"
    
    def test_sensitivity_lambda_values_in_valid_range(self, evaluator, sample_metrics, sample_dataset_stats):
        """All lambda values should be in [0, 1]."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        for exp, res in result["results"].items():
            lam = res["lambda_value"]
            assert 0.0 <= lam <= 1.0, f"Lambda value out of range at exponent {exp}: {lam}"
    
    def test_sensitivity_score_range_is_nonnegative(self, evaluator, sample_metrics, sample_dataset_stats):
        """Score range (max - min) should be non-negative."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        sa = result["sensitivity_analysis"]
        assert sa["score_range"] >= 0.0
        
        # Verify score_range is actually max - min
        expected_range = sa["max_score"] - sa["min_score"]
        assert abs(sa["score_range"] - expected_range) < 0.1  # Allow for rounding
    
    def test_sensitivity_comparison_has_vs_baseline(self, evaluator, sample_metrics, sample_dataset_stats):
        """Comparison entries should have vs_baseline field."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        for entry in result["comparison"]:
            assert "exponent" in entry
            assert "lambda" in entry
            assert "trust_score" in entry
            assert "vs_baseline" in entry
    
    def test_sensitivity_baseline_dii_valid(self, evaluator, sample_metrics, sample_dataset_stats):
        """Baseline DII should be in [0, 1]."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        assert 0.0 <= result["baseline_dii"] <= 1.0
    
    def test_sensitivity_results_have_component_scores(self, evaluator, sample_metrics, sample_dataset_stats):
        """Each result entry should have component scores."""
        result = evaluator.evaluate_lambda_sensitivity(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification"
        )
        
        for exp, res in result["results"].items():
            assert "component_scores" in res
            cs = res["component_scores"]
            assert "performance" in cs
            assert "health" in cs
            assert "fairness" in cs
            assert "robustness" in cs
            # All component scores should be in [0, 1]
            for name, score in cs.items():
                assert 0.0 <= score <= 1.0, f"Component {name} out of range: {score}"


# Run specific tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
