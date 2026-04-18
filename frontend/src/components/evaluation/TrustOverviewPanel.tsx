/**
 * Trust Overview Panel (Hero Section)
 * 
 * Large centered trust score display with DII, Lambda, and Guard status.
 * Research-grade: IEEE-clean, no gradients, no neon.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrustOverviewPanelProps {
  trustScore: number;
  trustScoreRaw?: number;
  DII: number;
  lambdaValue: number;
  guardTriggered: boolean;
  guardFailures?: Array<{ component: string; score: number }>;
  guardThreshold: number;
  verdict?: {
    status: string;
    message: string;
    confidence: number;
  };
}

export function TrustOverviewPanel({
  trustScore,
  trustScoreRaw,
  DII,
  lambdaValue,
  guardTriggered,
  guardFailures,
  guardThreshold,
  verdict,
}: TrustOverviewPanelProps) {
  const getTrustLevel = (score: number) => {
    if (score >= 70) return { label: "High Trust", color: "text-blue-700 dark:text-blue-400" };
    if (score >= 40) return { label: "Moderate Trust", color: "text-amber-700 dark:text-amber-400" };
    return { label: "Low Trust", color: "text-red-700 dark:text-red-400" };
  };

  const trustLevel = getTrustLevel(trustScore);

  // SVG circular gauge
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(trustScore / 100, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const getGaugeColor = (score: number) => {
    if (score >= 70) return "#3b82f6"; // blue-500
    if (score >= 40) return "#f59e0b"; // amber-500
    return "#ef4444"; // red-500
  };

  return (
    <Card className="glass-card p-8 border-border/60">
      <div className="text-center">
        {/* Title */}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Trust Score
        </h2>

        {/* Circular Gauge */}
        <div className="relative inline-flex items-center justify-center my-4">
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* Background ring */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-muted/40"
              strokeWidth="10"
            />
            {/* Progress ring */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={getGaugeColor(trustScore)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 90 90)"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-5xl font-bold tabular-nums ${trustLevel.color}`}>
              {(trustScore ?? 0).toFixed(2)}
            </span>
            <span className={`text-sm font-medium mt-1 ${trustLevel.color}`}>
              {trustLevel.label}
            </span>
          </div>
        </div>

        {/* Severity scale */}
        <div className="flex items-center justify-center gap-1 mb-6 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-16 h-2 rounded-l bg-red-500/40" />
            <div className="w-16 h-2 bg-amber-500/40" />
            <div className="w-16 h-2 rounded-r bg-primary/50" />
          </div>
        </div>
        <div className="flex justify-center gap-8 text-xs text-muted-foreground -mt-4 mb-6">
          <span>0 — Low</span>
          <span>40 — Moderate</span>
          <span>70 — High</span>
        </div>

        {/* Key indicators row */}
        <TooltipProvider>
          <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg bg-card/50">
            {/* DII */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="py-4 px-3 cursor-help">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    DII
                  </div>
                  <div className="text-xl font-bold tabular-nums text-foreground">
                    {(DII ?? 0).toFixed(3)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-48">
                  Dataset Instability Index. Controls the balance between automatic risk-detection
                  and user-defined weights. Higher DII = more automatic control.
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Lambda */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="py-4 px-3 cursor-help">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    λ (Lambda)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-foreground">
                    {(lambdaValue ?? 0).toFixed(3)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-48">
                  Lambda parameter derived from DII. Balanced: λ = DII. Strict: λ = DII^1.5.
                  Capped to preserve user influence.
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Guard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="py-4 px-3 cursor-help">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    Guard (τ={(guardThreshold ?? 0.3).toFixed(2)})
                  </div>
                  <div className="text-xl font-bold tabular-nums">
                    {guardTriggered ? (
                      <Badge variant="destructive" className="text-sm px-3 py-1">
                        Triggered
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-sm px-3 py-1 border-green-500 text-green-700 dark:text-green-400">
                        Not Triggered
                      </Badge>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-56">
                  Non-compensatory guard. If any component score (P, H, F, R) falls below τ={(guardThreshold ?? 0.3).toFixed(2)},
                  the guard triggers and overrides the verdict to high-risk.
                  {guardTriggered && guardFailures && guardFailures.length > 0 && (
                    <>
                      <br /><br />
                      Failed: {guardFailures.map(f => `${f.component}=${(f.score ?? 0).toFixed(4)}`).join(", ")}
                    </>
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Verdict */}
        {verdict && (
          <div className="mt-4 text-sm text-muted-foreground italic">
            {verdict.message}
          </div>
        )}
      </div>
    </Card>
  );
}
