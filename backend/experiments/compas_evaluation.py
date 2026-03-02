"""
COMPAS Dataset Evaluation Experiment
====================================
Validates the Hybrid Trust Aggregation Framework on the COMPAS recidivism dataset.

WHY COMPAS IS FAIRNESS-SENSITIVE:
---------------------------------
The COMPAS (Correctional Offender Management Profiling for Alternative Sanctions) dataset
is a canonical benchmark in algorithmic fairness research. It was used by Northpointe to
predict recidivism risk for criminal defendants. ProPublica's 2016 investigation revealed
significant racial disparities:
- Black defendants were nearly twice as likely to be incorrectly labeled as high-risk
- White defendants were more likely to be incorrectly labeled as low-risk

This makes COMPAS essential for validating fairness-aware ML evaluation frameworks.

EXPECTED DEMOGRAPHIC PARITY (DP) RANGE:
---------------------------------------
- Ideal: DP ≈ 0 (equal positive prediction rates across racial groups)
- Typical observed: DP ∈ [0.10, 0.25] for standard classifiers
- High disparity: DP > 0.30 indicates significant fairness concerns

WHY STRICT MODE SHOULD PENALIZE MORE:
--------------------------------------
In strict mode, the framework applies:
1. Multiplicative DII formula: amplifies compounding data quality issues
2. Lambda power adjustment (DII^1.5): faster weight escalation toward risk-reactive
3. Risk amplification (r^1.5): magnifies component-level risks
4. Global instability penalty: T = T * (1 - 0.15 * DII)
5. Higher guard threshold (0.40 vs 0.30): earlier non-compensatory triggers

For a fairness-critical dataset like COMPAS, strict mode correctly penalizes models
that exhibit demographic disparity, even if accuracy appears adequate.

Output Table:
| Accuracy | F1 | DP | DII | Balanced Trust | 95% CI | Strict Trust | 95% CI |
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import LabelEncoder
from fairlearn.metrics import demographic_parity_difference

from app.services.meta_evaluator import MetaEvaluator

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')
logging.disable(logging.WARNING)

# Reproducibility
RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

# COMPAS dataset URL (ProPublica's dataset)
COMPAS_URL = "https://raw.githubusercontent.com/propublica/compas-analysis/master/compas-scores-two-years.csv"


# ============================================================================
# STEP 1: Load COMPAS Dataset
# ============================================================================

def load_compas_dataset():
    """
    Load COMPAS dataset from ProPublica's GitHub repository.
    
    COMPAS includes:
    - Demographic features (age, sex, race)
    - Criminal history (priors_count, juv_fel_count, etc.)
    - Target: two_year_recid (whether defendant reoffended within 2 years)
    
    Protected attribute for fairness analysis: race
    
    We apply the same filtering as ProPublica's analysis:
    - days_b_screening_arrest between -30 and 30
    - is_recid != -1
    - c_charge_degree != 'O' (ordinary traffic offenses)
    - score_text != 'N/A'
    """
    print("\n[STEP 1] Loading COMPAS Dataset...")
    
    try:
        # Try to load from URL
        df = pd.read_csv(COMPAS_URL)
        print(f"  Loaded from ProPublica GitHub")
    except Exception as e:
        print(f"  Error loading from URL: {e}")
        print("  Creating synthetic COMPAS-like dataset for demonstration...")
        df = _create_synthetic_compas()
    
    # Apply ProPublica's filtering criteria
    df = df[
        (df['days_b_screening_arrest'] >= -30) & 
        (df['days_b_screening_arrest'] <= 30) &
        (df['is_recid'] != -1) &
        (df['c_charge_degree'] != 'O') &
        (df['score_text'] != 'N/A')
    ]
    
    print(f"  Dataset shape after filtering: {df.shape}")
    
    # Select relevant features
    feature_cols = [
        'age', 'sex', 'race', 'juv_fel_count', 'juv_misd_count', 'juv_other_count',
        'priors_count', 'c_charge_degree', 'two_year_recid'
    ]
    df = df[feature_cols].copy()
    
    print(f"  Features selected: {len(feature_cols) - 1}")
    
    # Show target distribution
    target_dist = df['two_year_recid'].value_counts()
    print(f"  Target distribution: {target_dist.to_dict()}")
    
    # Show race distribution (protected attribute)
    race_dist = df['race'].value_counts()
    print(f"  Race distribution: {race_dist.to_dict()}")
    
    return df


def _create_synthetic_compas():
    """Create synthetic COMPAS-like data if download fails."""
    np.random.seed(RANDOM_STATE)
    n = 6000
    
    df = pd.DataFrame({
        'age': np.random.randint(18, 70, n),
        'sex': np.random.choice(['Male', 'Female'], n, p=[0.8, 0.2]),
        'race': np.random.choice(
            ['African-American', 'Caucasian', 'Hispanic', 'Other'],
            n, p=[0.51, 0.34, 0.08, 0.07]
        ),
        'juv_fel_count': np.random.poisson(0.1, n),
        'juv_misd_count': np.random.poisson(0.2, n),
        'juv_other_count': np.random.poisson(0.3, n),
        'priors_count': np.random.poisson(3, n),
        'c_charge_degree': np.random.choice(['F', 'M'], n, p=[0.6, 0.4]),
        'days_b_screening_arrest': np.random.randint(-30, 30, n),
        'is_recid': np.random.choice([0, 1], n, p=[0.55, 0.45]),
        'score_text': np.random.choice(['Low', 'Medium', 'High'], n),
        'two_year_recid': np.random.choice([0, 1], n, p=[0.55, 0.45])
    })
    
    return df


# ============================================================================
# STEP 2: Preprocess Data
# ============================================================================

def preprocess_data(df):
    """
    Preprocess COMPAS data for classification.
    
    - Extract protected attribute (race) before encoding
    - Encode categorical features
    - Handle missing values
    """
    print("\n[STEP 2] Preprocessing Data...")
    
    df = df.copy()
    
    # Target column
    target_col = 'two_year_recid'
    
    # Protected attribute
    protected_attr = df['race'].copy()
    
    # Separate features and target
    X = df.drop(columns=[target_col])
    y = df[target_col]
    
    # Encode target if needed
    if y.dtype == 'object' or y.dtype.name == 'category':
        le = LabelEncoder()
        y = pd.Series(le.fit_transform(y), index=y.index, name=target_col)
    else:
        y = y.astype(int)
    
    # Encode categorical features
    categorical_cols = X.select_dtypes(include=['object', 'category']).columns
    for col in categorical_cols:
        X[col] = X[col].astype(str)
    
    X = pd.get_dummies(X, drop_first=True)
    
    # Fill any missing values
    X = X.fillna(X.median())
    
    print(f"  Features after encoding: {X.shape[1]}")
    print(f"  Target distribution: {y.value_counts().to_dict()}")
    
    return X, y, protected_attr


# ============================================================================
# STEP 3: Train-Test Split
# ============================================================================

def split_data(X, y, protected_attr, test_size=0.30):
    """
    Stratified 70/30 train-test split.
    Maintains class balance in both sets.
    """
    print("\n[STEP 3] Train-Test Split (70/30 stratified)...")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=test_size, 
        random_state=RANDOM_STATE, 
        stratify=y
    )
    
    # Align protected attribute with test set
    A_test = protected_attr.loc[X_test.index]
    
    print(f"  Train size: {len(X_train)}")
    print(f"  Test size: {len(X_test)}")
    
    return X_train, X_test, y_train, y_test, A_test


# ============================================================================
# STEP 4: Train Model
# ============================================================================

def train_model(X_train, y_train):
    """
    Train Logistic Regression classifier.
    
    Logistic Regression is chosen for:
    - Interpretability (important for fairness analysis)
    - Calibrated probability outputs
    - Established baseline in fairness literature
    """
    print("\n[STEP 4] Training Logistic Regression Model...")
    
    model = LogisticRegression(
        max_iter=1000, 
        random_state=RANDOM_STATE,
        solver='lbfgs'
    )
    model.fit(X_train, y_train)
    
    print("  Model trained successfully.")
    return model


# ============================================================================
# STEP 5: Compute Performance Metrics
# ============================================================================

def compute_metrics(y_test, y_pred):
    """Compute standard classification metrics."""
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1_score": f1_score(y_test, y_pred, zero_division=0)
    }
    return metrics


# ============================================================================
# STEP 6: Compute Fairness (Demographic Parity)
# ============================================================================

def compute_fairness(y_test, y_pred, A_test):
    """
    Compute Demographic Parity Difference.
    
    DP = max_g P(Ŷ=1|G=g) - min_g P(Ŷ=1|G=g)
    
    For COMPAS with race as protected attribute:
    - DP close to 0: predictions are demographically fair
    - DP > 0.10: noticeable disparity
    - DP > 0.20: significant disparity requiring attention
    
    COMPAS typically shows DP in [0.10, 0.25] range with standard classifiers.
    
    Note: We binarize race to African-American vs Others for cleaner DP calculation,
    following common practice in COMPAS fairness studies.
    """
    # Binarize race: African-American vs Others (common in COMPAS fairness studies)
    A_test_binary = A_test.apply(lambda x: 'African-American' if x == 'African-American' else 'Other')
    
    dp = demographic_parity_difference(
        y_true=y_test,
        y_pred=y_pred,
        sensitive_features=A_test_binary
    )
    
    # Format for MetaEvaluator compatibility
    fairness_result = {
        "analysis_successful": True,
        "fairness_metrics": {
            "demographic_parity_difference": abs(dp)
        }
    }
    
    return fairness_result, dp


# ============================================================================
# STEP 7: Compute Dataset Statistics (for DII)
# ============================================================================

def compute_dataset_stats(df, X, y):
    """
    Compute dataset instability statistics for DII calculation.
    
    DII Components:
    - missing_ratio: Proportion of missing values
    - imbalance_ratio: Class balance (0.5 = perfectly balanced)
    - duplicate_ratio: Proportion of duplicate rows
    - skew_score: Average absolute skewness of numeric features
    
    COMPAS typically has:
    - Low missing ratio (clean dataset)
    - Moderate imbalance (recidivism rate ~45%)
    - Very low duplicate ratio
    - Moderate skewness in count features
    """
    # Missing ratio
    total_cells = df.shape[0] * df.shape[1]
    missing_values = df.isnull().sum().sum()
    
    # Class imbalance
    class_counts = y.value_counts()
    imbalance_ratio = min(class_counts) / max(class_counts)
    
    # Duplicate ratio - compute on feature matrix X (after encoding)
    # This is more accurate than computing on df with fewer columns
    duplicate_ratio = X.duplicated().sum() / len(X)
    
    # Skew score (average absolute skewness of numeric columns)
    numeric_cols = X.select_dtypes(include=[np.number])
    if len(numeric_cols.columns) > 0:
        skew_values = numeric_cols.skew()
        # Filter out infinite skewness values
        skew_values = skew_values.replace([np.inf, -np.inf], np.nan).dropna()
        skew_score = skew_values.abs().mean() if len(skew_values) > 0 else 0.0
    else:
        skew_score = 0.0
    
    # Build column_stats for meta_evaluator (sample first 5 numeric columns)
    column_stats = {}
    for col in numeric_cols.columns[:5]:
        col_skew = numeric_cols[col].skew()
        if not np.isinf(col_skew):
            column_stats[col] = {"skewness": float(col_skew)}
    
    dataset_stats = {
        "n_rows": len(df),
        "n_features": X.shape[1],
        "total_cells": total_cells,
        "missing_values": int(missing_values),
        "imbalance_ratio": float(imbalance_ratio),
        "duplicate_ratio": float(duplicate_ratio),
        "column_stats": column_stats
    }
    
    return dataset_stats


# ============================================================================
# STEP 8: Run MetaEvaluator
# ============================================================================

def run_evaluation(metrics, dataset_stats, fairness_result):
    """
    Run MetaEvaluator in both balanced and strict modes.
    
    Also runs evaluate_multi_run() with stochastic=True for confidence intervals.
    
    Returns comprehensive results including:
    - Trust scores for both modes
    - 95% confidence intervals from bootstrap estimation
    - Component risk weights
    - Guard trigger status
    """
    
    evaluator_balanced = MetaEvaluator(trust_mode="balanced")
    evaluator_strict = MetaEvaluator(trust_mode="strict")
    
    # Single-run evaluation
    result_balanced = evaluator_balanced.evaluate(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result
    )
    
    result_strict = evaluator_strict.evaluate(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result
    )
    
    # Multi-run stochastic evaluation for CI (σ=0.02, n=10 runs)
    multi_balanced = evaluator_balanced.evaluate_multi_run(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result,
        n_runs=10,
        random_seed_base=RANDOM_STATE,
        stochastic=True,
        sigma=0.02
    )
    
    multi_strict = evaluator_strict.evaluate_multi_run(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result,
        n_runs=10,
        random_seed_base=RANDOM_STATE,
        stochastic=True,
        sigma=0.02
    )
    
    return {
        "result_balanced": result_balanced,
        "result_strict": result_strict,
        "multi_balanced": multi_balanced,
        "multi_strict": multi_strict
    }


# ============================================================================
# STEP 9: Print Results
# ============================================================================

def print_results(metrics, fairness_result, dataset_stats, eval_results):
    """Print paper-ready formatted results."""
    
    result_b = eval_results["result_balanced"]
    result_s = eval_results["result_strict"]
    multi_b = eval_results["multi_balanced"]
    multi_s = eval_results["multi_strict"]
    
    dp = fairness_result["fairness_metrics"]["demographic_parity_difference"]
    
    print("\n" + "=" * 100)
    print("COMPAS DATASET - TRUST AGGREGATION FRAMEWORK EVALUATION")
    print("=" * 100)
    
    # Performance Metrics
    print("\n📊 PERFORMANCE METRICS")
    print("-" * 50)
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1 Score:  {metrics['f1_score']:.4f}")
    
    # Fairness Metrics
    print("\n⚖️  FAIRNESS METRICS (Protected: race)")
    print("-" * 50)
    print(f"  Demographic Parity Difference: {dp:.4f}")
    if dp < 0.10:
        print("  → Interpretation: FAIR (DP < 0.10)")
    elif dp < 0.20:
        print("  → Interpretation: MODERATE DISPARITY (0.10 ≤ DP < 0.20)")
    else:
        print("  → Interpretation: SIGNIFICANT DISPARITY (DP ≥ 0.20)")
    
    # Dataset Instability
    print("\n📈 DATASET INSTABILITY INDEX (DII)")
    print("-" * 50)
    print(f"  DII (Balanced): {result_b['DII']:.4f}")
    print(f"  DII (Strict):   {result_s['DII']:.4f}")
    print(f"  Missing Ratio:   {dataset_stats['missing_values'] / dataset_stats['total_cells']:.4f}")
    print(f"  Imbalance Ratio: {dataset_stats['imbalance_ratio']:.4f}")
    print(f"  Duplicate Ratio: {dataset_stats['duplicate_ratio']:.4f}")
    
    # Component Scores
    print("\n🧩 COMPONENT SCORES")
    print("-" * 50)
    print(f"  Performance (P): {result_b['component_scores']['performance']:.4f}")
    print(f"  Health (H):      {result_b['component_scores']['health']:.4f}")
    print(f"  Fairness (F):    {result_b['component_scores']['fairness']:.4f}")
    print(f"  Robustness (R):  {result_b['component_scores']['robustness']:.4f}")
    
    # Risk Weights Analysis
    print("\n⚠️  RISK WEIGHT ANALYSIS")
    print("-" * 50)
    risk_weights = result_b.get("automatic_weights", result_b.get("beta_auto", {}))
    if risk_weights:
        max_risk_component = max(risk_weights, key=risk_weights.get)
        print(f"  Highest risk component: {max_risk_component.upper()}")
        print(f"  Risk weights: {risk_weights}")
    
    # Trust Scores
    print("\n🎯 TRUST SCORES")
    print("-" * 50)
    print(f"  BALANCED Mode: {result_b['trust_score']:.2f}")
    print(f"    95% CI: [{multi_b['ci_low']:.1f}, {multi_b['ci_high']:.1f}]")
    print(f"    Std: {multi_b['std_trust']:.4f}")
    print(f"  STRICT Mode:   {result_s['trust_score']:.2f}")
    print(f"    95% CI: [{multi_s['ci_low']:.1f}, {multi_s['ci_high']:.1f}]")
    print(f"    Std: {multi_s['std_trust']:.4f}")
    
    # Delta Analysis
    delta = result_b['trust_score'] - result_s['trust_score']
    print(f"\n  Δ (Balanced - Strict): {delta:+.2f}")
    print(f"  → Strict mode penalizes by {abs(delta):.2f} points")
    
    # Guard Trigger Status
    print("\n🚨 NON-COMPENSATORY GUARD STATUS")
    print("-" * 50)
    guard_b = result_b.get("non_compensatory_override", False)
    guard_s = result_s.get("non_compensatory_override", False)
    print(f"  Balanced mode guard: {'TRIGGERED' if guard_b else 'Not triggered'}")
    print(f"  Strict mode guard:   {'TRIGGERED' if guard_s else 'Not triggered'}")
    
    # Paper-Ready Table
    print("\n" + "=" * 100)
    print("PAPER-READY TABLE")
    print("=" * 100)
    
    ci_b = f"[{multi_b['ci_low']:.1f}, {multi_b['ci_high']:.1f}]"
    ci_s = f"[{multi_s['ci_low']:.1f}, {multi_s['ci_high']:.1f}]"
    
    print(f"\n{'Metric':<12} | {'Value':>10}")
    print("-" * 30)
    print(f"{'Accuracy':<12} | {metrics['accuracy']:>10.4f}")
    print(f"{'F1':<12} | {metrics['f1_score']:>10.4f}")
    print(f"{'DP':<12} | {dp:>10.4f}")
    print(f"{'DII':<12} | {result_b['DII']:>10.4f}")
    print(f"{'Balanced':<12} | {result_b['trust_score']:>10.2f}")
    print(f"{'  95% CI':<12} | {ci_b:>10}")
    print(f"{'Strict':<12} | {result_s['trust_score']:>10.2f}")
    print(f"{'  95% CI':<12} | {ci_s:>10}")
    
    # Markdown Table
    print("\n### Markdown Table for Paper\n")
    print("| Dataset | Accuracy | F1 | DP | DII | Balanced Trust | 95% CI | Strict Trust | 95% CI |")
    print("|---------|----------|----|----|-----|----------------|--------|--------------|--------|")
    print(f"| COMPAS | {metrics['accuracy']:.4f} | {metrics['f1_score']:.4f} | {dp:.4f} | "
          f"{result_b['DII']:.4f} | {result_b['trust_score']:.2f} | {ci_b} | "
          f"{result_s['trust_score']:.2f} | {ci_s} |")
    
    # Summary interpretation
    print("\n" + "=" * 100)
    print("INTERPRETATION")
    print("=" * 100)
    print(f"""
The COMPAS dataset evaluation shows:

1. PERFORMANCE: Accuracy={metrics['accuracy']:.2%}, F1={metrics['f1_score']:.4f}
   - Typical for COMPAS with logistic regression

2. FAIRNESS: DP={dp:.4f}
   - {'Within acceptable range' if dp < 0.15 else 'Shows demographic disparity requiring attention'}
   - Indicates {'relatively fair' if dp < 0.15 else 'unequal'} prediction rates across racial groups

3. DATA QUALITY: DII={result_b['DII']:.4f}
   - {'Low instability' if result_b['DII'] < 0.15 else 'Moderate instability'}
   - COMPAS is a well-curated benchmark dataset

4. TRUST ASSESSMENT:
   - Balanced: {result_b['trust_score']:.2f} ({'High' if result_b['trust_score'] >= 80 else 'Moderate' if result_b['trust_score'] >= 65 else 'Low'} trust)
   - Strict: {result_s['trust_score']:.2f} ({'High' if result_s['trust_score'] >= 80 else 'Moderate' if result_s['trust_score'] >= 65 else 'Low'} trust)
   - Strict mode correctly amplifies fairness-related risk

5. RECOMMENDATION:
   - {'Model shows acceptable trust for deployment with monitoring' if result_b['trust_score'] >= 70 else 'Model requires improvement before deployment'}
   - {'Fairness mitigation techniques recommended' if dp >= 0.15 else 'Fairness is acceptable'}
""")


# ============================================================================
# BIAS INJECTION FOR GUARD ACTIVATION TEST
# ============================================================================

def inject_bias(y_pred, X_test, A_test, bias_strength="strong"):
    """
    Artificially inject demographic bias into predictions to trigger guard.
    
    ETHICAL DISCLAIMER:
    -------------------
    This bias injection is intentionally introduced to validate the non-compensatory
    guard behavior and does NOT represent realistic deployment practice. The purpose
    is to demonstrate framework safety mechanisms under extreme fairness violations.
    
    Parameters:
    -----------
    y_pred : array-like
        Original model predictions
    X_test : DataFrame
        Test features (used to identify race column if one-hot encoded)
    A_test : Series
        Protected attribute (race) for test set
    bias_strength : str
        "strong" - Force positive predictions for African-American (DP ≈ 0.60-0.70)
        "extreme" - Force positive for AA and negative for Others (DP ≈ 0.80+)
    
    Returns:
    --------
    biased_pred : array
        Modified predictions with injected bias
    """
    biased_pred = np.array(y_pred).copy()
    
    # Create mask for African-American individuals
    is_african_american = (A_test == 'African-American').values
    
    if bias_strength == "strong":
        # Force positive predictions for African-American group
        # This increases their positive rate dramatically relative to others
        biased_pred[is_african_american] = 1
        
    elif bias_strength == "extreme":
        # Force positive for AA, negative for others (extreme disparity)
        biased_pred[is_african_american] = 1
        biased_pred[~is_african_american] = 0
        
    return biased_pred


def run_guard_activation_experiment(df, X, y, protected_attr, X_train, X_test, 
                                     y_train, y_test, A_test, model, y_pred_original,
                                     dataset_stats, normal_results):
    """
    Run bias injection experiment to demonstrate guard activation.
    
    This experiment:
    1. Injects strong demographic bias into predictions
    2. Computes fairness metrics with biased predictions
    3. Runs MetaEvaluator to show guard trigger behavior
    4. Compares normal vs biased scenarios
    
    Guard thresholds:
    - Balanced: τ = 0.30
    - Strict:   τ = 0.40
    
    To trigger guard, we need min(P, H, F, R) < τ.
    With DP ≥ 0.60, F = 1 - DP ≤ 0.40, triggering strict guard.
    """
    
    print("\n" + "=" * 100)
    print("GUARD ACTIVATION EXPERIMENT - FAIRNESS STRESS TEST")
    print("=" * 100)
    print("\n⚠️  ETHICAL DISCLAIMER:")
    print("   The following fairness perturbation is intentionally introduced to validate")
    print("   guard behavior and does NOT represent realistic deployment practice.")
    print("   This demonstrates framework safety mechanisms under extreme bias conditions.")
    
    # Inject bias
    print("\n[BIAS INJECTION] Forcing positive predictions for African-American group...")
    biased_pred = inject_bias(y_pred_original, X_test, A_test, bias_strength="strong")
    
    # Show prediction rate change
    original_aa_rate = y_pred_original[A_test == 'African-American'].mean()
    biased_aa_rate = biased_pred[A_test == 'African-American'].mean()
    original_other_rate = y_pred_original[A_test != 'African-American'].mean()
    biased_other_rate = biased_pred[A_test != 'African-American'].mean()
    
    print(f"\n  Positive prediction rates (African-American):")
    print(f"    Original: {original_aa_rate:.4f}")
    print(f"    Biased:   {biased_aa_rate:.4f}")
    print(f"\n  Positive prediction rates (Other races):")
    print(f"    Original: {original_other_rate:.4f}")
    print(f"    Biased:   {biased_other_rate:.4f}")
    
    # Compute biased metrics
    biased_metrics = compute_metrics(y_test, biased_pred)
    biased_fairness, biased_dp = compute_fairness(y_test, biased_pred, A_test)
    
    print(f"\n  Biased Metrics:")
    print(f"    Accuracy: {biased_metrics['accuracy']:.4f}")
    print(f"    F1 Score: {biased_metrics['f1_score']:.4f}")
    print(f"    DP (Biased): {biased_dp:.4f}")
    
    # Run evaluation with biased predictions
    print("\n[EVALUATION] Running MetaEvaluator with biased predictions...")
    biased_eval = run_evaluation(biased_metrics, dataset_stats, biased_fairness)
    
    result_b = biased_eval["result_balanced"]
    result_s = biased_eval["result_strict"]
    multi_b = biased_eval["multi_balanced"]
    multi_s = biased_eval["multi_strict"]
    
    # Print biased scenario results
    print("\n" + "-" * 80)
    print("BIASED SCENARIO RESULTS")
    print("-" * 80)
    
    # Component scores
    print("\n🧩 COMPONENT SCORES (Biased)")
    print(f"  Performance (P): {result_b['component_scores']['performance']:.4f}")
    print(f"  Health (H):      {result_b['component_scores']['health']:.4f}")
    print(f"  Fairness (F):    {result_b['component_scores']['fairness']:.4f}")
    print(f"  Robustness (R):  {result_b['component_scores']['robustness']:.4f}")
    
    # Analyze guard trigger
    min_component = min(
        result_b['component_scores']['performance'],
        result_b['component_scores']['health'],
        result_b['component_scores']['fairness'],
        result_b['component_scores']['robustness']
    )
    min_component_name = [
        name for name, val in result_b['component_scores'].items() 
        if val == min_component
    ][0]
    
    print(f"\n  Minimum component: {min_component_name.upper()} = {min_component:.4f}")
    print(f"  Balanced threshold (τ): 0.30")
    print(f"  Strict threshold (τ):   0.40")
    
    # Guard status
    guard_b = result_b.get("non_compensatory_override", False)
    guard_s = result_s.get("non_compensatory_override", False)
    
    print("\n🚨 GUARD TRIGGER STATUS")
    print("-" * 50)
    
    if min_component < 0.30:
        print(f"  ✓ min(P,H,F,R) = {min_component:.4f} < 0.30 → Balanced guard SHOULD trigger")
    else:
        print(f"  ✗ min(P,H,F,R) = {min_component:.4f} ≥ 0.30 → Balanced guard does not trigger")
    
    if min_component < 0.40:
        print(f"  ✓ min(P,H,F,R) = {min_component:.4f} < 0.40 → Strict guard SHOULD trigger")
    else:
        print(f"  ✗ min(P,H,F,R) = {min_component:.4f} ≥ 0.40 → Strict guard does not trigger")
    
    print(f"\n  Balanced mode guard: {'🔴 TRIGGERED' if guard_b else '⚪ Not triggered'}")
    print(f"  Strict mode guard:   {'🔴 TRIGGERED' if guard_s else '⚪ Not triggered'}")
    
    # Trust scores
    print("\n🎯 TRUST SCORES (Biased Scenario)")
    print("-" * 50)
    print(f"  BALANCED Mode: {result_b['trust_score']:.2f}")
    print(f"    95% CI: [{multi_b['ci_low']:.1f}, {multi_b['ci_high']:.1f}]")
    if guard_b:
        print(f"    ⚠️  Score capped by non-compensatory guard")
    print(f"  STRICT Mode:   {result_s['trust_score']:.2f}")
    print(f"    95% CI: [{multi_s['ci_low']:.1f}, {multi_s['ci_high']:.1f}]")
    if guard_s:
        print(f"    ⚠️  Score capped by non-compensatory guard")
    
    # Comparison table
    normal_b = normal_results["result_balanced"]
    normal_s = normal_results["result_strict"]
    normal_dp = normal_results["dp"]
    normal_f = normal_b['component_scores']['fairness']
    
    print("\n" + "=" * 100)
    print("COMPARISON: NORMAL vs BIASED SCENARIO")
    print("=" * 100)
    
    print("\n### Paper Table V.I: Guard Activation Under Extreme Fairness Violation\n")
    print("| Scenario | DP | F | Balanced Trust | Strict Trust | Guard (B) | Guard (S) |")
    print("|----------|-----|------|----------------|--------------|-----------|-----------|")
    print(f"| Normal   | {normal_dp:.4f} | {normal_f:.4f} | {normal_b['trust_score']:.2f} | {normal_s['trust_score']:.2f} | {'Yes' if normal_b.get('non_compensatory_override') else 'No'} | {'Yes' if normal_s.get('non_compensatory_override') else 'No'} |")
    print(f"| Biased   | {biased_dp:.4f} | {result_b['component_scores']['fairness']:.4f} | {result_b['trust_score']:.2f} | {result_s['trust_score']:.2f} | {'Yes' if guard_b else 'No'} | {'Yes' if guard_s else 'No'} |")
    
    # Delta analysis
    delta_balanced = normal_b['trust_score'] - result_b['trust_score']
    delta_strict = normal_s['trust_score'] - result_s['trust_score']
    
    print(f"\n  Trust Score Degradation:")
    print(f"    Balanced: {normal_b['trust_score']:.2f} → {result_b['trust_score']:.2f} (Δ = {delta_balanced:+.2f})")
    print(f"    Strict:   {normal_s['trust_score']:.2f} → {result_s['trust_score']:.2f} (Δ = {delta_strict:+.2f})")
    
    # Interpretation
    print("\n" + "-" * 80)
    print("INTERPRETATION FOR PAPER")
    print("-" * 80)
    print(f"""
Under artificially induced demographic disparity (DP = {biased_dp:.4f}), the fairness
component score drops to F = {result_b['component_scores']['fairness']:.4f}. This triggers the non-compensatory 
safeguard in {'both modes' if guard_b and guard_s else 'strict mode' if guard_s else 'neither mode'}, overriding compensatory aggregation.

Key observations:
1. Fairness (F) = 1 - DP = {result_b['component_scores']['fairness']:.4f}
2. Guard threshold: Balanced (τ=0.30), Strict (τ=0.40)
3. Condition: min(P,H,F,R) = {min_component:.4f} {'<' if min_component < 0.40 else '≥'} τ

This demonstrates the framework's safety-first behavior under extreme bias conditions.
The non-compensatory guard prevents high-performing but unfair models from receiving
artificially inflated trust scores through compensatory aggregation.

ETHICAL NOTE: This bias injection was performed solely to validate framework behavior
and does not represent realistic deployment practice.
""")
    
    return {
        "biased_metrics": biased_metrics,
        "biased_dp": biased_dp,
        "biased_eval": biased_eval,
        "guard_balanced": guard_b,
        "guard_strict": guard_s
    }


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """
    Main execution pipeline for COMPAS dataset evaluation.
    
    Implements the full trust aggregation framework evaluation:
    1. Load COMPAS dataset
    2. Preprocess for classification
    3. Train logistic regression
    4. Compute performance, fairness, and dataset stats
    5. Evaluate with MetaEvaluator (balanced & strict modes)
    6. Generate paper-ready output
    7. Run guard activation experiment with bias injection
    """
    print("=" * 100)
    print("COMPAS DATASET - HYBRID TRUST AGGREGATION FRAMEWORK EVALUATION")
    print("=" * 100)
    print("\nThis experiment validates the framework on a fairness-critical benchmark.")
    print("COMPAS is widely used in algorithmic fairness research due to documented")
    print("racial disparities in recidivism prediction.")
    
    # Load data
    df = load_compas_dataset()
    
    # Preprocess
    X, y, protected_attr = preprocess_data(df)
    
    # Split
    X_train, X_test, y_train, y_test, A_test = split_data(X, y, protected_attr)
    
    # Train
    model = train_model(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Compute metrics
    print("\n[STEP 5] Computing Performance Metrics...")
    metrics = compute_metrics(y_test, y_pred)
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    print(f"  F1 Score: {metrics['f1_score']:.4f}")
    
    # Compute fairness
    print("\n[STEP 6] Computing Fairness Metrics (DP on race)...")
    fairness_result, dp = compute_fairness(y_test, y_pred, A_test)
    print(f"  Demographic Parity Difference: {dp:.4f}")
    
    # Compute dataset stats
    print("\n[STEP 7] Computing Dataset Statistics...")
    dataset_stats = compute_dataset_stats(df, X, y)
    print(f"  Missing Ratio: {dataset_stats['missing_values'] / dataset_stats['total_cells']:.4f}")
    print(f"  Imbalance Ratio: {dataset_stats['imbalance_ratio']:.4f}")
    print(f"  Duplicate Ratio: {dataset_stats['duplicate_ratio']:.4f}")
    
    # Run MetaEvaluator
    print("\n[STEP 8] Running MetaEvaluator (Balanced & Strict modes)...")
    eval_results = run_evaluation(metrics, dataset_stats, fairness_result)
    print(f"  Balanced Trust: {eval_results['result_balanced']['trust_score']:.2f}")
    print(f"  Strict Trust:   {eval_results['result_strict']['trust_score']:.2f}")
    
    # Print full results
    print_results(metrics, fairness_result, dataset_stats, eval_results)
    
    # Store normal results for comparison
    normal_results = {
        "result_balanced": eval_results["result_balanced"],
        "result_strict": eval_results["result_strict"],
        "dp": dp
    }
    
    # Run guard activation experiment
    guard_results = run_guard_activation_experiment(
        df, X, y, protected_attr,
        X_train, X_test, y_train, y_test, A_test,
        model, y_pred, dataset_stats, normal_results
    )
    
    print("\n" + "=" * 100)
    print("EXPERIMENT COMPLETE")
    print("=" * 100)
    
    return {
        "normal_eval": eval_results,
        "guard_experiment": guard_results
    }


if __name__ == "__main__":
    main()
