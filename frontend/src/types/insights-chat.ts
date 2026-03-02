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
  // Display mode
  inline?: boolean;
  // All evaluations for comprehensive AI context
  allEvaluations?: EvaluationData[];
  allModels?: ModelInfo[];
  allDatasets?: DatasetInfo[];
}
