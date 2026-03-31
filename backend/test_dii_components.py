"""Quick test to verify DII components calculation"""
import sys
sys.path.insert(0, '.')

from app.services.meta_evaluator import MetaEvaluator

# Test with sample dataset stats
dataset_stats = {
    'n_rows': 1000,
    'n_features': 10,
    'missing_values': 50,  # 50 missing values out of 10000 cells = 0.5%
    'imbalance_ratio': 0.7,  # 70% majority class
    'duplicate_ratio': 0.05,  # 5% duplicates
    'skew_score': 0.3,  # Moderate skew
    'low_variance_fraction': 0.1
}

# Test metrics
metrics = {
    'accuracy': 0.85,
    'precision': 0.82,
    'recall': 0.88,
    'f1_score': 0.85
}

print("=" * 60)
print("Testing DII Components Calculation")
print("=" * 60)

print("\nInput dataset_stats:")
for k, v in dataset_stats.items():
    print(f"  {k}: {v}")

evaluator = MetaEvaluator(trust_mode="balanced")
result = evaluator.evaluate(
    metrics=metrics,
    dataset_stats=dataset_stats,
    model_type="classification"
)

print("\n" + "=" * 60)
print("Output from meta_evaluator:")
print("=" * 60)
print(f"\nDII: {result.get('DII')}")
print(f"dii_components: {result.get('dii_components')}")

dii_components = result.get('dii_components', {})
print("\nIndividual DII components:")
print(f"  imbalance (I): {dii_components.get('imbalance')}")
print(f"  missing (M): {dii_components.get('missing')}")
print(f"  duplicates (D): {dii_components.get('duplicates')}")
print(f"  skew (S): {dii_components.get('skew')}")

# Expected values:
# I = abs(0.7 - 0.5) * 2 = 0.4
# M = 50 / (1000 * 10) = 0.005
# D = 0.05
# S = 0.3
# DII (balanced) = 0.35*M + 0.30*I + 0.20*D + 0.15*S = 0.35*0.005 + 0.30*0.4 + 0.20*0.05 + 0.15*0.3 = 0.00175 + 0.12 + 0.01 + 0.045 = 0.17675

print("\n" + "=" * 60)
print("Expected values:")
print("=" * 60)
print("  I (imbalance) = abs(0.7 - 0.5) * 2 = 0.4")
print("  M (missing) = 50 / (1000 * 10) = 0.005")
print("  D (duplicates) = 0.05")
print("  S (skew) = 0.3")
print("  DII = 0.35*0.005 + 0.30*0.4 + 0.20*0.05 + 0.15*0.3 ≈ 0.1768")
