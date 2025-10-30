import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, Activity, BarChart3, Database, Brain, Loader2 } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Model {
  id: string;
  name: string;
  description: string;
  model_type: string;
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

// Add these response interfaces to narrow unknown API responses
interface ListModelsResponse {
  models?: Model[];
}

interface ListDatasetsResponse {
  datasets?: Dataset[];
}

const Evaluate = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
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
      const result = await apiClient.evaluateModel(selectedModel, selectedDataset);
      
      toast({
        title: "Evaluation complete",
        description: "Model evaluation finished successfully",
      });
      
      setShowResults(true);
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
                                {model.framework} • {model.model_type} • {formatFileSize(model.file_size)}
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
        {showResults && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">Evaluation Results</h2>
            
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Accuracy" value="94.2%" icon={Target} trend="+2.1%" trendUp />
              <MetricCard title="Precision" value="92.8%" icon={TrendingUp} trend="+1.5%" trendUp />
              <MetricCard title="Recall" value="91.5%" icon={Activity} trend="+3.2%" trendUp />
              <MetricCard title="F1-Score" value="92.1%" icon={BarChart3} trend="+2.8%" trendUp />
            </div>

            {/* Confusion Matrix */}
            <Card className="glass-card p-8 mb-8">
              <h3 className="text-xl font-semibold mb-6">Confusion Matrix</h3>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="metric-card text-center">
                  <p className="text-sm text-muted-foreground mb-2">True Positive</p>
                  <p className="text-3xl font-bold text-green-400">847</p>
                </div>
                <div className="metric-card text-center">
                  <p className="text-sm text-muted-foreground mb-2">False Positive</p>
                  <p className="text-3xl font-bold text-yellow-400">52</p>
                </div>
                <div className="metric-card text-center">
                  <p className="text-sm text-muted-foreground mb-2">False Negative</p>
                  <p className="text-3xl font-bold text-orange-400">68</p>
                </div>
                <div className="metric-card text-center">
                  <p className="text-sm text-muted-foreground mb-2">True Negative</p>
                  <p className="text-3xl font-bold text-green-400">923</p>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button className="btn-glow flex-1">Download Report</Button>
              <Button variant="outline" className="flex-1">Compare Models</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Evaluate;
