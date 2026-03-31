/**
 * TypeScript interfaces for the Insights AI Chat component
 */

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface EvaluationData {
  id: string;
  model_id: string;
  dataset_id: string;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    r2_score?: number;
  };
  eval_score: number;
  evaluated_at: string;
  // Hybrid Trust Framework (MetaEvaluator)
  meta_score?: number;
  trust_score?: number;
  DII?: number;
  component_scores?: Record<string, number>;
  risk_values?: Record<string, number>;
  hybrid_weights?: Record<string, number>;
  dataset_health_score?: number;
  meta_flags?: string[];
  meta_recommendations?: Array<{ action: string; why: string; priority: string }>;
  meta_verdict?: { status: string; message: string; confidence?: number };
  // Explainability
  feature_importance?: Array<{ feature: string; importance: number; rank: number }>;
  explainability_method?: string;
  shap_summary?: Record<string, any>;
  // Fairness
  fairness_metrics?: Record<string, any>;
  group_metrics?: Record<string, any>;
  sensitive_attribute?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  model_type: string;
  framework: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
}

export interface InsightsAIChatProps {
  datasetName?: string;
  qualityScore?: number;
  outlierCount?: number;
  correlationCount?: number;
  issues?: string[];
  summary?: string;
  initialQuestion?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Model evaluation props
  insightType?: "dataset" | "model";
  modelName?: string;
  modelType?: string;
  modelFramework?: string;
  evalScore?: number;
  modelMetrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    r2_score?: number;
  };
  // Hybrid Trust Framework props (MetaEvaluator)
  trustScore?: number;
  metaScore?: number;
  dii?: number;
  componentScores?: Record<string, number>;
  riskValues?: Record<string, number>;
  hybridWeights?: Record<string, number>;
  datasetHealthScore?: number;
  metaFlags?: string[];
  metaRecommendations?: Array<{ action: string; why: string; priority: string }>;
  metaVerdict?: { status: string; message: string; confidence?: number };
  // Explainability props
  featureImportance?: Array<{ feature: string; importance: number; rank: number }>;
  explainabilityMethod?: string;
  shapSummary?: Record<string, any>;
  // Fairness props
  fairnessMetrics?: Record<string, any>;
  groupMetrics?: Record<string, any>;
  sensitiveAttribute?: string;
  // Display mode
  inline?: boolean;
  // All evaluations for comprehensive AI context
  allEvaluations?: EvaluationData[];
  allModels?: ModelInfo[];
  allDatasets?: DatasetInfo[];
}
