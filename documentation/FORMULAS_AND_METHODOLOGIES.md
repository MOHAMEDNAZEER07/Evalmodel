# EvalModel - Formulas & Calculation Methodologies

This document provides a comprehensive reference for all mathematical formulas, scoring methodologies, and calculation pipelines used in EvalModel's Hybrid Trust Framework and SMCP (Standardized Model Comparison Pipeline).

---

## Table of Contents

1. [Hybrid Trust Framework Overview](#1-hybrid-trust-framework-overview)
2. [Component Score Calculations](#2-component-score-calculations)
3. [Risk Values](#3-risk-values)
4. [Hybrid Weight Calculation](#4-hybrid-weight-calculation)
5. [Trust Score Final Calculation](#5-trust-score-final-calculation)
6. [Non-Compensatory Guards](#6-non-compensatory-guards)
7. [SMCP EvalScore](#7-smcp-evalscore)
8. [Fairness Metrics](#8-fairness-metrics)
9. [Quick Reference Formula Sheet](#9-quick-reference-formula-sheet)

---

## 1. Hybrid Trust Framework Overview

The **Trust Score** is a unified reliability metric that aggregates four component scores using adaptive hybrid weighting:

```
Trust Score T = 100 × (β_P × P + β_H × H + β_F × F + β_R × R)
```

### Mathematical Guarantees

| Variable | Range | Description |
|----------|-------|-------------|
| T | [0, 100] | Final trust score |
| P, H, F, R | [0, 1] | Component scores |
| β_i | [0, 1] | Hybrid weights (Σβ = 1) |
| DII, DP, δ | [0, 1] | Risk indicators |

### Component Definitions

| Component | Symbol | Description |
|-----------|--------|-------------|
| Performance | P | Model prediction quality |
| Health | H | Dataset quality and stability |
| Fairness | F | Bias-free predictions |
| Robustness | R | Generalization stability |

---

## 2. Component Score Calculations

### 2.1 Performance Score (P)

Performance score measures the model's prediction quality on test data.

#### Classification Models

```
P = F1-score                    (preferred)
P = Accuracy                    (fallback if F1 unavailable)
```

**Where:**
- F1-score = `2 × (Precision × Recall) / (Precision + Recall)`
- Accuracy = `(TP + TN) / (TP + TN + FP + FN)`

#### Regression Models

```
P = max(0, R²)                  (if R² available)
P = 1 / (1 + MSE)               (if using MSE as fallback)
```

**Where:**
- R² (Coefficient of Determination) = `1 - (SS_res / SS_tot)`
- MSE (Mean Squared Error) = `Σ(y_true - y_pred)² / n`

---

### 2.2 Dataset Health Score (H)

Health score represents dataset quality, derived from the Dataset Instability Index (DII):

```
H = 1 - DII
```

#### DII (Dataset Instability Index)

DII measures dataset instability through four components:

| Component | Symbol | Calculation |
|-----------|--------|-------------|
| Imbalance | I | `|imbalance_ratio - 0.5| × 2` |
| Missing Values | M | `missing_values / (rows × features)` |
| Duplicates | D | `duplicate_rows / total_rows` |
| Skewness | S | `skew_score` or `low_variance_fraction` |

##### Balanced Mode (Additive)

```
DII = (I + M + D + S) / 4
```

##### Strict Mode (Multiplicative)

```
DII = 1 - (1 - I) × (1 - M) × (1 - D) × (1 - S)
```

**Note:** Multiplicative formula causes DII to escalate faster when multiple risks are present simultaneously.

---

### 2.3 Fairness Score (F)

Fairness score measures prediction equity across demographic groups:

```
F = 1 - DP
```

#### Demographic Parity (DP)

```
DP = |PPR_group0 - PPR_group1|
```

**Where:**
- PPR (Positive Prediction Rate) = `Positive Predictions / Total Predictions` per group

**Interpretation:**
- DP = 0 → Perfect demographic parity
- DP = 1 → Maximum disparity between groups

---

### 2.4 Robustness Score (R)

Robustness score (also called Generalization Stability Score) measures how well the model generalizes:

```
R = 1 - δ
```

#### Delta (δ) - Performance Degradation

##### With Training Metrics Available

```
δ = |perf_train - perf_test| / perf_train
```

**Where:**
- For classification: `perf = F1-score` or `Accuracy`
- For regression: `perf = R²`

##### Without Training Metrics (Estimated)

**Classification:**
```
δ = |Precision - Recall| × 0.5
```

**Regression:**
```
δ = (1 - max(0, R²)) × 0.3
```

---

## 3. Risk Values

Each component has an associated risk value representing potential model weakness:

| Risk | Symbol | Formula | Description |
|------|--------|---------|-------------|
| Performance Risk | r_P | `1 - P` | Lower performance = higher risk |
| Health Risk | r_H | `DII` | Dataset instability directly = risk |
| Fairness Risk | r_F | `DP` | Demographic disparity = risk |
| Robustness Risk | r_R | `δ` | Generalization gap = risk |

### Strict Mode Risk Amplification

In strict mode, all risk values are amplified using a power function:

```
r_i(strict) = r_i^1.5
```

This causes moderate risks to become more pronounced, encouraging stricter evaluation.

### Total Risk Sum

```
R_total = r_P + r_H + r_F + r_R
```

---

## 4. Hybrid Weight Calculation

The hybrid weighting system balances automatic risk-detection with user preferences.

### 4.1 Automatic Weights (Risk-Proportional)

Automatic weights are proportional to detected risks:

```
β_auto_i = r_i / Σr_j     (if Σr_j > ε)
β_auto_i = 0.25           (equal weights if risk sum ≈ 0)
```

**Interpretation:** Components with higher risk receive higher weight, focusing attention on weaknesses.

### 4.2 Lambda (λ) - Control Parameter

Lambda determines the balance between automatic and user-defined weights:

| Mode | Formula | Behavior |
|------|---------|----------|
| Balanced | `λ = DII` | Gradual automatic control |
| Strict | `λ = DII^1.5` | Faster escalation to automatic control |

**Lambda Cap:**
```
λ_final = min(λ, 0.85)
```

Cap ensures user preferences always retain at least 15% influence.

### 4.3 Final Hybrid Weights

```
β_i = λ × β_auto_i + (1 - λ) × user_weight_i
```

**Then renormalize:**
```
β_i(final) = β_i / Σβ_j
```

### Default User Weights

| Component | Default Weight |
|-----------|----------------|
| Performance | 0.40 |
| Health | 0.25 |
| Fairness | 0.20 |
| Robustness | 0.15 |

---

## 5. Trust Score Final Calculation

### Balanced Mode

```
T = 100 × Σ(β_i × S_i)

T = 100 × (β_P × P + β_H × H + β_F × F + β_R × R)
```

### Strict Mode (with Global Instability Penalty)

```
T_raw = 100 × Σ(β_i × S_i)
T = T_raw × (1 - 0.15 × DII)
```

**Global Instability Penalty:** Reduces overall trust when dataset instability is high, applied after weighted aggregation.

### Clipping

```
T_final = max(0, min(100, T))
```

---

## 6. Non-Compensatory Guards

Non-compensatory guards prevent high scores in some components from masking critical failures in others.

### Guard Thresholds

| Mode | Threshold |
|------|-----------|
| Balanced | 0.30 |
| Strict | 0.40 |

### Guard Logic

```python
if any(component_score < threshold):
    trigger_non_compensatory_override()
    override_verdict_to_warning()
```

**When Triggered:**
- Verdict is overridden to indicate critical weakness
- Trust score remains calculated but interpretation changes
- Recommendations are generated for failing components

---

## 7. SMCP EvalScore

The SMCP EvalScore provides a standardized 0-100 evaluation metric independent of the trust framework.

### Classification Metric Weights

| Metric | Weight |
|--------|--------|
| Accuracy | 0.25 |
| Precision | 0.25 |
| Recall | 0.25 |
| F1-Score | 0.25 |

### Regression Metric Weights

| Metric | Weight | Normalization |
|--------|--------|---------------|
| R² | 0.40 | Direct (higher is better) |
| MAE | 0.30 | `1 / (1 + MAE)` |
| RMSE | 0.30 | `1 / (1 + RMSE)` |

### EvalScore Formula

```
EvalScore = 100 × Σ(weight_i × normalized_metric_i)
```

---

## 8. Fairness Metrics

Complete set of fairness metrics computed during analysis:

### Demographic Parity (Statistical Parity)

```
DP_diff = |PPR_group0 - PPR_group1|
Statistical_Parity = 1 - DP_diff
```

### Disparate Impact Ratio

```
DI = PPR_group1 / PPR_group0
```

**Interpretation:**
- DI = 1.0 → Equal impact
- DI < 0.8 → Potential adverse impact (80% rule)

### Equal Opportunity

```
EO_diff = |TPR_group0 - TPR_group1|
```

Where TPR = True Positive Rate = `TP / (TP + FN)`

### Equalized Odds

```
EqOdds = max(|TPR_group0 - TPR_group1|, |FPR_group0 - FPR_group1|)
```

Where FPR = False Positive Rate = `FP / (FP + TN)`

### Predictive Parity

```
PP = 1 - |Precision_group0 - Precision_group1|
```

### Group-Level Metrics

For each demographic group:

| Metric | Formula |
|--------|---------|
| TPR (Recall) | `TP / (TP + FN)` |
| FPR | `FP / (FP + TN)` |
| PPR | `(TP + FP) / Total` |
| Precision | `TP / (TP + FP)` |

---

## 9. Quick Reference Formula Sheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRUST SCORE CALCULATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  T = 100 × (β_P × P + β_H × H + β_F × F + β_R × R)                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  COMPONENT SCORES                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  P = F1 or Accuracy (classification)                                │
│  P = max(0, R²) (regression)                                        │
│                                                                     │
│  H = 1 - DII                                                        │
│                                                                     │
│  F = 1 - DP                                                         │
│                                                                     │
│  R = 1 - δ                                                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  DII (Dataset Instability Index)                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Balanced:  DII = (I + M + D + S) / 4                               │
│                                                                     │
│  Strict:    DII = 1 - (1-I)(1-M)(1-D)(1-S)                          │
│                                                                     │
│  Where:                                                             │
│    I = |imbalance_ratio - 0.5| × 2                                  │
│    M = missing_values / (rows × features)                           │
│    D = duplicate_ratio                                              │
│    S = skew_score or low_variance_fraction                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  HYBRID WEIGHTS                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  β_auto_i = r_i / Σr_j                                              │
│                                                                     │
│  λ = DII (balanced) or DII^1.5 (strict)                             │
│  λ = min(λ, 0.85)  ← cap                                            │
│                                                                     │
│  β_i = λ × β_auto_i + (1 - λ) × user_weight_i                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  RISK VALUES                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  r_P = 1 - P                                                        │
│  r_H = DII                                                          │
│  r_F = DP                                                           │
│  r_R = δ                                                            │
│                                                                     │
│  Strict mode: r_i = r_i^1.5                                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  STRICT MODE PENALTY                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  T_final = T × (1 - 0.15 × DII)                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  NON-COMPENSATORY GUARDS                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Balanced threshold: 0.30                                           │
│  Strict threshold:   0.40                                           │
│                                                                     │
│  If any(S_i < threshold) → Guard triggered                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Lambda Sensitivity Analysis

The `evaluate_lambda_sensitivity()` function supports research ablation studies by computing trust scores under different lambda formulas.

### Lambda Exponent Variations

```
λ = DII^exponent
```

| Exponent | Behavior | Use Case |
|----------|----------|----------|
| 1.0 | Linear (λ = DII) | Balanced, proportional |
| 1.2 | Mild convexity | Slightly conservative |
| 1.5 | Standard strict mode | Production conservative |
| 2.0 | Strong convexity | Aggressive automatic control |

### Mathematical Properties

For exponent γ > 1, the lambda function is **convex**:
```
d²(DII^γ)/dDII² = γ(γ-1) × DII^(γ-2) > 0
```

This convexity ensures that:
- Low DII values produce proportionally lower lambda
- High DII values rapidly increase automatic weight control

### Research Usage

```python
sensitivity = meta_evaluator.evaluate_lambda_sensitivity(
    metrics={'f1_score': 0.85},
    dataset_stats={'n_rows': 1000, 'missing_values': 50, ...},
    lambda_exponents=[1.0, 1.2, 1.5, 2.0]
)
```

Returns comparison of trust scores across exponent values, enabling ablation studies.

---

## 11. Mathematical Invariants (Enforced)

The following invariants are enforced via assertions:

| Invariant | Range | Enforcement |
|-----------|-------|-------------|
| Component scores (P, H, F, R) | [0, 1] | `_validate_integrity()` |
| Risk values (r_P, r_H, r_F, r_R) | [0, 1] | Clipping + assertion |
| Hybrid weights sum | = 1.0 ± 1e-6 | `_validate_integrity()` |
| Trust score | [0, 100] | Clipping + assertion |
| DII, DP, delta | [0, 1] | `_validate_integrity()` |

Violations raise `AssertionError` indicating implementation bugs.

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-02-25 | Initial documentation |
| 1.1 | 2026-02-25 | Added sensitivity analysis, mathematical invariants |

---

## References

- Source: `backend/app/services/meta_evaluator.py`
- Source: `backend/app/services/smcp_engine.py`
- Source: `backend/app/services/fairness.py`
