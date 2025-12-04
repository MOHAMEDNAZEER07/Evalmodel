"""
ONNX Model Conversion Utility for EvalModel

This script converts scikit-learn models (pickle/joblib) to ONNX format
for maximum cross-version and cross-platform compatibility.

Usage:
    python convert_to_onnx.py --input model.pkl --output model.onnx --n_features 10
    python convert_to_onnx.py --input model.joblib --output model.onnx --feature_names "feature_order.json"

Why ONNX?
- Works across Python versions (3.8, 3.9, 3.10, 3.11, 3.12+)
- Works without scikit-learn installed
- Fast, optimized inference via onnxruntime
- Stable long-term storage
- No pickle/joblib version compatibility issues
"""

import argparse
import json
import pickle
import sys
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np


def load_sklearn_model(model_path: str):
    """Load sklearn model from pickle or joblib file."""
    path = Path(model_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    ext = path.suffix.lower()
    
    # Try joblib first (works for both .joblib and .pkl)
    try:
        return joblib.load(model_path)
    except Exception as e1:
        print(f"Joblib load failed: {e1}, trying pickle...")
    
    # Fallback to pickle
    try:
        with open(model_path, 'rb') as f:
            return pickle.load(f)
    except Exception as e2:
        raise ValueError(f"Failed to load model. Joblib error: {e1}, Pickle error: {e2}")


def convert_to_onnx(
    model,
    n_features: int,
    output_path: str,
    feature_names: Optional[List[str]] = None
) -> str:
    """
    Convert sklearn model/pipeline to ONNX format.
    
    Args:
        model: Trained sklearn model or pipeline
        n_features: Number of input features
        output_path: Path to save .onnx file
        feature_names: Optional list of feature names
    
    Returns:
        Path to the saved ONNX file
    """
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType
    except ImportError:
        print("ERROR: skl2onnx is not installed.")
        print("Install it with: pip install skl2onnx")
        sys.exit(1)
    
    # Define input type (None = dynamic batch size)
    initial_type = [("input", FloatTensorType([None, n_features]))]
    
    # Convert to ONNX
    print(f"Converting model to ONNX (input shape: [batch, {n_features}])...")
    
    try:
        onnx_model = convert_sklearn(
            model,
            initial_types=initial_type,
            target_opset=15  # Use a stable opset version
        )
    except Exception as e:
        print(f"ERROR during conversion: {e}")
        print("\nTips:")
        print("  - Ensure your model uses standard sklearn components")
        print("  - Custom transformers may need custom converters")
        print("  - Try updating skl2onnx: pip install --upgrade skl2onnx")
        sys.exit(1)
    
    # Save ONNX model
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    print(f"✅ ONNX model saved: {output_path}")
    print(f"   File size: {output_path.stat().st_size / 1024:.1f} KB")
    
    # Save feature order if provided
    if feature_names:
        feature_order_path = output_path.with_suffix('.feature_order.json')
        with open(feature_order_path, 'w') as f:
            json.dump(feature_names, f, indent=2)
        print(f"✅ Feature order saved: {feature_order_path}")
    
    return str(output_path)


def validate_onnx_model(onnx_path: str, n_features: int) -> bool:
    """Validate the converted ONNX model with random input."""
    try:
        import onnxruntime as ort
    except ImportError:
        print("WARNING: onnxruntime not installed, skipping validation")
        return True
    
    print("\nValidating ONNX model...")
    
    try:
        # Load model
        session = ort.InferenceSession(onnx_path)
        input_name = session.get_inputs()[0].name
        
        # Create dummy input
        dummy_input = np.random.randn(5, n_features).astype(np.float32)
        
        # Run inference
        outputs = session.run(None, {input_name: dummy_input})
        
        print(f"✅ Validation successful!")
        print(f"   Input shape: {dummy_input.shape}")
        print(f"   Output shapes: {[o.shape for o in outputs]}")
        print(f"   Output names: {[o.name for o in session.get_outputs()]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Validation failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Convert scikit-learn models to ONNX format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic conversion
  python convert_to_onnx.py --input model.pkl --output model.onnx --n_features 10
  
  # With feature names from JSON file
  python convert_to_onnx.py --input model.joblib --output model.onnx --feature_names features.json
  
  # With inline feature names
  python convert_to_onnx.py --input model.pkl --output model.onnx --n_features 3 --feature_list "age,income,score"

Why use ONNX?
  - Cross-Python version compatibility (3.8 to 3.12+)
  - No sklearn required at inference time
  - Fast, optimized inference
  - Stable long-term storage
        """
    )
    
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to input sklearn model (.pkl or .joblib)"
    )
    
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Path to output ONNX model (.onnx)"
    )
    
    parser.add_argument(
        "--n_features", "-n",
        type=int,
        help="Number of input features (required if --feature_names not provided)"
    )
    
    parser.add_argument(
        "--feature_names", "-f",
        help="Path to JSON file containing feature names list"
    )
    
    parser.add_argument(
        "--feature_list",
        help="Comma-separated list of feature names"
    )
    
    parser.add_argument(
        "--skip_validation",
        action="store_true",
        help="Skip ONNX model validation"
    )
    
    args = parser.parse_args()
    
    # Load feature names if provided
    feature_names = None
    n_features = args.n_features
    
    if args.feature_names:
        with open(args.feature_names, 'r') as f:
            feature_names = json.load(f)
        n_features = len(feature_names)
        print(f"Loaded {n_features} feature names from {args.feature_names}")
    
    elif args.feature_list:
        feature_names = [f.strip() for f in args.feature_list.split(",")]
        n_features = len(feature_names)
        print(f"Using {n_features} features: {feature_names}")
    
    if n_features is None:
        print("ERROR: Either --n_features or --feature_names/--feature_list is required")
        sys.exit(1)
    
    # Load sklearn model
    print(f"Loading sklearn model from: {args.input}")
    model = load_sklearn_model(args.input)
    print(f"Model type: {type(model).__name__}")
    
    # Convert to ONNX
    onnx_path = convert_to_onnx(
        model=model,
        n_features=n_features,
        output_path=args.output,
        feature_names=feature_names
    )
    
    # Validate
    if not args.skip_validation:
        validate_onnx_model(onnx_path, n_features)
    
    print("\n" + "="*50)
    print("Conversion complete!")
    print("="*50)
    print(f"\nTo use with EvalModel, upload: {args.output}")
    if feature_names:
        print(f"Feature order file: {Path(args.output).with_suffix('.feature_order.json')}")
    print("\nONNX models work across all Python versions and don't require sklearn!")


if __name__ == "__main__":
    main()
