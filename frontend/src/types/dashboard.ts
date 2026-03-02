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
    f1?: number;
    r2?: number;
    mae?: number;
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
