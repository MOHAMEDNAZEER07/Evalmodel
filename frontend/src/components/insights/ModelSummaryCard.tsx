/**
 * Model Performance Summary card – shows model metadata
 * and last evaluation date.
 */

import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { ModelData, Evaluation } from "@/types/insights";
import type { Dataset } from "@/types/dashboard";

interface ModelSummaryCardProps {
  models: ModelData[];
  selectedModelId: string;
  modelEvaluation: Evaluation;
  selectedDataset?: Dataset;
}

export function ModelSummaryCard({
  models,
  selectedModelId,
  modelEvaluation,
  selectedDataset,
}: ModelSummaryCardProps) {
  const model = models.find((m) => m.id === selectedModelId);

  return (
    <Card className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Performance Summary</h3>
      </div>
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-muted-foreground mb-1">Model Name</div>
          <div className="font-medium">{model?.name}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Model Type</div>
          <div className="font-medium">{model?.model_type}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Framework</div>
          <div className="font-medium">{model?.framework}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Dataset</div>
          <div className="font-medium">{selectedDataset?.name}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Last Evaluated</div>
          <div className="font-medium text-xs">
            {new Date(modelEvaluation.evaluated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}
