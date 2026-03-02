import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, 
  Target, Shield, Database, Zap, Activity, Scale, Gauge
} from "lucide-react";

interface ComponentScores {
  performance: number;
  health: number;
  fairness: number;
  robustness: number;
}

interface MetaEvaluatorResultsProps {
  metaScore: number;
  trustScore?: number;
  DII?: number;
  componentScores?: ComponentScores;
  riskValues?: ComponentScores;
  hybridWeights?: ComponentScores;
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
  trustScore,
  DII,
  componentScores,
  riskValues,
  hybridWeights,
  datasetHealthScore,
  flags,
  recommendations,
  verdict,
  breakdown
}: MetaEvaluatorResultsProps) {
  
  // Use trust score if available, otherwise fall back to meta score
  const displayScore = trustScore ?? metaScore;
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getComponentScoreColor = (score: number) => {
    if (score >= 0.85) return "text-green-500";
    if (score >= 0.70) return "text-blue-500";
    if (score >= 0.50) return "text-yellow-500";
    return "text-red-500";
  };

  const getDIIColor = (dii: number) => {
    if (dii <= 0.15) return "text-green-500";
    if (dii <= 0.30) return "text-blue-500";
    if (dii <= 0.50) return "text-yellow-500";
    return "text-red-500";
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

  const componentLabels = {
    performance: { label: 'Performance (P)', icon: Target, description: 'Model accuracy and metrics' },
    health: { label: 'Health (H)', icon: Database, description: 'Dataset quality and integrity' },
    fairness: { label: 'Fairness (F)', icon: Scale, description: 'Bias and demographic parity' },
    robustness: { label: 'Robustness (R)', icon: Shield, description: 'Generalization capability' }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Trust Score Header */}
      <Card className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl -z-10" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              {trustScore !== undefined ? 'Trust Score' : 'Meta Score'}
            </h2>
            <p className="text-muted-foreground">
              {trustScore !== undefined 
                ? 'Hybrid Trust Aggregation Assessment'
                : 'Unified model quality assessment'}
            </p>
          </div>
          {getStatusIcon()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Score */}
          <div className="md:col-span-2">
            <div className="flex items-end gap-4 mb-4">
              <div className={`text-6xl font-bold ${getScoreColor(displayScore)}`}>
                {displayScore.toFixed(1)}
              </div>
              <div className="text-2xl text-muted-foreground pb-2">/100</div>
            </div>
            
            <Progress value={displayScore} className="h-3 mb-4" />
            
            <Alert className="border-l-4 border-l-primary">
              <AlertDescription className="font-medium">
                {verdict.message}
              </AlertDescription>
            </Alert>
          </div>

          {/* DII and Dataset Health */}
          <div className="space-y-4">
            {DII !== undefined && (
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold text-sm">Dataset Instability (DII)</h4>
                </div>
                <div className={`text-3xl font-bold ${getDIIColor(DII)} mb-2`}>
                  {(DII * 100).toFixed(1)}%
                </div>
                <Progress value={DII * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {DII <= 0.15 ? 'Low instability' : DII <= 0.30 ? 'Moderate' : DII <= 0.50 ? 'High' : 'Critical'}
                </p>
              </div>
            )}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-sm">Dataset Health</h4>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor(datasetHealthScore)} mb-2`}>
                {datasetHealthScore.toFixed(1)}
              </div>
              <Progress value={datasetHealthScore} className="h-2" />
            </div>
          </div>
        </div>
      </Card>

      {/* Component Scores (P, H, F, R) */}
      {componentScores && (
        <Card className="glass-card p-8">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Component Scores (P, H, F, R)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(componentScores) as Array<keyof ComponentScores>).map((key) => {
              const info = componentLabels[key];
              const score = componentScores[key];
              const weight = hybridWeights?.[key];
              const risk = riskValues?.[key];
              
              return (
                <div key={key} className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <info.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{info.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${getComponentScoreColor(score)} mb-1`}>
                    {(score * 100).toFixed(1)}%
                  </div>
                  <Progress value={score * 100} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                  {weight !== undefined && (
                    <div className="mt-2 text-xs">
                      <span className="text-muted-foreground">Weight: </span>
                      <span className="font-medium">{(weight * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {risk !== undefined && risk > 0.01 && (
                    <div className="text-xs text-yellow-500">
                      Risk: {(risk * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Score Breakdown (Legacy) */}
      {!componentScores && (
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
      )}

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
