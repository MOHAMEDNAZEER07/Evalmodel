import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Database, Target, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightsData, getImpactColor } from "@/hooks/use-insights-data";
import { apiClient } from "@/lib/api-client";
import type { Dataset } from "@/types/dashboard";
import { InsightsAIChat } from "@/components/InsightsAIChat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ModelData {
  id: string;
  name: string;
  description: string;
  model_type: string;
  framework: string;
  file_size: number;
  uploaded_at: string;
  is_evaluated?: boolean;
}

interface Evaluation {
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

const Insights = () => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [insightType, setInsightType] = useState<"dataset" | "model">("dataset");
  
  // Model insights state
  const [models, setModels] = useState<ModelData[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelEvaluation, setModelEvaluation] = useState<Evaluation | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  
  const { quality, outliers, correlations, summary, isLoading, error, refetch } = useInsightsData(selectedDatasetId);

  // Fetch available datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          apiClient.setToken(token);
        }
        const response = await apiClient.listDatasets();
        setDatasets(response.datasets || []);
        // Auto-select first dataset if available
        if (response.datasets && response.datasets.length > 0) {
          setSelectedDatasetId(response.datasets[0].id);
        }
      } catch (err) {
        console.error('Error fetching datasets:', err);
      } finally {
        setLoadingDatasets(false);
      }
    };

    fetchDatasets();
  }, []);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      if (insightType !== "model") return;
      
      setLoadingModels(true);
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          apiClient.setToken(token);
        }
        const response = await apiClient.listModels();
        setModels((response.models || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          description: m.description || '',
          model_type: m.model_type || m.type || 'unknown',
          framework: m.framework || 'unknown',
          file_size: m.file_size || 0,
          uploaded_at: m.uploaded_at || new Date().toISOString(),
          is_evaluated: m.is_evaluated || false,
        } as ModelData)));
        // Auto-select first evaluated model if available
        const evaluatedModel = (response.models || []).find((m: any) => m.is_evaluated);
        if (evaluatedModel && selectedDatasetId) {
          setSelectedModelId(evaluatedModel.id);
        }
      } catch (err) {
        console.error('Error fetching models:', err);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [insightType, selectedDatasetId]);

  // Fetch model evaluation when model is selected
  useEffect(() => {
    const fetchEvaluation = async () => {
      if (!selectedModelId || !selectedDatasetId) return;
      
      setLoadingEvaluation(true);
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          apiClient.setToken(token);
        }
        
        // Fetch evaluation history and filter for this model+dataset combo
        const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBaseURL}/api/evaluation/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("🔍 Evaluation History API Response:", data);
          console.log("🔍 Looking for model_id:", selectedModelId, "dataset_id:", selectedDatasetId);
          
          // Log what IDs are actually in the response
          if (data.evaluations && data.evaluations.length > 0) {
            console.log("🔍 Available evaluations:");
            data.evaluations.forEach((e: any, idx: number) => {
              console.log(`  [${idx}] model_id: "${e.model_id}", dataset_id: "${e.dataset_id}"`);
            });
          }
          
          // Try to find exact match first
          let evaluation = data.evaluations?.find(
            (e: Evaluation) => e.model_id === selectedModelId && e.dataset_id === selectedDatasetId
          );
          
          // If no exact match, use the most recent evaluation for this model
          if (!evaluation) {
            evaluation = data.evaluations?.find(
              (e: Evaluation) => e.model_id === selectedModelId
            );
            if (evaluation) {
              console.log("⚠️ No evaluation for current dataset. Showing most recent evaluation for this model.");
            }
          }
          
          console.log("🔍 Found Evaluation:", evaluation);
          console.log("🔍 Evaluation Metrics:", evaluation?.metrics);
          
          setModelEvaluation(evaluation || null);
        } else {
          console.error("🔍 Evaluation API failed:", response.status, response.statusText);
        }
      } catch (err) {
        console.error('Error fetching evaluation:', err);
        setModelEvaluation(null);
      } finally {
        setLoadingEvaluation(false);
      }
    };

    fetchEvaluation();
  }, [selectedModelId, selectedDatasetId]);

  // Calculate overall quality score from summary or quality
  const overallQualityScore = quality 
    ? quality.overall_score 
    : summary?.quality_metrics?.overall_score || 0;

  // Get quality metrics for display - prefer from summary first
  const qualityData = quality || summary?.quality_metrics;
  const dataQualityMetrics = qualityData ? [
    { name: "Completeness", value: qualityData.completeness, status: qualityData.completeness >= 95 ? "good" : qualityData.completeness >= 80 ? "warning" : "poor" },
    { name: "Validity", value: qualityData.validity, status: qualityData.validity >= 95 ? "good" : qualityData.validity >= 80 ? "warning" : "poor" },
    { name: "Uniqueness", value: qualityData.uniqueness, status: qualityData.uniqueness >= 70 ? "good" : qualityData.uniqueness >= 50 ? "warning" : "poor" },
    { name: "Consistency", value: qualityData.consistency, status: qualityData.consistency >= 95 ? "good" : qualityData.consistency >= 80 ? "warning" : "poor" },
  ] : [];

  // Get top correlations for display - use summary.correlations structure
  const correlationData = summary?.correlations?.top_correlations || correlations?.correlations || [];
  const topCorrelations = correlationData.slice(0, 5);

  // Get outliers list - prefer from summary
  const outliersData = outliers || summary?.outliers;
  const outliersList = outliersData?.outliers?.slice(0, 5) || [];

  // Prepare data quality issues for AI chat
  const dataQualityIssues: string[] = [];
  
  if (qualityData) {
    if (qualityData.missing_values > 0) {
      dataQualityIssues.push(`${qualityData.missing_values} missing values detected`);
    }
    if (qualityData.completeness < 95) {
      dataQualityIssues.push(`Completeness is ${qualityData.completeness.toFixed(1)}% (below 95%)`);
    }
    if (qualityData.validity < 95) {
      dataQualityIssues.push(`Data validity is ${qualityData.validity.toFixed(1)}% (below 95%)`);
    }
    if (qualityData.uniqueness < 70) {
      dataQualityIssues.push(`Uniqueness is ${qualityData.uniqueness.toFixed(1)}% (below 70%)`);
    }
  }
  
  if (outliersData && outliersData.total_outliers > 0) {
    dataQualityIssues.push(`${outliersData.total_outliers} total outliers across ${outliersData.affected_features} features`);
  }

  // Get selected dataset name
  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 neon-text">
                Data Intelligence & Insights
              </h1>
              <p className="text-muted-foreground text-lg">
                AI-powered analysis and interactive data exploration
              </p>
            </div>
            <div className="flex gap-3">
              <Select
                value={selectedDatasetId || ""}
                onValueChange={setSelectedDatasetId}
                disabled={loadingDatasets}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {dataset.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={refetch}
                variant="outline"
                size="icon"
                disabled={!selectedDatasetId || isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {error.includes('Session expired') || error.includes('authentication') 
                    ? 'Your session has expired. Please log in again.' 
                    : error.includes('not found in storage') || error.includes('Object not found')
                    ? 'Dataset file not found. The dataset may need to be re-uploaded. Please go to the Upload page to upload your dataset again.'
                    : error}
                </span>
                {(error.includes('Session expired') || error.includes('authentication')) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.href = '/'}
                    className="ml-4"
                  >
                    Go to Login
                  </Button>
                )}
                {(error.includes('not found in storage') || error.includes('Object not found')) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.href = '/upload'}
                    className="ml-4"
                  >
                    Go to Upload
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!selectedDatasetId && !loadingDatasets && datasets.length === 0 && (
            <Alert className="mt-4">
              <Database className="h-4 w-4" />
              <AlertDescription>
                No datasets found. Please upload a dataset first.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Tabs for Dataset vs Model Insights */}
        <Tabs value={insightType} onValueChange={(v) => setInsightType(v as "dataset" | "model")} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dataset" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Dataset Insights
            </TabsTrigger>
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Evaluation
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Chat Assistant - Inline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ask EvalModel - Inline Chat */}
            <Card className="glass-card p-8 animate-fade-in-up">
              <InsightsAIChat
                inline={true}
                insightType={insightType}
                // Dataset props
                datasetName={selectedDataset?.name}
                qualityScore={overallQualityScore}
                outlierCount={outliersData?.affected_features}
                correlationCount={correlationData.length}
                issues={dataQualityIssues}
                summary={summary?.summary}
                // Model props
                modelName={models.find(m => m.id === selectedModelId)?.name}
                modelType={models.find(m => m.id === selectedModelId)?.model_type}
                modelFramework={models.find(m => m.id === selectedModelId)?.framework}
                evalScore={modelEvaluation?.eval_score}
                modelMetrics={modelEvaluation?.metrics}
              />
            </Card>

            {/* Dataset Insights: Data Quality Dashboard */}
            {insightType === "dataset" && (
              <Card className="glass-card p-8 animate-fade-in-up">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Data Quality Radar
                </h2>

                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : dataQualityMetrics.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {dataQualityMetrics.map((metric) => (
                        <div key={metric.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{metric.name}</span>
                            <span className="text-sm font-semibold">{metric.value.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                metric.status === "good"
                                  ? "bg-gradient-to-r from-primary to-accent"
                                  : metric.status === "warning"
                                  ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                  : "bg-gradient-to-r from-red-500 to-orange-500"
                              }`}
                              style={{ width: `${metric.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold mb-1">
                            Overall Quality Score: {overallQualityScore.toFixed(1)}%
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {qualityData && qualityData.status === 'good' 
                              ? 'Your dataset shows excellent quality!'
                              : qualityData && qualityData.status === 'warning'
                              ? 'Your dataset has good quality but could be improved.'
                              : 'Your dataset needs attention to improve quality.'}
                          </p>
                          {qualityData && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {qualityData.total_rows} rows × {qualityData.total_columns} columns
                              {qualityData.missing_values > 0 && ` • ${qualityData.missing_values} missing values`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a dataset to view quality metrics</p>
                  </div>
                )}
              </Card>
            )}

            {/* Model Insights: Evaluation Metrics */}
            {insightType === "model" && (
              <Card className="glass-card p-8 animate-fade-in-up">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Model Evaluation Metrics
                </h2>

                {/* Model Selection */}
                <div className="mb-6">
                  <Select
                    value={selectedModelId || ""}
                    onValueChange={setSelectedModelId}
                    disabled={loadingModels}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4" />
                            <span>{model.name}</span>
                            {model.is_evaluated && (
                              <Badge variant="outline" className="ml-2 text-xs">Evaluated</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingEvaluation ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : modelEvaluation ? (
                  <>
                    {/* Warning if evaluation is from different dataset */}
                    {modelEvaluation.dataset_id !== selectedDatasetId && (
                      <Alert className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          This evaluation was performed on a different dataset. The metrics shown may not reflect performance on the currently selected dataset.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Eval Score */}
                    <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">
                            EvalScore: {modelEvaluation.eval_score.toFixed(1)}/100
                          </h4>
                          <div className="h-3 bg-muted/50 rounded-full overflow-hidden mt-2">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                              style={{ width: `${modelEvaluation.eval_score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Evaluated on {new Date(modelEvaluation.evaluated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {modelEvaluation.metrics.accuracy !== undefined && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Accuracy</span>
                            <span className="text-sm font-semibold">
                              {(modelEvaluation.metrics.accuracy * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                              style={{ width: `${modelEvaluation.metrics.accuracy * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.precision !== undefined && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Precision</span>
                            <span className="text-sm font-semibold">
                              {(modelEvaluation.metrics.precision * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                              style={{ width: `${modelEvaluation.metrics.precision * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.recall !== undefined && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Recall</span>
                            <span className="text-sm font-semibold">
                              {(modelEvaluation.metrics.recall * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              style={{ width: `${modelEvaluation.metrics.recall * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.f1_score !== undefined && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">F1 Score</span>
                            <span className="text-sm font-semibold">
                              {(modelEvaluation.metrics.f1_score * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                              style={{ width: `${modelEvaluation.metrics.f1_score * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.mae !== undefined && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground">MAE</div>
                          <div className="text-lg font-semibold">
                            {modelEvaluation.metrics.mae.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.mse !== undefined && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground">MSE</div>
                          <div className="text-lg font-semibold">
                            {modelEvaluation.metrics.mse.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.rmse !== undefined && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground">RMSE</div>
                          <div className="text-lg font-semibold">
                            {modelEvaluation.metrics.rmse.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {modelEvaluation.metrics.r2_score !== undefined && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground">R² Score</div>
                          <div className="text-lg font-semibold">
                            {modelEvaluation.metrics.r2_score.toFixed(4)}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : selectedModelId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No evaluation found</p>
                    <p className="text-sm mt-1">
                      This model hasn't been evaluated with the selected dataset yet.
                    </p>
                    <Button variant="outline" className="mt-4" size="sm">
                      Evaluate Now
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a model to view evaluation metrics</p>
                  </div>
                )}
              </Card>
            )}

            {/* Correlation Heatmap - Dataset Only */}
            {insightType === "dataset" && (
              <Card className="glass-card p-8 animate-fade-in-up">
                <h2 className="text-xl font-semibold mb-6">Feature Correlations</h2>
              
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : topCorrelations.length > 0 ? (
                <div className="space-y-3">
                  {topCorrelations.map((corr, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">
                            {corr.feature1} ↔ {corr.feature2}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {corr.strength}
                            </Badge>
                            <span className={`text-sm font-semibold ${
                              corr.direction === 'positive' ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(3)}
                            </span>
                          </div>
                        </div>
                        <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              corr.direction === 'positive'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-red-500 to-orange-500'
                            }`}
                            style={{ width: `${corr.abs_correlation * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {correlations && correlations.total_pairs > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      Showing top 5 of {correlations.total_pairs} correlation pairs
                    </p>
                  )}
                  {summary && summary.correlations && summary.correlations.total_pairs > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      Showing top 5 of {summary.correlations.total_pairs} correlation pairs
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No significant correlations found</p>
                </div>
              )}
              </Card>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Outlier Detection - Dataset Only */}
            {insightType === "dataset" && (
              <Card className="glass-card p-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Outliers Detected</h3>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : outliersList.length > 0 ? (
                <div className="space-y-4">
                  {outliersList.map((outlier) => (
                    <div key={outlier.feature} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{outlier.feature}</span>
                        <Badge
                          variant="outline"
                          className={getImpactColor(outlier.impact)}
                        >
                          {outlier.impact}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {outlier.count} outliers ({outlier.percentage.toFixed(1)}%)
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Range:</span>
                          <span className="font-mono">
                            {outlier.min_value.toFixed(2)} - {outlier.max_value.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected:</span>
                          <span className="font-mono">
                            {outlier.lower_bound.toFixed(2)} - {outlier.upper_bound.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {outliersData && outliersData.total_outliers > outliersList.length && (
                    <p className="text-xs text-muted-foreground text-center">
                      {outliersData.affected_features - outliersList.length} more features with outliers
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No outliers detected</p>
                </div>
              )}
              </Card>
            )}

            {/* Model Summary - Model Only */}
            {insightType === "model" && selectedModelId && modelEvaluation && (
              <Card className="glass-card p-6 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Performance Summary</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Model Name</div>
                    <div className="font-medium">
                      {models.find(m => m.id === selectedModelId)?.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Model Type</div>
                    <div className="font-medium">
                      {models.find(m => m.id === selectedModelId)?.model_type}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Framework</div>
                    <div className="font-medium">
                      {models.find(m => m.id === selectedModelId)?.framework}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Dataset</div>
                    <div className="font-medium">{selectedDataset?.name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Last Evaluated</div>
                    <div className="font-medium text-xs">
                      {new Date(modelEvaluation.evaluated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="glass-card p-6 animate-fade-in-up">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Generate Quality Report
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  Remove Outliers
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Feature Importance
                </Button>
              </div>
            </Card>

            {/* AI Summary */}
            <Card className="glass-card p-6 glow-border-accent animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold">AI Summary</h3>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : summary?.summary ? (
                <p className="text-sm text-muted-foreground">
                  {summary.summary}
                </p>
              ) : selectedDatasetId ? (
                <p className="text-sm text-muted-foreground">
                  Analyzing your dataset...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a dataset to get AI-powered insights and recommendations.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights;
