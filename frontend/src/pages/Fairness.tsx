import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import type { LucideIcon } from "lucide-react";
import { Scale, AlertTriangle, CheckCircle2, Info, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { Progress } from "@/components/ui/progress";

const FairnessMetricsChart = lazy(() =>
  import("@/components/fairness/FairnessMetricsChart").then((module) => ({
    default: module.FairnessMetricsChart,
  }))
);

const FairnessGroupCharts = lazy(() =>
  import("@/components/fairness/FairnessGroupCharts").then((module) => ({
    default: module.FairnessGroupCharts,
  }))
);

interface FairnessMetrics {
  demographic_parity_difference: number;
  equal_opportunity_difference: number;
  disparate_impact_ratio: number;
  statistical_parity: number;
  predictive_parity: number;
  equalized_odds_difference: number;
  overall_fairness_score: number;
}

interface GroupMetrics {
  group: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  true_positive_rate: number;
  false_positive_rate: number;
  positive_prediction_rate: number;
  sample_count: number;
}

interface Evaluation {
  id: string;
  model_id: string;
  dataset_id: string;
  model_type: string;
  meta_score: number;
  fairness_metrics?: FairnessMetrics;
  group_metrics?: GroupMetrics[];
  sensitive_attribute?: string;
  evaluated_at: string;
  models?: {
    name: string;
  };
  datasets?: {
    name: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasFairnessMetrics(value: unknown): value is Evaluation {
  if (!isRecord(value)) return false;
  const fairness = value.fairness_metrics;
  return isRecord(fairness) && Object.keys(fairness).length > 0;
}

const FAIRNESS_THRESHOLDS = {
  excellent: 0.9,
  good: 0.75,
  fair: 0.6,
  poor: 0.4,
};

const METRIC_COLORS = {
  excellent: "#10b981",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#ef4444",
};

export default function Fairness() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string>("");
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const loadEvaluations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getEvaluationHistory(100, false);

      // Filter evaluations that have fairness metrics
      const fairnessEvaluations = (response.evaluations || []).filter(hasFairnessMetrics);

      setEvaluations(fairnessEvaluations);

      // Auto-select the most recent evaluation
      if (fairnessEvaluations.length > 0) {
        const mostRecent = fairnessEvaluations[0];
        setSelectedEvaluationId((prev) => prev || mostRecent.id);
        setCurrentEvaluation((prev) => prev || mostRecent);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load fairness evaluations.";
      console.error('Error loading evaluations:', error);
      toast({
        title: "Error Loading Data",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const handleEvaluationSelect = (evaluationId: string) => {
    setSelectedEvaluationId(evaluationId);
    const evaluation = evaluations.find(evalItem => evalItem.id === evaluationId);
    if (evaluation) {
      setCurrentEvaluation(evaluation);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvaluations();
    setIsRefreshing(false);
    toast({
      title: "Data Refreshed",
      description: "Fairness analysis data has been updated.",
    });
  };

  const getFairnessLevel = (score: number): { level: string; color: string } => {
    if (score >= FAIRNESS_THRESHOLDS.excellent) return { level: "Excellent", color: METRIC_COLORS.excellent };
    if (score >= FAIRNESS_THRESHOLDS.good) return { level: "Good", color: METRIC_COLORS.good };
    if (score >= FAIRNESS_THRESHOLDS.fair) return { level: "Fair", color: METRIC_COLORS.fair };
    return { level: "Poor", color: METRIC_COLORS.poor };
  };

  const getMetricInterpretation = (metric: string, value: number): { status: string; icon: LucideIcon; color: string } => {
    const absValue = Math.abs(value);
    
    if (metric.includes('difference')) {
      if (absValue <= 0.1) return { status: "Fair", icon: CheckCircle2, color: "text-green-500" };
      if (absValue <= 0.2) return { status: "Moderate", icon: Info, color: "text-yellow-500" };
      return { status: "Biased", icon: AlertTriangle, color: "text-red-500" };
    }
    
    if (metric.includes('ratio')) {
      if (value >= 0.8 && value <= 1.25) return { status: "Fair", icon: CheckCircle2, color: "text-green-500" };
      if (value >= 0.6 && value <= 1.5) return { status: "Moderate", icon: Info, color: "text-yellow-500" };
      return { status: "Biased", icon: AlertTriangle, color: "text-red-500" };
    }
    
    if (value >= 0.8) return { status: "Fair", icon: CheckCircle2, color: "text-green-500" };
    if (value >= 0.6) return { status: "Moderate", icon: Info, color: "text-yellow-500" };
    return { status: "Biased", icon: AlertTriangle, color: "text-red-500" };
  };

  const formatMetricName = (metric: string): string => {
    return metric
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Scale className="h-8 w-8 text-primary animate-pulse" />
          <div>
            <h1 className="text-3xl font-bold">Fairness Analysis</h1>
            <p className="text-muted-foreground">Loading fairness metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Fairness Analysis</h1>
              <p className="text-muted-foreground">Bias detection and fairness metrics</p>
            </div>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scale className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Fairness Data Available</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Run a model evaluation with sensitive attributes to generate fairness analysis.
            </p>
            <Button onClick={() => window.location.href = '/evaluate'}>
              Go to Evaluate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fairnessMetrics = currentEvaluation?.fairness_metrics;
  const groupMetrics = currentEvaluation?.group_metrics || [];
  const overallScore = fairnessMetrics?.overall_fairness_score || 0;
  const fairnessLevel = getFairnessLevel(overallScore);

  // Prepare data for charts
  const metricsChartData = fairnessMetrics
    ? Object.entries(fairnessMetrics)
        .filter(([key]) => key !== 'overall_fairness_score')
        .map(([key, value]) => ({
          name: formatMetricName(key),
          value: typeof value === 'number' ? Math.abs(value) : 0,
          rawValue: value,
          interpretation: getMetricInterpretation(key, value as number),
        }))
    : [];

  const groupComparisonData = groupMetrics.map(group => ({
    group: group.group,
    accuracy: group.accuracy * 100,
    precision: group.precision * 100,
    recall: group.recall * 100,
    f1_score: group.f1_score * 100,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Fairness Analysis</h1>
            <p className="text-muted-foreground">Bias detection and fairness metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Evaluation Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Evaluation</CardTitle>
          <CardDescription>Choose an evaluation to analyze fairness metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedEvaluationId} onValueChange={handleEvaluationSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an evaluation..." />
            </SelectTrigger>
            <SelectContent>
              {evaluations.map((evalItem) => (
                <SelectItem key={evalItem.id} value={evalItem.id}>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="font-medium">
                      {evalItem.models?.name || 'Unknown Model'} × {evalItem.datasets?.name || 'Unknown Dataset'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {evalItem.sensitive_attribute || 'N/A'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evalItem.evaluated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {currentEvaluation && fairnessMetrics && (
        <>
          {/* Overall Fairness Score */}
          <Card className="border-2" style={{ borderColor: fairnessLevel.color }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Overall Fairness Score</CardTitle>
                  <CardDescription>
                    Analyzing {currentEvaluation.sensitive_attribute || 'sensitive attribute'}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-lg px-4 py-2"
                  style={{ borderColor: fairnessLevel.color, color: fairnessLevel.color }}
                >
                  {fairnessLevel.level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold" style={{ color: fairnessLevel.color }}>
                    {(overallScore * 100).toFixed(1)}%
                  </div>
                  <Progress value={overallScore * 100} className="flex-1" />
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    The overall fairness score combines multiple fairness metrics to provide a
                    comprehensive assessment of model bias. Scores above 75% indicate good fairness.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Different Views */}
          <Tabs defaultValue="metrics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="metrics">Fairness Metrics</TabsTrigger>
              <TabsTrigger value="groups">Group Comparison</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            {/* Fairness Metrics Tab */}
            <TabsContent value="metrics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fairness Metrics Overview</CardTitle>
                  <CardDescription>
                    Lower values indicate better fairness (closer to 0 for differences, closer to 1 for ratios)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>}>
                    <FairnessMetricsChart
                      data={metricsChartData.map((metric) => ({
                        name: metric.name,
                        value: metric.value,
                        rawValue: metric.rawValue as number,
                        interpretation: {
                          status: metric.interpretation.status,
                          color: metric.interpretation.color,
                        },
                      }))}
                      goodColor={METRIC_COLORS.excellent}
                      moderateColor={METRIC_COLORS.fair}
                      poorColor={METRIC_COLORS.poor}
                    />
                  </Suspense>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {metricsChartData.map((metric, index) => {
                      const IconComponent = metric.interpretation.icon;
                      return (
                        <Card key={index}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-sm mb-1">{metric.name}</p>
                                <p className="text-2xl font-bold">{metric.rawValue.toFixed(4)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <IconComponent className={`h-5 w-5 ${metric.interpretation.color}`} />
                                <Badge
                                  variant="outline"
                                  className={metric.interpretation.color}
                                >
                                  {metric.interpretation.status}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Metric Definitions */}
              <Card>
                <CardHeader>
                  <CardTitle>Metric Definitions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-1">Demographic Parity Difference</h4>
                      <p className="text-sm text-muted-foreground">
                        Measures the difference in positive prediction rates between groups. Values close to 0 indicate fairness.
                      </p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-1">Equal Opportunity Difference</h4>
                      <p className="text-sm text-muted-foreground">
                        Measures the difference in true positive rates (recall) between groups. Values close to 0 indicate fairness.
                      </p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-1">Disparate Impact Ratio</h4>
                      <p className="text-sm text-muted-foreground">
                        Ratio of positive prediction rates between groups. Values between 0.8 and 1.25 are considered fair.
                      </p>
                    </div>
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-1">Equalized Odds Difference</h4>
                      <p className="text-sm text-muted-foreground">
                        Measures the maximum difference in true positive and false positive rates. Values close to 0 indicate fairness.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Group Comparison Tab */}
            <TabsContent value="groups" className="space-y-6">
              {groupMetrics.length > 0 ? (
                <>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">Loading group charts...</div>}>
                    <FairnessGroupCharts
                      groupComparisonData={groupComparisonData}
                    />
                  </Suspense>

                  {/* Group Metrics Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Detailed Group Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 font-semibold">Group</th>
                              <th className="text-right py-3 px-4 font-semibold">Samples</th>
                              <th className="text-right py-3 px-4 font-semibold">Accuracy</th>
                              <th className="text-right py-3 px-4 font-semibold">Precision</th>
                              <th className="text-right py-3 px-4 font-semibold">Recall</th>
                              <th className="text-right py-3 px-4 font-semibold">F1 Score</th>
                              <th className="text-right py-3 px-4 font-semibold">TPR</th>
                              <th className="text-right py-3 px-4 font-semibold">FPR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupMetrics.map((group, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="py-3 px-4 font-medium">{group.group}</td>
                                <td className="text-right py-3 px-4">{group.sample_count}</td>
                                <td className="text-right py-3 px-4">{(group.accuracy * 100).toFixed(2)}%</td>
                                <td className="text-right py-3 px-4">{(group.precision * 100).toFixed(2)}%</td>
                                <td className="text-right py-3 px-4">{(group.recall * 100).toFixed(2)}%</td>
                                <td className="text-right py-3 px-4">{(group.f1_score * 100).toFixed(2)}%</td>
                                <td className="text-right py-3 px-4">{(group.true_positive_rate * 100).toFixed(2)}%</td>
                                <td className="text-right py-3 px-4">{(group.false_positive_rate * 100).toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No group-level metrics available for this evaluation.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fairness Recommendations</CardTitle>
                  <CardDescription>Actionable steps to improve model fairness</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {overallScore < FAIRNESS_THRESHOLDS.good && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Critical:</strong> Your model shows significant fairness issues. Immediate action is recommended.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Data Collection & Preprocessing</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Ensure balanced representation of all demographic groups in training data</li>
                          <li>Remove or mitigate features that may encode protected attributes</li>
                          <li>Use stratified sampling to maintain group proportions</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Model Training Techniques</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Apply fairness constraints during training (e.g., demographic parity)</li>
                          <li>Use reweighting to balance group representation</li>
                          <li>Consider adversarial debiasing techniques</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Post-Processing Methods</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Adjust decision thresholds per group to equalize outcomes</li>
                          <li>Apply calibration techniques to improve fairness</li>
                          <li>Use reject option classification for uncertain predictions</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Monitoring & Governance</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Establish regular fairness audits and testing protocols</li>
                          <li>Set up alerts for fairness metric degradation</li>
                          <li>Document fairness considerations and mitigation strategies</li>
                          <li>Involve diverse stakeholders in model evaluation</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Improving fairness often involves trade-offs with overall accuracy.
                      Consider your specific use case and regulatory requirements when implementing these recommendations.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <a href="#" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Info className="h-4 w-4" />
                      Read our Fairness Best Practices Guide
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Info className="h-4 w-4" />
                      Learn about Fairness-Aware ML Algorithms
                    </a>
                    <a href="#" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Info className="h-4 w-4" />
                      Explore Bias Mitigation Techniques
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
