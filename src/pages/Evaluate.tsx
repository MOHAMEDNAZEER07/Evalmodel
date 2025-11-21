import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, Activity, BarChart3, Database, Brain, Loader2, Sparkles } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import { MetaEvaluatorResults } from "@/components/MetaEvaluatorResults";
import { ExplainabilityDashboard } from "@/components/ExplainabilityDashboard";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  rows?: Array<Record<string, any>>;
  data?: Array<Record<string, any>>;
  preview?: {
    columns?: string[];
    rows?: Array<Record<string, any>>;
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
  meta_score?: number;
  dataset_health_score?: number;
  meta_flags?: string[];
  meta_recommendations?: { action: string; why: string; priority: string; }[];
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
}

const Evaluate = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [datasetColumns, setDatasetColumns] = useState<string[]>([]);
  const [sensitiveAttribute, setSensitiveAttribute] = useState<string>('auto');
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // When selectedDataset changes, fetch a small preview to extract column names
  useEffect(() => {
    const loadColumns = async () => {
      setDatasetColumns([]);
      setSensitiveAttribute('auto');
      if (!selectedDataset) return;
      try {
        const previewRaw = await apiClient.previewDataset(selectedDataset, 1);
        const preview = previewRaw as DatasetPreviewResponse | Array<Record<string, any>> | null;
        
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
          cols = Object.keys(preview as Record<string, any>);
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
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
  };

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
      setIsEvaluating(true);
  // Send the sensitive attribute only when the user picked a specific column.
  const sensitiveToSend = sensitiveAttribute && sensitiveAttribute !== 'auto' ? sensitiveAttribute : undefined;
  const result = (await apiClient.evaluateModel(selectedModel, selectedDataset, sensitiveToSend)) as EvaluationResult;
      
      setEvaluationResult(result);
      setShowResults(true);
      
      toast({
        title: "Evaluation complete",
        description: `Meta Score: ${result.meta_score?.toFixed(1) || 'N/A'}/100`,
      });
      
      console.log('Evaluation result:', result);
    } catch (error) {
      console.error('Evaluation error:', error);
      toast({
        title: "Evaluation failed",
        description: error instanceof Error ? error.message : "Failed to evaluate model",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

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

        {/* Progress */}
        {isEvaluating && (
          <Card className="glass-card p-8 mb-8 animate-fade-in">
            <div className="text-center">
              <div className="inline-block p-4 bg-primary/10 rounded-full mb-4 animate-glow-pulse">
                <Activity className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Evaluating Model...</h3>
              <p className="text-muted-foreground">This may take a few moments</p>
            </div>
          </Card>
        )}

        {/* Results */}
        {showResults && evaluationResult && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-2xl font-bold">Evaluation Results</h2>
              <div className="flex items-center gap-3">
                {evaluationResult.explainability_method && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Brain className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {evaluationResult.explainability_method === 'SHAP' && 'SHAP Analysis'}
                      {evaluationResult.explainability_method === 'LIME' && 'LIME Analysis'}
                      {evaluationResult.explainability_method === 'basic' && 'Feature Importance'}
                    </span>
                  </div>
                )}
                {evaluationResult.meta_score !== null && evaluationResult.meta_score !== undefined && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">
                      Meta Score: <span className="text-primary text-lg font-bold">{evaluationResult.meta_score.toFixed(1)}</span>/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Tabs 
              defaultValue={
                evaluationResult.meta_score ? "meta" : 
                evaluationResult.feature_importance ? "explainability" : 
                "metrics"
              } 
              className="w-full"
            >
              <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
                <TabsTrigger value="meta" disabled={!evaluationResult.meta_score}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Meta Evaluator
                  {!evaluationResult.meta_score && (
                    <span className="ml-2 text-xs">(Not Available)</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="explainability" disabled={!evaluationResult.feature_importance}>
                  <Brain className="h-4 w-4 mr-2" />
                  Explainability
                  {!evaluationResult.feature_importance && (
                    <span className="ml-2 text-xs">(Not Available)</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="metrics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Standard Metrics
                </TabsTrigger>
              </TabsList>

              {/* Meta Evaluator Tab */}
              <TabsContent value="meta" className="space-y-6">
                {evaluationResult.meta_score ? (
                  <MetaEvaluatorResults
                    metaScore={evaluationResult.meta_score}
                    datasetHealthScore={evaluationResult.dataset_health_score || 0}
                    flags={evaluationResult.meta_flags || []}
                    recommendations={evaluationResult.meta_recommendations || []}
                    verdict={evaluationResult.meta_verdict || {
                      status: "unknown",
                      message: "No verdict available",
                      confidence: 0,
                      critical_issues: 0,
                      total_issues: 0
                    }}
                    breakdown={{
                      metric_contribution: evaluationResult.meta_score * 0.65 || 0,
                      dataset_contribution: (evaluationResult.dataset_health_score || 0) * 0.25,
                      complexity_contribution: evaluationResult.meta_score * 0.10 || 0
                    }}
                  />
                ) : (
                  <Card className="glass-card p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">Meta Evaluator Not Available</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        The Meta Evaluator feature requires backend updates. Please ensure:
                      </p>
                      <ul className="text-sm text-muted-foreground text-left space-y-2">
                        <li>✓ Database migration has been run</li>
                        <li>✓ Backend server has been restarted</li>
                        <li>✓ Re-run the evaluation after updates</li>
                      </ul>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* Explainability Tab */}
              <TabsContent value="explainability" className="space-y-6">
                <ExplainabilityDashboard
                  featureImportance={evaluationResult.feature_importance || null}
                  explainabilityMethod={evaluationResult.explainability_method || null}
                  shapSummary={evaluationResult.shap_summary || null}
                />
              </TabsContent>

              {/* Standard Metrics Tab */}
              <TabsContent value="metrics" className="space-y-6">
                {/* Traditional Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {evaluationResult.metrics?.accuracy != null && (
                    <MetricCard 
                      title="Accuracy" 
                      value={`${(evaluationResult.metrics.accuracy * 100).toFixed(1)}%`} 
                      icon={Target} 
                    />
                  )}
                  {evaluationResult.metrics?.precision != null && (
                    <MetricCard 
                      title="Precision" 
                      value={`${(evaluationResult.metrics.precision * 100).toFixed(1)}%`} 
                      icon={TrendingUp} 
                    />
                  )}
                  {evaluationResult.metrics?.recall != null && (
                    <MetricCard 
                      title="Recall" 
                      value={`${(evaluationResult.metrics.recall * 100).toFixed(1)}%`} 
                      icon={Activity} 
                    />
                  )}
                  {evaluationResult.metrics?.f1_score != null && (
                    <MetricCard 
                      title="F1-Score" 
                      value={`${(evaluationResult.metrics.f1_score * 100).toFixed(1)}%`} 
                      icon={BarChart3} 
                    />
                  )}
                  {evaluationResult.metrics?.r2_score != null && (
                    <MetricCard 
                      title="R² Score" 
                      value={evaluationResult.metrics.r2_score.toFixed(4)} 
                      icon={Target} 
                    />
                  )}
                  {evaluationResult.metrics?.mse != null && (
                    <MetricCard 
                      title="MSE" 
                      value={evaluationResult.metrics.mse.toFixed(4)} 
                      icon={Activity} 
                    />
                  )}
                  {evaluationResult.metrics?.mae != null && (
                    <MetricCard 
                      title="MAE" 
                      value={evaluationResult.metrics.mae.toFixed(4)} 
                      icon={TrendingUp} 
                    />
                  )}
                  {evaluationResult.metrics?.rmse != null && (
                    <MetricCard 
                      title="RMSE" 
                      value={evaluationResult.metrics.rmse.toFixed(4)} 
                      icon={BarChart3} 
                    />
                  )}
                </div>

                {/* Eval Score */}
                {evaluationResult.eval_score != null && (
                  <Card className="glass-card p-8">
                    <h3 className="text-xl font-semibold mb-4">SMCP Eval Score</h3>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl font-bold text-primary">
                        {typeof evaluationResult.eval_score === 'object' && evaluationResult.eval_score !== null
                          ? ((evaluationResult.eval_score as any)?.eval_score?.toFixed(1) ?? 'N/A')
                          : (typeof evaluationResult.eval_score === 'number' ? evaluationResult.eval_score.toFixed(1) : 'N/A')}
                      </div>
                      <div className="text-2xl text-muted-foreground">/100</div>
                    </div>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-4 mt-8">
              <Button className="btn-glow flex-1">Download Report</Button>
              <Button variant="outline" className="flex-1">Compare Models</Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowResults(false);
                  setEvaluationResult(null);
                }}
              >
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
