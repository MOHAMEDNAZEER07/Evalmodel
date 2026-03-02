import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, TrendingUp, Zap, Target, BarChart3, Database, Loader2, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  eval_score: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
  };
}

const Compare = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [modelDatasetPairs, setModelDatasetPairs] = useState<ModelDatasetPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  
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
      const token = localStorage.getItem('access_token');
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
      console.log('Starting comparison with pairs:', modelDatasetPairs);
      
      // Evaluate each model-dataset pair
      const evaluationPromises = modelDatasetPairs.map(pair => {
        console.log(`Evaluating model ${pair.modelId} with dataset ${pair.datasetId}`);
        return apiClient.evaluateModel(pair.modelId, pair.datasetId);
      });
      
      const evaluations = await Promise.all(evaluationPromises);
      console.log('Raw evaluations received:', evaluations);
      
      // Build comparison result
      const comparisons = evaluations.map((evaluation: any, index) => {
        console.log(`Processing evaluation ${index}:`, evaluation);
        // Handle nested eval_score structure from backend
        const evalScore = typeof evaluation.eval_score === 'object' 
          ? evaluation.eval_score.eval_score 
          : evaluation.eval_score || 0;
          
        return {
          model_id: modelDatasetPairs[index].modelId,
          dataset_id: modelDatasetPairs[index].datasetId,
          eval_score: evalScore,
          metrics: evaluation.metrics || {},
          evaluation_id: evaluation.id
        };
      });
      
      console.log('Processed comparisons:', comparisons);
      
      // Find best model
      const bestComparison = comparisons.reduce((best, current) => 
        (current.eval_score > best.eval_score) ? current : best
      );
      
      const result = {
        comparisons,
        best_model_id: bestComparison.model_id,
        best_model_name: models.find(m => m.id === bestComparison.model_id)?.name,
        best_eval_score: bestComparison.eval_score
      };
      
      console.log('Final comparison result:', result);
      setComparisonResults(result);
      
      toast({
        title: "Comparison complete",
        description: "Models compared successfully",
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
        {comparisonResults && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Models Compared</h3>
                </div>
                <p className="text-3xl font-bold text-primary">{comparisonResults.comparisons?.length || modelDatasetPairs.length}</p>
              </Card>
              
              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold">Best Model</h3>
                </div>
                <p className="text-lg font-bold truncate">
                  {comparisonResults.best_model_name || models.find(m => m.id === comparisonResults.best_model_id)?.name || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Score: {comparisonResults.best_eval_score?.toFixed(2) || 'N/A'}
                </p>
              </Card>
              
              <Card className="glass-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <h3 className="font-semibold">Pairs Compared</h3>
                </div>
                <p className="text-3xl font-bold text-primary">{comparisonResults.comparisons?.length || modelDatasetPairs.length}</p>
              </Card>
            </div>

            {/* Metrics Comparison Table */}
            {comparisonResults.comparisons && comparisonResults.comparisons.length > 0 && (
              <Card className="glass-card p-8">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Metrics Comparison
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Model</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dataset</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">EvalScore</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">Accuracy</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">Precision</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">Recall</th>
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">F1-Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResults.comparisons.map((comparison: any, idx: number) => {
                        const model = models.find(m => m.id === comparison.model_id);
                        const dataset = datasets.find(d => d.id === comparison.dataset_id);
                        const isBest = comparison.model_id === comparisonResults.best_model_id;
                        
                        return (
                          <tr 
                            key={`${comparison.model_id}-${comparison.dataset_id}`} 
                            className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${isBest ? 'bg-primary/5' : ''}`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {isBest && <Badge className="bg-primary text-primary-foreground">Best</Badge>}
                                <div>
                                  <p className="font-medium">{model?.name || `Model ${idx + 1}`}</p>
                                  <p className="text-xs text-muted-foreground">{model?.framework}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-sm">{dataset?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {dataset?.row_count} rows • {dataset?.column_count} cols
                                </p>
                              </div>
                            </td>
                            <td className="text-center p-4">
                              <span className={`font-bold ${isBest ? 'text-primary text-lg' : ''}`}>
                                {comparison.eval_score?.toFixed(2) || 'N/A'}
                              </span>
                            </td>
                            <td className="text-center p-4">
                              {comparison.metrics?.accuracy ? (comparison.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'}
                            </td>
                            <td className="text-center p-4">
                              {comparison.metrics?.precision ? (comparison.metrics.precision * 100).toFixed(1) + '%' : 'N/A'}
                            </td>
                            <td className="text-center p-4">
                              {comparison.metrics?.recall ? (comparison.metrics.recall * 100).toFixed(1) + '%' : 'N/A'}
                            </td>
                            <td className="text-center p-4">
                              {comparison.metrics?.f1_score ? (comparison.metrics.f1_score * 100).toFixed(1) + '%' : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Visual Comparison Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* EvalScore Bar Chart */}
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  EvalScore Comparison
                </h3>
                <div className="space-y-4">
                  {comparisonResults.comparisons?.map((comparison: any, idx: number) => {
                    const model = models.find(m => m.id === comparison.model_id);
                    const dataset = datasets.find(d => d.id === comparison.dataset_id);
                    const score = comparison.eval_score || 0;
                    const isBest = comparison.model_id === comparisonResults.best_model_id;
                    
                    return (
                      <div key={`${comparison.model_id}-${comparison.dataset_id}`}>
                        <div className="flex justify-between mb-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium truncate">{model?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{dataset?.name || 'Unknown'}</span>
                          </div>
                          <span className={`text-sm font-bold ${isBest ? 'text-primary' : ''}`}>
                            {score.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-8 bg-muted rounded-lg overflow-hidden">
                          <div
                            className={`eval-score-bar h-full rounded-lg transition-all ${
                              isBest 
                                ? 'bg-gradient-to-r from-primary to-accent' 
                                : 'bg-gradient-to-r from-primary/60 to-accent/60'
                            }`}
                            style={{ '--bar-width': `${score}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Metrics Radar Chart Placeholder */}
              <Card className="glass-card p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  {['Accuracy', 'Precision', 'Recall', 'F1-Score'].map((metric) => {
                    const metricKey = metric.toLowerCase().replace('-', '_');
                    const values = comparisonResults.comparisons?.map((c: any) => 
                      c.metrics?.[metricKey] ? c.metrics[metricKey] * 100 : 0
                    ) || [];
                    const maxValue = Math.max(...values, 0);
                    
                    return (
                      <div key={metric}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">{metric}</span>
                          <span className="text-sm font-semibold">{maxValue.toFixed(1)}%</span>
                        </div>
                        <div className="flex gap-2 h-6">
                          {comparisonResults.comparisons?.map((comparison: any, idx: number) => {
                            const value = comparison.metrics?.[metricKey] ? comparison.metrics[metricKey] * 100 : 0;
                            const isBest = comparison.model_id === comparisonResults.best_model_id;
                            
                            return (
                              <div
                                key={comparison.model_id}
                                className="flex-1 bg-muted rounded overflow-hidden relative group"
                                title={`${models.find(m => m.id === comparison.model_id)?.name}: ${value.toFixed(1)}%`}
                              >
                                <div
                                  className={`metric-bar rounded transition-all ${
                                    isBest 
                                      ? 'bg-gradient-to-t from-primary to-accent' 
                                      : 'bg-gradient-to-t from-primary/50 to-accent/50'
                                  }`}
                                  style={{ '--bar-height': `${(value / maxValue) * 100}%` } as React.CSSProperties}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* AI Insights */}
            <Card className="glass-card p-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Key Insights
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                  <h4 className="font-semibold mb-2 text-primary">Top Performer</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>{comparisonResults.best_model_name || 'N/A'}</strong> achieved the highest EvalScore 
                    of <strong>{comparisonResults.best_eval_score?.toFixed(2) || 'N/A'}</strong>
                  </p>
                  {comparisonResults.comparisons?.[0] && (
                    <div className="text-xs space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <span className="font-medium">
                          {comparisonResults.comparisons[0].metrics?.accuracy 
                            ? (comparisonResults.comparisons[0].metrics.accuracy * 100).toFixed(1) + '%' 
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>F1-Score:</span>
                        <span className="font-medium">
                          {comparisonResults.comparisons[0].metrics?.f1_score 
                            ? (comparisonResults.comparisons[0].metrics.f1_score * 100).toFixed(1) + '%' 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted/50 rounded-xl">
                  <h4 className="font-semibold mb-2">Performance Distribution</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• {comparisonResults.comparisons?.length || 0} model-dataset pairs evaluated</p>
                    <p>• Multiple datasets used for comparison</p>
                    <p>• All models compared using SMCP pipeline</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button className="btn-glow flex-1" onClick={() => setComparisonResults(null)}>
                New Comparison
              </Button>
              <Button variant="outline" className="flex-1 border-accent/50 hover:bg-accent/10">
                Export Results
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
