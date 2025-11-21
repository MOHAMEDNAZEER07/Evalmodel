"""
Pydantic Models for API Request/Response Schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Global model config to disable protected namespace warnings
BASE_MODEL_CONFIG = ConfigDict(
    from_attributes=True,
    protected_namespaces=()
)

# Enums
class ModelType(str, Enum):
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    NLP = "nlp"
    COMPUTER_VISION = "cv"

class ModelFramework(str, Enum):
    SKLEARN = "sklearn"
    PYTORCH = "pytorch"
    TENSORFLOW = "tensorflow"
    KERAS = "keras"
    ONNX = "onnx"

class UserTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"

# User Schemas
class UserBase(BaseModel):
    email: str
    username: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    tier: UserTier
    created_at: datetime
    count: int = 0
    
    model_config = BASE_MODEL_CONFIG

# Model Schemas
class ModelUploadRequest(BaseModel):
    name: str
    description: Optional[str] = None
    type: ModelType
    framework: ModelFramework
    
class ModelMetadata(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    type: ModelType = Field(alias='model_type')
    framework: ModelFramework
    file_path: str
    file_size: int
    uploaded_at: datetime
    is_evaluated: bool = False
    
    model_config = ConfigDict(
        from_attributes=True,
        protected_namespaces=(),
        populate_by_name=True
    )

class ModelListResponse(BaseModel):
    models: List[ModelMetadata]
    total: int

# Dataset Schemas
class DatasetUploadRequest(BaseModel):
    name: str
    description: Optional[str] = None
    
class DatasetMetadata(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    file_path: str
    file_size: int
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    uploaded_at: datetime
    
    model_config = BASE_MODEL_CONFIG

# Evaluation Schemas
class EvaluationRequest(BaseModel):
    id: str
    dataset_id: str
    # Optional explicit sensitive attribute column name. If provided, it will be used when present in the dataset.
    sensitive_attribute: Optional[str] = None
    
class MetricsResult(BaseModel):
    # Classification
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    
    # Regression
    mae: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    r2_score: Optional[float] = None
    
    # NLP
    bleu_score: Optional[float] = None
    rouge_score: Optional[Dict[str, float]] = None
    perplexity: Optional[float] = None
    
    # CV
    iou: Optional[float] = None
    dice_coefficient: Optional[float] = None
    pixel_accuracy: Optional[float] = None

class EvalScoreResult(BaseModel):
    eval_score: float = Field(ge=0, le=100, description="Unified score 0-100")
    normalized_metrics: Dict[str, float]
    weight_distribution: Dict[str, float]

class EvaluationResult(BaseModel):
    id: str
    model_id: str
    dataset_id: str
    type: ModelType
    metrics: MetricsResult
    eval_score: EvalScoreResult
    evaluated_at: datetime
    meta_score: Optional[float] = None
    dataset_health_score: Optional[float] = None
    meta_flags: Optional[List[str]] = None
    meta_recommendations: Optional[List[Dict[str, Any]]] = None
    meta_verdict: Optional[Dict[str, Any]] = None
    feature_importance: Optional[List[Dict[str, Any]]] = None
    explainability_method: Optional[str] = None
    shap_summary: Optional[Dict[str, Any]] = None
    fairness_metrics: Optional[Dict[str, Any]] = None
    group_metrics: Optional[List[Dict[str, Any]]] = None
    sensitive_attribute: Optional[str] = None
    
    model_config = BASE_MODEL_CONFIG

class ComparisonRequest(BaseModel):
    ids: List[str] = Field(min_length=2, max_length=10)
    dataset_id: str

class ComparisonResult(BaseModel):
    models: List[ModelMetadata]
    evaluations: List[EvaluationResult]
    leaderboard: List[Dict[str, Any]]
    
# Error Response
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
