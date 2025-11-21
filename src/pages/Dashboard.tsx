import { Brain, Database, TrendingUp, Zap, Upload, Play, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import MetricCard from "@/components/MetricCard";
import { Link } from "react-router-dom";
import { useDashboardData, formatRelativeTime, getPrimaryMetric } from "@/hooks/use-dashboard-data";

const Dashboard = () => {
  const { metrics, recentEvaluations, isLoading, error, refetch } = useDashboardData();

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Welcome to EvalModel
          </h1>
          <p className="text-muted-foreground text-lg">
            Evaluate, compare, and optimize your AI models with precision
          </p>
        </div>

        {/* Metrics Grid */}
        {error && (
          <Alert variant="destructive" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button onClick={refetch} variant="outline" size="sm" className="ml-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="glass-card p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in">
            <MetricCard 
              title="Models Uploaded" 
              value={metrics.totalModels.toString()} 
              icon={Brain} 
              trend={metrics.modelsEvaluated > 0 ? `${metrics.modelsEvaluated} evaluated` : undefined}
              trendUp={metrics.modelsEvaluated > metrics.modelsUnevaluated}
            />
            <MetricCard 
              title="Datasets" 
              value={metrics.totalDatasets.toString()} 
              icon={Database} 
              trend={metrics.recentActivity > 0 ? `${metrics.recentActivity} used this week` : undefined}
              trendUp={metrics.recentActivity > 0}
            />
            <MetricCard 
              title="Avg Accuracy" 
              value={metrics.averageAccuracy > 0 ? `${metrics.averageAccuracy}%` : "N/A"} 
              icon={TrendingUp} 
              trend={metrics.totalEvaluations > 0 ? `${metrics.totalEvaluations} evaluations` : undefined}
              trendUp={metrics.averageAccuracy >= 70}
            />
            <MetricCard 
              title="Avg EvalScore" 
              value={metrics.averageEvalScore > 0 ? metrics.averageEvalScore.toFixed(1) : "N/A"} 
              icon={Zap} 
              trend={metrics.totalEvaluations > 0 ? "Overall performance" : undefined}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="glass-card p-8 glow-border hover:border-primary/50 transition-all group">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Upload New Dataset</h3>
                <p className="text-muted-foreground mb-4">
                  Import your training or testing data to begin evaluation
                </p>
                <Link to="/upload">
                  <Button className="btn-glow">Upload Dataset</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card className="glass-card p-8 glow-border hover:border-primary/50 transition-all group">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors">
                <Play className="h-8 w-8 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">Evaluate Model</h3>
                <p className="text-muted-foreground mb-4">
                  Test your model's performance with comprehensive metrics
                </p>
                <Link to="/evaluate">
                  <Button variant="outline" className="btn-glow border-accent/30 hover:bg-accent/10">
                    Start Evaluation
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Evaluations */}
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Evaluations</h2>
            <Button onClick={refetch} variant="ghost" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          <Card className="glass-card overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-12 flex-1" />
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-24" />
                  </div>
                ))}
              </div>
            ) : recentEvaluations.length === 0 ? (
              <div className="p-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No evaluations yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start by uploading a model and dataset, then run your first evaluation
                </p>
                <div className="flex gap-3 justify-center">
                  <Link to="/upload">
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </Link>
                  <Link to="/evaluate">
                    <Button variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      Evaluate Model
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Model</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dataset</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Performance</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">EvalScore</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvaluations.map((evaluation) => {
                      const primaryMetric = getPrimaryMetric(evaluation);
                      return (
                        <tr
                          key={evaluation.id}
                          className="border-b border-border/30 hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-4 font-medium">
                            {evaluation.models?.name || 'Unknown Model'}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {evaluation.datasets?.name || 'Unknown Dataset'}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{primaryMetric.name}</span>
                              <span className="font-medium">{primaryMetric.value}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                              {evaluation.eval_score.toFixed(1)}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">
                            {formatRelativeTime(evaluation.evaluated_at)}
                          </td>
                          <td className="p-4">
                            <Link to="/compare">
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
