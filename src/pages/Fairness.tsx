import { useState, useEffect } from "react";
import { Scale, AlertTriangle, CheckCircle2, Info, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

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

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('evaluations')
        .select(`
          *,
          models:model_id(name),
          datasets:dataset_id(name)
        `)
        .order('evaluated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Filter evaluations that have fairness metrics
      const fairnessEvaluations = (data || []).filter(
        (evalItem: any) => evalItem.fairness_metrics && Object.keys(evalItem.fairness_metrics).length > 0
      ) as Evaluation[];

      setEvaluations(fairnessEvaluations);

      // Auto-select the most recent evaluation
      if (fairnessEvaluations.length > 0 && !selectedEvaluationId) {
        const mostRecent = fairnessEvaluations[0];
        setSelectedEvaluationId(mostRecent.id);
        setCurrentEvaluation(mostRecent);
      }
    } catch (error: any) {
      console.error('Error loading evaluations:', error);
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load fairness evaluations.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const getMetricInterpretation = (metric: string, value: number): { status: string; icon: any; color: string } => {
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

  const radarData = groupMetrics.map(group => ({
    metric: group.group,
    Accuracy: group.accuracy * 100,
    Precision: group.precision * 100,
    Recall: group.recall * 100,
    'F1 Score': group.f1_score * 100,
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
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={metricsChartData} layout="vertical" margin={{ left: 150 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 1]} />
                      <YAxis type="category" dataKey="name" width={145} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                                <p className="font-semibold text-sm mb-1">{data.name}</p>
                                <p className="text-sm">Value: {data.rawValue.toFixed(4)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <data.interpretation.icon className={`h-4 w-4 ${data.interpretation.color}`} />
                                  <span className={`text-sm font-medium ${data.interpretation.color}`}>
                                    {data.interpretation.status}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {metricsChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.interpretation.status === 'Fair'
                                ? METRIC_COLORS.excellent
                                : entry.interpretation.status === 'Moderate'
                                ? METRIC_COLORS.fair
                                : METRIC_COLORS.poor
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

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
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance by Group</CardTitle>
                      <CardDescription>Comparing metrics across different demographic groups</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={groupComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="group" />
                          <YAxis domain={[0, 100]} label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} />
                          <Line type="monotone" dataKey="precision" stroke="#10b981" strokeWidth={2} />
                          <Line type="monotone" dataKey="recall" stroke="#f59e0b" strokeWidth={2} />
                          <Line type="monotone" dataKey="f1_score" stroke="#8b5cf6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Radar Chart: Multi-Metric View</CardTitle>
                      <CardDescription>360° view of performance across groups</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" />
                          <PolarRadiusAxis domain={[0, 100]} />
                          <Radar name="Accuracy" dataKey="Accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                          <Radar name="Precision" dataKey="Precision" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                          <Radar name="Recall" dataKey="Recall" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                          <Radar name="F1 Score" dataKey="F1 Score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

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
