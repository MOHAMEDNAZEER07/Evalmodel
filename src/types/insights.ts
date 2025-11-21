/**
 * TypeScript interfaces for Insights data
 */

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
