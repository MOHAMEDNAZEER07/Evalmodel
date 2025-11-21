"""
Script to create test models for EvalModel platform
Creates 3 models: Classification, Regression, and NLP
"""

import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.datasets import make_classification, make_regression
from sklearn.model_selection import train_test_split
import pandas as pd
import os

# Create test_models directory if it doesn't exist
os.makedirs("test_models", exist_ok=True)
os.makedirs("test_datasets", exist_ok=True)

print("🔨 Creating test models and datasets...")
print("=" * 60)

# ============================================================================
# 1. CLASSIFICATION MODEL - Random Forest Classifier
# ============================================================================
print("\n1️⃣  Creating Classification Model (Random Forest)...")

# Generate classification dataset
X_class, y_class = make_classification(
    n_samples=1000,
    n_features=10,
    n_informative=8,
    n_redundant=2,
    n_classes=2,
    random_state=42,
    flip_y=0.1  # Add some noise
)

# Split data
X_train_class, X_test_class, y_train_class, y_test_class = train_test_split(
    X_class, y_class, test_size=0.3, random_state=42
)

# Create and train model
rf_classifier = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42
)
rf_classifier.fit(X_train_class, y_train_class)

# Save model
with open("test_models/random_forest_classifier.pkl", "wb") as f:
    pickle.dump(rf_classifier, f)

# Save test dataset
feature_names = [f"feature_{i}" for i in range(10)]
test_df_class = pd.DataFrame(X_test_class, columns=feature_names)
test_df_class['target'] = y_test_class
test_df_class.to_csv("test_datasets/classification_test_data.csv", index=False)

train_accuracy = rf_classifier.score(X_train_class, y_train_class)
test_accuracy = rf_classifier.score(X_test_class, y_test_class)

print(f"   ✅ Model saved: test_models/random_forest_classifier.pkl")
print(f"   ✅ Dataset saved: test_datasets/classification_test_data.csv")
print(f"   📊 Training Accuracy: {train_accuracy:.4f}")
print(f"   📊 Test Accuracy: {test_accuracy:.4f}")
print(f"   📦 Model Type: Classification (Binary)")
print(f"   🔧 Framework: scikit-learn")
print(f"   📏 Dataset Size: {len(test_df_class)} samples, {len(feature_names)} features")

# ============================================================================
# 2. REGRESSION MODEL - Random Forest Regressor
# ============================================================================
print("\n2️⃣  Creating Regression Model (Random Forest)...")

# Generate regression dataset
X_reg, y_reg = make_regression(
    n_samples=1000,
    n_features=15,
    n_informative=10,
    noise=10.0,
    random_state=42
)

# Split data
X_train_reg, X_test_reg, y_train_reg, y_test_reg = train_test_split(
    X_reg, y_reg, test_size=0.3, random_state=42
)

# Create and train model
rf_regressor = RandomForestRegressor(
    n_estimators=100,
    max_depth=15,
    random_state=42
)
rf_regressor.fit(X_train_reg, y_train_reg)

# Save model
with open("test_models/random_forest_regressor.pkl", "wb") as f:
    pickle.dump(rf_regressor, f)

# Save test dataset
feature_names_reg = [f"feature_{i}" for i in range(15)]
test_df_reg = pd.DataFrame(X_test_reg, columns=feature_names_reg)
test_df_reg['target'] = y_test_reg
test_df_reg.to_csv("test_datasets/regression_test_data.csv", index=False)

train_r2 = rf_regressor.score(X_train_reg, y_train_reg)
test_r2 = rf_regressor.score(X_test_reg, y_test_reg)

print(f"   ✅ Model saved: test_models/random_forest_regressor.pkl")
print(f"   ✅ Dataset saved: test_datasets/regression_test_data.csv")
print(f"   📊 Training R² Score: {train_r2:.4f}")
print(f"   📊 Test R² Score: {test_r2:.4f}")
print(f"   📦 Model Type: Regression")
print(f"   🔧 Framework: scikit-learn")
print(f"   📏 Dataset Size: {len(test_df_reg)} samples, {len(feature_names_reg)} features")

# ============================================================================
# 3. CLASSIFICATION MODEL - Logistic Regression (Simple)
# ============================================================================
print("\n3️⃣  Creating Simple Classification Model (Logistic Regression)...")

# Generate simpler classification dataset
X_simple, y_simple = make_classification(
    n_samples=800,
    n_features=8,
    n_informative=6,
    n_redundant=2,
    n_classes=3,  # Multi-class
    n_clusters_per_class=1,
    random_state=42
)

# Split data
X_train_simple, X_test_simple, y_train_simple, y_test_simple = train_test_split(
    X_simple, y_simple, test_size=0.3, random_state=42
)

# Create and train model
log_reg = LogisticRegression(
    max_iter=1000,
    random_state=42,
    multi_class='multinomial'
)
log_reg.fit(X_train_simple, y_train_simple)

# Save model
with open("test_models/logistic_regression_multiclass.pkl", "wb") as f:
    pickle.dump(log_reg, f)

# Save test dataset
feature_names_simple = [f"feature_{i}" for i in range(8)]
test_df_simple = pd.DataFrame(X_test_simple, columns=feature_names_simple)
test_df_simple['target'] = y_test_simple
test_df_simple.to_csv("test_datasets/multiclass_test_data.csv", index=False)

train_accuracy_simple = log_reg.score(X_train_simple, y_train_simple)
test_accuracy_simple = log_reg.score(X_test_simple, y_test_simple)

print(f"   ✅ Model saved: test_models/logistic_regression_multiclass.pkl")
print(f"   ✅ Dataset saved: test_datasets/multiclass_test_data.csv")
print(f"   📊 Training Accuracy: {train_accuracy_simple:.4f}")
print(f"   📊 Test Accuracy: {test_accuracy_simple:.4f}")
print(f"   📦 Model Type: Classification (Multi-class: 3 classes)")
print(f"   🔧 Framework: scikit-learn")
print(f"   📏 Dataset Size: {len(test_df_simple)} samples, {len(feature_names_simple)} features")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 60)
print("✨ Test Models and Datasets Created Successfully!")
print("=" * 60)
print("\n📁 Generated Files:")
print("\n   Models (upload these to EvalModel):")
print("   ├── test_models/random_forest_classifier.pkl")
print("   ├── test_models/random_forest_regressor.pkl")
print("   └── test_models/logistic_regression_multiclass.pkl")
print("\n   Datasets (use these for evaluation):")
print("   ├── test_datasets/classification_test_data.csv")
print("   ├── test_datasets/regression_test_data.csv")
print("   └── test_datasets/multiclass_test_data.csv")

print("\n📝 How to use these in EvalModel:")
print("   1. Start your frontend and backend servers")
print("   2. Go to the Upload page")
print("   3. Upload each .pkl model file with metadata:")
print("      - Model 1: Binary Classification (Random Forest)")
print("      - Model 2: Regression (Random Forest)")
print("      - Model 3: Multi-class Classification (Logistic Regression)")
print("   4. Upload the corresponding .csv dataset files")
print("   5. Go to Evaluate page and test each model-dataset pair")
print("   6. Compare all models on the Compare page")

print("\n🎯 Expected EvalScores:")
print(f"   - Binary Classifier: ~{test_accuracy * 100:.1f} (high accuracy)")
print(f"   - Regressor: ~{test_r2 * 100:.1f} (good R² score)")
print(f"   - Multi-class Classifier: ~{test_accuracy_simple * 100:.1f} (moderate accuracy)")

print("\n✅ All done! Ready to test your EvalModel platform! 🚀")
