# ONNX Model Guide for EvalModel

## Why ONNX?

Machine learning models trained using scikit-learn are typically saved using pickle or joblib. However, these serialization formats have significant compatibility issues:

| Issue | Pickle/Joblib | ONNX |
|-------|---------------|------|
| Cross-Python version | ❌ No | ✅ Yes |
| Cross-scikit-learn version | ❌ No | ✅ Yes |
| Requires sklearn installed | ✅ Yes | ❌ No |
| Reliable long-term storage | ❌ Risky | ✅ Stable |
| Inference performance | Normal | ⚡ Fast, optimized |

**ONNX (Open Neural Network Exchange)** is a standardized, framework-neutral model format that ensures:
- Models work across Python versions (3.8 to 3.12+)
- No dependency on scikit-learn at inference time
- Fast, optimized inference via onnxruntime
- Stable long-term storage for reproducibility

## Converting sklearn Models to ONNX

### Option 1: Use the Built-in Conversion Script

EvalModel provides a utility script to convert your sklearn models:

```bash
cd backend/scripts

# Basic conversion
python convert_to_onnx.py --input model.pkl --output model.onnx --n_features 10

# With feature names from JSON file
python convert_to_onnx.py --input model.joblib --output model.onnx --feature_names features.json

# With inline feature names
python convert_to_onnx.py --input model.pkl --output model.onnx --feature_list "age,income,score"
```

### Option 2: Manual Conversion in Python

```python
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import json

# Load/train your model
df = pd.read_csv("your_dataset.csv")
X = df.drop(columns=["target"])
y = df["target"]

# IMPORTANT: Save feature order for ONNX (uses positional inputs)
feature_order = X.columns.tolist()
with open("feature_order.json", "w") as f:
    json.dump(feature_order, f)

# Create and train pipeline
pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", RandomForestClassifier(n_estimators=100, random_state=42))
])
pipe.fit(X, y)

# Convert to ONNX
initial_type = [("input", FloatTensorType([None, X.shape[1]]))]
onnx_model = convert_sklearn(pipe, initial_types=initial_type)

# Save ONNX model
with open("model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())
```

## Using ONNX Models with EvalModel

### Upload
1. Go to the Upload page
2. Select your `.onnx` file
3. Choose "ONNX" as the framework
4. Select the model type (classification/regression)
5. Upload your test dataset

### Evaluation
ONNX models are evaluated just like any other model format. EvalModel automatically:
- Loads the model using onnxruntime
- Converts input data to float32 (required by ONNX)
- Runs optimized inference
- Calculates all standard metrics

## Feature Order (Important!)

ONNX models use **positional inputs**, meaning the column order must match exactly what the model was trained with.

### Best Practice: Save Feature Order

When training your model:
```python
import json

# Save feature names in the exact order
feature_order = X.columns.tolist()
with open("feature_order.json", "w") as f:
    json.dump(feature_order, f)
```

When preparing data for inference:
```python
import json
import pandas as pd

# Load feature order
with open("feature_order.json", "r") as f:
    feature_order = json.load(f)

# Ensure columns are in correct order
df = pd.read_csv("new_data.csv")
X = df[feature_order]  # Reorder columns
```

## Common Issues and Solutions

### 1. Feature Order Mismatch
**Symptom**: Garbage predictions or errors
**Solution**: Always save and use `feature_order.json`

### 2. Dtype Errors
**Symptom**: `Invalid input type` errors
**Solution**: Convert input to float32:
```python
import numpy as np
X = np.asarray(X, dtype=np.float32)
```

### 3. Unsupported Transformers
**Symptom**: Conversion fails for custom sklearn components
**Solutions**:
- Use standard sklearn transformers
- Implement a custom converter
- Do preprocessing in Python, export only the model

### 4. Output Shape Differences
**Symptom**: Unexpected output format
**Solution**: Inspect output shapes:
```python
import onnxruntime as ort

session = ort.InferenceSession("model.onnx")
for output in session.get_outputs():
    print(f"{output.name}: {output.shape}")
```

## Requirements

Install ONNX dependencies:
```bash
pip install onnx onnxruntime skl2onnx
```

For GPU acceleration:
```bash
pip install onnxruntime-gpu
```

## Supported sklearn Components

Most sklearn estimators and transformers are supported, including:
- **Classifiers**: LogisticRegression, RandomForest, SVC, GradientBoosting, etc.
- **Regressors**: LinearRegression, Ridge, RandomForestRegressor, SVR, etc.
- **Preprocessors**: StandardScaler, MinMaxScaler, OneHotEncoder, LabelEncoder, etc.
- **Pipelines**: Full sklearn Pipeline objects

For the complete list, see: https://onnx.ai/sklearn-onnx/supported.html

## Performance Tips

1. **Batch inference**: Pass multiple rows at once for better performance
2. **Use GPU**: Install `onnxruntime-gpu` on CUDA-enabled machines
3. **Optimize graph**: Enable all optimizations:
   ```python
   import onnxruntime as ort
   
   sess_options = ort.SessionOptions()
   sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
   session = ort.InferenceSession("model.onnx", sess_options)
   ```

## Summary

- **Problem**: Pickle/joblib models fail across Python/sklearn versions
- **Solution**: Convert to ONNX for version-proof, portable inference
- **Benefits**: Cross-version compatibility, no sklearn dependency, fast inference
- **Files needed**: `model.onnx` + `feature_order.json`
