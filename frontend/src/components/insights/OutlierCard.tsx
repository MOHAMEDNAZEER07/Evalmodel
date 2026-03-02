/**
 * Outliers Detected card – shows the top outlier features
 * with impact badges and bounds information.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getImpactColor } from "@/hooks/use-insights-data";
import type { OutlierInfo, OutliersData } from "@/types/insights";

interface OutlierCardProps {
  isLoading: boolean;
  outliersList: OutlierInfo[];
  outliersData: OutliersData | undefined | null;
}

export function OutlierCard({ isLoading, outliersList, outliersData }: OutlierCardProps) {
  return (
    <Card className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">Outliers Detected</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : outliersList.length > 0 ? (
        <div className="space-y-4">
          {outliersList.map((outlier) => (
            <div key={outlier.feature} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-sm">{outlier.feature}</span>
                <Badge variant="outline" className={getImpactColor(outlier.impact)}>
                  {outlier.impact}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {outlier.count} outliers ({outlier.percentage.toFixed(1)}%)
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Range:</span>
                  <span className="font-mono">
                    {outlier.min_value.toFixed(2)} - {outlier.max_value.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Expected:</span>
                  <span className="font-mono">
                    {outlier.lower_bound.toFixed(2)} - {outlier.upper_bound.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {outliersData && outliersData.total_outliers > outliersList.length && (
            <p className="text-xs text-muted-foreground text-center">
              {outliersData.affected_features - outliersList.length} more features with outliers
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No outliers detected</p>
        </div>
      )}
    </Card>
  );
}
