/**
 * TypeScript interfaces for Insights data
 */

export interface ModelData {
  id: string;
  name: string;
  description: string;
  model_type: string;
  framework: string;
  file_size: number;
  uploaded_at: string;
  is_evaluated?: boolean;
}

export interface Evaluation {
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
}

export interface DataQualityMetrics {
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  overall_score: number;
  total_rows: number;
  total_columns: number;
  missing_values: number;
  status: "good" | "warning" | "poor";
}

export interface OutlierInfo {
  feature: string;
  count: number;
  percentage: number;
  impact: "high" | "medium" | "low";
  lower_bound: number;
  upper_bound: number;
  min_value: number;
  max_value: number;
  mean: number;
  std: number;
}

export interface OutliersData {
  outliers: OutlierInfo[];
  total_outliers: number;
  affected_features: number;
  method: "iqr" | "zscore";
}

export interface CorrelationPair {
  feature1: string;
  feature2: string;
  correlation: number;
  abs_correlation: number;
  strength: "very_strong" | "strong" | "moderate";
  direction: "positive" | "negative";
}

export interface CorrelationsData {
  correlations: CorrelationPair[];
  strong_correlations: CorrelationPair[];
  total_pairs: number;
  correlation_matrix?: Record<string, Record<string, number>>;
  method: "pearson" | "spearman";
  features_analyzed: string[];
}

export interface InsightsSummary {
  dataset_id: string;
  quality_metrics: DataQualityMetrics;
  outliers: OutliersData;
  correlations: {
    top_correlations: CorrelationPair[];
    strong_correlations: CorrelationPair[];
    total_pairs: number;
  };
  summary: string;
  features_analyzed: number;
  rows_analyzed: number;
}

export interface InsightsState {
  datasetId: string | null;
  quality: DataQualityMetrics | null;
  outliers: OutliersData | null;
  correlations: CorrelationsData | null;
  summary: InsightsSummary | null;
  isLoading: boolean;
  error: string | null;
}
