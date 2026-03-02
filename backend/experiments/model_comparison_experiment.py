"""
Model Comparison Experiment with Full Statistical Analysis

This experiment:
- Trains Logistic Regression, Random Forest, and XGBoost
- Runs 5-fold Cross-Validation
- Computes trust scores per fold (Balanced and Strict modes)
- Reports mean ± std
- Performs paired t-test for statistical significance
- Analyzes trust vs accuracy correlation
- Conducts λ sensitivity ablation study
"""

import numpy as np
import pandas as pd
from scipy import stats

from sklearn.datasets import fetch_openml
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

from xgboost import XGBClassifier

from fairlearn.metrics import demographic_parity_difference

from app.services.meta_evaluator import MetaEvaluator


# =========================================
# Load Adult Dataset
# =========================================

print("Loading Adult Dataset...")
adult = fetch_openml(name="adult", version=2, as_frame=True)
df = adult.frame

X = df.drop("class", axis=1)
y = (df["class"] == ">50K").astype(int)

sensitive_feature = X["sex"]  # fairness attribute


# =========================================
# Preprocessing - identify column types
# =========================================

categorical_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
numeric_cols = X.select_dtypes(include=["int64", "float64"]).columns.tolist()


def make_preprocessor():
    """Create a fresh preprocessor for each fold."""
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
            ("num", "passthrough", numeric_cols),
        ]
    )


# =========================================
# Models to Compare
# =========================================

def get_models():
    """Return fresh model instances."""
    return {
        "LogisticRegression": LogisticRegression(max_iter=1000),
        "RandomForest": RandomForestClassifier(n_estimators=200, random_state=42),
        "XGBoost": XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            eval_metric="logloss",
            use_label_encoder=False,
            random_state=42
        )
    }

model_names = ["LogisticRegression", "RandomForest", "XGBoost"]


# =========================================
# 5-Fold Cross Validation
# =========================================

kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

results = {}
all_fold_data = []  # For correlation analysis

for model_name in model_names:

    print(f"\nRunning 5-fold CV for {model_name}...")
    trust_scores_balanced = []
    trust_scores_strict = []
    accuracies = []
    f1_scores = []

    for fold_idx, (train_index, test_index) in enumerate(kf.split(X, y)):

        X_train, X_test = X.iloc[train_index], X.iloc[test_index]
        y_train, y_test = y.iloc[train_index], y.iloc[test_index]
        sensitive_test = sensitive_feature.iloc[test_index]

        # Create fresh preprocessor and model for each fold
        pipeline = Pipeline(steps=[
            ("preprocessor", make_preprocessor()),
            ("model", get_models()[model_name])
        ])

        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        # ==========================
        # Compute Metrics
        # ==========================

        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)

        dp = demographic_parity_difference(
            y_true=y_test,
            y_pred=y_pred,
            sensitive_features=sensitive_test
        )

        dp = abs(dp)

        metrics = {
            "accuracy": accuracy,
            "f1_score": f1
        }

        # ==========================
        # Dataset Stats for DII
        # ==========================

        missing_ratio = X_train.isnull().sum().sum() / (X_train.shape[0] * X_train.shape[1])
        class_counts = y_train.value_counts()
        imbalance_ratio = min(class_counts) / max(class_counts)
        duplicate_ratio = X_train.duplicated().sum() / len(X_train)
        
        # Normalize skew to [0,1] using tanh transformation
        # Raw skewness can be >> 1, we need it bounded for DII
        raw_skew = X_train.select_dtypes(include=[np.number]).skew().abs().mean()
        skew_score = np.tanh(raw_skew / 3.0)  # Maps ~3 skew to ~0.76, ~6 to ~0.96

        dataset_stats = {
            "n_rows": len(X_train),
            "n_features": X_train.shape[1],
            "missing_values": X_train.isnull().sum().sum(),
            "imbalance_ratio": imbalance_ratio,
            "duplicate_ratio": duplicate_ratio,
            "skew_score": skew_score
        }

        fairness_result = {
            "analysis_successful": True,
            "fairness_metrics": {
                "demographic_parity_difference": dp
            }
        }

        # ==========================
        # Trust Evaluation
        # ==========================

        evaluator_balanced = MetaEvaluator(trust_mode="balanced")
        evaluator_strict = MetaEvaluator(trust_mode="strict")

        r_balanced = evaluator_balanced.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification",
            fairness_result=fairness_result
        )

        r_strict = evaluator_strict.evaluate(
            metrics=metrics,
            dataset_stats=dataset_stats,
            model_type="classification",
            fairness_result=fairness_result
        )

        trust_scores_balanced.append(r_balanced["trust_score"])
        trust_scores_strict.append(r_strict["trust_score"])
        accuracies.append(accuracy)
        f1_scores.append(f1)

        # Store for correlation analysis
        all_fold_data.append({
            "model": model_name,
            "fold": fold_idx,
            "accuracy": accuracy,
            "f1_score": f1,
            "trust_balanced": r_balanced["trust_score"],
            "trust_strict": r_strict["trust_score"],
            "dp": dp
        })

    results[model_name] = {
        "Balanced Mean": np.mean(trust_scores_balanced),
        "Balanced Std": np.std(trust_scores_balanced),
        "Strict Mean": np.mean(trust_scores_strict),
        "Strict Std": np.std(trust_scores_strict),
        "Accuracy Mean": np.mean(accuracies),
        "Accuracy Std": np.std(accuracies),
        "F1 Mean": np.mean(f1_scores),
        "F1 Std": np.std(f1_scores),
        "balanced_scores": trust_scores_balanced,
        "strict_scores": trust_scores_strict,
        "accuracies": accuracies
    }


# =========================================
# Final Results Table
# =========================================

print("\n" + "=" * 60)
print("MODEL COMPARISON RESULTS (5-FOLD CV)")
print("=" * 60)

for model_name, values in results.items():
    print(f"\n{model_name}")
    print(f"  Accuracy:  {values['Accuracy Mean']:.4f} ± {values['Accuracy Std']:.4f}")
    print(f"  F1 Score:  {values['F1 Mean']:.4f} ± {values['F1 Std']:.4f}")
    print(f"  Balanced:  {values['Balanced Mean']:.2f} ± {values['Balanced Std']:.2f}")
    print(f"  Strict:    {values['Strict Mean']:.2f} ± {values['Strict Std']:.2f}")


# =========================================
# Statistical Significance Tests
# =========================================

print("\n" + "=" * 60)
print("STATISTICAL SIGNIFICANCE TESTS (Paired t-test)")
print("=" * 60)

# Test 1: Balanced vs Strict within each model
print("\n--- Balanced vs Strict Trust Mode Comparison ---")
for model_name, values in results.items():
    t_stat, p_value = stats.ttest_rel(
        values["balanced_scores"],
        values["strict_scores"]
    )
    significance = "***" if p_value < 0.001 else "**" if p_value < 0.01 else "*" if p_value < 0.05 else "ns"
    print(f"{model_name}: t={t_stat:.3f}, p={p_value:.4f} {significance}")

# Test 2: Between models (pairwise)
print("\n--- Model Comparison (Balanced Mode) ---")
model_names = list(results.keys())
for i in range(len(model_names)):
    for j in range(i + 1, len(model_names)):
        m1, m2 = model_names[i], model_names[j]
        t_stat, p_value = stats.ttest_rel(
            results[m1]["balanced_scores"],
            results[m2]["balanced_scores"]
        )
        significance = "***" if p_value < 0.001 else "**" if p_value < 0.01 else "*" if p_value < 0.05 else "ns"
        print(f"{m1} vs {m2}: t={t_stat:.3f}, p={p_value:.4f} {significance}")


# =========================================
# Trust vs Accuracy Correlation Analysis
# =========================================

print("\n" + "=" * 60)
print("TRUST VS ACCURACY CORRELATION ANALYSIS")
print("=" * 60)

df_results = pd.DataFrame(all_fold_data)

# Overall correlation
corr_balanced, p_balanced = stats.pearsonr(df_results["accuracy"], df_results["trust_balanced"])
corr_strict, p_strict = stats.pearsonr(df_results["accuracy"], df_results["trust_strict"])

print(f"\nOverall Correlations (across all models and folds):")
print(f"  Accuracy vs Trust (Balanced): r={corr_balanced:.4f}, p={p_balanced:.4f}")
print(f"  Accuracy vs Trust (Strict):   r={corr_strict:.4f}, p={p_strict:.4f}")

# Per-model correlation
print(f"\nPer-Model Correlations:")
for model_name in model_names:
    model_data = df_results[df_results["model"] == model_name]
    if len(model_data) > 2:
        corr, p = stats.pearsonr(model_data["accuracy"], model_data["trust_balanced"])
        print(f"  {model_name}: r={corr:.4f}, p={p:.4f}")

# F1 vs Trust correlation
corr_f1_balanced, p_f1 = stats.pearsonr(df_results["f1_score"], df_results["trust_balanced"])
print(f"\n  F1 vs Trust (Balanced): r={corr_f1_balanced:.4f}, p={p_f1:.4f}")

# Fairness (DP) vs Trust correlation
corr_dp_balanced, p_dp = stats.pearsonr(df_results["dp"], df_results["trust_balanced"])
print(f"  DP Diff vs Trust (Balanced): r={corr_dp_balanced:.4f}, p={p_dp:.4f}")
print("  (Negative correlation expected: lower DP diff = fairer = higher trust)")


# =========================================
# Fairness Weight Sensitivity Ablation Study
# =========================================

print("\n" + "=" * 60)
print("FAIRNESS WEIGHT SENSITIVITY ABLATION STUDY")
print("=" * 60)

# We vary user-specified fairness weight to see how it affects trust scores
# Using XGBoost as the reference model (best performer)

# Get a single fold's metrics for ablation
sample_metrics = {
    "accuracy": results["XGBoost"]["Accuracy Mean"],
    "f1_score": results["XGBoost"]["F1 Mean"]
}

# Use average dataset stats
sample_dataset_stats = {
    "n_rows": len(X),
    "n_features": X.shape[1],
    "missing_values": X.isnull().sum().sum(),
    "imbalance_ratio": min(y.value_counts()) / max(y.value_counts()),
    "duplicate_ratio": X.duplicated().sum() / len(X),
    "skew_score": np.tanh(X.select_dtypes(include=[np.number]).skew().abs().mean() / 3.0)
}

# Estimate DP from stored data
avg_dp = df_results[df_results["model"] == "XGBoost"]["dp"].mean()
sample_fairness = {
    "analysis_successful": True,
    "fairness_metrics": {
        "demographic_parity_difference": avg_dp
    }
}

# Fairness weight ablation values (0.0 to 0.6)
# We vary how much weight user gives to fairness while keeping others proportional
fairness_weights = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60]

print("\nFairness Weight Sensitivity Analysis (using XGBoost metrics):")
print("Varying user-specified fairness weight (w_f)")
print("w_f=0: No fairness consideration | w_f=0.6: Heavy fairness emphasis")
print("-" * 60)

ablation_results = []

for mode in ["balanced", "strict"]:
    print(f"\n[{mode.upper()} MODE]")
    print(f"{'w_f':>5} | {'Trust Score':>12} | {'Delta':>8} | Weights (P/H/F/R)")
    print("-" * 60)
    
    prev_score = None
    for w_f in fairness_weights:
        # Distribute remaining weight proportionally among P, H, R
        remaining = 1.0 - w_f
        # Default ratios: P=0.40, H=0.25, R=0.15 (sum=0.80 without F)
        # Scale to remaining
        scale = remaining / 0.80 if remaining > 0 else 0
        user_weights = {
            'performance': 0.40 * scale,
            'health': 0.25 * scale,
            'fairness': w_f,
            'robustness': 0.15 * scale
        }
        
        evaluator = MetaEvaluator(trust_mode=mode)
        
        result = evaluator.evaluate(
            metrics=sample_metrics,
            dataset_stats=sample_dataset_stats,
            model_type="classification",
            fairness_result=sample_fairness,
            user_weights=user_weights
        )
        
        trust_score = result["trust_score"]
        delta = trust_score - prev_score if prev_score is not None else 0.0
        delta_str = f"{delta:+.2f}" if prev_score is not None else "---"
        
        weights_str = f"{user_weights['performance']:.2f}/{user_weights['health']:.2f}/{w_f:.2f}/{user_weights['robustness']:.2f}"
        print(f"{w_f:>5.2f} | {trust_score:>12.2f} | {delta_str:>8} | {weights_str}")
        
        ablation_results.append({
            "mode": mode,
            "fairness_weight": w_f,
            "trust_score": trust_score
        })
        prev_score = trust_score

# Sensitivity analysis summary
print("\n" + "-" * 60)
print("Sensitivity Summary:")

df_ablation = pd.DataFrame(ablation_results)
for mode in ["balanced", "strict"]:
    mode_data = df_ablation[df_ablation["mode"] == mode]
    score_range = mode_data["trust_score"].max() - mode_data["trust_score"].min()
    score_std = mode_data["trust_score"].std()
    print(f"  {mode.capitalize()}: Range={score_range:.2f}, Std={score_std:.2f}")


# =========================================
# Summary Statistics Table (LaTeX-ready)
# =========================================

print("\n" + "=" * 60)
print("SUMMARY TABLE (LaTeX-ready)")
print("=" * 60)

print("\n\\begin{table}[h]")
print("\\centering")
print("\\caption{Model Comparison Results (5-Fold CV)}")
print("\\begin{tabular}{lcccc}")
print("\\hline")
print("Model & Accuracy & F1 & Trust (Balanced) & Trust (Strict) \\\\")
print("\\hline")

for model_name, values in results.items():
    acc = f"{values['Accuracy Mean']:.3f}±{values['Accuracy Std']:.3f}"
    f1 = f"{values['F1 Mean']:.3f}±{values['F1 Std']:.3f}"
    tb = f"{values['Balanced Mean']:.1f}±{values['Balanced Std']:.1f}"
    ts = f"{values['Strict Mean']:.1f}±{values['Strict Std']:.1f}"
    print(f"{model_name} & {acc} & {f1} & {tb} & {ts} \\\\")

print("\\hline")
print("\\end{tabular}")
print("\\end{table}")


# =========================================
# Save Results to CSV
# =========================================

# Save detailed fold results
df_results.to_csv("experiments/model_comparison_fold_results.csv", index=False)
print(f"\nDetailed fold results saved to: experiments/model_comparison_fold_results.csv")

# Save summary results
summary_data = []
for model_name, values in results.items():
    summary_data.append({
        "model": model_name,
        "accuracy_mean": values["Accuracy Mean"],
        "accuracy_std": values["Accuracy Std"],
        "f1_mean": values["F1 Mean"],
        "f1_std": values["F1 Std"],
        "trust_balanced_mean": values["Balanced Mean"],
        "trust_balanced_std": values["Balanced Std"],
        "trust_strict_mean": values["Strict Mean"],
        "trust_strict_std": values["Strict Std"]
    })

df_summary = pd.DataFrame(summary_data)
df_summary.to_csv("experiments/model_comparison_summary.csv", index=False)
print(f"Summary results saved to: experiments/model_comparison_summary.csv")

# Save ablation results
df_ablation.to_csv("experiments/fairness_weight_ablation_results.csv", index=False)
print(f"Fairness weight ablation results saved to: experiments/fairness_weight_ablation_results.csv")

print("\n" + "=" * 60)
print("EXPERIMENT COMPLETE")
print("=" * 60)
