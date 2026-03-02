import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Sparkles, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { ExplainabilityDashboard } from "@/components/ExplainabilityDashboard";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Evaluation {
  id: string;
  model_id: string;
  dataset_id: string;
  evaluated_at: string;
  meta_score?: number;
  feature_importance?: Array<{ feature: string; importance: number; rank: number }>;
  explainability_method?: string;
  shap_summary?: {
    mean_abs_shap?: number;
    max_shap?: number;
    top_features?: string[];
    base_value?: number;
  };
  models?: { name: string };
  datasets?: { name: string };
}

const Explainability = () => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>("");
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadEvaluations();
    }
  }, [user]);

  const loadEvaluations = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
        const response = await apiClient.getEvaluationHistory(100);
        
        // Filter evaluations that have explainability data
        const evaluationsWithExplainability = response.evaluations.filter(
          (evaluation: Evaluation) => evaluation.feature_importance && evaluation.feature_importance.length > 0
        );
        
        setEvaluations(evaluationsWithExplainability);
        
        // Auto-select the most recent evaluation
        if (evaluationsWithExplainability.length > 0 && !selectedEvaluation) {
          const mostRecent = evaluationsWithExplainability[0];
          setSelectedEvaluation(mostRecent.id);
          setCurrentEvaluation(mostRecent);
        }
      }
    } catch (error) {
      console.error('Error loading evaluations:', error);
      toast({
        title: "Error",
        description: "Failed to load evaluations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluationSelect = (evaluationId: string) => {
    setSelectedEvaluation(evaluationId);
    const evaluation = evaluations.find(evalItem => evalItem.id === evaluationId);
    setCurrentEvaluation(evaluation || null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvaluations();
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Evaluation history updated successfully."
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading explainability data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Model Explainability</h1>
            <p className="text-muted-foreground mt-1">
              Understand feature importance and model decision-making with SHAP & LIME analysis
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Evaluation Selector */}
      {evaluations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Select Evaluation
            </CardTitle>
            <CardDescription>
              Choose an evaluation to view its explainability analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Evaluation</label>
                <Select value={selectedEvaluation} onValueChange={handleEvaluationSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an evaluation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {evaluations.map((evaluation) => (
                      <SelectItem key={evaluation.id} value={evaluation.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {evaluation.models?.name || 'Unknown Model'} × {evaluation.datasets?.name || 'Unknown Dataset'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(evaluation.evaluated_at).toLocaleDateString()} • 
                            {evaluation.explainability_method === 'SHAP' && ' SHAP Analysis'}
                            {evaluation.explainability_method === 'LIME' && ' LIME Analysis'}
                            {evaluation.explainability_method === 'basic' && ' Basic Feature Importance'}
                            {evaluation.meta_score && ` • Meta Score: ${evaluation.meta_score.toFixed(1)}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentEvaluation && (
                <div className="flex gap-2">
                  {currentEvaluation.explainability_method && (
                    <div className="px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {currentEvaluation.explainability_method.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {currentEvaluation.meta_score !== null && currentEvaluation.meta_score !== undefined && (
                    <div className="px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="text-sm font-medium">
                        Meta: {currentEvaluation.meta_score.toFixed(1)}/100
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''} with explainability data
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Explainability Data Available</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven't run any evaluations with explainability analysis yet. 
              Go to the Evaluate page and run a model evaluation to generate explainability insights.
            </p>
            <Button onClick={() => window.location.href = '/evaluate'}>
              Go to Evaluate
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Explainability Dashboard */}
      {currentEvaluation && (
        <div className="animate-fade-in">
          <ExplainabilityDashboard
            featureImportance={currentEvaluation.feature_importance || null}
            explainabilityMethod={currentEvaluation.explainability_method || null}
            shapSummary={currentEvaluation.shap_summary || null}
          />
        </div>
      )}

      {/* Info Section */}
      {currentEvaluation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About This Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p className="font-medium">{currentEvaluation.models?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dataset</p>
                <p className="font-medium">{currentEvaluation.datasets?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Evaluated</p>
                <p className="font-medium">
                  {new Date(currentEvaluation.evaluated_at).toLocaleString()}
                </p>
              </div>
            </div>
            
            {currentEvaluation.shap_summary?.top_features && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Top Features Impact</p>
                <div className="flex flex-wrap gap-2">
                  {currentEvaluation.shap_summary.top_features.map((feature, index) => (
                    <div 
                      key={feature}
                      className="px-3 py-1 bg-muted rounded-full text-sm font-medium"
                    >
                      #{index + 1} {feature}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Explainability;
