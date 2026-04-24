"""
Meta Evaluator - Hybrid Trust Aggregation System
Dynamically adaptive, instability-aware trust aggregation engine

Trust = f(Performance, Dataset Health, Fairness, Robustness)

Core innovation:
- Multi-dimensional trust assessment
- Risk-reactive weight adaptation
- Hybrid control (automatic + user preferences)
- Non-compensatory guard rules for critical failures

Mathematical Guarantees:
- All component scores (P, H, F, R) ∈ [0, 1]
- All weights sum to 1.0 (within numerical tolerance)
- Trust score T ∈ [0, 100]
- DII, DP, delta ∈ [0, 1]
"""
import logging
import math
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# =============================================================================
# NUMERICAL STABILITY CONSTANTS
# =============================================================================
EPSILON = 1e-12  # Threshold for near-zero checks in divisions
WEIGHT_TOLERANCE = 1e-6  # Tolerance for weight sum validation (Σβ = 1 ± tolerance)
SCORE_MIN = 0.0  # Minimum component score bound
SCORE_MAX = 1.0  # Maximum component score bound
TRUST_MIN = 0.0  # Minimum trust score bound
TRUST_MAX = 100.0  # Maximum trust score bound

# =============================================================================
# TRUST MODE CONFIGURATION
# =============================================================================
TRUST_MODE_BALANCED = "balanced"  # Proportional, smooth scoring
TRUST_MODE_STRICT = "strict"      # Conservative, amplified risk detection
VALID_TRUST_MODES = {TRUST_MODE_BALANCED, TRUST_MODE_STRICT}

# =============================================================================
# NON-COMPENSATORY GUARD THRESHOLDS (τ)
# Research justification: These thresholds define deployment-tier boundaries.
# If min(P, H, F, R) < τ, guard triggers and overrides verdict to high_risk.
# Guard affects VERDICT ONLY, NOT the numeric trust score.
# =============================================================================
GUARD_THRESHOLD_BALANCED = 0.30  # τ for balanced mode - allows more tolerance
GUARD_THRESHOLD_STRICT = 0.40   # τ for strict mode - earlier intervention

# =============================================================================
# STRICT MODE AMPLIFICATION CONSTANTS
# Research justification for γ = 1.5 (STRICT_AMPLIFICATION_POWER):
#   - Provides convex risk amplification on [0,1]
#   - Moderate risks (0.3-0.5) are amplified more than proportionally
#   - Mathematical property: d²(r^γ)/dr² > 0 for γ > 1 (convex)
#   - Example transformations:
#     r=0.2 → 0.089, r=0.4 → 0.253, r=0.6 → 0.465, r=0.8 → 0.716
# =============================================================================
STRICT_AMPLIFICATION_POWER = 1.5  # γ - Risk amplification exponent (convex)
STRICT_LAMBDA_POWER = 1.5         # Lambda adjustment exponent (DII^1.5)

# =============================================================================
# GLOBAL INSTABILITY PENALTY (α)
# Research justification for α = 0.15:
#   - Applied in strict mode: T = T_raw × (1 - α × DII)
#   - At maximum DII=1, reduces trust score by 15%
#   - Provides additional conservatism beyond component-level penalties
#   - Bounded penalty ensures trust score remains meaningful
# =============================================================================
DEFAULT_INSTABILITY_PENALTY = 0.15  # α - Global instability penalty coefficient

# =============================================================================
# LAMBDA CAP
# Research justification for λ_cap = 0.85:
#   - Even at maximum DII, user preferences retain (1 - λ_cap) = 15% influence
#   - Prevents complete automation dominance
#   - Preserves human oversight and domain expertise contribution
# =============================================================================
DEFAULT_LAMBDA_CAP = 0.85  # Maximum lambda value to preserve user influence

# Legacy constant for backward compatibility
NON_COMPENSATORY_THRESHOLD = GUARD_THRESHOLD_BALANCED

# Minimum weight floor for auto weights
# Prevents "perfect" components from being completely invisible in trust score
# Research justification: Even components with zero risk should have minimal influence
# to ensure they're still considered in final trust computation
MIN_WEIGHT_FLOOR = 0.05  # Every component gets at least 5% weight

# Stochastic estimation defaults
DEFAULT_STOCHASTIC_SIGMA = 0.02  # Conservative perturbation standard deviation


class MetaEvaluator:
    """
    Hybrid Trust Aggregation System
    
    Supports two trust modes:
    - "balanced": Smooth, proportional scoring (default)
    - "strict": Aggressive risk amplification, earlier guard triggers
    
    Produces:
    - Trust Score T (0-100): Unified reliability metric
    - Component scores: P (Performance), H (Health), F (Fairness), R (Robustness)
    - DII (Dataset Instability Index): Adaptive weight controller
    - Hybrid weights: Balances automatic risk-detection with user preferences
    
    Strict Mode Differences:
    - DII: Multiplicative risk formula (1 - (1-I)(1-M)(1-D)(1-S))
    - Lambda: DII^1.5 instead of DII
    - Risk values: r^1.5 amplification
    - Guard threshold: 0.40 instead of 0.30
    - Global instability penalty: T * (1 - 0.15 * DII)
    """
    
    # Default user preference weights (sum = 1.0)
    DEFAULT_USER_WEIGHTS = {
        'performance': 0.40,
        'health': 0.25,
        'fairness': 0.20,
        'robustness': 0.15
    }
    
    # Equal fallback weights when risk is near-zero
    EQUAL_WEIGHTS = {
        'performance': 0.25,
        'health': 0.25,
        'fairness': 0.25,
        'robustness': 0.25
    }
    
    # Default lambda cap to prevent complete automatic weight dominance
    DEFAULT_LAMBDA_CAP = 0.85
    
    def __init__(
        self,
        trust_mode: str = TRUST_MODE_BALANCED,
        lambda_cap: float = DEFAULT_LAMBDA_CAP,
        instability_penalty: float = DEFAULT_INSTABILITY_PENALTY
    ):
        self.logger = logging.getLogger(__name__)
        
        # Validate trust mode
        if trust_mode not in VALID_TRUST_MODES:
            raise ValueError(f"Invalid trust_mode '{trust_mode}'. Must be one of {VALID_TRUST_MODES}")
        
        self.trust_mode = trust_mode
        
        # Lambda cap prevents complete dominance of automatic weighting
        # Even with high DII, user preferences retain (1 - lambda_cap) influence
        self.lambda_cap = min(1.0, max(0.0, lambda_cap))
        
        # Instability penalty coefficient for strict mode
        self.instability_penalty = min(1.0, max(0.0, instability_penalty))
        
        # Set mode-specific guard threshold
        self.guard_threshold = (
            GUARD_THRESHOLD_STRICT if trust_mode == TRUST_MODE_STRICT
            else GUARD_THRESHOLD_BALANCED
        )
        
        self.logger.info(
            f"🔧 MetaEvaluator initialized: mode={trust_mode}, lambda_cap={self.lambda_cap}, "
            f"guard_threshold={self.guard_threshold}, instability_penalty={self.instability_penalty}"
        )
    
    def evaluate(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        model_type: str,
        train_metrics: Optional[Dict[str, Any]] = None,
        fairness_result: Optional[Dict[str, Any]] = None,
        user_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Main evaluation function - Hybrid Trust Aggregation
        
        Args:
            metrics: Raw evaluation metrics (accuracy, f1, mse, etc.)
            dataset_stats: Dataset statistics (rows, missing, imbalance, etc.)
            model_type: 'classification' or 'regression'
            train_metrics: Optional training metrics for robustness check
            fairness_result: Optional fairness analysis results
            user_weights: Optional user preference weights
        
        Returns:
            Dict with trust_score, component scores, DII, weights, recommendations
        """
        try:
            # ============================================
            # STEP 1: Calculate Normalized Component Scores [0,1]
            # ============================================
            
            # P - Performance Score (benefit-type, higher is better)
            perf_score = self._calculate_performance_score(metrics, model_type)
            
            # DII - Dataset Instability Index (used for adaptive weighting)
            dii_score, dii_components = self._calculate_dii(dataset_stats)
            
            # H - Dataset Health Score (1 - DII, benefit-type)
            health_score = 1.0 - dii_score
            
            # F - Fairness Score and DP (Demographic Parity difference)
            fair_score, dp_value, fairness_evaluated = self._calculate_fairness_score(fairness_result)
            
            # Track whether fairness was actually tested vs defaulted
            # fairness_evaluated=True means real fairness data exists
            # fairness_evaluated=False means F=0.5 is a neutral placeholder (untested)
            
            # R - Robustness Score and delta
            robust_score, delta_value = self._calculate_robustness_score(metrics, train_metrics, model_type)
            
            # Clip all values to [0, 1] for stability
            perf_score = self._clip(perf_score)
            health_score = self._clip(health_score)
            fair_score = self._clip(fair_score)
            robust_score = self._clip(robust_score)
            
            # Log component scores
            self.logger.info(f"📊 Component Scores: P={perf_score:.4f}, H={health_score:.4f}, F={fair_score:.4f}, R={robust_score:.4f}")
            self.logger.info(f"📊 DII={dii_score:.4f} | DP={dp_value:.4f} | delta={delta_value:.4f}")
            
            # ============================================
            # STEP 2: Calculate Risk Values (r_i)
            # Risk is inverted score: higher risk = lower score
            # All risk values are clipped to [0, 1] for stability
            # In strict mode, apply nonlinear amplification
            # 
            # IMPORTANT: When fairness is not evaluated, F is EXCLUDED
            # from weight computation entirely (not given neutral risk).
            # This prevents unverified fairness from dominating weights.
            # ============================================
            
            r_P = self._clip(1.0 - perf_score)    # Performance risk
            r_H = self._clip(dii_score)           # Dataset health risk (DII itself is instability)
            r_R = self._clip(delta_value)         # Generalization stability risk (train-test gap)
            
            # F risk only computed if fairness was actually evaluated
            if fairness_evaluated:
                r_F = self._clip(dp_value)
            else:
                r_F = None  # Excluded from computation
            
            # Strict mode: Apply symmetric risk amplification
            amplification_applied = False
            if self.trust_mode == TRUST_MODE_STRICT:
                amplification_applied = True
                r_P = self._clip(r_P ** STRICT_AMPLIFICATION_POWER)
                r_H = self._clip(r_H ** STRICT_AMPLIFICATION_POWER)
                if r_F is not None:
                    r_F = self._clip(r_F ** STRICT_AMPLIFICATION_POWER)
                r_R = self._clip(r_R ** STRICT_AMPLIFICATION_POWER)
                self.logger.info(f"⚡ STRICT MODE: Risk amplification applied (power={STRICT_AMPLIFICATION_POWER})")
            
            # Risk sum only includes evaluated components
            if fairness_evaluated:
                risk_sum = r_P + r_H + r_F + r_R
                active_components = {'performance', 'health', 'fairness', 'robustness'}
            else:
                risk_sum = r_P + r_H + r_R
                active_components = {'performance', 'health', 'robustness'}
            
            self.logger.info(f"⚠️  Risk Values: r_P={r_P:.4f}, r_H={r_H:.4f}, r_F={r_F if r_F else 'N/A'}, r_R={r_R:.4f}")
            self.logger.info(f"⚠️  Active Components: {active_components} | Total Risk Sum: {risk_sum:.4f}")
            
            # ============================================
            # STEP 3: Calculate Automatic Weights (risk-proportional)
            # Only active components participate in weight computation
            # ============================================
            
            if risk_sum > EPSILON:
                if fairness_evaluated:
                    beta_auto = {
                        'performance': r_P / risk_sum,
                        'health': r_H / risk_sum,
                        'fairness': r_F / risk_sum,
                        'robustness': r_R / risk_sum
                    }
                else:
                    # F excluded - only P, H, R
                    beta_auto = {
                        'performance': r_P / risk_sum,
                        'health': r_H / risk_sum,
                        'fairness': 0.0,  # Excluded
                        'robustness': r_R / risk_sum
                    }
            else:
                # Risk sum is effectively zero - use equal weights over active components
                self.logger.warning(f"⚠️  Risk sum ({risk_sum}) <= EPSILON ({EPSILON}), using equal weights")
                if fairness_evaluated:
                    beta_auto = self.EQUAL_WEIGHTS.copy()
                else:
                    beta_auto = {'performance': 1/3, 'health': 1/3, 'fairness': 0.0, 'robustness': 1/3}
            
            # Apply minimum weight floor only to active components
            beta_auto = self._apply_min_floor_active(beta_auto, MIN_WEIGHT_FLOOR, active_components)
            
            self.logger.info(f"🤖 Auto Weights: {beta_auto}")
            
            # ============================================
            # STEP 4: Hybrid Weight Computation
            # beta_i = lambda * beta_auto_i + (1 - lambda) * user_weight_i
            # Balanced: lambda = DII
            # Strict: lambda = DII^1.5 (faster escalation)
            # Then: lambda = min(lambda, lambda_cap)
            # 
            # When fairness is excluded, redistribute its user weight among P, H, R
            # ============================================
            
            # Use user weights or defaults
            user_w = user_weights.copy() if user_weights else self.DEFAULT_USER_WEIGHTS.copy()
            
            # Redistribute fairness user weight among P, H, R when fairness is excluded
            if not fairness_evaluated:
                f_weight = user_w.get('fairness', 0.20)
                user_w['fairness'] = 0.0
                boost = f_weight / 3.0
                for k in ['performance', 'health', 'robustness']:
                    user_w[k] = user_w.get(k, 0.25) + boost
            
            # Lambda controls automatic vs user preference
            raw_lambda = dii_score
            
            # Strict mode: Apply power adjustment to lambda
            if self.trust_mode == TRUST_MODE_STRICT:
                lambda_adjusted = self._clip(raw_lambda ** STRICT_LAMBDA_POWER)
                self.logger.info(f"⚡ STRICT MODE: Lambda power adjusted: {raw_lambda:.4f}^{STRICT_LAMBDA_POWER} = {lambda_adjusted:.4f}")
            else:
                lambda_adjusted = raw_lambda
            
            # Cap lambda to prevent complete dominance of automatic weighting
            lambda_value = min(lambda_adjusted, self.lambda_cap)
            
            if lambda_adjusted > self.lambda_cap:
                self.logger.info(f"🔧 Lambda capped: {lambda_adjusted:.4f} -> {lambda_value:.4f} (cap={self.lambda_cap})")
            
            # Compute hybrid weights (convex combination) only over active components
            beta_final: Dict[str, float] = {}
            for key in ['performance', 'health', 'fairness', 'robustness']:
                if key in active_components:
                    beta_final[key] = lambda_value * beta_auto[key] + (1.0 - lambda_value) * user_w.get(key, 0.25)
                else:
                    beta_final[key] = 0.0  # Excluded component
            
            # Explicit renormalization to ensure weights sum to 1 (only active components)
            weight_sum = sum(beta_final[k] for k in active_components)
            
            if weight_sum <= EPSILON:
                # Fallback to equal weights if weight_sum is effectively zero
                self.logger.warning(f"⚠️  Weight sum ({weight_sum}) <= EPSILON, using equal weights")
                if fairness_evaluated:
                    beta_final = self.EQUAL_WEIGHTS.copy()
                else:
                    beta_final = {'performance': 1/3, 'health': 1/3, 'fairness': 0.0, 'robustness': 1/3}
            else:
                # Renormalize weights
                beta_final = {k: v / weight_sum for k, v in beta_final.items()}
            
            # Validate weights sum to 1 (assertion for mathematical integrity)
            final_sum = sum(beta_final.values())
            if abs(final_sum - 1.0) >= WEIGHT_TOLERANCE:
                self.logger.error(f"❌ Weight normalization failed: sum={final_sum}, expected 1.0")
                raise ValueError(f"Hybrid weights do not sum to 1.0: {final_sum}")
            
            self.logger.info(f"🔧 Lambda (DII={raw_lambda:.4f}, capped={lambda_value:.4f})")
            self.logger.info(f"📐 Final Hybrid Weights: {beta_final} (sum={final_sum:.6f})")
            self.logger.info(f"📐 Active components: {active_components}")
            
            # ============================================
            # STEP 5: Calculate Trust Score T
            # T = 100 * Σ(beta_i * C_i) for active components only
            # When fairness is excluded, T is computed over P, H, R only
            # Strict mode: Apply global instability penalty T = T * (1 - penalty * DII)
            # ============================================
            
            # Compute trust score only over active components
            trust_score_raw: float = 100.0 * (
                beta_final['performance'] * perf_score +
                beta_final['health'] * health_score +
                (beta_final['fairness'] * fair_score if fairness_evaluated else 0.0) +
                beta_final['robustness'] * robust_score
            )
            
            # Apply global instability penalty in strict mode
            global_penalty_applied = False
            instability_penalty_value = 0.0
            if self.trust_mode == TRUST_MODE_STRICT:
                global_penalty_applied = True
                instability_penalty_value = self.instability_penalty * dii_score
                trust_score = trust_score_raw * (1.0 - instability_penalty_value)
                self.logger.info(
                    f"⚡ STRICT MODE: Global instability penalty applied: "
                    f"{trust_score_raw:.2f} * (1 - {self.instability_penalty} * {dii_score:.4f}) = {trust_score:.2f}"
                )
            else:
                trust_score = trust_score_raw
            
            # Clip to [0, 100]
            trust_score = max(0.0, min(100.0, trust_score))
            
            self.logger.info(f"✅ TRUST SCORE: {trust_score:.2f}/100")
            
            # ============================================
            # STEP 6: Non-Compensatory Guard Check
            # If any component score falls below mode-specific threshold, override risk classification
            # Balanced: threshold = 0.30, Strict: threshold = 0.40
            # Note: Fairness is only included in guard check if it was actually evaluated
            # ============================================
            
            component_scores_raw = {
                'performance': perf_score,
                'health': health_score,
                'robustness': robust_score
            }
            if fairness_evaluated:
                component_scores_raw['fairness'] = fair_score
            
            # Check for non-compensatory failures (any score below mode-specific threshold)
            non_compensatory_failures = [
                (name, score) for name, score in component_scores_raw.items()
                if score < self.guard_threshold
            ]
            
            non_compensatory_override = len(non_compensatory_failures) > 0
            if non_compensatory_override:
                failure_details = ", ".join([f"{n}={s:.4f}" for n, s in non_compensatory_failures])
                self.logger.warning(f"⚠️  NON-COMPENSATORY GUARD TRIGGERED: {failure_details} < {self.guard_threshold}")
            
            # ============================================
            # STEP 7: Generate Flags, Recommendations, Verdict
            # ============================================
            
            flags = self._generate_flags(metrics, dataset_stats, train_metrics, model_type, dii_score, dp_value, delta_value, fairness_evaluated)
            recommendations = self._generate_recommendations(flags, metrics, dataset_stats, dii_score, dp_value, delta_value, fairness_evaluated)
            verdict = self._generate_verdict(trust_score, flags, non_compensatory_override, non_compensatory_failures, fairness_evaluated)
            
            # ============================================
            # STEP 8: Validate Mathematical Integrity
            # ============================================
            
            self._validate_integrity(
                component_scores_raw, beta_final, trust_score, dii_score, dp_value, delta_value
            )
            
            # ============================================
            # STEP 9: Structured Summary Log
            # ============================================
            
            summary = {
                "trust_mode": self.trust_mode,
                "trust_score": round(trust_score, 2),
                "trust_score_raw": round(trust_score_raw, 2),
                "P": round(perf_score, 4), "H": round(health_score, 4),
                "F": round(fair_score, 4), "R": round(robust_score, 4),
                "DII": round(dii_score, 4),
                "dii_formula": "multiplicative" if self.trust_mode == TRUST_MODE_STRICT else "additive_weighted",
                "lambda": round(lambda_value, 4),
                "lambda_raw": round(raw_lambda, 4),
                "lambda_cap": self.lambda_cap,
                "lambda_formula": f"DII^{STRICT_LAMBDA_POWER}" if self.trust_mode == TRUST_MODE_STRICT else "DII",
                "amplification_power": STRICT_AMPLIFICATION_POWER if amplification_applied else None,
                "beta_auto": {k: round(v, 4) for k, v in beta_auto.items()},
                "beta_final": {k: round(v, 4) for k, v in beta_final.items()},
                "guard_threshold": self.guard_threshold,
                "guard_triggered": non_compensatory_override,
                "global_penalty_applied": global_penalty_applied,
                "instability_penalty_value": round(instability_penalty_value, 4)
            }
            self.logger.info(f"📋 SUMMARY: {summary}")
            
            # ============================================
            # STEP 10: Compile Full Result
            # ============================================
            
            return {
                # Primary output
                "meta_score": round(trust_score, 2),  # Keep backward compatibility
                "trust_score": round(trust_score, 2),
                "trust_score_raw": round(trust_score_raw, 2),  # Before global penalty
                
                # Trust mode configuration
                "trust_mode": self.trust_mode,
                
                # Component scores (all normalized to [0,1] -> display as 0-100)
                "performance_score": round(perf_score * 100, 2),
                "dataset_health_score": round(health_score * 100, 2),
                "fairness_score": round(fair_score * 100, 2),
                "robustness_score": round(robust_score * 100, 2),
                
                # Raw normalized values [0,1]
                "component_scores": {
                    "performance": round(perf_score, 4),
                    "health": round(health_score, 4),
                    "fairness": round(fair_score, 4),  # 0.5 (neutral) if not evaluated
                    "robustness": round(robust_score, 4)
                },
                
                # Fairness evaluation status
                "fairness_evaluated": fairness_evaluated,  # True if real fairness data exists
                "fairness_available": fairness_evaluated,  # Legacy alias
                
                # Risk metrics
                "DII": round(dii_score, 4),
                "dii_formula": "multiplicative" if self.trust_mode == TRUST_MODE_STRICT else "additive_weighted",
                "dii_components": {k: round(v, 4) for k, v in dii_components.items() if isinstance(v, (int, float))},
                "risk_values": {
                    "DP": round(dp_value, 4),
                    "delta": round(delta_value, 4),
                    "r_P": round(r_P, 4),
                    "r_H": round(r_H, 4),
                    "r_F": round(r_F, 4) if r_F is not None else None,
                    "r_F_display": "Excluded" if not fairness_evaluated else round(r_F, 4),
                    "r_R": round(r_R, 4),
                    "total": round(risk_sum, 4),
                    "amplification_applied": amplification_applied,
                    "amplification_power": STRICT_AMPLIFICATION_POWER if amplification_applied else None,
                    "fairness_excluded": not fairness_evaluated
                },
                
                # Weight information
                "lambda_value": round(lambda_value, 4),
                "lambda_raw": round(raw_lambda, 4),  # Before capping
                "lambda_cap": self.lambda_cap,
                "lambda_formula": f"DII^{STRICT_LAMBDA_POWER}" if self.trust_mode == TRUST_MODE_STRICT else "DII",
                "beta_auto": {k: round(v, 4) for k, v in beta_auto.items()},
                "hybrid_weights": {k: round(v, 4) for k, v in beta_final.items()},
                "user_weights": user_w,
                
                # Global instability penalty (strict mode)
                "global_penalty_applied": global_penalty_applied,
                "instability_penalty_coefficient": self.instability_penalty,
                "instability_penalty_value": round(instability_penalty_value, 4),
                
                # Non-compensatory guard info
                "guard_threshold": self.guard_threshold,
                "non_compensatory_override": non_compensatory_override,
                "non_compensatory_failures": [
                    {"component": n, "score": round(s, 4)} for n, s in non_compensatory_failures
                ],
                
                # Legacy compatibility
                "primary_metric_normalized": round(perf_score * 100, 2),
                "model_complexity_adjustment": round(-delta_value * 100, 2),
                
                # Analysis outputs
                "flags": flags,
                "recommendations": recommendations,
                "verdict": verdict,
                
                # Score breakdown for UI
                "breakdown": {
                    "performance_contribution": round(beta_final['performance'] * perf_score * 100, 2),
                    "health_contribution": round(beta_final['health'] * health_score * 100, 2),
                    "fairness_contribution": round(beta_final['fairness'] * fair_score * 100, 2),
                    "robustness_contribution": round(beta_final['robustness'] * robust_score * 100, 2)
                }
            }
            
        except Exception as e:
            self.logger.error(f"Meta evaluation failed: {e}")
            raise
    
    def _clip(self, value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
        """Clip value to [min_val, max_val] range for stability"""
        return max(min_val, min(max_val, float(value)))
    
    def _safe_divide(self, numerator: float, denominator: float, default: float = 0.0) -> float:
        """Safe division handling zero denominator"""
        return numerator / denominator if abs(denominator) > 1e-10 else default
    
    def _apply_min_floor(self, weights: Dict[str, float], floor: float = 0.05) -> Dict[str, float]:
        """
        Apply minimum floor to weights and renormalize.
        
        Prevents "perfect" components (zero risk) from having zero weight,
        ensuring they still contribute to the trust score calculation.
        
        Args:
            weights: Dictionary of component weights
            floor: Minimum weight for each component (default 5%)
        
        Returns:
            Weights with floor applied and normalized to sum to 1.0
        """
        # Apply floor
        floored = {k: max(v, floor) for k, v in weights.items()}
        
        # Renormalize to sum to 1.0
        total = sum(floored.values())
        if total > EPSILON:
            floored = {k: v / total for k, v in floored.items()}
        
        return floored
    
    def _apply_min_floor_active(
        self,
        weights: Dict[str, float],
        floor: float,
        active_components: set
    ) -> Dict[str, float]:
        """
        Apply minimum floor only to active components and renormalize.
        
        Inactive components (e.g., excluded fairness) remain at 0.
        
        Args:
            weights: Dictionary of component weights
            floor: Minimum weight for active components (default 5%)
            active_components: Set of component names to include
        
        Returns:
            Weights with floor applied to active components, normalized to sum to 1.0
        """
        # Apply floor only to active components
        floored = {}
        for k, v in weights.items():
            if k in active_components:
                floored[k] = max(v, floor)
            else:
                floored[k] = 0.0  # Excluded component stays at 0
        
        # Renormalize only active components to sum to 1.0
        active_total = sum(floored[k] for k in active_components)
        if active_total > EPSILON:
            for k in active_components:
                floored[k] = floored[k] / active_total
        
        return floored
    
    def _calculate_performance_score(self, metrics: Dict[str, Any], model_type: str) -> float:
        """
        Calculate normalized Performance Score P [0,1]
        
        Classification: Uses F1 (preferred) or accuracy
        Regression: Uses R² (clipped at 0)
        
        All metrics normalized to [0,1] benefit-type (higher = better)
        """
        if model_type == "classification":
            # Prefer F1, fallback to accuracy
            if 'f1_score' in metrics:
                return self._clip(metrics['f1_score'])
            elif 'accuracy' in metrics:
                return self._clip(metrics['accuracy'])
            else:
                return 0.5  # Unknown default
        
        elif model_type == "regression":
            if 'r2_score' in metrics:
                # R² can be negative, clip to [0,1]
                return self._clip(max(0.0, metrics['r2_score']))
            elif 'mse' in metrics:
                # MSE is cost-type: convert using 1/(1+MSE)
                mse = metrics.get('mse', 1.0)
                return 1.0 / (1.0 + mse)
            else:
                return 0.5
        
        return 0.5
    
    def _calculate_dii(self, stats: Dict[str, Any]) -> Tuple[float, Dict[str, float]]:
        """
        Calculate Dataset Instability Index (DII)
        
        Balanced Mode (additive):
            DII = (I + M + D + S) / 4
        
        Strict Mode (multiplicative risk amplification):
            DII = 1 - ((1-I) * (1-M) * (1-D) * (1-S))
            This causes DII to escalate faster when multiple risks are present.
        
        Each component normalized to [0,1]
        Higher DII = more unstable dataset = more automatic weight control
        
        Returns:
            Tuple of (DII value, component breakdown dict)
        """
        n_rows = max(1, stats.get('n_rows', 1))
        n_features = max(1, stats.get('n_features', 1))
        
        # Component 1: Imbalance ratio normalized (I)
        # imbalance_ratio of 0.5 is perfectly balanced -> 0 instability
        # imbalance_ratio of 1.0 is completely unbalanced -> 1 instability
        imbalance_ratio = stats.get('imbalance_ratio', 0.5)
        # Transform: distance from 0.5, scaled to [0,1]
        imbalance_norm = min(1.0, abs(imbalance_ratio - 0.5) * 2)
        
        # Component 2: Missing value ratio (M)
        missing_values = stats.get('missing_values', 0)
        total_cells = n_rows * n_features
        missing_ratio = missing_values / total_cells if total_cells > 0 else 0.0
        missing_ratio = self._clip(missing_ratio)
        
        # Component 3: Duplicate ratio (D)
        duplicate_ratio = stats.get('duplicate_ratio', 0.0)
        duplicate_ratio = self._clip(duplicate_ratio)
        
        # Component 4: Skewness score (S)
        skew_score = stats.get('skew_score', 0.0)
        if skew_score == 0.0:
            # Estimate from low_variance_fraction as proxy
            low_var = stats.get('low_variance_fraction', 0.0)
            skew_score = self._clip(low_var)
        else:
            skew_score = self._clip(skew_score)
        
        # Calculate DII based on trust mode
        if self.trust_mode == TRUST_MODE_STRICT:
            # Multiplicative formula: DII = 1 - (1-I)(1-M)(1-D)(1-S)
            # This amplifies when multiple risks are present
            dii = 1.0 - (
                (1.0 - imbalance_norm) *
                (1.0 - missing_ratio) *
                (1.0 - duplicate_ratio) *
                (1.0 - skew_score)
            )
            dii_formula = "multiplicative"
            self.logger.info(f"⚡ STRICT MODE: Using multiplicative DII formula")
        else:
            # Balanced mode: Weighted average (M most impactful, S least)
            dii = 0.35 * missing_ratio + 0.30 * imbalance_norm + 0.20 * duplicate_ratio + 0.15 * skew_score
            dii_formula = "additive_weighted"
        
        dii = round(float(self._clip(dii)), 4)
        
        # Return keys matching frontend expectations (I, M, D, S)
        components = {
            'imbalance': imbalance_norm,
            'missing': missing_ratio,
            'duplicates': duplicate_ratio,
            'skew': skew_score,
            'formula': dii_formula
        }
        
        self.logger.info(f"📉 DII Components: I={imbalance_norm:.3f}, M={missing_ratio:.3f}, D={duplicate_ratio:.3f}, S={skew_score:.3f}")
        
        return dii, components
    
    def _calculate_fairness_score(self, fairness_result: Optional[Dict[str, Any]]) -> Tuple[float, float, bool]:
        """
        Calculate Fairness Score F and Demographic Parity difference DP
        
        F = 1 - DP (higher F = more fair)
        DP = |prob_positive_group0 - prob_positive_group1|
        
        When fairness is not evaluated (no sensitive attribute), returns neutral values:
        - F = 0.5 (neither good nor bad)
        - DP = 0.5 (neutral risk)
        - fairness_evaluated = False
        
        Returns:
            Tuple of (F score [0,1], DP value [0,1], fairness_evaluated bool)
        """
        if not fairness_result or not fairness_result.get('analysis_successful'):
            # No fairness data - return neutral values (0.5 = agnostic)
            # This ensures fairness component has neutral weight contribution
            # rather than being either "perfect" (1.0) or "risky" (0.0)
            self.logger.info("⚖️  No fairness data available, using neutral values (F=0.5, fairness_evaluated=False)")
            return 0.5, 0.5, False
        
        fairness_metrics = fairness_result.get('fairness_metrics', {})
        
        # Get demographic parity difference (already computed in fairness engine)
        dp = fairness_metrics.get('demographic_parity_difference', 0.0)
        dp = self._clip(dp)
        
        # F = 1 - DP (convert difference to score)
        f_score = 1.0 - dp
        f_score = self._clip(f_score)
        
        self.logger.info(f"⚖️  Fairness evaluated: DP={dp:.4f}, F={f_score:.4f}")
        
        return f_score, dp, True
    
    def _calculate_robustness_score(
        self,
        test_metrics: Dict[str, Any],
        train_metrics: Optional[Dict[str, Any]],
        model_type: str
    ) -> Tuple[float, float]:
        """
        Calculate Generalization Stability Score R and performance degradation delta
        
        This score measures the model's generalization stability between train and
        test performance. A high R indicates the model generalizes well without
        significant performance degradation on unseen data.
        
        Note: Also referred to as "robustness_score" in API for backward compatibility.
        
        delta = |perf_train - perf_test| / perf_train (normalized degradation)
        R = 1 - delta
        
        Returns:
            Tuple of (R score [0,1], delta value [0,1])
        """
        if train_metrics:
            # Use train-test gap as robustness measure
            if model_type == "classification":
                train_perf = train_metrics.get('f1_score', train_metrics.get('accuracy', 1.0))
                test_perf = test_metrics.get('f1_score', test_metrics.get('accuracy', 1.0))
            else:
                train_perf = train_metrics.get('r2_score', 1.0)
                test_perf = test_metrics.get('r2_score', 1.0)
            
            # delta = |train - test| / train (normalized degradation)
            if abs(train_perf) > 1e-10:
                delta = abs(train_perf - test_perf) / abs(train_perf)
            else:
                delta = abs(train_perf - test_perf)
            
            delta = self._clip(delta)
        else:
            # No train metrics - estimate robustness from test metric variance
            # Use precision-recall gap as proxy for classification
            if model_type == "classification":
                precision = test_metrics.get('precision', 0.5)
                recall = test_metrics.get('recall', 0.5)
                # Large precision-recall gap indicates instability
                delta = abs(precision - recall) * 0.5  # Scale down
            else:
                # For regression, check if R² is much lower than MAE suggests
                r2 = test_metrics.get('r2_score', 0.5)
                # Low R² can indicate prediction instability
                delta = (1.0 - max(0.0, r2)) * 0.3  # Scaled estimate
            
            delta = self._clip(delta)
        
        # R = 1 - delta
        r_score = 1.0 - delta
        r_score = self._clip(r_score)
        
        self.logger.info(f"🛡️  Robustness: delta={delta:.4f}, R={r_score:.4f}")
        
        return r_score, delta
    
    def _generate_flags(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        train_metrics: Optional[Dict[str, Any]],
        model_type: str,
        dii: float,
        dp: float,
        delta: float,
        fairness_evaluated: bool = True
    ) -> List[str]:
        """
        Generate warning flags based on component analysis
        """
        flags: List[str] = []
        
        # Fairness evaluation status - CRITICAL flag if not evaluated
        if not fairness_evaluated:
            flags.append("fairness_unverified")
        
        # DII-based flags (Dataset Instability)
        if dii > 0.7:
            flags.append("critical_dataset_instability")
        elif dii > 0.5:
            flags.append("high_dataset_instability")
        elif dii > 0.3:
            flags.append("moderate_dataset_instability")
        
        # Fairness flags (only apply if fairness was evaluated)
        if fairness_evaluated:
            if dp > 0.3:
                flags.append("severe_fairness_violation")
            elif dp > 0.2:
                flags.append("significant_bias_detected")
            elif dp > 0.1:
                flags.append("mild_bias_detected")
        
        # Robustness flags
        if delta > 0.3:
            flags.append("severe_overfitting")
        elif delta > 0.2:
            flags.append("significant_overfitting")
        elif delta > 0.1:
            flags.append("mild_overfitting")
        
        # Dataset-specific flags
        missing_ratio = dataset_stats.get('missing_values', 0) / max(1, dataset_stats.get('n_rows', 1) * dataset_stats.get('n_features', 1))
        if missing_ratio > 0.1:
            flags.append("high_missing_values")
        
        imbalance = dataset_stats.get('imbalance_ratio', 0.5)
        if imbalance > 0.8:
            flags.append("severe_class_imbalance")
        elif imbalance > 0.7:
            flags.append("moderate_class_imbalance")
        
        if dataset_stats.get('n_rows', 0) < 100:
            flags.append("small_sample_size")
        
        low_var = dataset_stats.get('low_variance_fraction', 0)
        if low_var > 0.3:
            flags.append("many_low_variance_features")
        
        # Performance flags
        if model_type == "classification":
            precision = metrics.get('precision', 0)
            recall = metrics.get('recall', 0)
            
            if abs(precision - recall) > 0.15:
                flags.append("precision_recall_imbalance")
            
            accuracy = metrics.get('accuracy', 0)
            if accuracy < 0.6:
                flags.append("critical_low_accuracy")
            elif accuracy < 0.7:
                flags.append("low_accuracy")
        
        elif model_type == "regression":
            r2 = metrics.get('r2_score', 0)
            if r2 < 0:
                flags.append("negative_r2_warning")
            elif r2 < 0.3:
                flags.append("critical_low_r2")
            elif r2 < 0.5:
                flags.append("low_r2_score")
        
        return flags
    
    def _generate_recommendations(
        self,
        flags: List[str],
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        dii: float,
        dp: float,
        delta: float,
        fairness_evaluated: bool = True
    ) -> List[Dict[str, str]]:
        """
        Generate actionable recommendations based on trust component analysis
        """
        recommendations: List[Dict[str, str]] = []
        
        # Fairness unverified - critical recommendation
        if not fairness_evaluated:
            recommendations.append({
                "action": "Add sensitive attribute to dataset for fairness evaluation",
                "why": "Fairness was not evaluated (F=0.5 is a neutral placeholder). "
                       "Trust score may be inflated without verifying model does not discriminate.",
                "priority": "high",
                "component": "fairness"
            })
        
        # DII-based recommendations
        if dii > 0.5:
            recommendations.append({
                "action": "Improve dataset quality before trusting model predictions",
                "why": f"High Dataset Instability Index ({dii:.2f}) indicates unreliable data foundation",
                "priority": "critical",
                "component": "health"
            })
        
        # Fairness recommendations (only if evaluated)
        if fairness_evaluated:
            if dp > 0.2:
                recommendations.append({
                    "action": "Apply fairness interventions (reweighting, adversarial debiasing)",
                    "why": f"Demographic parity difference ({dp:.2f}) exceeds acceptable threshold",
                    "priority": "high",
                    "component": "fairness"
                })
            elif dp > 0.1:
                recommendations.append({
                    "action": "Monitor fairness metrics and consider bias mitigation",
                    "why": f"Mild bias detected (DP={dp:.2f})",
                    "priority": "medium",
                    "component": "fairness"
                })
        
        # Robustness recommendations
        if delta > 0.2:
            recommendations.append({
                "action": "Apply regularization or increase training data to reduce overfitting",
                "why": f"Performance degradation ({delta:.2f}) indicates overfitting",
                "priority": "high",
                "component": "robustness"
            })
        
        # Flag-based recommendations
        flag_recommendations = {
            "high_missing_values": {
                "action": "Handle missing values with imputation or removal",
                "why": "Missing values can bias model predictions and reduce trust",
                "priority": "high",
                "component": "health"
            },
            "severe_class_imbalance": {
                "action": "Apply SMOTE, class weighting, or undersampling",
                "why": "Severe imbalance leads to biased predictions",
                "priority": "high",
                "component": "health"
            },
            "moderate_class_imbalance": {
                "action": "Consider stratified sampling or cost-sensitive learning",
                "why": "Moderate imbalance may affect minority class performance",
                "priority": "medium",
                "component": "health"
            },
            "small_sample_size": {
                "action": "Collect more data or use data augmentation",
                "why": "Small datasets lead to unreliable trust estimates",
                "priority": "high",
                "component": "health"
            },
            "many_low_variance_features": {
                "action": "Remove or transform low-variance features",
                "why": "Low variance features don't contribute to predictions",
                "priority": "low",
                "component": "health"
            },
            "precision_recall_imbalance": {
                "action": "Adjust classification threshold or rebalance classes",
                "why": "Imbalanced precision/recall indicates prediction bias",
                "priority": "medium",
                "component": "performance"
            },
            "low_accuracy": {
                "action": "Try hyperparameter tuning or feature engineering",
                "why": "Low accuracy reduces overall trust",
                "priority": "high",
                "component": "performance"
            },
            "critical_low_accuracy": {
                "action": "Redesign model architecture or collect better features",
                "why": "Critical accuracy issues make model unreliable",
                "priority": "critical",
                "component": "performance"
            },
            "low_r2_score": {
                "action": "Feature engineering or try different model architecture",
                "why": "Low R² indicates poor fit to data",
                "priority": "high",
                "component": "performance"
            },
            "negative_r2_warning": {
                "action": "Review model and data - model performs worse than baseline",
                "why": "Negative R² means model is worse than predicting mean",
                "priority": "critical",
                "component": "performance"
            }
        }
        
        for flag in flags:
            if flag in flag_recommendations:
                recommendations.append(flag_recommendations[flag])
        
        # Add positive recommendation if everything looks good
        if len(recommendations) == 0:
            recommendations.append({
                "action": "Model shows good trust characteristics across all dimensions",
                "why": "Continue monitoring trust metrics in production",
                "priority": "low",
                "component": "all"
            })
        
        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        recommendations.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 3))
        
        return recommendations
    
    def _generate_verdict(
        self,
        trust_score: float,
        flags: List[str],
        non_compensatory_override: bool = False,
        non_compensatory_failures: Optional[List[Tuple[str, float]]] = None,
        fairness_evaluated: bool = True
    ) -> Dict[str, Any]:
        """
        Generate final verdict based on trust score and flags
        
        Args:
            trust_score: Computed trust score [0-100]
            flags: List of warning/issue flags
            non_compensatory_override: If True, any component fell below threshold
            non_compensatory_failures: List of (component_name, score) that failed
            fairness_evaluated: If False, append "(Fairness Unverified)" to message
        """
        # NON-COMPENSATORY GUARD: Override to High Risk if any component critically low
        if non_compensatory_override:
            failure_list = non_compensatory_failures or []
            failure_details = ", ".join([f"{n}={s:.2f}" for n, s in failure_list])
            return {
                "status": "high_risk",
                "message": f"🚨 HIGH RISK - Critical component failure: {failure_details}" + ("" if fairness_evaluated else " (Fairness Unverified)"),
                "confidence": round(trust_score, 2),
                "critical_issues": len(failure_list),
                "total_issues": len(flags),
                "trust_level": "critical",
                "non_compensatory_triggered": True,
                "fairness_evaluated": fairness_evaluated
            }
        
        critical_flags = [f for f in flags if any(
            x in f for x in ['severe', 'critical', 'negative']
        )]
        
        if trust_score >= 85 and len(critical_flags) == 0:
            status = "high_trust"
            if fairness_evaluated:
                message = "✅ HIGH TRUST - Production ready"
            else:
                message = "✅ HIGH TRUST - Production ready — run fairness audit first"
        elif trust_score >= 70 and len(critical_flags) == 0:
            status = "moderate_trust"
            if fairness_evaluated:
                message = "✅ MODERATE TRUST - Production ready with monitoring"
            else:
                message = "✅ MODERATE TRUST - Production ready with monitoring — run fairness audit first"
        elif trust_score >= 50:
            status = "low_trust"
            message = "⚠️ LOW TRUST - Improvements needed before production"
        else:
            status = "untrusted"
            message = "❌ UNTRUSTED - Do not deploy"
        
        # Override if critical issues exist
        if len(critical_flags) > 0:
            if status in ["high_trust", "moderate_trust"]:
                status = "conditional_trust"
                message = "⚠️ CONDITIONAL TRUST - Critical issues must be addressed"
        
        # Append fairness unverified suffix if applicable
        fairness_tag = "" if fairness_evaluated else " (Fairness Unverified)"
        message = f"{message}{fairness_tag}"
        
        return {
            "status": status,
            "message": message,
            "confidence": round(trust_score, 2),
            "critical_issues": len(critical_flags),
            "total_issues": len(flags),
            "trust_level": self._get_trust_level(trust_score),
            "non_compensatory_triggered": False,
            "fairness_evaluated": fairness_evaluated
        }
    
    def _get_trust_level(self, score: float) -> str:
        """Convert numeric trust score to categorical level"""
        if score >= 90:
            return "excellent"
        elif score >= 80:
            return "good"
        elif score >= 70:
            return "acceptable"
        elif score >= 50:
            return "questionable"
        else:
            return "poor"
    
    def _validate_integrity(
        self,
        component_scores: Dict[str, float],
        weights: Dict[str, float],
        trust_score: float,
        dii_score: float,
        dp_value: float,
        delta_value: float
    ) -> None:
        """
        Validate mathematical integrity of all computed values.
        
        Raises AssertionError if any invariant is violated, which indicates
        a bug in the computation logic.
        
        Invariants checked:
        - All component scores ∈ [0,1]
        - All weights ∈ [0,1] and sum to 1
        - Trust score ∈ [0,100]
        - DII, DP, delta ∈ [0,1]
        - No NaN or inf values
        """
        import math
        
        # Check component scores
        for name, score in component_scores.items():
            assert not math.isnan(score) and not math.isinf(score), \
                f"Component {name} has invalid value: {score}"
            assert 0.0 <= score <= 1.0, \
                f"Component {name} out of range [0,1]: {score}"
        
        # Check weights
        for name, weight in weights.items():
            assert not math.isnan(weight) and not math.isinf(weight), \
                f"Weight {name} has invalid value: {weight}"
            assert 0.0 <= weight <= 1.0, \
                f"Weight {name} out of range [0,1]: {weight}"
        
        weight_sum = sum(weights.values())
        assert abs(weight_sum - 1.0) < WEIGHT_TOLERANCE, \
            f"Weights do not sum to 1: {weight_sum}"
        
        # Check trust score
        assert not math.isnan(trust_score) and not math.isinf(trust_score), \
            f"Trust score has invalid value: {trust_score}"
        assert 0.0 <= trust_score <= 100.0, \
            f"Trust score out of range [0,100]: {trust_score}"
        
        # Check intermediate values
        for name, val in [("DII", dii_score), ("DP", dp_value), ("delta", delta_value)]:
            assert not math.isnan(val) and not math.isinf(val), \
                f"{name} has invalid value: {val}"
            assert 0.0 <= val <= 1.0, \
                f"{name} out of range [0,1]: {val}"
        
        self.logger.debug("✅ Mathematical integrity validated")
    
    def evaluate_multi_run(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        model_type: str = "classification",
        train_metrics: Optional[Dict[str, Any]] = None,
        fairness_result: Optional[Dict[str, Any]] = None,
        user_weights: Optional[Dict[str, float]] = None,
        n_runs: int = 10,
        random_seed_base: Optional[int] = None,
        stochastic: bool = True,
        sigma: float = DEFAULT_STOCHASTIC_SIGMA
    ) -> Dict[str, Any]:
        """
        Multi-run trust estimation with bootstrap-based stochastic CI calculation.
        
        When stochastic=True, adds small Gaussian perturbation to input metrics
        to simulate measurement uncertainty and produce meaningful confidence intervals.
        
        Args:
            metrics: Standard SMCP metrics dict
            dataset_stats: Dataset statistics for DII calculation
            model_type: 'classification' or 'regression'
            train_metrics: Optional training metrics for robustness
            fairness_result: Optional pre-computed fairness analysis
            user_weights: Optional user-specified component weights
            n_runs: Number of evaluation runs (default: 10)
            random_seed_base: Base seed for reproducibility (None = time-based)
            stochastic: If True, add Gaussian perturbation (default: True)
            sigma: Standard deviation for perturbation (default: 0.02)
        
        Returns:
            Dict with:
                - mean_trust: Mean trust score across runs
                - std_trust: Standard deviation of trust scores
                - ci_low: 95% CI lower bound
                - ci_high: 95% CI upper bound
                - n_runs: Number of runs performed
                - all_scores: List of individual trust scores
                - representative_result: Full result from median run
                - stochastic: Whether stochastic mode was active
                - sigma: Perturbation sigma used
        """
        import random
        import numpy as np
        from scipy import stats as scipy_stats
        import copy
        
        # Log stochastic configuration
        self.logger.info(f"🎲 Multi-run config: stochastic={stochastic}, sigma={sigma}")
        
        # Helper function to perturb a value with Gaussian noise
        def perturb_value(val: float, rng: np.random.RandomState) -> float:
            """Add Gaussian perturbation and clip to [0, 1]."""
            perturbed = val + rng.normal(0, sigma)
            return max(0.0, min(1.0, perturbed))
        
        # Set base seed for reproducibility
        if random_seed_base is not None:
            random.seed(random_seed_base)
            np.random.seed(random_seed_base)
            self.logger.info(f"🎲 Multi-run seeded with base: {random_seed_base}")
        
        trust_scores = []
        all_results = []
        
        # Performance metric keys to perturb (all expected to be in [0,1] range)
        perf_keys = ['accuracy', 'f1_score', 'precision', 'recall', 'r2_score']
        # Dataset stat keys to perturb
        stat_keys = ['imbalance_ratio', 'duplicate_ratio']
        
        for run_idx in range(n_runs):
            # Derive run-specific seed from base
            run_seed = (random_seed_base * 1000 + run_idx) if random_seed_base else (run_idx + 1) * 42
            rng = np.random.RandomState(run_seed)
            
            if stochastic:
                # Create perturbed copies of inputs
                perturbed_metrics = copy.deepcopy(metrics)
                perturbed_stats = copy.deepcopy(dataset_stats)
                perturbed_train = copy.deepcopy(train_metrics) if train_metrics else None
                perturbed_fairness = copy.deepcopy(fairness_result) if fairness_result else None
                
                # Perturb performance metrics
                for key in perf_keys:
                    if key in perturbed_metrics and isinstance(perturbed_metrics[key], (int, float)):
                        perturbed_metrics[key] = perturb_value(perturbed_metrics[key], rng)
                
                # Perturb regression metrics (mse, mae are error metrics, handle differently)
                # For error metrics, we perturb but keep them positive
                for key in ['mse', 'mae']:
                    if key in perturbed_metrics and isinstance(perturbed_metrics[key], (int, float)):
                        val = perturbed_metrics[key]
                        perturbed = val + rng.normal(0, sigma * val) if val > 0 else 0.0
                        perturbed_metrics[key] = max(0.0, perturbed)
                
                # Perturb dataset stats (DII components)
                for key in stat_keys:
                    if key in perturbed_stats and isinstance(perturbed_stats[key], (int, float)):
                        perturbed_stats[key] = perturb_value(perturbed_stats[key], rng)
                
                # Perturb skewness values (can be in any column stats)
                if 'column_stats' in perturbed_stats:
                    for col_name, col_data in perturbed_stats['column_stats'].items():
                        if isinstance(col_data, dict) and 'skewness' in col_data:
                            skew_val = col_data['skewness']
                            if isinstance(skew_val, (int, float)):
                                # Skewness can be any value, perturb proportionally
                                col_data['skewness'] = skew_val + rng.normal(0, sigma * max(1.0, abs(skew_val)))
                
                # Perturb train metrics if present
                if perturbed_train:
                    for key in perf_keys:
                        if key in perturbed_train and isinstance(perturbed_train[key], (int, float)):
                            perturbed_train[key] = perturb_value(perturbed_train[key], rng)
                
                # Perturb fairness DP if present
                if perturbed_fairness and perturbed_fairness.get('analysis_successful'):
                    fm = perturbed_fairness.get('fairness_metrics', {})
                    if 'demographic_parity_difference' in fm:
                        dp_val = fm['demographic_parity_difference']
                        if isinstance(dp_val, (int, float)):
                            # DP is typically in [0, 1], perturb and clip
                            fm['demographic_parity_difference'] = perturb_value(abs(dp_val), rng)
                
                # Use perturbed values for this run
                result = self.evaluate(
                    metrics=perturbed_metrics,
                    dataset_stats=perturbed_stats,
                    model_type=model_type,
                    train_metrics=perturbed_train,
                    fairness_result=perturbed_fairness,
                    user_weights=user_weights
                )
            else:
                # Deterministic mode - use original values
                result = self.evaluate(
                    metrics=metrics,
                    dataset_stats=dataset_stats,
                    model_type=model_type,
                    train_metrics=train_metrics,
                    fairness_result=fairness_result,
                    user_weights=user_weights
                )
            
            trust_scores.append(result["trust_score"])
            all_results.append(result)
        
        # Calculate statistics
        trust_scores_arr = np.array(trust_scores)
        mean_trust = float(np.mean(trust_scores_arr))
        std_trust = float(np.std(trust_scores_arr, ddof=1))  # Sample std
        
        # 95% Confidence Interval using t-distribution
        n = len(trust_scores_arr)
        if n > 1 and std_trust > 0:
            t_critical = scipy_stats.t.ppf(0.975, df=n-1)
            margin = t_critical * (std_trust / np.sqrt(n))
            ci_low = max(0.0, mean_trust - margin)
            ci_high = min(100.0, mean_trust + margin)
        else:
            margin = 0.0
            ci_low = ci_high = mean_trust
        
        # Confidence interval value (half-width)
        confidence_interval = max(0.0, margin)
        
        # Validate no NaN or inf in outputs
        import math as math_module
        for name, val in [("mean_trust", mean_trust), ("std_trust", std_trust), 
                          ("ci_low", ci_low), ("ci_high", ci_high), ("confidence_interval", confidence_interval)]:
            if math_module.isnan(val) or math_module.isinf(val):
                raise ValueError(f"Multi-run produced invalid {name}: {val}")
        
        # Find median run for representative result
        median_idx = int(np.argsort(trust_scores_arr)[n // 2])
        representative_result = all_results[median_idx]
        
        # Structured logging for multi-run
        multi_run_summary = {
            "trust_mode": self.trust_mode,
            "stochastic": stochastic,
            "sigma": sigma,
            "n_runs": n_runs,
            "mean_trust": round(mean_trust, 2),
            "std_trust": round(std_trust, 4),
            "confidence_interval": round(confidence_interval, 4),
            "lower_bound": round(ci_low, 2),
            "upper_bound": round(ci_high, 2),
            "trust_per_run": [round(s, 2) for s in trust_scores]
        }
        self.logger.info(f"📊 MULTI-RUN SUMMARY: {multi_run_summary}")
        
        return {
            # Primary outputs (requested naming)
            "trust_score_mean": round(mean_trust, 2),
            "confidence_interval": round(confidence_interval, 4),
            "lower_bound": round(ci_low, 2),
            "upper_bound": round(ci_high, 2),
            
            # Compatibility aliases
            "mean_trust": round(mean_trust, 2),
            "std_trust": round(std_trust, 4),
            "ci_low": round(ci_low, 2),
            "ci_high": round(ci_high, 2),
            
            # Run details
            "n_runs": n_runs,
            "all_scores": [round(s, 2) for s in trust_scores],
            "trust_per_run": [round(s, 2) for s in trust_scores],
            
            # Full result from representative (median) run
            "representative_result": representative_result,
            
            # Mode information
            "trust_mode": self.trust_mode,
            
            # Stochastic estimation parameters
            "stochastic": stochastic,
            "sigma": sigma
        }

    def evaluate_lambda_sensitivity(
        self,
        metrics: Dict[str, Any],
        dataset_stats: Dict[str, Any],
        model_type: str = "classification",
        train_metrics: Optional[Dict[str, Any]] = None,
        fairness_result: Optional[Dict[str, Any]] = None,
        user_weights: Optional[Dict[str, float]] = None,
        lambda_exponents: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate trust score sensitivity to lambda exponent choices.
        
        This function supports research ablation studies by computing trust scores
        under different lambda formulas:
            λ = DII^exponent
        
        for various exponent values. This allows researchers to understand how
        the choice of lambda exponent affects the final trust assessment.
        
        Research Motivation:
        -------------------
        The lambda parameter controls the balance between automatic (risk-based)
        weights and user-specified weights. Different exponent values produce
        different behaviors:
        - exponent = 1.0: Linear relationship (λ = DII)
        - exponent = 1.2: Mild convexity 
        - exponent = 1.5: Standard strict mode (moderate convexity)
        - exponent = 2.0: Strong convexity (aggressive automatic control)
        
        Args:
            metrics: Raw evaluation metrics (accuracy, f1, mse, etc.)
            dataset_stats: Dataset statistics (rows, missing, imbalance, etc.)
            model_type: 'classification' or 'regression'
            train_metrics: Optional training metrics for robustness check
            fairness_result: Optional fairness analysis results
            user_weights: Optional user preference weights
            lambda_exponents: List of exponent values to test (default: [1.0, 1.2, 1.5, 2.0])
        
        Returns:
            Dict containing:
                - results: Dict mapping exponent -> trust evaluation result
                - comparison: Summary comparison table
                - sensitivity_analysis: Statistical analysis of sensitivity
                - baseline_dii: The DII value used (affects all lambda values)
        
        Example:
            >>> sensitivity = meta_evaluator.evaluate_lambda_sensitivity(
            ...     metrics={'f1_score': 0.85},
            ...     dataset_stats={'n_rows': 1000, 'missing_values': 50, ...}
            ... )
            >>> print(sensitivity['comparison'])
        """
        import numpy as np
        
        if lambda_exponents is None:
            # Default ablation exponents for research
            lambda_exponents = [1.0, 1.2, 1.5, 2.0]
        
        # First, compute DII which is constant across all lambda variations
        dii_score, dii_components = self._calculate_dii(dataset_stats)
        
        results: Dict[float, Dict[str, Any]] = {}
        trust_scores: List[float] = []
        
        # Store original trust mode to restore later
        original_mode = self.trust_mode
        
        for exponent in lambda_exponents:
            # Compute lambda with this exponent
            lambda_value = min(self._clip(dii_score ** exponent), self.lambda_cap)
            
            # Create a temporary evaluator state for this lambda
            # We'll manually compute the trust score with this lambda
            
            # Get component scores (these don't depend on lambda)
            perf_score = self._clip(self._calculate_performance_score(metrics, model_type))
            health_score = self._clip(1.0 - dii_score)
            fair_score, dp_value, _fairness_evaluated = self._calculate_fairness_score(fairness_result)
            fair_score = self._clip(fair_score)
            robust_score, delta_value = self._calculate_robustness_score(metrics, train_metrics, model_type)
            robust_score = self._clip(robust_score)
            
            # Risk values (use strict mode amplification if original mode is strict)
            r_P = self._clip(1.0 - perf_score)
            r_H = self._clip(dii_score)
            r_F = self._clip(dp_value)
            r_R = self._clip(delta_value)
            
            if original_mode == TRUST_MODE_STRICT:
                r_P = self._clip(r_P ** STRICT_AMPLIFICATION_POWER)
                r_H = self._clip(r_H ** STRICT_AMPLIFICATION_POWER)
                r_F = self._clip(r_F ** STRICT_AMPLIFICATION_POWER)
                r_R = self._clip(r_R ** STRICT_AMPLIFICATION_POWER)
            
            risk_sum = r_P + r_H + r_F + r_R
            
            # Automatic weights
            if risk_sum > EPSILON:
                beta_auto = {
                    'performance': r_P / risk_sum,
                    'health': r_H / risk_sum,
                    'fairness': r_F / risk_sum,
                    'robustness': r_R / risk_sum
                }
            else:
                beta_auto = self.EQUAL_WEIGHTS.copy()
            
            # User weights
            user_w = user_weights if user_weights else self.DEFAULT_USER_WEIGHTS
            
            # Compute hybrid weights with this lambda
            beta_final: Dict[str, float] = {}
            for key in ['performance', 'health', 'fairness', 'robustness']:
                beta_final[key] = lambda_value * beta_auto[key] + (1.0 - lambda_value) * user_w.get(key, 0.25)
            
            # Renormalize
            weight_sum = sum(beta_final.values())
            if weight_sum > EPSILON:
                beta_final = {k: v / weight_sum for k, v in beta_final.items()}
            else:
                beta_final = self.EQUAL_WEIGHTS.copy()
            
            # Compute trust score
            trust_score_raw = 100.0 * (
                beta_final['performance'] * perf_score +
                beta_final['health'] * health_score +
                beta_final['fairness'] * fair_score +
                beta_final['robustness'] * robust_score
            )
            
            # Apply strict mode penalty if applicable
            if original_mode == TRUST_MODE_STRICT:
                trust_score = trust_score_raw * (1.0 - self.instability_penalty * dii_score)
            else:
                trust_score = trust_score_raw
            
            trust_score = max(0.0, min(100.0, trust_score))
            trust_scores.append(trust_score)
            
            results[exponent] = {
                'lambda_exponent': exponent,
                'lambda_value': round(lambda_value, 4),
                'trust_score': round(trust_score, 2),
                'trust_score_raw': round(trust_score_raw, 2),
                'hybrid_weights': {k: round(v, 4) for k, v in beta_final.items()},
                'component_scores': {
                    'performance': round(perf_score, 4),
                    'health': round(health_score, 4),
                    'fairness': round(fair_score, 4),
                    'robustness': round(robust_score, 4)
                }
            }
        
        # Compute sensitivity analysis
        trust_arr = np.array(trust_scores)
        sensitivity_range = float(trust_arr.max() - trust_arr.min())
        sensitivity_std = float(np.std(trust_arr))
        sensitivity_cv = float(sensitivity_std / np.mean(trust_arr)) if np.mean(trust_arr) > 0 else 0.0
        
        # Create comparison summary
        comparison = []
        for exp, res in results.items():
            comparison.append({
                'exponent': exp,
                'lambda': res['lambda_value'],
                'trust_score': res['trust_score'],
                'vs_baseline': round(res['trust_score'] - results.get(1.0, results[lambda_exponents[0]])['trust_score'], 2)
            })
        
        self.logger.info(f"🔬 Lambda sensitivity analysis complete: range={sensitivity_range:.2f}, std={sensitivity_std:.2f}")
        
        return {
            'results': results,
            'comparison': comparison,
            'sensitivity_analysis': {
                'score_range': round(sensitivity_range, 2),
                'score_std': round(sensitivity_std, 4),
                'coefficient_of_variation': round(sensitivity_cv, 4),
                'min_score': round(float(trust_arr.min()), 2),
                'max_score': round(float(trust_arr.max()), 2),
                'exponents_tested': lambda_exponents
            },
            'baseline_dii': round(dii_score, 4),
            'trust_mode': original_mode
        }


# Singleton instance
meta_evaluator = MetaEvaluator()
