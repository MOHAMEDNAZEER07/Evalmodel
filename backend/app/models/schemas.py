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
    model_count: int = 0
    
    model_config = BASE_MODEL_CONFIG

# Model Schemas
class ModelUploadRequest(BaseModel):
    name: str
    description: Optional[str] = None
    model_type: ModelType
    framework: ModelFramework
    
class ModelMetadata(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    model_type: ModelType
    framework: ModelFramework
    file_path: str
    file_size: int
    uploaded_at: datetime
    is_evaluated: bool = False
    
    model_config = BASE_MODEL_CONFIG

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
    model_id: str
    dataset_id: str
    
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
    model_type: ModelType
    metrics: MetricsResult
    eval_score: EvalScoreResult
    evaluated_at: datetime
    
    model_config = BASE_MODEL_CONFIG

class ComparisonRequest(BaseModel):
    model_ids: List[str] = Field(min_length=2, max_length=10)
    dataset_id: str

class ComparisonResult(BaseModel):
    models: List[ModelMetadata]
    evaluations: List[EvaluationResult]
    leaderboard: List[Dict[str, Any]]
    
# Error Response
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
