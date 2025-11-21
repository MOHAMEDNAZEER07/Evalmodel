# Test Models and Datasets Mapping Guide

## 📊 Model-Dataset Pairs

### 1️⃣ Binary Classification Model
**Model File**: `random_forest_classifier.pkl`
- **Model Type**: Classification (Binary)
- **Framework**: scikit-learn
- **Algorithm**: Random Forest Classifier
- **Expected Accuracy**: ~78%

**Dataset File**: `classification_test_data.csv`
- **Samples**: 300 rows
- **Features**: 10 (feature_0 to feature_9)
- **Target Column**: `target` (values: 0 or 1)
- **Use Case**: Binary classification tasks

---

### 2️⃣ Regression Model
**Model File**: `random_forest_regressor.pkl`
- **Model Type**: Regression
- **Framework**: scikit-learn
- **Algorithm**: Random Forest Regressor
- **Expected R² Score**: ~0.83

**Dataset File**: `regression_test_data.csv`
- **Samples**: 300 rows
- **Features**: 15 (feature_0 to feature_14)
- **Target Column**: `target` (continuous values)
- **Use Case**: Continuous value prediction

---

### 3️⃣ Multi-class Classification Model
**Model File**: `logistic_regression_multiclass.pkl`
- **Model Type**: Classification (Multi-class)
- **Framework**: scikit-learn
- **Algorithm**: Logistic Regression
- **Expected Accuracy**: ~89%

**Dataset File**: `multiclass_test_data.csv`
- **Samples**: 240 rows
- **Features**: 8 (feature_0 to feature_7)
- **Target Column**: `target` (values: 0, 1, or 2)
- **Use Case**: Multi-class classification with 3 classes

---

## 🎯 Quick Reference Table

| Model Name | Model File | Dataset File | Type | Expected Score |
|------------|-----------|--------------|------|----------------|
| RF Binary Classifier | `random_forest_classifier.pkl` | `classification_test_data.csv` | Classification | 78% |
| RF Regressor | `random_forest_regressor.pkl` | `regression_test_data.csv` | Regression | R²=0.83 |
| Logistic Multi-class | `logistic_regression_multiclass.pkl` | `multiclass_test_data.csv` | Classification | 89% |

---

## 📝 Upload Instructions

### Step 1: Upload Models
Go to **Upload** page → **Upload Model** tab:

1. **Binary Classifier**
   - Drag: `random_forest_classifier.pkl`
   - Name: "Binary Classifier - Random Forest"
   - Type: Classification
   - Framework: sklearn

2. **Regressor**
   - Drag: `random_forest_regressor.pkl`
   - Name: "Regressor - Random Forest"
   - Type: Regression
   - Framework: sklearn

3. **Multi-class Classifier**
   - Drag: `logistic_regression_multiclass.pkl`
   - Name: "Multi-class Classifier - Logistic Regression"
   - Type: Classification
   - Framework: sklearn

### Step 2: Upload Datasets
Go to **Upload** page → **Upload Dataset** tab:

1. **Binary Dataset**
   - Drag: `classification_test_data.csv`
   - Name: "Binary Classification Test Data"
   - Description: "300 samples, 10 features, binary target"

2. **Regression Dataset**
   - Drag: `regression_test_data.csv`
   - Name: "Regression Test Data"
   - Description: "300 samples, 15 features, continuous target"

3. **Multi-class Dataset**
   - Drag: `multiclass_test_data.csv`
   - Name: "Multi-class Test Data"
   - Description: "240 samples, 8 features, 3-class target"

### Step 3: Evaluate Pairs
Go to **Evaluate** page and test:

✅ **Pair 1**: Binary Classifier + Binary Classification Test Data  
✅ **Pair 2**: Regressor + Regression Test Data  
✅ **Pair 3**: Multi-class Classifier + Multi-class Test Data  

❌ **Don't mix**: Classification models with regression datasets (or vice versa)

---

## ⚠️ Important Notes

- **Always match model type with dataset type**
- Binary/Multi-class classifiers need classification datasets
- Regressors need regression datasets
- Feature count doesn't need to match exactly (model will use what it needs)
- Target column must be named `target` in CSV files
- All models are scikit-learn (.pkl format)

---

## 🧪 Testing Scenarios

### Scenario 1: Individual Evaluation
Test each model with its corresponding dataset to get baseline metrics

### Scenario 2: Compare Classification Models
Compare Binary Classifier vs Multi-class Classifier (both on classification tasks)

### Scenario 3: Full Platform Test
Upload all 3 models and datasets, evaluate all pairs, view comparison dashboard

---

**Generated**: November 19, 2025  
**Location**: `test_models/test_datasets/`
