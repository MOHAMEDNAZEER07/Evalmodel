"""
UCI Adult Dataset Evaluation Experiment
=======================================
Validates the Hybrid Trust Aggregation Framework on a recognized public benchmark.

Produces a comparison table:
| Scenario | Accuracy | F1 | DP | DII | Balanced Trust | Strict Trust |
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import warnings
import numpy as np
import pandas as pd
from sklearn.datasets import fetch_openml
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from fairlearn.metrics import demographic_parity_difference

from app.services.meta_evaluator import MetaEvaluator

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')
logging.disable(logging.WARNING)

# ============================================================================
# STEP 1: Load Adult Dataset
# ============================================================================

def load_adult_dataset():
    """Load UCI Adult dataset from OpenML."""
    print("\n[STEP 1] Loading UCI Adult Dataset...")
    adult = fetch_openml(name="adult", version=2, as_frame=True)
    df = adult.frame
    
    # Rename target for clarity
    df.rename(columns={"class": "income"}, inplace=True)
    
    print(f"  Dataset shape: {df.shape}")
    print(f"  Target classes: {df['income'].unique()}")
    return df


# ============================================================================
# STEP 2: Preprocess Data
# ============================================================================

def preprocess_data(df):
    """Preprocess: binary target, one-hot encode categoricals."""
    print("\n[STEP 2] Preprocessing Data...")
    
    df = df.copy()
    
    # Convert target to binary
    df["income"] = df["income"].apply(lambda x: 1 if x == ">50K" else 0)
    
    # Store protected attribute before encoding
    protected_attr = df["sex"].copy()
    
    # Separate features
    X = df.drop("income", axis=1)
    y = df["income"]
    
    # One-hot encode categorical features
    X = pd.get_dummies(X, drop_first=True)
    
    print(f"  Features after encoding: {X.shape[1]}")
    print(f"  Target distribution: {y.value_counts().to_dict()}")
    
    return X, y, protected_attr


# ============================================================================
# STEP 3: Train-Test Split
# ============================================================================

def split_data(X, y, protected_attr, test_size=0.3, random_state=42):
    """Stratified train-test split."""
    print("\n[STEP 3] Train-Test Split...")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
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
    """Train Logistic Regression classifier."""
    print("\n[STEP 4] Training Logistic Regression Model...")
    
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    
    print("  Model trained successfully.")
    return model


# ============================================================================
# STEP 5: Compute Performance Metrics
# ============================================================================

def compute_metrics(y_test, y_pred):
    """Compute classification metrics."""
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
    """Compute demographic parity difference."""
    dp = demographic_parity_difference(
        y_true=y_test,
        y_pred=y_pred,
        sensitive_features=A_test
    )
    
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
    """Compute dataset statistics for DII calculation."""
    # Missing ratio
    total_cells = df.shape[0] * df.shape[1]
    missing_values = df.isnull().sum().sum()
    
    # Class imbalance (0.5 = balanced, 0/1 = fully imbalanced)
    class_counts = y.value_counts()
    imbalance_ratio = min(class_counts) / max(class_counts)
    # Normalize: 0.5 -> 0 instability, 0 or 1 -> 1 instability
    # We pass raw ratio; meta_evaluator handles normalization
    
    # Duplicate ratio
    duplicate_ratio = df.duplicated().sum() / len(df)
    
    # Skew score (average absolute skewness of numeric columns)
    numeric_cols = X.select_dtypes(include=[np.number])
    if len(numeric_cols.columns) > 0:
        skew_values = numeric_cols.skew()
        skew_score = skew_values.abs().mean()
    else:
        skew_score = 0.0
    
    # Build column_stats for skewness (meta_evaluator format)
    column_stats = {}
    for col in numeric_cols.columns[:5]:  # Sample first 5 numeric columns
        column_stats[col] = {"skewness": float(numeric_cols[col].skew())}
    
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

def run_evaluation(metrics, dataset_stats, fairness_result, scenario_name=""):
    """Run MetaEvaluator in both balanced and strict modes."""
    
    evaluator_balanced = MetaEvaluator(trust_mode="balanced")
    evaluator_strict = MetaEvaluator(trust_mode="strict")
    
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
    
    # Multi-run stochastic evaluation for CI
    multi_balanced = evaluator_balanced.evaluate_multi_run(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result,
        n_runs=10,
        random_seed_base=42,
        stochastic=True,
        sigma=0.02
    )
    
    multi_strict = evaluator_strict.evaluate_multi_run(
        metrics=metrics,
        dataset_stats=dataset_stats,
        model_type="classification",
        fairness_result=fairness_result,
        n_runs=10,
        random_seed_base=42,
        stochastic=True,
        sigma=0.02
    )
    
    return {
        "scenario": scenario_name,
        "accuracy": metrics["accuracy"],
        "f1": metrics["f1_score"],
        "dp": fairness_result["fairness_metrics"]["demographic_parity_difference"],
        "dii_balanced": result_balanced["DII"],
        "dii_strict": result_strict["DII"],
        "trust_balanced": result_balanced["trust_score"],
        "trust_strict": result_strict["trust_score"],
        "guard_balanced": result_balanced.get("non_compensatory_triggered", False),
        "guard_strict": result_strict.get("non_compensatory_triggered", False),
        # CI data
        "ci_balanced": f"[{multi_balanced['ci_low']:.1f}, {multi_balanced['ci_high']:.1f}]",
        "ci_strict": f"[{multi_strict['ci_low']:.1f}, {multi_strict['ci_high']:.1f}]",
        "std_balanced": multi_balanced['std_trust'],
        "std_strict": multi_strict['std_trust']
    }


# ============================================================================
# STEP 9: Create Corrupted Versions
# ============================================================================

def corrupt_moderate(df, X, y, missing_rate=0.10):
    """Moderate corruption: 10% missing values (excluding target and protected attribute)."""
    df_corrupted = df.copy()
    
    # Inject missing values
    np.random.seed(42)
    mask = np.random.rand(*df_corrupted.shape) < missing_rate
    
    # Don't corrupt the target column or protected attribute
    target_idx = df_corrupted.columns.get_loc("income")
    sex_idx = df_corrupted.columns.get_loc("sex")
    mask[:, target_idx] = False
    mask[:, sex_idx] = False
    
    df_corrupted = df_corrupted.mask(mask)
    
    return df_corrupted


def corrupt_severe(df, X, y, missing_rate=0.30, duplicate_rate=0.20):
    """Severe corruption: 30% missing, 20% duplicates, class imbalance."""
    df_corrupted = df.copy()
    
    np.random.seed(42)
    
    # 1. Inject 30% missing values (excluding target and protected attribute)
    mask = np.random.rand(*df_corrupted.shape) < missing_rate
    target_idx = df_corrupted.columns.get_loc("income")
    sex_idx = df_corrupted.columns.get_loc("sex")
    mask[:, target_idx] = False
    mask[:, sex_idx] = False
    df_corrupted = df_corrupted.mask(mask)
    
    # 2. Duplicate 20% of rows (from majority class)
    # Income is still in string format ("<=50K" / ">50K"), find majority
    income_counts = df_corrupted["income"].value_counts()
    majority_class = income_counts.idxmax()
    majority_rows = df_corrupted[df_corrupted["income"] == majority_class]
    n_duplicates = int(len(majority_rows) * duplicate_rate)
    duplicates = majority_rows.sample(n=n_duplicates, random_state=42, replace=True)
    df_corrupted = pd.concat([df_corrupted, duplicates], ignore_index=True)
    
    return df_corrupted


def run_corrupted_evaluation(df_corrupted, original_X_columns, scenario_name):
    """Run full pipeline on corrupted dataset."""
    
    # Preprocess corrupted data
    df_c = df_corrupted.copy()
    df_c["income"] = df_c["income"].apply(lambda x: 1 if x == ">50K" else (0 if x == "<=50K" else x))
    
    # For corrupted data with missing values, fill NaN for model training
    protected_attr = df_c["sex"].copy()
    # Fill missing protected attribute with mode
    protected_attr = protected_attr.fillna(protected_attr.mode().iloc[0] if len(protected_attr.mode()) > 0 else "Male")
    
    X_c = df_c.drop("income", axis=1)
    y_c = df_c["income"]
    
    # One-hot encode (handles NaN via dummy_na parameter)
    X_c = pd.get_dummies(X_c, drop_first=True, dummy_na=True)
    
    # Align columns with original (add missing columns as 0)
    for col in original_X_columns:
        if col not in X_c.columns:
            X_c[col] = 0
    
    # Keep only original columns + any NaN indicator columns
    cols_to_keep = list(original_X_columns) + [c for c in X_c.columns if c.endswith('_nan')]
    X_c = X_c[[c for c in cols_to_keep if c in X_c.columns]]
    
    # Fill numeric missing values with median
    numeric_cols = X_c.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if X_c[col].isna().any():
            X_c[col] = X_c[col].fillna(X_c[col].median())
    
    # Fill remaining NaN with 0
    X_c = X_c.fillna(0)
    
    # Fill target NaN
    y_c = y_c.fillna(y_c.mode().iloc[0] if len(y_c.mode()) > 0 else 0)
    y_c = y_c.astype(int)
    
    # Reset indices for consistent alignment
    X_c = X_c.reset_index(drop=True)
    y_c = y_c.reset_index(drop=True)
    protected_attr = protected_attr.reset_index(drop=True)
    
    # Split
    indices = np.arange(len(X_c))
    train_idx, test_idx = train_test_split(indices, test_size=0.3, random_state=42)
    
    X_train, X_test = X_c.iloc[train_idx], X_c.iloc[test_idx]
    y_train, y_test = y_c.iloc[train_idx], y_c.iloc[test_idx]
    A_test = protected_attr.iloc[test_idx]
    
    # Train
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Metrics
    metrics = compute_metrics(y_test, y_pred)
    fairness_result, _ = compute_fairness(y_test, y_pred, A_test)
    dataset_stats = compute_dataset_stats(df_corrupted, X_c, y_c)
    
    return run_evaluation(metrics, dataset_stats, fairness_result, scenario_name)


# ============================================================================
# STEP 10: Generate Final Table
# ============================================================================

def print_results_table(results):
    """Print formatted results table."""
    print("\n" + "=" * 120)
    print("EVALUATION RESULTS - UCI ADULT DATASET")
    print("=" * 120)
    
    # Header
    print(f"\n{'Scenario':<12} | {'Acc':>6} | {'F1':>6} | {'DP':>6} | {'DII':>6} | "
          f"{'Balanced':>8} | {'95% CI B':>14} | {'Strict':>8} | {'95% CI S':>14}")
    print("-" * 120)
    
    # Data rows
    for r in results:
        print(f"{r['scenario']:<12} | {r['accuracy']:>6.4f} | {r['f1']:>6.4f} | {r['dp']:>6.4f} | "
              f"{r['dii_balanced']:>6.4f} | {r['trust_balanced']:>8.2f} | {r['ci_balanced']:>14} | "
              f"{r['trust_strict']:>8.2f} | {r['ci_strict']:>14}")
    
    print("-" * 120)
    
    # Delta analysis
    if len(results) >= 2:
        baseline = results[0]
        print("\nDelta from Clean Baseline:")
        for r in results[1:]:
            delta_b = r["trust_balanced"] - baseline["trust_balanced"]
            delta_s = r["trust_strict"] - baseline["trust_strict"]
            print(f"  {r['scenario']}: Balanced Δ={delta_b:+.2f}, Strict Δ={delta_s:+.2f}")


def print_markdown_table(results):
    """Print results in Markdown format for paper."""
    print("\n### Markdown Table for Paper\n")
    print("| Scenario | Accuracy | F1 | DP | DII | Balanced Trust | 95% CI | Strict Trust | 95% CI |")
    print("|----------|----------|----|----|-----|----------------|--------|--------------|--------|")
    
    for r in results:
        print(f"| {r['scenario']} | {r['accuracy']:.4f} | {r['f1']:.4f} | {r['dp']:.4f} | "
              f"{r['dii_balanced']:.4f} | {r['trust_balanced']:.2f} | {r['ci_balanced']} | "
              f"{r['trust_strict']:.2f} | {r['ci_strict']} |")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    print("=" * 70)
    print("UCI Adult Dataset - Trust Aggregation Framework Evaluation")
    print("=" * 70)
    
    results = []
    
    # -------------------------------------------------------------------------
    # Clean Dataset Evaluation
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("SCENARIO 1: CLEAN DATASET")
    print("=" * 70)
    
    df = load_adult_dataset()
    X, y, protected_attr = preprocess_data(df)
    X_train, X_test, y_train, y_test, A_test = split_data(X, y, protected_attr)
    
    model = train_model(X_train, y_train)
    y_pred = model.predict(X_test)
    
    print("\n[STEP 5] Computing Performance Metrics...")
    metrics = compute_metrics(y_test, y_pred)
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1 Score:  {metrics['f1_score']:.4f}")
    
    print("\n[STEP 6] Computing Fairness Metrics...")
    fairness_result, dp = compute_fairness(y_test, y_pred, A_test)
    print(f"  Demographic Parity Difference: {dp:.4f}")
    
    print("\n[STEP 7] Computing Dataset Statistics...")
    dataset_stats = compute_dataset_stats(df, X, y)
    print(f"  Missing Ratio:    {dataset_stats['missing_values'] / dataset_stats['total_cells']:.4f}")
    print(f"  Imbalance Ratio:  {dataset_stats['imbalance_ratio']:.4f}")
    print(f"  Duplicate Ratio:  {dataset_stats['duplicate_ratio']:.4f}")
    
    print("\n[STEP 8] Running MetaEvaluator...")
    result_clean = run_evaluation(metrics, dataset_stats, fairness_result, "Clean")
    print(f"  Balanced Trust: {result_clean['trust_balanced']:.2f}")
    print(f"  Strict Trust:   {result_clean['trust_strict']:.2f}")
    results.append(result_clean)
    
    # -------------------------------------------------------------------------
    # Moderate Corruption
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("SCENARIO 2: MODERATE CORRUPTION (10% missing)")
    print("=" * 70)
    
    df_moderate = corrupt_moderate(df, X, y)
    result_moderate = run_corrupted_evaluation(df_moderate, X.columns, "Moderate")
    print(f"  Accuracy:       {result_moderate['accuracy']:.4f}")
    print(f"  F1 Score:       {result_moderate['f1']:.4f}")
    print(f"  DP:             {result_moderate['dp']:.4f}")
    print(f"  DII:            {result_moderate['dii_balanced']:.4f}")
    print(f"  Balanced Trust: {result_moderate['trust_balanced']:.2f}")
    print(f"  Strict Trust:   {result_moderate['trust_strict']:.2f}")
    results.append(result_moderate)
    
    # -------------------------------------------------------------------------
    # Severe Corruption
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("SCENARIO 3: SEVERE CORRUPTION (30% missing, 20% duplicates)")
    print("=" * 70)
    
    df_severe = corrupt_severe(df, X, y)
    result_severe = run_corrupted_evaluation(df_severe, X.columns, "Severe")
    print(f"  Accuracy:       {result_severe['accuracy']:.4f}")
    print(f"  F1 Score:       {result_severe['f1']:.4f}")
    print(f"  DP:             {result_severe['dp']:.4f}")
    print(f"  DII:            {result_severe['dii_balanced']:.4f}")
    print(f"  Balanced Trust: {result_severe['trust_balanced']:.2f}")
    print(f"  Strict Trust:   {result_severe['trust_strict']:.2f}")
    results.append(result_severe)
    
    # -------------------------------------------------------------------------
    # Final Results Table
    # -------------------------------------------------------------------------
    print_results_table(results)
    print_markdown_table(results)
    
    print("\n" + "=" * 70)
    print("EXPERIMENT COMPLETE")
    print("=" * 70)
    
    return results


if __name__ == "__main__":
    main()
