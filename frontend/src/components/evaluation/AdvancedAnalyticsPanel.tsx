/**
 * Advanced Analytics Panel
 *
 * Tabs for standard metrics, fairness metrics, and explainability.
 * Clean tabular presentation of all evaluation data.
 */

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Metrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  r2_score?: number;
  mse?: number;
  mae?: number;
  rmse?: number;
}

interface FairnessMetrics {
  demographic_parity_difference?: number;
  equal_opportunity_difference?: number;
  disparate_impact_ratio?: number;
  equalized_odds_difference?: number;
  statistical_parity?: number;
  predictive_parity?: number;
  overall_fairness_score?: number;
  [key: string]: any;
}

interface GroupMetric {
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

interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

interface AdvancedAnalyticsPanelProps {
  metrics?: Metrics;
  evalScore?: number;
  fairnessMetrics?: FairnessMetrics;
  groupMetrics?: GroupMetric[];
  sensitiveAttribute?: string;
  featureImportance?: FeatureImportance[];
  explainabilityMethod?: string;
  shapSummary?: {
    mean_abs_shap?: number;
    max_shap?: number;
    top_features?: string[];
    base_value?: number;
  };
}

function MetricRow({ label, value, format }: { label: string; value?: number; format?: "pct" | "num" }) {
  if (value == null) return null;
  const formatted = format === "pct" ? `${(value * 100).toFixed(2)}%` : (value ?? 0).toFixed(4);
  return (
    <div className="flex justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-semibold text-foreground">
        {formatted}
      </span>
    </div>
  );
}

export function AdvancedAnalyticsPanel({
  metrics,
  evalScore,
  fairnessMetrics,
  groupMetrics,
  sensitiveAttribute,
  featureImportance,
  explainabilityMethod,
  shapSummary,
}: AdvancedAnalyticsPanelProps) {
  const hasMetrics = metrics && Object.keys(metrics).some(k => (metrics as any)[k] != null);
  const hasFairness = fairnessMetrics && Object.keys(fairnessMetrics).some(k => fairnessMetrics[k] != null);
  const hasExplainability = featureImportance && featureImportance.length > 0;

  return (
    <Card className="glass-card border-border/60 shadow-sm">
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="w-full justify-start border-b border-border/60 rounded-none bg-muted/40 px-2">
          <TabsTrigger value="metrics" className="text-xs data-[state=active]:shadow-none">
            Standard Metrics
          </TabsTrigger>
          {hasFairness && (
            <TabsTrigger value="fairness" className="text-xs data-[state=active]:shadow-none">
              Fairness
            </TabsTrigger>
          )}
          {hasExplainability && (
            <TabsTrigger value="explainability" className="text-xs data-[state=active]:shadow-none">
              Feature Importance
            </TabsTrigger>
          )}
        </TabsList>

        {/* Standard Metrics Tab */}
        <TabsContent value="metrics" className="p-6 mt-0">
          {evalScore != null && (
            <div className="flex items-baseline gap-3 mb-6 pb-4 border-b border-border/40">
              <span className="text-sm text-muted-foreground">SMCP Eval Score</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {typeof evalScore === "object"
                  ? ((evalScore as any)?.eval_score?.toFixed(1) ?? "N/A")
                  : typeof evalScore === "number"
                  ? (evalScore ?? 0).toFixed(1)
                  : "N/A"}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          )}
          {hasMetrics && metrics && (
            <div className="max-w-md">
              <MetricRow label="Accuracy" value={metrics.accuracy} format="pct" />
              <MetricRow label="Precision" value={metrics.precision} format="pct" />
              <MetricRow label="Recall" value={metrics.recall} format="pct" />
              <MetricRow label="F1 Score" value={metrics.f1_score} format="pct" />
              <MetricRow label="R² Score" value={metrics.r2_score} format="num" />
              <MetricRow label="MAE" value={metrics.mae} format="num" />
              <MetricRow label="MSE" value={metrics.mse} format="num" />
              <MetricRow label="RMSE" value={metrics.rmse} format="num" />
            </div>
          )}
        </TabsContent>

        {/* Fairness Tab */}
        {hasFairness && (
          <TabsContent value="fairness" className="p-6 mt-0">
            {sensitiveAttribute && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sensitive Attribute:</span>
                <Badge variant="outline" className="text-xs font-mono">{sensitiveAttribute}</Badge>
              </div>
            )}
            <div className="max-w-md mb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Aggregate Fairness Metrics
              </h4>
              <MetricRow label="Demographic Parity Diff (DP)" value={fairnessMetrics!.demographic_parity_difference} format="num" />
              <MetricRow label="Disparate Impact Ratio (DI)" value={fairnessMetrics!.disparate_impact_ratio} format="num" />
              <MetricRow label="Equal Opportunity Diff (EO)" value={fairnessMetrics!.equal_opportunity_difference} format="num" />
              <MetricRow label="Equalized Odds Diff (EqOdds)" value={fairnessMetrics!.equalized_odds_difference} format="num" />
              <MetricRow label="Overall Fairness Score" value={fairnessMetrics!.overall_fairness_score} format="num" />
            </div>

            {/* Group metrics table */}
            {groupMetrics && groupMetrics.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Per-Group Performance
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2 pr-4 text-muted-foreground font-semibold">Group</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Acc</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Prec</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Rec</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">F1</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">TPR</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">FPR</th>
                        <th className="text-right py-2 pl-2 text-muted-foreground font-semibold">N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMetrics.map((g) => (
                        <tr key={g.group} className="border-b border-border/30 last:border-0">
                          <td className="py-2 pr-4 font-medium text-foreground">{g.group}</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.accuracy ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.precision ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.recall ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.f1_score ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.true_positive_rate ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 font-mono text-foreground/85">{((g.false_positive_rate ?? 0) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 pl-2 font-mono text-foreground/85">{g.sample_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Feature Importance Tab */}
        {hasExplainability && (
          <TabsContent value="explainability" className="p-6 mt-0">
            {explainabilityMethod && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Method:</span>
                <Badge variant="outline" className="text-xs font-mono">{explainabilityMethod}</Badge>
              </div>
            )}

            {shapSummary && (
              <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {shapSummary.mean_abs_shap != null && (
                  <div>
                    <div className="text-xs text-muted-foreground">Mean |SHAP|</div>
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {(shapSummary.mean_abs_shap ?? 0).toFixed(4)}
                    </div>
                  </div>
                )}
                {shapSummary.max_shap != null && (
                  <div>
                    <div className="text-xs text-muted-foreground">Max SHAP</div>
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {(shapSummary.max_shap ?? 0).toFixed(4)}
                    </div>
                  </div>
                )}
                {shapSummary.base_value != null && (
                  <div>
                    <div className="text-xs text-muted-foreground">Base Value</div>
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {(shapSummary.base_value ?? 0).toFixed(4)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feature importance table */}
            {featureImportance && featureImportance.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Feature Rankings
                </h4>
                <div className="space-y-1">
                  {featureImportance.slice(0, 15).map((fi) => {
                    const maxImportance = featureImportance![0]?.importance ?? 1;
                    const importance = fi.importance ?? 0;
                    const pct = maxImportance > 0 ? (importance / maxImportance) * 100 : 0;
                    return (
                      <div key={fi.feature} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                          {fi.rank}
                        </span>
                        <span className="text-xs text-foreground/85 w-32 truncate">
                          {fi.feature}
                        </span>
                        <div className="flex-1 h-2 bg-muted/70 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-14 text-right">
                          {(importance ?? 0).toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}
