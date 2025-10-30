import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const Insights = () => {
  const [chatInput, setChatInput] = useState("");

  const dataQualityMetrics = [
    { name: "Completeness", value: 94, status: "good" },
    { name: "Validity", value: 87, status: "good" },
    { name: "Uniqueness", value: 72, status: "warning" },
    { name: "Consistency", value: 96, status: "good" },
  ];

  const outliers = [
    { feature: "age", count: 23, impact: "high" },
    { feature: "income", count: 15, impact: "medium" },
    { feature: "credit_score", count: 8, impact: "low" },
  ];

  const correlations = [
    { feature1: "age", feature2: "income", correlation: 0.73 },
    { feature1: "education", feature2: "income", correlation: 0.68 },
    { feature1: "experience", feature2: "salary", correlation: 0.82 },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-4 neon-text">
            Data Intelligence & Insights
          </h1>
          <p className="text-muted-foreground text-lg">
            AI-powered analysis and interactive data exploration
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Chat Assistant */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ask EvalModel */}
            <Card className="glass-card p-8 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="h-6 w-6 text-primary animate-glow-pulse" />
                <h2 className="text-xl font-semibold">Ask EvalModel</h2>
                <Badge className="bg-accent text-accent-foreground">AI Powered</Badge>
              </div>

              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {/* Sample conversation */}
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 bg-muted/50 rounded-xl p-4">
                    <p className="text-sm">Which feature causes most misclassifications in the BERT model?</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 bg-primary/10 border border-primary/30 rounded-xl p-4">
                    <p className="text-sm mb-3">
                      Based on the analysis, the <span className="font-semibold text-primary">age</span> feature causes 34% of misclassifications in your BERT model. This is primarily due to:
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-4">
                      <li>• High variance in age distribution (18-82 years)</li>
                      <li>• 23 outliers detected in the age column</li>
                      <li>• Non-linear relationship with target variable</li>
                    </ul>
                    <div className="mt-4">
                      <Button size="sm" variant="outline" className="border-primary/50">
                        View Feature Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask about your data, models, or metrics..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="bg-muted/50 border-border/50 focus:border-primary/50"
                />
                <Button className="btn-glow">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Ask
                </Button>
              </div>
            </Card>

            {/* Data Quality Dashboard */}
            <Card className="glass-card p-8 animate-fade-in-up">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Data Quality Radar
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {dataQualityMetrics.map((metric) => (
                  <div key={metric.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{metric.name}</span>
                      <span className="text-sm font-semibold">{metric.value}%</span>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          metric.status === "good"
                            ? "bg-gradient-to-r from-primary to-accent"
                            : "bg-gradient-to-r from-yellow-500 to-orange-500"
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
                    <h4 className="font-semibold mb-1">Overall Quality Score: 87.2%</h4>
                    <p className="text-sm text-muted-foreground">
                      Your dataset shows good quality. Consider improving uniqueness to reach 90%+
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Correlation Heatmap */}
            <Card className="glass-card p-8 animate-fade-in-up">
              <h2 className="text-xl font-semibold mb-6">Feature Correlations</h2>
              
              <div className="space-y-3">
                {correlations.map((corr, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">
                          {corr.feature1} ↔ {corr.feature2}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {corr.correlation.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          style={{ width: `${corr.correlation * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Outlier Detection */}
            <Card className="glass-card p-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Outliers Detected</h3>
              </div>

              <div className="space-y-4">
                {outliers.map((outlier) => (
                  <div key={outlier.feature} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{outlier.feature}</span>
                      <Badge
                        variant="outline"
                        className={
                          outlier.impact === "high"
                            ? "border-destructive text-destructive"
                            : outlier.impact === "medium"
                            ? "border-yellow-500 text-yellow-500"
                            : "border-muted-foreground text-muted-foreground"
                        }
                      >
                        {outlier.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {outlier.count} outliers found
                    </p>
                  </div>
                ))}
              </div>
            </Card>

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
              <p className="text-sm text-muted-foreground">
                Your dataset shows strong quality metrics with 87.2% overall score. Focus on improving uniqueness and addressing 23 age-related outliers for optimal model performance.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights;
