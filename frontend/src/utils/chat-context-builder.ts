/**
 * Builds context strings from evaluation data for the AI chat.
 */

import type { EvaluationData, ModelInfo, DatasetInfo } from "@/types/insights-chat";

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

  let evalContext = `\n===== ALL EVALUATION HISTORY (${allEvaluations.length} evaluations) =====\n`;

  allEvaluations.forEach((ev, idx) => {
    const model = allModels.find((m) => m.id === ev.model_id);
    const dataset = allDatasets.find((d) => d.id === ev.dataset_id);

    evalContext += `\n[${idx + 1}] ${model?.name || "Unknown Model"} on ${dataset?.name || "Unknown Dataset"}\n`;
    evalContext += `    Type: ${model?.model_type || "unknown"} | Framework: ${model?.framework || "unknown"}\n`;
    evalContext += `    EvalScore: ${ev.eval_score?.toFixed(1) || "N/A"}/100\n`;
    evalContext += `    Evaluated: ${ev.evaluated_at ? new Date(ev.evaluated_at).toLocaleDateString() : "N/A"}\n`;

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
  });

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
