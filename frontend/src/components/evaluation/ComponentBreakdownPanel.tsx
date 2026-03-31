/**
 * Component Breakdown Panel
 *
 * Four equal cards showing Performance, Health, Fairness, Robustness
 * with score, risk value, hybrid weight, and a bar indicator.
 */

import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ComponentScores {
  performance: number;
  health: number;
  fairness: number;
  robustness: number;
}

interface RiskValues {
  r_P?: number;
  r_H?: number;
  r_F?: number;
  r_R?: number;
  DP?: number;
  delta?: number;
  [key: string]: any;
}

interface ComponentBreakdownPanelProps {
  componentScores: ComponentScores;
  riskValues: RiskValues;
  hybridWeights: ComponentScores;
  breakdown?: {
    performance_contribution?: number;
    health_contribution?: number;
    fairness_contribution?: number;
    robustness_contribution?: number;
  };
}

const COMPONENT_META: Record<
  keyof ComponentScores,
  { label: string; abbrev: string; riskKey: string; tooltip: string }
> = {
  performance: {
    label: "Performance",
    abbrev: "P",
    riskKey: "r_P",
    tooltip: "Performance score derived from primary metric (e.g., F1, R²).",
  },
  health: {
    label: "Health",
    abbrev: "H",
    riskKey: "r_H",
    tooltip: "Dataset health = 1 − DII. Measures data quality and stability.",
  },
  fairness: {
    label: "Fairness",
    abbrev: "F",
    riskKey: "r_F",
    tooltip: "Fairness score based on Demographic Parity (DP). F = 1 − DP.",
  },
  robustness: {
    label: "Robustness",
    abbrev: "R",
    riskKey: "r_R",
    tooltip: "Generalization robustness. R = 1 − δ (train-test gap).",
  },
};

function getBarColor(score: number) {
  if (score >= 0.7) return "bg-blue-600 dark:bg-blue-500";
  if (score >= 0.4) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-600 dark:bg-red-500";
}

export function ComponentBreakdownPanel({
  componentScores,
  riskValues,
  hybridWeights,
  breakdown,
}: ComponentBreakdownPanelProps) {
  const keys: (keyof ComponentScores)[] = ["performance", "health", "fairness", "robustness"];

  // Safety guards
  const safeScores = componentScores ?? { performance: 0, health: 0, fairness: 0, robustness: 0 };
  const safeRiskValues = riskValues ?? {};
  const safeWeights = hybridWeights ?? { performance: 0.25, health: 0.25, fairness: 0.25, robustness: 0.25 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <TooltipProvider>
        {keys.map((key) => {
          const meta = COMPONENT_META[key];
          const score = safeScores[key] ?? 0;
          const risk = safeRiskValues[meta.riskKey] ?? (1 - score);
          const weight = safeWeights[key] ?? 0;

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm cursor-help">
                  {/* Header */}
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {meta.label}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">({meta.abbrev})</span>
                  </div>

                  {/* Score */}
                  <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100 mb-3">
                    {(score ?? 0).toFixed(3)}
                  </div>

                  {/* Bar */}
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`}
                      style={{ width: `${Math.min(score * 100, 100)}%` }}
                    />
                  </div>

                  {/* Detail rows */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Risk</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {(risk ?? 0).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Weight (β)</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {(weight ?? 0).toFixed(3)}
                      </span>
                    </div>
                    {breakdown && (
                      <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Contribution</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {(breakdown[`${key}_contribution` as keyof typeof breakdown] ?? 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs max-w-52">{meta.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
