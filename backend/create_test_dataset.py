"""
Create a test dataset for evaluation
Run this script to generate a compatible CSV dataset
"""
import pandas as pd
from sklearn.datasets import make_classification

# Create a simple classification dataset
X, y = make_classification(
    n_samples=200,
    n_features=4,
    n_classes=2,
    n_informative=3,
    n_redundant=1,
    random_state=42
)

# Create DataFrame
df = pd.DataFrame(X, columns=['feature_1', 'feature_2', 'feature_3', 'feature_4'])
df['target'] = y

# Save to CSV
output_file = "test_dataset.csv"
df.to_csv(output_file, index=False)

print(f"✅ Test dataset created: {output_file}")
print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")
print(f"\nDataset preview:")
print(df.head())
print(f"\nYou can now upload this file through the Upload page.")
print("The last column 'target' contains the labels.")
