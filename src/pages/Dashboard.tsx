import { Brain, Database, TrendingUp, Zap, Upload, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import MetricCard from "@/components/MetricCard";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const recentEvaluations = [
    { id: 1, model: "BERT Classifier", dataset: "Customer Reviews", accuracy: "94.2%", date: "2 hours ago" },
    { id: 2, model: "Random Forest", dataset: "Sales Data", accuracy: "89.7%", date: "5 hours ago" },
    { id: 3, model: "Logistic Regression", dataset: "User Behavior", accuracy: "87.3%", date: "1 day ago" },
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in">
          <MetricCard title="Models Evaluated" value="24" icon={Brain} trend="+12%" trendUp />
          <MetricCard title="Datasets Uploaded" value="16" icon={Database} trend="+8%" trendUp />
          <MetricCard title="Avg Accuracy" value="91.4%" icon={TrendingUp} trend="+3.2%" trendUp />
          <MetricCard title="Active Tests" value="7" icon={Zap} />
        </div>

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
          <h2 className="text-2xl font-bold mb-6">Recent Evaluations</h2>
          <Card className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Model</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dataset</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Accuracy</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvaluations.map((evaluation) => (
                    <tr
                      key={evaluation.id}
                      className="border-b border-border/30 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4 font-medium">{evaluation.model}</td>
                      <td className="p-4 text-muted-foreground">{evaluation.dataset}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {evaluation.accuracy}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">{evaluation.date}</td>
                      <td className="p-4">
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
