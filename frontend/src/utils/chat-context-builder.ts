/**
 * Builds context strings from evaluation data for the AI chat.
 * Includes full MetaEvaluator / Hybrid Trust Framework data.
 */

import type { EvaluationData, ModelInfo, DatasetInfo } from "@/types/insights-chat";

function toDisplayText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Format all evaluations into a text block for the AI system prompt context.
 */
export function buildAllEvaluationsContext(
  allEvaluations: EvaluationData[],
  allModels: ModelInfo[],
  allDatasets: DatasetInfo[],
): string {
  if (!allEvaluations || allEvaluations.length === 0) {
    return "\nNo evaluation history available yet.\n";
  }

  // Limit to last 5 evaluations to keep context concise
  const MAX_HISTORY = 5;
  const recentEvals = allEvaluations.slice(0, MAX_HISTORY);
  const totalCount = allEvaluations.length;

  let evalContext = `\n===== EVALUATION HISTORY (showing ${recentEvals.length} of ${totalCount}) =====\n`;

  recentEvals.forEach((ev, idx) => {
    const model = allModels.find((m) => m.id === ev.model_id);
    const dataset = allDatasets.find((d) => d.id === ev.dataset_id);

    evalContext += `\n[${idx + 1}] ${model?.name || "Unknown Model"} on ${dataset?.name || "Unknown Dataset"}\n`;
    evalContext += `    Type: ${model?.model_type || "unknown"} | Framework: ${model?.framework || "unknown"}\n`;
    evalContext += `    EvalScore: ${ev.eval_score?.toFixed(1) || "N/A"}/100\n`;
    evalContext += `    Evaluated: ${ev.evaluated_at ? new Date(ev.evaluated_at).toLocaleDateString() : "N/A"}\n`;

    // Basic metrics
    const m = ev.metrics;
    if (m) {
      evalContext += `    Metrics: `;
      const metrics: string[] = [];
      if (m.accuracy !== undefined) metrics.push(`Accuracy=${(m.accuracy * 100).toFixed(2)}%`);
      if (m.precision !== undefined) metrics.push(`Precision=${(m.precision * 100).toFixed(2)}%`);
      if (m.recall !== undefined) metrics.push(`Recall=${(m.recall * 100).toFixed(2)}%`);
      if (m.f1_score !== undefined) metrics.push(`F1=${(m.f1_score * 100).toFixed(2)}%`);
      if (m.mae !== undefined) metrics.push(`MAE=${m.mae.toFixed(4)}`);
      if (m.mse !== undefined) metrics.push(`MSE=${m.mse.toFixed(4)}`);
      if (m.rmse !== undefined) metrics.push(`RMSE=${m.rmse.toFixed(4)}`);
      if (m.r2_score !== undefined) metrics.push(`R²=${m.r2_score.toFixed(4)}`);
      evalContext += metrics.length > 0 ? metrics.join(", ") : "No metrics";
      evalContext += "\n";
    }

    // Brief trust summary
    if (ev.trust_score !== undefined) {
      evalContext += `    Trust Score: ${ev.trust_score.toFixed(2)}/100\n`;
    }
    if (ev.meta_verdict) {
      const verdictMsg = ev.meta_verdict.message || ev.meta_verdict.status;
      evalContext += `    Verdict: ${verdictMsg}\n`;
    }
  });

  if (totalCount > MAX_HISTORY) {
    evalContext += `\n    ... and ${totalCount - MAX_HISTORY} older evaluations\n`;
  }

  evalContext += `===============================================\n`;
  return evalContext;
}

interface ModelContextParams {
  modelName?: string;
  modelType?: string;
  modelFramework?: string;
  datasetName?: string;
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
  // Hybrid Trust Framework
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
  // Explainability
  featureImportance?: Array<{ feature: string; importance: number; rank: number }>;
  explainabilityMethod?: string;
  shapSummary?: Record<string, unknown>;
  // Fairness
  fairnessMetrics?: Record<string, unknown>;
  groupMetrics?: Record<string, unknown>;
  sensitiveAttribute?: string;
}

interface DatasetContextParams {
  datasetName?: string;
  qualityScore?: number;
  outlierCount?: number;
  correlationCount?: number;
  issues?: string[];
  summary?: string;
}

/**
 * Build the full context message that gets sent to the edge function.
 */
export function buildContextMessage(
  insightType: "dataset" | "model",
  allEvalsContext: string,
  params: ModelContextParams & DatasetContextParams,
): string {
  if (insightType === "model") {
    let context = "=== CURRENT MODEL ANALYSIS ===\n";
    if (params.modelName) context += `Model: ${params.modelName}\n`;
    if (params.modelType) context += `Model Type: ${params.modelType}\n`;
    if (params.modelFramework) context += `Framework: ${params.modelFramework}\n`;
    if (params.datasetName) context += `Dataset: ${params.datasetName}\n`;
    if (params.evalScore !== undefined) context += `EvalScore: ${params.evalScore.toFixed(1)}/100\n`;

    // Basic performance metrics
    if (params.modelMetrics) {
      const mm = params.modelMetrics;
      context += `Performance Metrics:\n`;
      if (mm.accuracy !== undefined) context += `  • Accuracy: ${(mm.accuracy * 100).toFixed(2)}%\n`;
      if (mm.precision !== undefined) context += `  • Precision: ${(mm.precision * 100).toFixed(2)}%\n`;
      if (mm.recall !== undefined) context += `  • Recall: ${(mm.recall * 100).toFixed(2)}%\n`;
      if (mm.f1_score !== undefined) context += `  • F1 Score: ${(mm.f1_score * 100).toFixed(2)}%\n`;
      if (mm.mae !== undefined) context += `  • MAE: ${mm.mae.toFixed(4)}\n`;
      if (mm.mse !== undefined) context += `  • MSE: ${mm.mse.toFixed(4)}\n`;
      if (mm.rmse !== undefined) context += `  • RMSE: ${mm.rmse.toFixed(4)}\n`;
      if (mm.r2_score !== undefined) context += `  • R² Score: ${mm.r2_score.toFixed(4)}\n`;
    }

    // Hybrid Trust Framework (MetaEvaluator)
    if (params.trustScore !== undefined || params.dii !== undefined || params.metaVerdict) {
      context += `\nHybrid Trust Framework (MetaEvaluator):\n`;
      if (params.trustScore !== undefined) context += `  • Trust Score: ${params.trustScore.toFixed(2)}/100\n`;
      if (params.metaScore !== undefined) context += `  • Meta Score: ${params.metaScore.toFixed(2)}\n`;
      if (params.dii !== undefined) context += `  • DII (Data Instability Index): ${params.dii.toFixed(4)}\n`;
      if (params.datasetHealthScore !== undefined) context += `  • Dataset Health Score: ${params.datasetHealthScore.toFixed(2)}\n`;
      if (params.metaVerdict) {
        const msg = typeof params.metaVerdict === 'object'
          ? params.metaVerdict.message || params.metaVerdict.status
          : params.metaVerdict;
        context += `  • Verdict: ${msg}\n`;
      }
    }

    // Component scores (P, H, F, R)
    if (params.componentScores) {
      context += `\nComponent Scores:\n`;
      Object.entries(params.componentScores).forEach(([key, value]) => {
        context += `  • ${key}: ${typeof value === 'number' ? value.toFixed(3) : value}\n`;
      });
    }

    // Risk values
    if (params.riskValues) {
      context += `\nRisk Values:\n`;
      Object.entries(params.riskValues).forEach(([key, value]) => {
        context += `  • ${key}: ${typeof value === 'number' ? value.toFixed(3) : value}\n`;
      });
    }

    // Hybrid weights (λ distribution)
    if (params.hybridWeights) {
      context += `\nHybrid Weights (λ):\n`;
      Object.entries(params.hybridWeights).forEach(([key, value]) => {
        context += `  • ${key}: ${typeof value === 'number' ? value.toFixed(3) : value}\n`;
      });
    }

    // Fairness analysis
    if (params.sensitiveAttribute || params.fairnessMetrics || params.groupMetrics) {
      context += `\nFairness Analysis:\n`;
      if (params.sensitiveAttribute) context += `  • Sensitive Attribute: ${params.sensitiveAttribute}\n`;
      if (params.fairnessMetrics) {
        Object.entries(params.fairnessMetrics).forEach(([key, value]) => {
          context += `  • ${key}: ${typeof value === 'number' ? value.toFixed(4) : toDisplayText(value)}\n`;
        });
      }
      if (params.groupMetrics) {
        context += `  • Group Metrics: ${JSON.stringify(params.groupMetrics)}\n`;
      }
    }

    // Explainability
    if (params.explainabilityMethod || params.featureImportance) {
      context += `\nExplainability:\n`;
      if (params.explainabilityMethod) context += `  • Method: ${params.explainabilityMethod}\n`;
      if (params.featureImportance) {
        const sorted = [...params.featureImportance]
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 10);
        context += `  • Top Feature Importances:\n`;
        sorted.forEach(fi => {
          context += `    - ${fi.feature}: ${fi.importance.toFixed(4)}\n`;
        });
      }
      if (params.shapSummary) {
        context += `  • SHAP Summary: ${toDisplayText(params.shapSummary)}\n`;
      }
    }

    // Flags and recommendations
    if (params.metaFlags && params.metaFlags.length > 0) {
      context += `\nFlags/Warnings:\n`;
      params.metaFlags.forEach(flag => {
        context += `  ⚠ ${flag}\n`;
      });
    }
    if (params.metaRecommendations && params.metaRecommendations.length > 0) {
      context += `\nRecommendations:\n`;
      params.metaRecommendations.forEach(rec => {
        const text = typeof rec === 'object' ? `[${rec.priority}] ${rec.action}` : String(rec);
        context += `  → ${text}\n`;
      });
    }

    context += allEvalsContext;
    return context;
  }

  // Dataset context
  let context = "=== CURRENT DATASET ANALYSIS ===\n";
  if (params.datasetName) context += `Dataset: ${params.datasetName}\n`;
  if (params.qualityScore !== undefined) context += `Overall Quality Score: ${params.qualityScore.toFixed(1)}%\n`;
  if (params.outlierCount !== undefined && params.outlierCount > 0)
    context += `Outliers Detected: ${params.outlierCount} features with outliers\n`;
  if (params.correlationCount !== undefined && params.correlationCount > 0)
    context += `Feature Correlations: ${params.correlationCount} significant correlations found\n`;
  if (params.issues && params.issues.length > 0)
    context += `Issues Found:\n${params.issues.map((i) => `  • ${i}`).join("\n")}\n`;
  if (params.summary) context += `Summary: ${params.summary}\n`;

  context += allEvalsContext;
  return context;
}
