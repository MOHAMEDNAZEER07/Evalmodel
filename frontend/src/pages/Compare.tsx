import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, TrendingUp, Zap, BarChart3, Loader2, Brain, ShieldCheck, Activity, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import "./Compare.css";

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

interface ModelDatasetPair {
  modelId: string;
  datasetId: string;
}

interface EvaluationResult {
  id: string;
  model_id: string;
  dataset_id: string;
  type?: string;
  eval_score: number | { eval_score: number; normalized_metrics: Record<string, number>; weight_distribution: Record<string, number> };
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
  hybrid_weights?: {
    performance: number;
    health: number;
    fairness: number;
    robustness: number;
  };
  guard_triggered?: boolean;
  global_penalty_applied?: boolean;
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    r2_score?: number;
    mse?: number;
    mae?: number;
    rmse?: number;
    bleu_score?: number;
    perplexity?: number;
  };
  fairness_metrics?: {
    demographic_parity_difference?: number;
    equal_opportunity_difference?: number;
    disparate_impact_ratio?: number;
    overall_fairness_score?: number;
  };
  sensitive_attribute?: string;
  dataset_health_score?: number;
  meta_verdict?: { status: string; message: string };
}

interface ComparisonEntry {
  model_id: string;
  dataset_id: string;
  model_name: string;
  dataset_name: string;
  eval_score: number;
  trust_score?: number;
  DII?: number;
  trust_mode?: string;
  guard_triggered?: boolean;
  global_penalty_applied?: boolean;
  component_scores?: EvaluationResult["component_scores"];
  hybrid_weights?: EvaluationResult["hybrid_weights"];
  metrics?: EvaluationResult["metrics"];
  fairness_metrics?: EvaluationResult["fairness_metrics"];
  sensitive_attribute?: string;
  dataset_health_score?: number;
  model_type?: string;
}

const COMPONENT_LABELS: Record<string, string> = {
  performance: "Performance",
  health: "Dataset Health",
  fairness: "Fairness",
  robustness: "Robustness",
};

const COMPONENT_COLORS: Record<string, string> = {
  performance: "text-blue-400",
  health: "text-green-400",
  fairness: "text-purple-400",
  robustness: "text-orange-400",
};

const COMPONENT_BG: Record<string, string> = {
  performance: "bg-blue-400",
  health: "bg-green-400",
  fairness: "bg-purple-400",
  robustness: "bg-orange-400",
};

const Compare = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [modelDatasetPairs, setModelDatasetPairs] = useState<ModelDatasetPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonEntry[] | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      // API client returns unknown — cast result to any for TS and perform runtime checks.
      const [modelsResponse, datasetsResponse] = (await Promise.all([
        apiClient.listModels(),
        apiClient.listDatasets()
      ])) as any;

      // Runtime-safe assignment: ensure expected array shapes before setting state.
      if (modelsResponse && Array.isArray(modelsResponse.models)) {
        setModels(modelsResponse.models);
      } else {
        setModels([]);
      }

      if (datasetsResponse && Array.isArray(datasetsResponse.datasets)) {
        setDatasets(datasetsResponse.datasets);
      } else {
        setDatasets([]);
      }
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
  };

  const handleCompare = async () => {
    if (modelDatasetPairs.length < 2) {
      toast({
        title: "Selection required",
        description: "Please select at least 2 model-dataset pairs to compare",
        variant: "destructive",
      });
      return;
    }

    // Validate that all pairs have both model and dataset selected
    const incompletePairs = modelDatasetPairs.filter(pair => !pair.modelId || !pair.datasetId);
    if (incompletePairs.length > 0) {
      toast({
        title: "Incomplete selection",
        description: "Please select both model and dataset for each comparison pair",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsComparing(true);
      
      // Evaluate each model-dataset pair in parallel
      const evaluations = await Promise.all(
        modelDatasetPairs.map(pair => apiClient.evaluateModel(pair.modelId, pair.datasetId))
      ) as EvaluationResult[];
      
      // Map full evaluation data into ComparisonEntry
      const entries: ComparisonEntry[] = evaluations.map((evaluation, index) => {
        const pair = modelDatasetPairs[index];
        const model = models.find(m => m.id === pair.modelId);
        const dataset = datasets.find(d => d.id === pair.datasetId);

        const evalScore = typeof evaluation.eval_score === 'object'
          ? evaluation.eval_score.eval_score
          : evaluation.eval_score ?? 0;

        return {
          model_id: pair.modelId,
          dataset_id: pair.datasetId,
          model_name: model?.name ?? `Model ${index + 1}`,
          dataset_name: dataset?.name ?? 'Unknown Dataset',
          eval_score: evalScore,
          trust_score: evaluation.trust_score,
          DII: evaluation.DII,
          trust_mode: evaluation.trust_mode,
          guard_triggered: evaluation.guard_triggered,
          global_penalty_applied: evaluation.global_penalty_applied,
          component_scores: evaluation.component_scores,
          hybrid_weights: evaluation.hybrid_weights,
          metrics: evaluation.metrics,
          fairness_metrics: evaluation.fairness_metrics,
          sensitive_attribute: evaluation.sensitive_attribute,
          dataset_health_score: evaluation.dataset_health_score,
          model_type: model?.type,
        };
      });

      setComparisonResults(entries);

      const best = [...entries].sort((a, b) =>
        (b.trust_score ?? b.eval_score) - (a.trust_score ?? a.eval_score)
      )[0];

      toast({
        title: "Comparison complete",
        description: `Best model: ${best.model_name} (Trust Score: ${best.trust_score?.toFixed(1) ?? best.eval_score.toFixed(1)})`,
      });
    } catch (error) {
      console.error('Comparison error:', error);
      toast({
        title: "Comparison failed",
        description: error instanceof Error ? error.message : "Failed to compare models",
        variant: "destructive",
      });
    } finally {
      setIsComparing(false);
    }
  };

  const addModelDatasetPair = () => {
    if (modelDatasetPairs.length >= 4) {
      toast({
        title: "Maximum pairs reached",
        description: "You can compare up to 4 model-dataset pairs at a time",
        variant: "destructive",
      });
      return;
    }
    
    setModelDatasetPairs([...modelDatasetPairs, { modelId: '', datasetId: '' }]);
  };

  const removeModelDatasetPair = (index: number) => {
    setModelDatasetPairs(modelDatasetPairs.filter((_, i) => i !== index));
  };

  const updatePairModel = (index: number, modelId: string) => {
    const newPairs = [...modelDatasetPairs];
    newPairs[index].modelId = modelId;
    setModelDatasetPairs(newPairs);
  };

  const updatePairDataset = (index: number, datasetId: string) => {
    const newPairs = [...modelDatasetPairs];
    newPairs[index].datasetId = datasetId;
    setModelDatasetPairs(newPairs);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to compare models</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-4 neon-text">
            Model Comparison Hub
          </h1>
          <p className="text-muted-foreground text-lg">
            Compare multiple models with different datasets side-by-side
          </p>
        </div>

        {/* Model-Dataset Pairs Selection */}
        <Card className="glass-card p-8 mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <GitCompare className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Model-Dataset Pairs ({modelDatasetPairs.length}/4)</h2>
            </div>
            <Button 
              onClick={addModelDatasetPair}
              disabled={modelDatasetPairs.length >= 4 || isLoading}
              variant="outline"
              className="border-primary/50 hover:bg-primary/10"
            >
              Add Pair
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading data...</span>
            </div>
          ) : models.length === 0 || datasets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please upload both models and datasets to compare.</p>
              <p className="text-sm mt-2">Visit the Upload page to get started.</p>
            </div>
          ) : modelDatasetPairs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No comparison pairs added yet.</p>
              <Button onClick={addModelDatasetPair} className="btn-glow">
                Add Your First Pair
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {modelDatasetPairs.map((pair, index) => (
                  <Card key={index} className="p-6 bg-background/50 border-border/50">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-2">{index + 1}</Badge>
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Model Selection */}
                        <div>
                          <label className="text-sm font-medium mb-2 block text-muted-foreground">
                            Select Model
                          </label>
                          <Select 
                            value={pair.modelId} 
                            onValueChange={(value) => updatePairModel(index, value)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Choose a model..." />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{model.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {model.framework} • {model.type} • {formatFileSize(model.file_size)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Dataset Selection */}
                        <div>
                          <label className="text-sm font-medium mb-2 block text-muted-foreground">
                            Select Dataset
                          </label>
                          <Select 
                            value={pair.datasetId} 
                            onValueChange={(value) => updatePairDataset(index, value)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Choose a dataset..." />
                            </SelectTrigger>
                            <SelectContent>
                              {datasets.map((dataset) => (
                                <SelectItem key={dataset.id} value={dataset.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{dataset.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {dataset.row_count} rows • {dataset.column_count} columns • {formatFileSize(dataset.file_size)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModelDatasetPair(index)}
                        className="mt-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <Button 
                className="btn-glow w-full" 
                disabled={modelDatasetPairs.length < 2 || isComparing}
                onClick={handleCompare}
              >
                {isComparing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparing models...
                  </>
                ) : (
                  `Compare ${modelDatasetPairs.length} Model-Dataset Pair${modelDatasetPairs.length !== 1 ? 's' : ''}`
                )}
              </Button>

              {modelDatasetPairs.length < 2 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Add at least 2 model-dataset pairs to enable comparison
                </p>
              )}
            </>
          )}
        </Card>

        {/* Comparison Results */}
        {comparisonResults && comparisonResults.length > 0 && (() => {
          const sorted = [...comparisonResults].sort((a, b) =>
            (b.trust_score ?? b.eval_score) - (a.trust_score ?? a.eval_score)
          );
          const best = sorted[0];
          const hasTrustScores = comparisonResults.some(c => c.trust_score != null);
          const hasComponents = comparisonResults.some(c => c.component_scores != null);
          const hasFairness = comparisonResults.some(c => c.fairness_metrics != null);
          const isClassification = comparisonResults.some(c => c.metrics?.accuracy != null || c.metrics?.f1_score != null);
          const isRegression = comparisonResults.some(c => c.metrics?.mae != null || c.metrics?.rmse != null || c.metrics?.r2_score != null);

          return (
          <div className="space-y-6 animate-fade-in">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Models Compared</h3>
                </div>
                <p className="text-3xl font-bold text-primary">{comparisonResults.length}</p>
              </Card>

              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold">Best Model</h3>
                </div>
                <p className="text-lg font-bold truncate">{best.model_name}</p>
                <p className="text-xs text-muted-foreground">{best.dataset_name}</p>
                {hasTrustScores
                  ? <p className="text-sm font-semibold text-primary mt-1">Trust Score: {(best.trust_score ?? 0).toFixed(1)}</p>
                  : <p className="text-sm font-semibold text-primary mt-1">EvalScore: {best.eval_score.toFixed(1)}</p>
                }
              </Card>

              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="h-5 w-5 text-green-400" />
                  <h3 className="font-semibold">Avg Trust Score</h3>
                </div>
                {hasTrustScores ? (
                  <p className="text-3xl font-bold text-green-400">
                    {(comparisonResults.reduce((s, c) => s + (c.trust_score ?? 0), 0) / comparisonResults.length).toFixed(1)}
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-primary">
                    {(comparisonResults.reduce((s, c) => s + c.eval_score, 0) / comparisonResults.length).toFixed(1)}
                  </p>
                )}
              </Card>
            </div>

            {/* Primary Scores Table */}
            <Card className="glass-card p-8">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Primary Scores
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Model</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Dataset</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">EvalScore</th>
                      {hasTrustScores && <th className="text-center p-3 font-medium text-muted-foreground">Trust Score</th>}
                      {hasTrustScores && <th className="text-center p-3 font-medium text-muted-foreground">DII</th>}
                      <th className="text-center p-3 font-medium text-muted-foreground">Mode</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Guard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((entry, idx) => {
                      const isBest = entry.model_id === best.model_id && entry.dataset_id === best.dataset_id;
                      const diiColor = (entry.DII ?? 0) > 0.5 ? 'text-red-400' : (entry.DII ?? 0) > 0.3 ? 'text-yellow-400' : 'text-green-400';
                      return (
                        <tr key={`${entry.model_id}-${entry.dataset_id}`}
                          className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isBest ? 'bg-primary/5' : ''}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {isBest && <Badge className="bg-primary text-primary-foreground text-xs">Best</Badge>}
                              <div>
                                <p className="font-medium">{entry.model_name}</p>
                                <p className="text-xs text-muted-foreground">{entry.model_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{entry.dataset_name}</td>
                          <td className="text-center p-3 font-semibold">{entry.eval_score.toFixed(2)}</td>
                          {hasTrustScores && (
                            <td className="text-center p-3">
                              <span className={`font-bold text-base ${isBest ? 'text-primary' : ''}`}>
                                {entry.trust_score != null ? entry.trust_score.toFixed(1) : '—'}
                              </span>
                            </td>
                          )}
                          {hasTrustScores && (
                            <td className={`text-center p-3 font-mono ${diiColor}`}>
                              {entry.DII != null ? entry.DII.toFixed(3) : '—'}
                            </td>
                          )}
                          <td className="text-center p-3">
                            <Badge variant="outline" className="text-xs capitalize">
                              {entry.trust_mode ?? 'balanced'}
                            </Badge>
                          </td>
                          <td className="text-center p-3">
                            {entry.guard_triggered
                              ? <Badge variant="destructive" className="text-xs">Triggered</Badge>
                              : <Badge variant="outline" className="text-xs text-green-400 border-green-400/40">Pass</Badge>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Trust Score Bar Chart */}
            {hasTrustScores && (
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Trust Score Comparison
                </h3>
                <div className="space-y-4">
                  {sorted.map((entry) => {
                    const score = entry.trust_score ?? 0;
                    const isBest = entry.model_id === best.model_id && entry.dataset_id === best.dataset_id;
                    return (
                      <div key={`${entry.model_id}-${entry.dataset_id}`}>
                        <div className="flex justify-between mb-1">
                          <div>
                            <span className="text-sm font-medium">{entry.model_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{entry.dataset_name}</span>
                          </div>
                          <span className={`text-sm font-bold ${isBest ? 'text-primary' : ''}`}>{score.toFixed(1)}</span>
                        </div>
                        <Progress
                          value={score}
                          className={`h-3 ${isBest ? '[&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent' : '[&>div]:bg-primary/60'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Component Breakdown */}
            {hasComponents && (
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  Component Scores (P / H / F / R)
                </h3>
                  <div className="space-y-6">
                    {(['performance', 'health', 'fairness', 'robustness'] as const).map((component) => {
                      const values = sorted.map(e => (e.component_scores?.[component] ?? 0) * 100);
                      const maxVal = Math.max(...values, 100);
                      return (
                        <div key={component}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-semibold ${COMPONENT_COLORS[component]}`}>
                              {COMPONENT_LABELS[component]}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {sorted.map((entry) => {
                              const val = (entry.component_scores?.[component] ?? 0) * 100;
                              return (
                                <div key={`${entry.model_id}-${component}`} className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-28 truncate">{entry.model_name}</span>
                                  <div className="flex-1">
                                    <Progress
                                      value={(val / maxVal) * 100}
                                      className={`h-4 [&>div]:${COMPONENT_BG[component]} [&>div]:opacity-80`}
                                    />
                                  </div>
                                  <span className="text-xs font-mono w-12 text-right">{val.toFixed(1)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </Card>
            )}

            {/* Type-specific Metrics */}
            {(isClassification || isRegression) && (
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  {isClassification ? 'Classification Metrics' : 'Regression Metrics'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Model</th>
                        {isClassification && <>
                          <th className="text-center p-3 font-medium text-muted-foreground">Accuracy</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">Precision</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">Recall</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">F1-Score</th>
                        </>}
                        {isRegression && <>
                          <th className="text-center p-3 font-medium text-muted-foreground">MAE</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">RMSE</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">R²</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((entry) => {
                        const m = entry.metrics ?? {};
                        const isBest = entry.model_id === best.model_id && entry.dataset_id === best.dataset_id;
                        const bestClass = isBest ? 'font-bold text-primary' : '';
                        return (
                          <tr key={`${entry.model_id}-metrics`}
                            className={`border-b border-border/30 hover:bg-muted/20 ${isBest ? 'bg-primary/5' : ''}`}>
                            <td className="p-3 font-medium">{entry.model_name}</td>
                            {isClassification && <>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.accuracy != null ? (m.accuracy * 100).toFixed(1) + '%' : '—'}
                              </td>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.precision != null ? (m.precision * 100).toFixed(1) + '%' : '—'}
                              </td>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.recall != null ? (m.recall * 100).toFixed(1) + '%' : '—'}
                              </td>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.f1_score != null ? (m.f1_score * 100).toFixed(1) + '%' : '—'}
                              </td>
                            </>}
                            {isRegression && <>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.mae != null ? m.mae.toFixed(4) : '—'}
                              </td>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.rmse != null ? m.rmse.toFixed(4) : '—'}
                              </td>
                              <td className={`text-center p-3 ${bestClass}`}>
                                {m.r2_score != null ? m.r2_score.toFixed(4) : '—'}
                              </td>
                            </>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Fairness Metrics */}
            {hasFairness && (
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-purple-400" />
                  Fairness Metrics
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Model</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Overall Fairness</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Dem. Parity Diff</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Equal Opp. Diff</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Disparate Impact</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Attr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((entry) => {
                        const f = entry.fairness_metrics ?? {};
                        return (
                          <tr key={`${entry.model_id}-fairness`}
                            className="border-b border-border/30 hover:bg-muted/20">
                            <td className="p-3 font-medium">{entry.model_name}</td>
                            <td className="text-center p-3">
                              {f.overall_fairness_score != null
                                ? <span className={f.overall_fairness_score >= 0.8 ? 'text-green-400 font-semibold' : f.overall_fairness_score >= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
                                    {(f.overall_fairness_score * 100).toFixed(1)}%
                                  </span>
                                : '—'}
                            </td>
                            <td className="text-center p-3 font-mono">
                              {f.demographic_parity_difference != null ? f.demographic_parity_difference.toFixed(3) : '—'}
                            </td>
                            <td className="text-center p-3 font-mono">
                              {f.equal_opportunity_difference != null ? f.equal_opportunity_difference.toFixed(3) : '—'}
                            </td>
                            <td className="text-center p-3 font-mono">
                              {f.disparate_impact_ratio != null ? f.disparate_impact_ratio.toFixed(3) : '—'}
                            </td>
                            <td className="text-center p-3 text-xs text-muted-foreground">
                              {entry.sensitive_attribute ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Key Insights */}
            <Card className="glass-card p-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Key Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                  <h4 className="font-semibold mb-2 text-primary">Top Performer</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>{best.model_name}</strong> leads with{' '}
                    {hasTrustScores
                      ? <>Trust Score <strong>{(best.trust_score ?? 0).toFixed(1)}</strong> and DII <strong>{(best.DII ?? 0).toFixed(3)}</strong></>
                      : <>EvalScore <strong>{best.eval_score.toFixed(2)}</strong></>
                    }
                  </p>
                  {best.component_scores && (
                    <div className="text-xs space-y-1">
                      {(['performance', 'health', 'fairness', 'robustness'] as const).map(k => (
                        <div key={k} className="flex justify-between">
                          <span className={COMPONENT_COLORS[k]}>{COMPONENT_LABELS[k]}</span>
                          <span className="font-medium">{((best.component_scores![k] ?? 0) * 100).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <h4 className="font-semibold mb-2">Comparison Summary</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• {comparisonResults.length} model-dataset pairs evaluated</p>
                    <p>• Ranked by {hasTrustScores ? 'Hybrid Trust Score' : 'EvalScore'}</p>
                    {hasComponents && <p>• Component breakdown: P / H / F / R</p>}
                    {hasFairness && <p>• Fairness analysis included</p>}
                    {comparisonResults.some(c => c.guard_triggered) && (
                      <p className="text-red-400">• Non-compensatory guard triggered in {comparisonResults.filter(c => c.guard_triggered).length} model(s)</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button className="btn-glow flex-1" onClick={() => setComparisonResults(null)}>
                New Comparison
              </Button>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Compare;
