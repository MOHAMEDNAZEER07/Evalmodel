/**
 * Model Evaluation Metrics card – model selector, eval score bar,
 * classification metrics (accuracy/precision/recall/F1) and
 * regression metrics (MAE/MSE/RMSE/R²).
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Target, AlertTriangle, BarChart3 } from "lucide-react";
import type { ModelData, Evaluation } from "@/types/insights";

interface ModelEvaluationCardProps {
  models: ModelData[];
  selectedModelId: string | null;
  setSelectedModelId: (id: string) => void;
  selectedDatasetId: string | null;
  loadingModels: boolean;
  loadingEvaluation: boolean;
  modelEvaluation: Evaluation | null;
}

export function ModelEvaluationCard({
  models,
  selectedModelId,
  setSelectedModelId,
  selectedDatasetId,
  loadingModels,
  loadingEvaluation,
  modelEvaluation,
}: ModelEvaluationCardProps) {
  return (
    <Card className="glass-card p-8 animate-fade-in-up">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Model Evaluation Metrics
      </h2>

      {/* Model Selection */}
      <div className="mb-6">
        <Select
          value={selectedModelId || ""}
          onValueChange={setSelectedModelId}
          disabled={loadingModels}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span>{model.name}</span>
                  {model.is_evaluated && (
                    <Badge variant="outline" className="ml-2 text-xs">Evaluated</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingEvaluation ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : modelEvaluation ? (
        <>
          {/* Warning if evaluation is from different dataset */}
          {modelEvaluation.dataset_id !== selectedDatasetId && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This evaluation was performed on a different dataset.
                The metrics shown may not reflect performance on the currently selected dataset.
              </AlertDescription>
            </Alert>
          )}

          {/* Eval Score */}
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  EvalScore: {modelEvaluation.eval_score.toFixed(1)}/100
                </h4>
                <div className="h-3 bg-muted/50 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${modelEvaluation.eval_score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Evaluated on {new Date(modelEvaluation.evaluated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {modelEvaluation.metrics.accuracy !== undefined && (
              <MetricBar label="Accuracy" value={modelEvaluation.metrics.accuracy} gradient="from-primary to-accent" />
            )}
            {modelEvaluation.metrics.precision !== undefined && (
              <MetricBar label="Precision" value={modelEvaluation.metrics.precision} gradient="from-green-500 to-emerald-500" />
            )}
            {modelEvaluation.metrics.recall !== undefined && (
              <MetricBar label="Recall" value={modelEvaluation.metrics.recall} gradient="from-blue-500 to-cyan-500" />
            )}
            {modelEvaluation.metrics.f1_score !== undefined && (
              <MetricBar label="F1 Score" value={modelEvaluation.metrics.f1_score} gradient="from-purple-500 to-pink-500" />
            )}
            {modelEvaluation.metrics.mae !== undefined && (
              <MetricTile label="MAE" value={modelEvaluation.metrics.mae.toFixed(4)} />
            )}
            {modelEvaluation.metrics.mse !== undefined && (
              <MetricTile label="MSE" value={modelEvaluation.metrics.mse.toFixed(4)} />
            )}
            {modelEvaluation.metrics.rmse !== undefined && (
              <MetricTile label="RMSE" value={modelEvaluation.metrics.rmse.toFixed(4)} />
            )}
            {modelEvaluation.metrics.r2_score !== undefined && (
              <MetricTile label="R² Score" value={modelEvaluation.metrics.r2_score.toFixed(4)} />
            )}
          </div>
        </>
      ) : selectedModelId ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No evaluation found</p>
          <p className="text-sm mt-1">
            This model hasn't been evaluated with the selected dataset yet.
          </p>
          <Button variant="outline" className="mt-4" size="sm">
            Evaluate Now
          </Button>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Select a model to view evaluation metrics</p>
        </div>
      )}
    </Card>
  );
}

/* ---- helper sub-components ---- */

function MetricBar({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{(value * 100).toFixed(2)}%</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
