import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, 
  Target, Shield, Database, Zap 
} from "lucide-react";

interface MetaEvaluatorResultsProps {
  metaScore: number;
  datasetHealthScore: number;
  flags: string[];
  recommendations: Array<{
    action: string;
    why: string;
    priority: string;
  }>;
  verdict: {
    status: string;
    message: string;
    confidence: number;
    critical_issues: number;
    total_issues: number;
  };
  breakdown: {
    metric_contribution: number;
    dataset_contribution: number;
    complexity_contribution: number;
  };
}

export function MetaEvaluatorResults({
  metaScore,
  datasetHealthScore,
  flags,
  recommendations,
  verdict,
  breakdown
}: MetaEvaluatorResultsProps) {
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 85) return "from-green-500 to-emerald-500";
    if (score >= 70) return "from-blue-500 to-cyan-500";
    if (score >= 50) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-rose-500";
  };

  const getStatusIcon = () => {
    if (verdict.status === "production_ready") return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    if (verdict.status === "production_ready_with_monitoring") return <Shield className="h-6 w-6 text-blue-500" />;
    if (verdict.status === "needs_improvement") return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "critical") return <Badge variant="destructive">Critical</Badge>;
    if (priority === "high") return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
    if (priority === "medium") return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const formatFlagName = (flag: string) => {
    return flag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Meta Score Header */}
      <Card className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl -z-10" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Meta Score</h2>
            <p className="text-muted-foreground">
              Unified model quality assessment
            </p>
          </div>
          {getStatusIcon()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Meta Score */}
          <div className="md:col-span-2">
            <div className="flex items-end gap-4 mb-4">
              <div className={`text-6xl font-bold ${getScoreColor(metaScore)}`}>
                {metaScore.toFixed(1)}
              </div>
              <div className="text-2xl text-muted-foreground pb-2">/100</div>
            </div>
            
            <Progress value={metaScore} className="h-3 mb-4" />
            
            <Alert className="border-l-4 border-l-primary">
              <AlertDescription className="font-medium">
                {verdict.message}
              </AlertDescription>
            </Alert>
          </div>

          {/* Dataset Health */}
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Dataset Health</h4>
            </div>
            <div className={`text-4xl font-bold ${getScoreColor(datasetHealthScore)} mb-2`}>
              {datasetHealthScore.toFixed(1)}
            </div>
            <Progress value={datasetHealthScore} className="h-2" />
          </div>
        </div>
      </Card>

      {/* Score Breakdown */}
      <Card className="glass-card p-8">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Score Breakdown
        </h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Model Performance (65%)</span>
              <span className="text-sm font-semibold">{breakdown.metric_contribution.toFixed(1)}/65</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                style={{ width: `${(breakdown.metric_contribution / 65) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Dataset Quality (25%)</span>
              <span className="text-sm font-semibold">{breakdown.dataset_contribution.toFixed(1)}/25</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                style={{ width: `${(breakdown.dataset_contribution / 25) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Model Complexity (10%)</span>
              <span className="text-sm font-semibold">{breakdown.complexity_contribution.toFixed(1)}/10</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                style={{ width: `${(breakdown.complexity_contribution / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flags */}
        {flags.length > 0 && (
          <Card className="glass-card p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Detected Issues ({flags.length})
            </h3>
            
            <div className="space-y-2">
              {flags.map((flag, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm">{formatFlagName(flag)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recommendations */}
        <Card className="glass-card p-8">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Recommendations ({recommendations.length})
          </h3>
          
          <div className="space-y-4">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div key={idx} className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{rec.action}</h4>
                  {getPriorityBadge(rec.priority)}
                </div>
                <p className="text-xs text-muted-foreground">{rec.why}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Verdict Summary */}
      <Card className={`glass-card p-8 border-l-4 ${
        verdict.status === "production_ready" ? "border-l-green-500" :
        verdict.status === "production_ready_with_monitoring" ? "border-l-blue-500" :
        verdict.status === "needs_improvement" ? "border-l-yellow-500" :
        "border-l-red-500"
      }`}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">Final Verdict</h3>
            <p className="text-muted-foreground mb-4">
              {verdict.message}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-semibold ml-2">{verdict.confidence.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Issues:</span>
                <span className="font-semibold ml-2">{verdict.total_issues}</span>
              </div>
              {verdict.critical_issues > 0 && (
                <div>
                  <span className="text-red-500">Critical Issues:</span>
                  <span className="font-semibold ml-2 text-red-500">{verdict.critical_issues}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
