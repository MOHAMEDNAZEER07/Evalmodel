"""
Create a test sklearn model compatible with Python 3.11
Run this script to generate a test model file that you can upload
"""
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
import numpy as np

# Create a simple test dataset
X, y = make_classification(n_samples=100, n_features=4, n_classes=2, random_state=42)

# Train a simple model
model = RandomForestClassifier(n_estimators=10, random_state=42)
model.fit(X, y)

# Save the model with protocol 4 for maximum compatibility
output_file = "test_model_sklearn.pkl"
with open(output_file, 'wb') as f:
    pickle.dump(model, f, protocol=4)

print(f"✅ Test model created: {output_file}")
print(f"Model type: Random Forest Classifier")
print(f"Python version: 3.11")
print(f"Framework: sklearn")
print(f"\nYou can now upload this file through the Upload page.")
print("Make sure to select:")
print("  - Model Type: classification")
print("  - Framework: sklearn")
