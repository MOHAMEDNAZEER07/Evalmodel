/**
 * Feature Correlations card – shows the top correlation pairs
 * with strength/direction bars.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import type { CorrelationPair, CorrelationsData } from "@/types/insights";

interface CorrelationCardProps {
  isLoading: boolean;
  topCorrelations: CorrelationPair[];
  correlations: CorrelationsData | null;
  summaryTotalPairs?: number;
}

export function CorrelationCard({
  isLoading,
  topCorrelations,
  correlations,
  summaryTotalPairs,
}: CorrelationCardProps) {
  return (
    <Card className="glass-card p-8 animate-fade-in-up">
      <h2 className="text-xl font-semibold mb-6">Feature Correlations</h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : topCorrelations.length > 0 ? (
        <div className="space-y-3">
          {topCorrelations.map((corr, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm">
                    {corr.feature1} ↔ {corr.feature2}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {corr.strength}
                    </Badge>
                    <span
                      className={`text-sm font-semibold ${
                        corr.direction === "positive" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {corr.correlation > 0 ? "+" : ""}
                      {corr.correlation.toFixed(3)}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      corr.direction === "positive"
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : "bg-gradient-to-r from-red-500 to-orange-500"
                    }`}
                    style={{ width: `${corr.abs_correlation * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {correlations && correlations.total_pairs > 5 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Showing top 5 of {correlations.total_pairs} correlation pairs
            </p>
          )}
          {summaryTotalPairs && summaryTotalPairs > 5 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Showing top 5 of {summaryTotalPairs} correlation pairs
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No significant correlations found</p>
        </div>
      )}
    </Card>
  );
}
