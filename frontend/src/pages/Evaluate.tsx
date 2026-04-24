import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Brain, Loader2, Activity, FileDown, GitCompare, RotateCcw } from "lucide-react";
import { TrustOverviewPanel } from "@/components/evaluation/TrustOverviewPanel";
import { ComponentBreakdownPanel } from "@/components/evaluation/ComponentBreakdownPanel";
import { CalculationTransparencyPanel } from "@/components/evaluation/CalculationTransparencyPanel";
import { ModeComparisonPanel } from "@/components/evaluation/ModeComparisonPanel";
import { GuardActivationAlert } from "@/components/evaluation/GuardActivationAlert";
import { AdvancedAnalyticsPanel } from "@/components/evaluation/AdvancedAnalyticsPanel";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEvaluationJob } from "@/hooks/useEvaluationJob";

interface Model {
  id: string;
  name: string;
  description: string;
  type: string;
  framework: string;
  file_size: number;
  uploaded_at: string;
}

interface Dataset {
  id: string;
  name: string;
  description: string;
  row_count: number;
  column_count: number;
  file_size: number;
  uploaded_at: string;
}

// Add type for dataset preview responses
interface DatasetPreviewResponse {
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
  preview?: {
    columns?: string[];
    rows?: Array<Record<string, unknown>>;
  };
}

// Add these response interfaces to narrow unknown API responses
interface ListModelsResponse {
  models?: Model[];
}

interface ListDatasetsResponse {
  datasets?: Dataset[];
}

interface EvaluationResult {
  cache_hit?: boolean;
  cache_message?: string;
  cached?: boolean;
  meta_score?: number;
  trust_score?: number;
  trust_score_raw?: number;
  trust_mode?: string;
  DII?: number;
  component_scores?: {
    performance: number;
    health: number;
    fairness: number;
    robustness: number;
  };
  risk_values?: {
    performance: number;
    health: number;
    fairness: number;
    robustness: number;
    [key: string]: unknown;
  };
  hybrid_weights?: {
    performance: number;
    health: number;
    fairness: number;
    robustness: number;
  };
  dataset_health_score?: number;
  meta_flags?: string[];
  meta_recommendations?: { action: string; why: string; priority: string }[];
  meta_verdict?: {
    status: string;
    message: string;
    confidence: number;
    critical_issues: number;
    total_issues: number;
  };
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    r2_score?: number;
    mse?: number;
    mae?: number;
    rmse?: number;
  };
  eval_score?: number;
  feature_importance?: Array<{ feature: string; importance: number; rank: number }>;
  explainability_method?: string;
  shap_summary?: {
    mean_abs_shap?: number;
    max_shap?: number;
    top_features?: string[];
    base_value?: number;
  };
  // Fairness fields
  fairness_metrics?: {
    demographic_parity_difference?: number;
    equal_opportunity_difference?: number;
    disparate_impact_ratio?: number;
    statistical_parity?: number;
    predictive_parity?: number;
    equalized_odds_difference?: number;
    overall_fairness_score?: number;
  };
  group_metrics?: Array<{
    group: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    true_positive_rate: number;
    false_positive_rate: number;
    positive_prediction_rate: number;
    sample_count: number;
  }>;
  sensitive_attribute?: string;
  // Transparency fields (research-grade)
  lambda_value?: number;
  lambda_raw?: number;
  lambda_cap?: number;
  dii_components?: Record<string, number>;
  beta_auto?: { performance: number; health: number; fairness: number; robustness: number };
  guard_threshold?: number;
  guard_triggered?: boolean;
  guard_failures?: Array<{ component: string; score: number }>;
  global_penalty_applied?: boolean;
  instability_penalty_value?: number;
  breakdown?: Record<string, number>;
  strict_result?: Record<string, unknown>;
}

const Evaluate = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [datasetColumns, setDatasetColumns] = useState<string[]>([]);
  const [sensitiveAttribute, setSensitiveAttribute] = useState<string>('auto');
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Async evaluation hook for non-blocking evaluation with progress tracking
  const { job, startEvaluation, isEvaluating, reset: resetJob } = useEvaluationJob();
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Derived display names for report header
  const selectedModelName = models.find(m => m.id === selectedModel)?.name;
  const selectedDatasetName = datasets.find(d => d.id === selectedDataset)?.name;

  const handleDownloadReport = () => {
    if (!reportRef.current) return;
    // Use the browser's native print dialog targeting the report section
    const printContents = reportRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>Evaluation Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; color: #1e293b; max-width: 1000px; margin: 0 auto; }
  * { box-sizing: border-box; }
  .print\\:hidden { display: none !important; }
</style>
<link rel="stylesheet" href="${window.location.origin}/src/index.css" />
</head><body>${printContents}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // When selectedDataset changes, fetch a small preview to extract column names
  useEffect(() => {
    const loadColumns = async () => {
      setDatasetColumns([]);
      setSensitiveAttribute('auto');
      if (!selectedDataset) return;
      try {
        const previewRaw = await apiClient.previewDataset(selectedDataset, 1);
        const preview = previewRaw as DatasetPreviewResponse | Array<Record<string, unknown>> | null;
        
        // Try to derive columns robustly from various possible shapes
        let cols: string[] = [];
        if (!preview) {
          cols = [];
        } else if (Array.isArray(preview)) {
          if (preview.length > 0 && typeof preview[0] === 'object') cols = Object.keys(preview[0]);
        } else if (preview.columns && Array.isArray(preview.columns)) {
          cols = preview.columns;
        } else if (preview.preview && preview.preview.columns) {
          cols = preview.preview.columns;
        } else if (preview.rows && Array.isArray(preview.rows) && preview.rows.length > 0) {
          cols = Object.keys(preview.rows[0]);
        } else if (preview.data && Array.isArray(preview.data) && preview.data.length > 0) {
          cols = Object.keys(preview.data[0]);
        } else if (typeof preview === 'object') {
          cols = Object.keys(preview as Record<string, unknown>);
        }

        // Normalize and set
        cols = cols.map(c => String(c));
        setDatasetColumns(cols);
      } catch (err) {
        console.warn('Failed to preview dataset columns', err);
      }
    };

    loadColumns();
  }, [selectedDataset]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      // Await and cast each response to the expected shape so TypeScript knows about `.models` / `.datasets`
      const modelsResponse = (await apiClient.listModels()) as ListModelsResponse;
      const datasetsResponse = (await apiClient.listDatasets()) as ListDatasetsResponse;
      
      setModels(modelsResponse?.models ?? []);
      setDatasets(datasetsResponse?.datasets ?? []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load models and datasets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  const handleEvaluate = async () => {
    if (!selectedModel || !selectedDataset) {
      toast({
        title: "Selection required",
        description: "Please select both a model and dataset",
        variant: "destructive",
      });
      return;
    }

    try {
      // Reset previous results
      setShowResults(false);
      setEvaluationResult(null);
      
      // Send the sensitive attribute only when the user picked a specific column.
      const sensitiveToSend = sensitiveAttribute && sensitiveAttribute !== 'auto' ? sensitiveAttribute : undefined;
      
      // Start async evaluation — returns immediately with job_id
      await startEvaluation({
        model_id: selectedModel,
        dataset_id: selectedDataset,
        sensitive_attribute: sensitiveToSend,
      });
      
    } catch (error) {
      console.error('Evaluation error:', error);
      toast({
        title: "Evaluation failed",
        description: error instanceof Error ? error.message : "Failed to start evaluation",
        variant: "destructive",
      });
    }
  };

  const handleForceFreshEvaluation = async () => {
    if (!selectedModel || !selectedDataset) return;

    try {
      setShowResults(false);
      setEvaluationResult(null);

      const sensitiveToSend = sensitiveAttribute && sensitiveAttribute !== 'auto' ? sensitiveAttribute : undefined;
      await startEvaluation({
        model_id: selectedModel,
        dataset_id: selectedDataset,
        sensitive_attribute: sensitiveToSend,
        force_rerun: true,
      });
    } catch (error) {
      console.error('Force fresh evaluation error:', error);
      toast({
        title: 'Fresh evaluation failed',
        description: error instanceof Error ? error.message : 'Failed to start fresh evaluation',
        variant: 'destructive',
      });
    }
  };
  
  // Watch for job completion and update results
  useEffect(() => {
    if (job.status === "completed" && job.result) {
      setEvaluationResult(job.result as EvaluationResult);
      setShowResults(true);
      
      toast({
        title: "Evaluation complete",
        description: `Trust Score: ${(job.result as EvaluationResult).trust_score?.toFixed(1) || 'N/A'}/100`,
      });
      

    }
    
    if (job.status === "failed" && job.error) {
      toast({
        title: "Evaluation failed",
        description: job.error,
        variant: "destructive",
      });
    }
  }, [job.status, job.result, job.error, toast]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to evaluate models</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Evaluate Model
          </h1>
          <p className="text-muted-foreground text-lg">
            Test your model's performance with comprehensive metrics
          </p>
        </div>

        {/* Model Selection */}
        <Card className="glass-card p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Select Model & Dataset</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Model ({models.length} available)
                  </label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Choose a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No models uploaded yet
                        </div>
                      ) : (
                        models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {model.framework} • {model.type} • {formatFileSize(model.file_size)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedModel && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {models.find(m => m.id === selectedModel)?.description}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Dataset ({datasets.length} available)
                  </label>
                  {/** Sensitive attribute selector (optional) */}
                  {datasetColumns.length > 0 && (
                    <div className="mb-3">
                      <label htmlFor="sensitive-attribute" className="block text-xs font-medium mb-1">Sensitive attribute (optional)</label>
                      <select
                        id="sensitive-attribute"
                        aria-describedby="sensitive-attribute-help"
                        className="w-full px-3 py-2 border rounded-md bg-background/50"
                        value={sensitiveAttribute}
                        onChange={(e) => setSensitiveAttribute(e.target.value)}
                      >
                        <option value="auto">Auto-detect (recommended)</option>
                        {datasetColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <div id="sensitive-attribute-help" className="text-xs text-muted-foreground mt-1">If you want fairness measured on a specific column, choose it here. Otherwise leave Auto-detect.</div>
                    </div>
                  )}
                  <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Choose a dataset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No datasets uploaded yet
                        </div>
                      ) : (
                        datasets.map((dataset) => (
                          <SelectItem key={dataset.id} value={dataset.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{dataset.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {dataset.row_count} rows • {dataset.column_count} columns • {formatFileSize(dataset.file_size)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedDataset && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {datasets.find(d => d.id === selectedDataset)?.description}
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="btn-glow w-full"
                onClick={handleEvaluate}
                disabled={!selectedModel || !selectedDataset || isEvaluating || models.length === 0 || datasets.length === 0}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  "Run Evaluation"
                )}
              </Button>

              {models.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Please upload a model first from the Upload page
                </p>
              )}
              {datasets.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Please upload a dataset first from the Upload page
                </p>
              )}
            </>
          )}
        </Card>

        {/* Progress Bar — Real-time async progress */}
        {isEvaluating && (
          <Card className="glass-card p-8 mb-8 animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full animate-glow-pulse">
                  <Activity className="h-6 w-6 text-primary animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Evaluating Model...</h3>
                  <p className="text-sm text-muted-foreground">{job.step || "Starting evaluation"}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{job.progress}%</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              
              {/* Step breakdown */}
              <div className="grid grid-cols-6 gap-1 text-xs text-muted-foreground">
                <div className={`text-center ${job.progress >= 15 ? 'text-primary font-medium' : ''}`}>
                  Model
                </div>
                <div className={`text-center ${job.progress >= 30 ? 'text-primary font-medium' : ''}`}>
                  SMCP
                </div>
                <div className={`text-center ${job.progress >= 55 ? 'text-primary font-medium' : ''}`}>
                  Dataset
                </div>
                <div className={`text-center ${job.progress >= 70 ? 'text-primary font-medium' : ''}`}>
                  Fairness
                </div>
                <div className={`text-center ${job.progress >= 85 ? 'text-primary font-medium' : ''}`}>
                  Trust
                </div>
                <div className={`text-center ${job.progress >= 93 ? 'text-primary font-medium' : ''}`}>
                  SHAP
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {/* Error state */}
        {job.status === "failed" && job.error && (
          <Card className="glass-card p-6 mb-8 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 dark:text-red-400">Evaluation Failed</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{job.error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={resetJob}>
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {/* Results — Research-Grade Dashboard */}
        {showResults && evaluationResult && (
          <div className="animate-fade-in" ref={reportRef}>
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Evaluation Report
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedModelName && selectedDatasetName
                    ? `${selectedModelName} on ${selectedDatasetName}`
                    : "Model evaluation results"}
                  {evaluationResult.trust_mode && (
                    <span className="ml-2 text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      mode: {evaluationResult.trust_mode}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {(evaluationResult.cache_hit || evaluationResult.cached) && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/40 bg-primary/10 text-foreground">
                  <div className="text-sm">
                    {evaluationResult.cache_message || 'Cached result returned instantly for this model+dataset pair.'}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleForceFreshEvaluation}>
                    Force Fresh Evaluation
                  </Button>
                </div>
              )}

              {/* Guard Activation Alert */}
              {evaluationResult.guard_triggered && (
                <GuardActivationAlert
                  guardFailures={evaluationResult.guard_failures || []}
                  guardThreshold={evaluationResult.guard_threshold || 0.3}
                  trustMode={evaluationResult.trust_mode || "balanced"}
                />
              )}

              {/* 1. Trust Overview (Hero) - only show when full trust methodology data is available */}
              {evaluationResult.trust_score != null && evaluationResult.component_scores && (
                <TrustOverviewPanel
                  trustScore={evaluationResult.trust_score}
                  trustScoreRaw={evaluationResult.trust_score_raw}
                  DII={evaluationResult.DII ?? 0}
                  lambdaValue={evaluationResult.lambda_value ?? 0}
                  guardTriggered={evaluationResult.guard_triggered || false}
                  guardFailures={evaluationResult.guard_failures || []}
                  guardThreshold={evaluationResult.guard_threshold || 0.3}
                  verdict={evaluationResult.meta_verdict}
                />
              )}

              {/* 2. Component Breakdown (P, H, F, R) */}
              {evaluationResult.component_scores && (
                <ComponentBreakdownPanel
                  componentScores={evaluationResult.component_scores}
                  riskValues={evaluationResult.risk_values}
                  hybridWeights={evaluationResult.hybrid_weights}
                  breakdown={evaluationResult.breakdown}
                />
              )}

              {/* 3. Balanced vs Strict Comparison */}
              {evaluationResult.strict_result && evaluationResult.trust_score != null && (
                <ModeComparisonPanel
                  balanced={{
                    trustScore: evaluationResult.trust_score,
                    lambdaValue: evaluationResult.lambda_value ?? 0,
                    DII: evaluationResult.DII ?? 0,
                    guardTriggered: evaluationResult.guard_triggered || false,
                    guardThreshold: evaluationResult.guard_threshold ?? 0.3,
                    globalPenaltyApplied: evaluationResult.global_penalty_applied,
                    instabilityPenaltyValue: evaluationResult.instability_penalty_value,
                    componentScores: evaluationResult.component_scores,
                    guardFailures: evaluationResult.guard_failures || [],
                  }}
                  strict={{
                    trustScore: evaluationResult.strict_result.trust_score ?? 0,
                    lambdaValue: evaluationResult.strict_result.lambda_value ?? 0,
                    DII: evaluationResult.strict_result.DII ?? 0,
                    guardTriggered: evaluationResult.strict_result.guard_triggered || false,
                    guardThreshold: evaluationResult.strict_result.guard_threshold ?? 0.4,
                    globalPenaltyApplied: evaluationResult.strict_result.global_penalty_applied,
                    instabilityPenaltyValue: evaluationResult.strict_result.instability_penalty_value,
                    componentScores: evaluationResult.strict_result.component_scores,
                    guardFailures: evaluationResult.strict_result.guard_failures || [],
                  }}
                />
              )}

              {/* 4. Calculation Transparency - only show when full breakdown data is available */}
              {evaluationResult.trust_score != null && evaluationResult.component_scores && (
                <CalculationTransparencyPanel
                  metrics={evaluationResult.metrics}
                  DII={evaluationResult.DII ?? 0}
                  diiComponents={evaluationResult.dii_components}
                  componentScores={evaluationResult.component_scores}
                  riskValues={evaluationResult.risk_values}
                  lambdaValue={evaluationResult.lambda_value ?? 0}
                  lambdaRaw={evaluationResult.lambda_raw}
                  lambdaCap={evaluationResult.lambda_cap}
                  betaAuto={evaluationResult.beta_auto}
                  hybridWeights={evaluationResult.hybrid_weights}
                  trustScore={evaluationResult.trust_score ?? 0}
                  trustScoreRaw={evaluationResult.trust_score_raw}
                  guardThreshold={evaluationResult.guard_threshold}
                  guardTriggered={evaluationResult.guard_triggered}
                  guardFailures={evaluationResult.guard_failures}
                  trustMode={evaluationResult.trust_mode || "balanced"}
                  fairnessMetrics={evaluationResult.fairness_metrics}
                  globalPenaltyApplied={evaluationResult.global_penalty_applied}
                  instabilityPenaltyValue={evaluationResult.instability_penalty_value}
                />
              )}

              {/* 5. Advanced Analytics (Standard Metrics, Fairness, Feature Importance) */}
              <AdvancedAnalyticsPanel
                metrics={evaluationResult.metrics}
                evalScore={evaluationResult.eval_score}
                fairnessMetrics={evaluationResult.fairness_metrics}
                groupMetrics={evaluationResult.group_metrics}
                sensitiveAttribute={evaluationResult.sensitive_attribute}
                featureImportance={evaluationResult.feature_importance}
                explainabilityMethod={evaluationResult.explainability_method}
                shapSummary={evaluationResult.shap_summary}
              />
            </div>

            {/* Actions Bar */}
            <div className="flex gap-4 mt-8 print:hidden">
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleDownloadReport}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download Report
              </Button>
              <Button variant="outline" className="flex-1">
                <GitCompare className="mr-2 h-4 w-4" />
                Compare Models
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResults(false);
                  setEvaluationResult(null);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                New Evaluation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Evaluate;
