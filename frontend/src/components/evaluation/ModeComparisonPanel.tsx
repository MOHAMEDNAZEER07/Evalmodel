/**
 * Mode Comparison Panel
 *
 * Side-by-side comparison of Balanced vs Strict evaluation modes.
 * Shows trust scores, guard status, lambda, and the trust gap.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModeData {
  trustScore: number;
  trustScoreRaw?: number;
  DII: number;
  lambdaValue: number;
  guardTriggered: boolean;
  guardThreshold: number;
  guardFailures?: Array<{ component: string; score: number }>;
  componentScores?: {
    performance: number;
    health: number;
    fairness: number;
    robustness: number;
  };
  globalPenaltyApplied?: boolean;
  instabilityPenaltyValue?: number;
}

interface ModeComparisonPanelProps {
  balanced: ModeData;
  strict: ModeData;
}

function ModeCard({
  mode,
  data,
  accent,
}: {
  mode: string;
  data: ModeData;
  accent: "blue" | "red";
}) {
  const borderColor = accent === "blue"
    ? "border-blue-500"
    : "border-red-500";
  const accentText = accent === "blue"
    ? "text-blue-700 dark:text-blue-400"
    : "text-red-700 dark:text-red-400";
  const accentBg = accent === "blue"
    ? "bg-primary/10"
    : "bg-destructive/10";

  return (
    <Card className={`glass-card border-2 ${borderColor} p-6 shadow-sm`}>
      {/* Mode Label */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          variant="outline"
          className={`${borderColor} ${accentText} text-xs font-semibold uppercase tracking-wider px-3 py-1`}
        >
          {mode}
        </Badge>
        {data.guardTriggered ? (
          <Badge variant="destructive" className="text-xs">Guard Triggered</Badge>
        ) : (
          <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400">
            Guard Clear
          </Badge>
        )}
      </div>

      {/* Trust Score */}
      <div className={`text-center py-4 rounded-lg ${accentBg} mb-4`}>
        <div className={`text-4xl font-bold tabular-nums ${accentText}`}>
          {(data.trustScore ?? 0).toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">/100</div>
      </div>

      {/* Key Metrics */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">λ (Lambda)</span>
          <span className="font-mono font-medium text-foreground/90">
            {(data.lambdaValue ?? 0).toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">DII</span>
          <span className="font-mono font-medium text-foreground/90">
            {(data.DII ?? 0).toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Guard τ</span>
          <span className="font-mono font-medium text-foreground/90">
            {(data.guardThreshold ?? 0.3).toFixed(2)}
          </span>
        </div>
        {data.globalPenaltyApplied && data.instabilityPenaltyValue != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Penalty</span>
            <span className="font-mono font-medium text-red-600 dark:text-red-400">
              −{((data.instabilityPenaltyValue ?? 0) * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Component Scores */}
      {data.componentScores && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Components
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {(["performance", "health", "fairness", "robustness"] as const).map((key) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{key[0].toUpperCase()}</span>
                <span className="font-mono font-medium text-foreground/85">
                  {(data.componentScores![key] ?? 0).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guard failures */}
      {data.guardTriggered && data.guardFailures && data.guardFailures.length > 0 && (
        <div className="mt-3 p-2 bg-destructive/10 rounded text-xs text-destructive">
          <span className="font-semibold">Guard failures: </span>
          {data.guardFailures.map(f => `${f.component}=${(f.score ?? 0).toFixed(3)}`).join(", ")}
        </div>
      )}
    </Card>
  );
}

export function ModeComparisonPanel({ balanced, strict }: ModeComparisonPanelProps) {
  const balancedScore = balanced.trustScore ?? 0;
  const strictScore = strict.trustScore ?? 0;
  const trustGap = balancedScore - strictScore;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModeCard mode="Balanced" data={balanced} accent="blue" />
        <ModeCard mode="Strict" data={strict} accent="red" />
      </div>

      {/* Trust Gap */}
      <Card className="glass-card border-border/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Trust Gap (Balanced − Strict)
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tabular-nums ${trustGap > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
              {trustGap > 0 ? "+" : ""}{(trustGap ?? 0).toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">points</span>
          </div>
        </div>
        {/* Visual bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Strict</div>
          <div className="flex-1 h-3 bg-muted/70 rounded-full overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-red-400 dark:bg-red-600 rounded-l-full"
              style={{ width: `${Math.min(strictScore, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-l-full opacity-60"
              style={{ width: `${Math.min(balancedScore, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">Balanced</div>
        </div>
      </Card>
    </div>
  );
}
