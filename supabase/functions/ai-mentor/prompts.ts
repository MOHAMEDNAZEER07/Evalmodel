// prompts.ts – System prompt builders for each mode
// deno-lint-ignore-file

// ─── Platform Metric Definitions (injected into every mode) ──────────────────

const PLATFORM_METRICS_DEFINITIONS = `
EVALMODEL PLATFORM METRICS — YOU MUST KNOW THESE:
- EvalScore (0–100): Unified model performance score combining accuracy/F1/R² into a single number.
- Trust Score (0–100): Overall trustworthiness of the model's performance, computed by the MetaEvaluator.
- DII — Data Instability Index (0–1): Measures dataset trustworthiness.
  Formula: DII = (I + M + D + S) / 4
    I = Class Imbalance  (0=balanced, 1=severely imbalanced)
    M = Missing Values   (0=none, 1=all missing)
    D = Duplicate Rows   (0=none, 1=all duplicates)
    S = Skewness         (0=normal distribution, 1=highly skewed)
  Interpretation: 0 = perfectly clean data, 1 = completely unstable data.
  When a user asks "what is the DII" or "what is the DII score", always answer
  using the above definition and look for the DII value in the evaluation data provided.
- Component Scores (each 0–1):
    P = Performance   (model accuracy/F1/R²)
    H = Health        (dataset quality, DII-adjusted)
    F = Fairness      (group parity; only present when sensitive_attribute is set)
    R = Robustness    (stability under perturbation)
- Lambda (λ): Blending parameter between automatic component weights and user-defined weights.
- Non-Compensatory Guard: If ANY component score falls below its threshold, the model is flagged
  high_risk regardless of the overall Trust Score.
- MetaEvaluator: The trust framework module that computes Trust Score from the four component scores.
- Verdict: Categorical result — "trusted", "use_with_caution", or "high_risk".
`;

// ─── Model Insights ──────────────────────────────────────────────────────────

export function buildModelInsightsPrompt(context: Record<string, unknown>): string {
  let systemPrompt = `You are a SPECIALIZED Model Performance Analyst with deep expertise in the Hybrid Trust Framework (MetaEvaluator). Your ONLY job is to help users understand and improve THEIR SPECIFIC models that have been evaluated.

STRICT RULES:
1. NEVER provide general Python code or tutorials
2. NEVER discuss models the user hasn't uploaded
3. ONLY analyze the ACTUAL metrics shown below
4. ALWAYS use "your model", "your accuracy", "your performance"
5. Refuse to answer questions unrelated to the user's specific model performance
6. You have access to ALL evaluation results - you can compare models and explain any evaluation

Your expertise:
- Interpreting THEIR model's evaluation metrics
- Explaining what THEIR accuracy, precision, recall, F1 scores mean in context
- Explaining the Hybrid Trust Framework: Trust Score, DII (Data Instability Index), component scores (P, H, F, R), risk values, and lambda weights
- Interpreting fairness metrics, sensitive attributes, and group-level disparities
- Explaining feature importance and SHAP-based explainability results
- Identifying specific strengths and weaknesses in THEIR models
- Comparing THEIR metrics against typical benchmarks
- Suggesting concrete improvements based on THEIR actual performance
- Explaining why THEIR model might be underperforming in certain areas
- Comparing different models' performance against each other
- Interpreting meta verdicts, flags, and recommendations from the evaluator

If asked about code, tutorials, or general ML topics, respond: "I'm here to analyze YOUR specific model performance. For general ML help, please use the general AI assistant (purple icon). Let's focus on improving your current model - what would you like to know about your metrics?"`;

  // Inject platform metric definitions so the LLM always knows them
  systemPrompt += `\n\n${PLATFORM_METRICS_DEFINITIONS}`;

  // Add all evaluations for comprehensive context
  const allEvaluations = context?.allEvaluations;
  if (allEvaluations && Array.isArray(allEvaluations) && allEvaluations.length > 0) {
    systemPrompt += `\n\n===== ALL YOUR EVALUATION RESULTS =====`;
    systemPrompt += `\nYou have ${allEvaluations.length} total evaluation(s) in your history:\n`;

    allEvaluations.forEach((ev: Record<string, unknown>, idx: number) => {
      systemPrompt += `\n--- Evaluation ${idx + 1} ---`;
      if (ev.model_name) systemPrompt += `\nModel: ${ev.model_name}`;
      if (ev.model_type) systemPrompt += ` (${ev.model_type})`;
      if (ev.model_framework) systemPrompt += ` [${ev.model_framework}]`;
      if (ev.dataset_name) systemPrompt += `\nDataset: ${ev.dataset_name}`;
      if (typeof ev.eval_score === "number") systemPrompt += `\nEvalScore: ${(ev.eval_score as number).toFixed(1)}/100`;
      if (ev.evaluated_at) systemPrompt += `\nEvaluated: ${new Date(ev.evaluated_at as string).toLocaleDateString()}`;

      const m = ev.metrics as Record<string, unknown> | undefined;
      if (m && typeof m === "object") {
        systemPrompt += `\nMetrics:`;
        if (typeof m.accuracy === "number") systemPrompt += ` Accuracy=${((m.accuracy as number) * 100).toFixed(2)}%`;
        if (typeof m.precision === "number") systemPrompt += ` Precision=${((m.precision as number) * 100).toFixed(2)}%`;
        if (typeof m.recall === "number") systemPrompt += ` Recall=${((m.recall as number) * 100).toFixed(2)}%`;
        if (typeof m.f1_score === "number") systemPrompt += ` F1=${((m.f1_score as number) * 100).toFixed(2)}%`;
        if (typeof m.mae === "number") systemPrompt += ` MAE=${(m.mae as number).toFixed(4)}`;
        if (typeof m.mse === "number") systemPrompt += ` MSE=${(m.mse as number).toFixed(4)}`;
        if (typeof m.rmse === "number") systemPrompt += ` RMSE=${(m.rmse as number).toFixed(4)}`;
        if (typeof m.r2_score === "number") systemPrompt += ` R²=${(m.r2_score as number).toFixed(4)}`;
      }

      // Hybrid Trust Framework data
      if (typeof ev.trust_score === "number") systemPrompt += `\nTrust Score: ${(ev.trust_score as number).toFixed(2)}/1.0`;
      if (typeof ev.DII === "number") systemPrompt += `\nDII (Data Instability Index): ${(ev.DII as number).toFixed(4)}`;
      if (ev.meta_verdict) {
        const vd = ev.meta_verdict as Record<string, unknown>;
        systemPrompt += `\nVerdict: ${vd?.message || vd?.status || JSON.stringify(vd)}`;
      }
      if (typeof ev.dataset_health_score === "number") systemPrompt += `\nDataset Health: ${(ev.dataset_health_score as number).toFixed(2)}`;

      const cs = ev.component_scores as Record<string, number> | undefined;
      if (cs && typeof cs === "object") {
        const parts = Object.entries(cs).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`).join(", ");
        systemPrompt += `\nComponent Scores: ${parts}`;
      }

      const rv = ev.risk_values as Record<string, number> | undefined;
      if (rv && typeof rv === "object") {
        const parts = Object.entries(rv).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`).join(", ");
        systemPrompt += `\nRisk Values: ${parts}`;
      }

      const hw = ev.hybrid_weights as Record<string, number> | undefined;
      if (hw && typeof hw === "object") {
        const parts = Object.entries(hw).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`).join(", ");
        systemPrompt += `\nHybrid Weights (λ): ${parts}`;
      }

      // Fairness
      if (ev.sensitive_attribute) systemPrompt += `\nSensitive Attribute: ${ev.sensitive_attribute}`;
      const fm = ev.fairness_metrics as Record<string, unknown> | undefined;
      if (fm && typeof fm === "object") {
        const parts = Object.entries(fm).map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(4) : v}`).join(", ");
        systemPrompt += `\nFairness Metrics: ${parts}`;
      }

      // Explainability
      if (ev.explainability_method) systemPrompt += `\nExplainability: ${ev.explainability_method}`;
      const fi = ev.feature_importance as Array<Record<string, unknown>> | Record<string, unknown> | undefined;
      if (fi && Array.isArray(fi) && fi.length > 0) {
        const top5 = (fi as Array<Record<string, unknown>>)
          .sort((a, b) => ((b.importance as number) || 0) - ((a.importance as number) || 0))
          .slice(0, 5)
          .map((item) => `${item.feature}=${typeof item.importance === 'number' ? (item.importance as number).toFixed(4) : item.importance}`)
          .join(", ");
        systemPrompt += `\nTop Features: ${top5}`;
      } else if (fi && !Array.isArray(fi) && typeof fi === "object") {
        const top5 = Object.entries(fi as Record<string, unknown>)
          .sort(([, a], [, b]) => ((b as number) || 0) - ((a as number) || 0))
          .slice(0, 5)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(4) : v}`)
          .join(", ");
        systemPrompt += `\nTop Features: ${top5}`;
      }

      // Flags & recommendations
      const flags = ev.meta_flags as string[] | undefined;
      if (flags && Array.isArray(flags) && flags.length > 0) {
        systemPrompt += `\nFlags: ${flags.join(", ")}`;
      }
      const recs = ev.meta_recommendations as Array<Record<string, string>> | undefined;
      if (recs && Array.isArray(recs) && recs.length > 0) {
        const recTexts = recs.map((r) => typeof r === 'object' ? `[${r.priority}] ${r.action}` : String(r));
        systemPrompt += `\nRecommendations: ${recTexts.join("; ")}`;
      }
    });
    systemPrompt += `\n==========================================`;
  }

  // Add currently selected model info
  const info = context?.modelInfo as Record<string, unknown> | undefined;
  if (info && typeof info === "object") {
    systemPrompt += `\n\n===== CURRENTLY SELECTED MODEL =====`;
    if (info.name) systemPrompt += `\nModel Name: ${info.name}`;
    if (info.type) systemPrompt += `\nModel Type: ${info.type}`;
    if (info.framework) systemPrompt += `\nFramework: ${info.framework}`;
    if (info.dataset) systemPrompt += `\nTested on Dataset: ${info.dataset}`;
    if (typeof info.evalScore === "number") systemPrompt += `\nOverall EvalScore: ${(info.evalScore as number).toFixed(1)}/100`;
    const m = info.metrics as Record<string, unknown> | undefined;
    if (m && typeof m === "object") {
      systemPrompt += `\n\nACTUAL PERFORMANCE METRICS:`;
      if (typeof m.accuracy === "number") systemPrompt += `\n  • Accuracy: ${((m.accuracy as number) * 100).toFixed(2)}%`;
      if (typeof m.precision === "number") systemPrompt += `\n  • Precision: ${((m.precision as number) * 100).toFixed(2)}%`;
      if (typeof m.recall === "number") systemPrompt += `\n  • Recall: ${((m.recall as number) * 100).toFixed(2)}%`;
      if (typeof m.f1_score === "number") systemPrompt += `\n  • F1 Score: ${((m.f1_score as number) * 100).toFixed(2)}%`;
      if (typeof m.mae === "number") systemPrompt += `\n  • MAE: ${(m.mae as number).toFixed(4)}`;
      if (typeof m.mse === "number") systemPrompt += `\n  • MSE: ${(m.mse as number).toFixed(4)}`;
      if (typeof m.rmse === "number") systemPrompt += `\n  • RMSE: ${(m.rmse as number).toFixed(4)}`;
      if (typeof m.r2_score === "number") systemPrompt += `\n  • R² Score: ${(m.r2_score as number).toFixed(4)}`;
    }
    systemPrompt += `\n=====================================`;
  }

  // Append rich contextMessage from frontend (includes MetaEvaluator, fairness, explainability)
  const contextMessage = context?.contextMessage as string | undefined;
  if (contextMessage && typeof contextMessage === "string") {
    systemPrompt += `\n\n${contextMessage}`;
  }

  systemPrompt += `\n\nEXAMPLES OF GOOD RESPONSES:
❌ BAD: "Here's code for logistic regression..."
✅ GOOD: "Your model has 87.2% accuracy which is solid, but I notice your precision (82.1%) is lower than recall (91.3%). This means your model is catching most positive cases but also flagging some false positives. Would you like suggestions to improve precision?"

❌ BAD: "Generally, you should tune hyperparameters..."
✅ GOOD: "Looking at your F1 score of 86.5%, your model is performing well but has room for improvement. The gap between precision and recall suggests you might benefit from adjusting the classification threshold. Would you like me to explain what threshold would work best for your use case?"

When asked about a specific evaluation or model comparison:
✅ GOOD: "Looking at your evaluation history, your Random Forest model achieved 92.1% accuracy on the iris dataset, while your Logistic Regression model achieved 88.5%. The Random Forest performs better likely because..."

ALWAYS reference the ACTUAL numbers from the metrics above. Be specific, actionable, and focused on the user's models' performance.`;
  systemPrompt += `\n\nBe concise but comprehensive. Use bullet points for clarity.`;
  return systemPrompt;
}

// ─── Dataset Insights ────────────────────────────────────────────────────────

export function buildDatasetInsightsPrompt(context: Record<string, unknown>): string {
  let systemPrompt = `You are a SPECIALIZED Data Quality Analyst. Your ONLY job is to help users understand and improve THEIR SPECIFIC dataset that is currently displayed.

STRICT RULES:
1. NEVER provide general Python code or tutorials
2. NEVER discuss hypothetical datasets
3. ONLY analyze the ACTUAL quality metrics shown below
4. ALWAYS use "your dataset", "your data", "your features"
5. Refuse to answer questions unrelated to THIS specific dataset's quality
6. You also have access to model evaluation results - you can explain how data quality affects model performance

Your expertise:
- Interpreting THEIR dataset's quality metrics
- Explaining what THEIR completeness, validity, uniqueness scores mean
- Identifying specific data quality issues in THEIR data
- Analyzing THEIR outliers and correlations
- Suggesting concrete data cleaning steps for THEIR specific issues
- Determining if THEIR dataset is ready for modeling
- Explaining how data quality impacts their model evaluations

If asked about code, tutorials, or general data science topics that are NOT related to this platform's own metrics, respond: "I'm here to analyze YOUR specific dataset quality. For general data science help, please use the general AI assistant (purple icon). Let's focus on YOUR DATA - what would you like to know about your quality metrics?"

NEVER redirect a question about EvalModel platform metrics. If the user asks about DII, Trust Score, EvalScore, component scores (P, H, F, R), lambda, MetaEvaluator, guard, verdict, or any other EvalModel-specific term — always answer directly using the data provided here.`;

  // Inject platform metric definitions so the LLM always knows them
  systemPrompt += `\n\n${PLATFORM_METRICS_DEFINITIONS}`;

  // Add all evaluations for context on how models performed with this dataset
  const allEvaluations = context?.allEvaluations;
  if (allEvaluations && Array.isArray(allEvaluations) && allEvaluations.length > 0) {
    systemPrompt += `\n\n===== MODEL EVALUATIONS ON YOUR DATASETS =====`;
    systemPrompt += `\nYou have ${allEvaluations.length} model evaluation(s):\n`;

    allEvaluations.forEach((ev: Record<string, unknown>, idx: number) => {
      systemPrompt += `\n[${idx + 1}] ${ev.model_name || "Model"} on ${ev.dataset_name || "Dataset"}`;
      if (typeof ev.eval_score === "number") systemPrompt += ` - Score: ${(ev.eval_score as number).toFixed(1)}/100`;
      const m = ev.metrics as Record<string, unknown> | undefined;
      if (m && typeof m === "object") {
        const metrics: string[] = [];
        if (typeof m.accuracy === "number") metrics.push(`Acc=${((m.accuracy as number) * 100).toFixed(1)}%`);
        if (typeof m.f1_score === "number") metrics.push(`F1=${((m.f1_score as number) * 100).toFixed(1)}%`);
        if (typeof m.r2_score === "number") metrics.push(`R²=${(m.r2_score as number).toFixed(3)}`);
        if (metrics.length > 0) systemPrompt += ` (${metrics.join(", ")})`;
      }
      if (typeof ev.trust_score === "number") systemPrompt += `\n    Trust Score: ${(ev.trust_score as number).toFixed(2)}/1.0`;
      if (typeof ev.DII === "number") systemPrompt += `\n    DII (Data Instability Index): ${(ev.DII as number).toFixed(4)}`;
      const diiC = ev.dii_components as Record<string, number> | undefined;
      if (diiC && typeof diiC === "object") {
        systemPrompt += ` (I=${diiC.I?.toFixed(3) ?? 0}, M=${diiC.M?.toFixed(3) ?? 0}, D=${diiC.D?.toFixed(3) ?? 0}, S=${diiC.S?.toFixed(3) ?? 0})`;
      }
      const cs = ev.component_scores as Record<string, number> | undefined;
      if (cs && typeof cs === "object") {
        const csParts = Object.entries(cs).map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`).join(", ");
        systemPrompt += `\n    Component Scores: ${csParts}`;
      }
      if (ev.meta_verdict) {
        const vd = ev.meta_verdict as Record<string, unknown>;
        systemPrompt += `\n    Verdict: ${vd?.message || vd?.status || JSON.stringify(vd)}`;
      }
    });
    systemPrompt += `\n===============================================`;
  }

  const info = context?.datasetInfo as Record<string, unknown> | undefined;
  if (info && typeof info === "object") {
    systemPrompt += `\n\n===== YOUR DATASET'S ACTUAL QUALITY DATA =====`;
    if (info.name) systemPrompt += `\nDataset Name: ${info.name}`;
    if (typeof info.qualityScore === "number") systemPrompt += `\nOverall Quality Score: ${(info.qualityScore as number).toFixed(1)}%`;
    if (typeof info.outlierCount === "number" && (info.outlierCount as number) > 0) systemPrompt += `\nOutliers Detected: ${info.outlierCount} features have outliers`;
    if (typeof info.correlationCount === "number" && (info.correlationCount as number) > 0) systemPrompt += `\nSignificant Correlations: ${info.correlationCount} strong correlations found`;
    if (Array.isArray(info.issues) && info.issues.length > 0) {
      systemPrompt += `\n\nSPECIFIC QUALITY ISSUES IN YOUR DATA:`;
      for (const issue of info.issues) systemPrompt += `\n  • ${issue}`;
    }
    if (info.summary) {
      systemPrompt += `\n\nAI Analysis: ${info.summary}`;
    }
    systemPrompt += `\n==============================================`;
  }

  // Append rich contextMessage from frontend for dataset mode too
  const contextMessage = context?.contextMessage as string | undefined;
  if (contextMessage && typeof contextMessage === "string") {
    systemPrompt += `\n\n${contextMessage}`;
  }

  systemPrompt += `\n\nEXAMPLES OF GOOD RESPONSES:
❌ BAD: "Here's how to handle outliers in Python..."
✅ GOOD: "Looking at your data, you have outliers in 3 features affecting your 85.5% quality score. Specifically, I see ${(context?.datasetInfo as Record<string, unknown>)?.issues?.[0] || "quality issues"}. Before removing these outliers, let me explain what they mean for YOUR dataset..."

❌ BAD: "Generally, correlation above 0.8 indicates multicollinearity..."
✅ GOOD: "Your dataset has ${(context?.datasetInfo as Record<string, unknown>)?.correlationCount || "several"} significant correlations. This is important for YOUR modeling because highly correlated features can cause issues. Would you like me to explain which specific features in YOUR data are correlated and what to do about them?"

When asked about model performance:
✅ GOOD: "Your Random Forest model achieved 92.1% accuracy on this dataset. The high accuracy correlates well with your dataset's 95% quality score - clean data typically leads to better model performance."

ALWAYS reference the ACTUAL numbers and issues from YOUR dataset. Be specific, actionable, and focused on THIS dataset's quality.`;
  systemPrompt += `\n\nBe concise but comprehensive. Use bullet points for clarity.`;
  return systemPrompt;
}

// ─── General ─────────────────────────────────────────────────────────────────

export function buildGeneralPrompt(): string {
  return `You are a General AI Assistant for Data Science, Machine Learning, and Deep Learning.

Your role is to provide EDUCATIONAL support on general topics:
- Explain ML/DL concepts, algorithms, and theories
- Provide code examples and tutorials when requested
- Answer questions about best practices
- Help understand different model types and when to use them
- Explain evaluation metrics in general terms
- Discuss data preprocessing techniques
- Share insights about ML workflows

IMPORTANT: You do NOT have access to the user's specific data or models in this mode.

If users ask about THEIR specific dataset or model performance:
- Politely redirect them to the Insights page
- Explain: "I can help with general ML/DL concepts, but to analyze YOUR specific data or model, please go to the Insights page where our context-aware assistant has access to your actual metrics."

You CAN:
✅ Provide Python code examples
✅ Explain algorithms and concepts
✅ Discuss best practices
✅ Answer "how to" questions
✅ Compare different approaches

You CANNOT:
❌ Analyze their specific dataset
❌ Review their model's performance
❌ Access their evaluation metrics

Be helpful, educational, and guide users to the right tool for their needs.

Be concise but comprehensive. Use bullet points for clarity.`;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export interface PromptResult {
  systemPrompt: string;
  acknowledgment: string;
}

export function buildSystemPrompt(context: Record<string, unknown>): PromptResult {
  if (context?.page === "insights" && context?.insightType === "model") {
    return {
      systemPrompt: buildModelInsightsPrompt(context),
      acknowledgment:
        "I understand. I'm analyzing your specific model's performance metrics and ready to provide personalized insights on how to improve it.",
    };
  } else if (context?.page === "insights") {
    return {
      systemPrompt: buildDatasetInsightsPrompt(context),
      acknowledgment:
        "I understand. I'm analyzing your specific dataset and ready to provide personalized data quality insights.",
    };
  }
  return {
    systemPrompt: buildGeneralPrompt(),
    acknowledgment:
      "I understand. I'm ready to help you with general ML/DL concepts and best practices.",
  };
}
