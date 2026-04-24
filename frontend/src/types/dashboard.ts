/**
 * TypeScript interfaces for Dashboard data
 */

export interface Model {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: string;
  framework: string;
  file_path: string;
  file_size: number;
  is_evaluated: boolean;
  uploaded_at: string;
}

export interface Dataset {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  file_path: string;
  file_size: number;
  row_count?: number;
  column_count?: number;
  uploaded_at: string;
}

export interface Evaluation {
  id: string;
  model_id: string;
  dataset_id: string;
  user_id: string;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    r2_score?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    [key: string]: number | undefined;
  };
  eval_score: number;
  normalized_metrics?: Record<string, number>;
  weight_distribution?: Record<string, number>;
  evaluated_at: string;
  models?: {
    name: string;
  };
  datasets?: {
    name: string;
  };
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
  meta_verdict?: { status: string; message: string; confidence: number; critical_issues?: number; total_issues?: number };
  // Explainability
  feature_importance?: Array<{ feature: string; importance: number; rank: number }>;
  explainability_method?: string;
  shap_summary?: Record<string, unknown>;
  // Fairness
  fairness_metrics?: Record<string, unknown>;
  group_metrics?: Record<string, unknown>;
  sensitive_attribute?: string;
  // Strict mode comparison
  strict_result?: Record<string, unknown>;
}

export interface DashboardMetrics {
  totalModels: number;
  totalDatasets: number;
  totalEvaluations: number;
  averageAccuracy: number;
  averageEvalScore: number;
  modelsEvaluated: number;
  modelsUnevaluated: number;
  recentActivity: number; // evaluations in last 7 days
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentEvaluations: Evaluation[];
  isLoading: boolean;
  error: string | null;
}
