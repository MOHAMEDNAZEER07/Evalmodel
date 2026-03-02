/**
 * Data Quality Radar card – shows completeness, validity, uniqueness, consistency
 * and an overall quality score for the selected dataset.
 */

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Database, TrendingUp } from "lucide-react";
import type { DataQualityMetrics } from "@/types/insights";

interface DataQualityCardProps {
  isLoading: boolean;
  qualityData: DataQualityMetrics | undefined | null;
  overallQualityScore: number;
  dataQualityMetrics: { name: string; value: number; status: string }[];
}

export function DataQualityCard({
  isLoading,
  qualityData,
  overallQualityScore,
  dataQualityMetrics,
}: DataQualityCardProps) {
  return (
    <Card className="glass-card p-8 animate-fade-in-up">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        Data Quality Radar
      </h2>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : dataQualityMetrics.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            {dataQualityMetrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{metric.name}</span>
                  <span className="text-sm font-semibold">{metric.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metric.status === "good"
                        ? "bg-gradient-to-r from-primary to-accent"
                        : metric.status === "warning"
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                        : "bg-gradient-to-r from-red-500 to-orange-500"
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
                <h4 className="font-semibold mb-1">
                  Overall Quality Score: {overallQualityScore.toFixed(1)}%
                </h4>
                <p className="text-sm text-muted-foreground">
                  {qualityData && qualityData.status === "good"
                    ? "Your dataset shows excellent quality!"
                    : qualityData && qualityData.status === "warning"
                    ? "Your dataset has good quality but could be improved."
                    : "Your dataset needs attention to improve quality."}
                </p>
                {qualityData && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {qualityData.total_rows} rows × {qualityData.total_columns} columns
                    {qualityData.missing_values > 0 && ` • ${qualityData.missing_values} missing values`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Select a dataset to view quality metrics</p>
        </div>
      )}
    </Card>
  );
}
