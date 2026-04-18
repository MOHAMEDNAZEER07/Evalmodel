
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

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

interface ComponentScores {
  performance: number;
  health: number;
  fairness: number;
  robustness: number;
}

interface RiskValues {
  r_P?: number;
  r_H?: number;
  r_F?: number | null;
  r_F_display?: string | number;
  r_R?: number;
  DP?: number;
  delta?: number;
  total?: number;
  amplification_applied?: boolean;
  amplification_power?: number;
  fairness_excluded?: boolean;
  [key: string]: any;
}

interface CalculationTransparencyPanelProps {
  metrics: Metrics;
  DII: number;
  diiComponents?: {
    imbalance?: number;
    missing?: number;
    duplicates?: number;
    skew?: number;
    [key: string]: any;
  };
  componentScores: ComponentScores;
  riskValues: RiskValues;
  lambdaValue: number;
  lambdaRaw?: number;
  lambdaCap?: number;
  betaAuto?: ComponentScores;
  hybridWeights: ComponentScores;
  trustScore: number;
  trustScoreRaw?: number;
  globalPenaltyApplied?: boolean;
  instabilityPenaltyValue?: number;
  trustMode: string;
  guardThreshold: number;
  guardTriggered: boolean;
  guardFailures?: Array<{ component: string; score: number }>;
  fairnessMetrics?: {
    demographic_parity_difference?: number;
    equal_opportunity_difference?: number;
    disparate_impact_ratio?: number;
    equalized_odds_difference?: number;
    overall_fairness_score?: number;
    [key: string]: any;
  };
}

/** Render a single equation line in monospace with label */
function Eq({ label, expr, result }: { label?: string; expr: string; result?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      {label && <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>}
      <code className="text-sm font-mono text-foreground/90">
        {expr}
        {result !== undefined && (
          <>
            {" = "}
            <span className="font-bold text-primary">{result}</span>
          </>
        )}
      </code>
    </div>
  );
}

/** Render a key-value row */
function DataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-semibold text-foreground">
        {value == null ? "—" : typeof value === "number" ? value.toFixed(4) : value}
      </span>
    </div>
  );
}

/** Safe number formatter - returns "Excluded" or "—" for null/undefined */
const fmt = (val: number | null | undefined, digits = 4): string => {
  if (val == null) return "Excluded";
  return (val ?? 0).toFixed(digits);
};

export function CalculationTransparencyPanel({
  metrics,
  DII,
  diiComponents,
  componentScores,
  riskValues,
  lambdaValue,
  lambdaRaw,
  lambdaCap,
  betaAuto,
  hybridWeights,
  trustScore,
  trustScoreRaw,
  globalPenaltyApplied,
  instabilityPenaltyValue,
  trustMode,
  guardThreshold,
  guardTriggered,
  guardFailures,
  fairnessMetrics,
}: CalculationTransparencyPanelProps) {
  const I = diiComponents?.imbalance ?? 0;
  const M = diiComponents?.missing ?? 0;
  const D = diiComponents?.duplicates ?? 0;
  const S = diiComponents?.skew ?? 0;

  // Compute safe values - DII first since H depends on it
  const safeDII = DII ?? 0;
  const computedHealth = 1 - safeDII;  // H = 1 - DII
  
  // Default component scores - compute health from DII if not provided
  const defaultScores = { 
    performance: 0, 
    health: computedHealth, 
    fairness: 1, // Default to 1.0 (fully fair) when no data
    robustness: 0 
  };
  // Ensure each property has a fallback even if componentScores exists but has null values
  const safeComponentScores = {
    performance: componentScores?.performance ?? defaultScores.performance,
    health: (componentScores?.health === 0 && safeDII === 0) 
      ? 1.0 
      : (componentScores?.health ?? defaultScores.health),
    fairness: componentScores?.fairness ?? defaultScores.fairness,
    robustness: componentScores?.robustness ?? defaultScores.robustness,
  };
  
  const defaultWeights = { performance: 0.25, health: 0.25, fairness: 0.25, robustness: 0.25 };
  const safeHybridWeights = {
    performance: hybridWeights?.performance ?? defaultWeights.performance,
    health: hybridWeights?.health ?? defaultWeights.health,
    fairness: hybridWeights?.fairness ?? defaultWeights.fairness,
    robustness: hybridWeights?.robustness ?? defaultWeights.robustness,
  };
  const defaultRisks = { r_P: 0, r_H: 0, r_F: null as number | null, r_R: 0, DP: 0, delta: 0, total: 0, amplification_applied: false, amplification_power: null as number | null, fairness_excluded: false };
  const fairnessExcluded = riskValues?.fairness_excluded ?? false;
  const safeRiskValues = {
    r_P: riskValues?.r_P ?? defaultRisks.r_P,
    r_H: riskValues?.r_H ?? defaultRisks.r_H,
    r_F: fairnessExcluded ? null : (riskValues?.r_F ?? 0),
    r_R: riskValues?.r_R ?? defaultRisks.r_R,
    DP: riskValues?.DP ?? defaultRisks.DP,
    delta: riskValues?.delta ?? defaultRisks.delta,
    total: riskValues?.total ?? defaultRisks.total,
    amplification_applied: riskValues?.amplification_applied ?? defaultRisks.amplification_applied,
    amplification_power: riskValues?.amplification_power ?? defaultRisks.amplification_power,
    fairness_excluded: fairnessExcluded,
  };
  const safeMetrics = metrics ?? {};
  const safeTrustScore = trustScore ?? 0;
  const safeLambdaValue = lambdaValue ?? 0;
  const safeGuardThreshold = guardThreshold ?? 0.3;

  const isStrict = trustMode === "strict";

  return (
    <Card className="glass-card border-border/60 shadow-sm">
      <Accordion type="multiple" className="w-full">
        {/* Section A: Raw Inputs */}
        <AccordionItem value="raw-inputs" className="border-b border-border/60">
          <AccordionTrigger className="px-6 py-4 text-sm font-semibold text-foreground hover:no-underline">
            A. Raw Inputs
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Model Metrics
                </h4>
                {safeMetrics.accuracy != null && <DataRow label="Accuracy" value={safeMetrics.accuracy} />}
                {safeMetrics.precision != null && <DataRow label="Precision" value={safeMetrics.precision} />}
                {safeMetrics.recall != null && <DataRow label="Recall" value={safeMetrics.recall} />}
                {safeMetrics.f1_score != null && <DataRow label="F1 Score" value={safeMetrics.f1_score} />}
                {safeMetrics.r2_score != null && <DataRow label="R² Score" value={safeMetrics.r2_score} />}
                {safeMetrics.mae != null && <DataRow label="MAE" value={safeMetrics.mae} />}
                {safeMetrics.mse != null && <DataRow label="MSE" value={safeMetrics.mse} />}
                {safeMetrics.rmse != null && <DataRow label="RMSE" value={safeMetrics.rmse} />}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Dataset Instability Components
                </h4>
                <DataRow label="Imbalance (I)" value={I} />
                <DataRow label="Missing (M)" value={M} />
                <DataRow label="Duplicates (D)" value={D} />
                <DataRow label="Skew (S)" value={S} />
                {fairnessMetrics?.demographic_parity_difference != null && (
                  <DataRow label="DP (Demographic Parity)" value={fairnessMetrics.demographic_parity_difference} />
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section B: Intermediate Calculations */}
        <AccordionItem value="intermediate" className="border-b border-border/60">
          <AccordionTrigger className="px-6 py-4 text-sm font-semibold text-foreground hover:no-underline">
            B. Intermediate Calculations
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4 space-y-4">
            {/* DII */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Dataset Instability Index (DII)
              </h4>
              {isStrict ? (
                <>
                  <Eq
                    label="Formula"
                    expr="DII = 1 − (1−0.35×M)(1−0.30×I)(1−0.20×D)(1−0.15×S)"
                  />
                  <Eq
                    label="Substitution"
                    expr={`DII = 1 − (1−0.35×${(M ?? 0).toFixed(3)})(1−0.30×${(I ?? 0).toFixed(3)})(1−0.20×${(D ?? 0).toFixed(3)})(1−0.15×${(S ?? 0).toFixed(3)})`}
                    result={safeDII.toFixed(4)}
                  />
                </>
              ) : (
                <>
                  <Eq label="Formula" expr="DII = 0.35×M + 0.30×I + 0.20×D + 0.15×S" />
                  <Eq
                    label="Substitution"
                    expr={`DII = 0.35×${(M ?? 0).toFixed(3)} + 0.30×${(I ?? 0).toFixed(3)} + 0.20×${(D ?? 0).toFixed(3)} + 0.15×${(S ?? 0).toFixed(3)}`}
                    result={safeDII.toFixed(4)}
                  />
                </>
              )}
            </div>

            {/* Component Scores */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Component Scores
              </h4>
              <Eq label="Health" expr={`H = 1 − DII = 1 − ${safeDII.toFixed(4)}`} result={(safeComponentScores.health ?? 0).toFixed(4)} />
              <Eq label="Performance" expr="P = normalize(primary_metric)" result={(safeComponentScores.performance ?? 0).toFixed(4)} />
              {safeRiskValues.fairness_excluded ? (
                <Eq label="Fairness" expr="F = (Fairness not evaluated)" result="Excluded" />
              ) : (
                <Eq
                  label="Fairness"
                  expr={`F = 1 − DP = 1 − ${(safeRiskValues.DP ?? 0).toFixed(4)}`}
                  result={(safeComponentScores.fairness ?? 0).toFixed(4)}
                />
              )}
              <Eq
                label="Robustness"
                expr={`R = 1 − δ = 1 − ${(safeRiskValues.delta ?? 0).toFixed(4)}`}
                result={(safeComponentScores.robustness ?? 0).toFixed(4)}
              />
            </div>

            {/* Risk Values */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Risk Values
                {safeRiskValues.amplification_applied && (
                  <span className="ml-2 text-destructive normal-case">
                    (γ={safeRiskValues.amplification_power} amplification applied)
                  </span>
                )}
              </h4>
              <Eq label="r_P" expr={`r_P = 1 − P = 1 − ${(safeComponentScores.performance ?? 0).toFixed(4)}`} result={(safeRiskValues.r_P ?? 0).toFixed(4)} />
              <Eq label="r_H" expr={`r_H = DII = ${safeDII.toFixed(4)}`} result={(safeRiskValues.r_H ?? 0).toFixed(4)} />
              {safeRiskValues.fairness_excluded ? (
                <Eq label="r_F" expr="r_F = (Fairness not evaluated)" result="Excluded" />
              ) : (
                <Eq label="r_F" expr={`r_F = DP = ${(safeRiskValues.DP ?? 0).toFixed(4)}`} result={fmt(safeRiskValues.r_F)} />
              )}
              <Eq label="r_R" expr={`r_R = δ = ${(safeRiskValues.delta ?? 0).toFixed(4)}`} result={(safeRiskValues.r_R ?? 0).toFixed(4)} />
              {safeRiskValues.total != null && (
                <Eq label="Σ risk" expr={safeRiskValues.fairness_excluded ? "r_P + r_H + r_R" : "r_P + r_H + r_F + r_R"} result={safeRiskValues.total.toFixed(4)} />
              )}
            </div>

            {/* Lambda */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Lambda (λ) — Auto/User Balance
              </h4>
              {isStrict ? (
                <Eq label="Formula" expr={`λ = DII^1.5 = ${(lambdaRaw ?? safeDII).toFixed(4)}^1.5`} result={safeLambdaValue.toFixed(4)} />
              ) : (
                <Eq label="Formula" expr={`λ = DII = ${safeDII.toFixed(4)}`} result={safeLambdaValue.toFixed(4)} />
              )}
              {lambdaCap != null && lambdaRaw != null && lambdaRaw > lambdaCap && (
                <Eq label="Capped" expr={`λ = min(${lambdaRaw.toFixed(4)}, ${lambdaCap.toFixed(2)})`} result={safeLambdaValue.toFixed(4)} />
              )}
            </div>

            {/* Hybrid Weights */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Hybrid Weight Computation
              </h4>
              <Eq label="Formula" expr="β_i = λ · β_auto_i + (1−λ) · β_user_i" />
              {betaAuto && (
                <div className="ml-28 text-xs text-muted-foreground font-mono space-y-0.5 mt-1">
                  <div>
                    β_auto: P={(betaAuto.performance ?? 0).toFixed(3)} H={(betaAuto.health ?? 0).toFixed(3)}{" "}
                    F={safeRiskValues.fairness_excluded ? "Excl." : (betaAuto.fairness ?? 0).toFixed(3)}{" "}
                    R={(betaAuto.robustness ?? 0).toFixed(3)}
                  </div>
                  <div>
                    β_final: P={(safeHybridWeights.performance ?? 0).toFixed(3)} H={(safeHybridWeights.health ?? 0).toFixed(3)}{" "}
                    F={safeRiskValues.fairness_excluded ? "Excl." : (safeHybridWeights.fairness ?? 0).toFixed(3)}{" "}
                    R={(safeHybridWeights.robustness ?? 0).toFixed(3)}
                  </div>
                </div>
              )}
            </div>

            {/* Trust Score */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Trust Score Computation
              </h4>
              <Eq label="Formula" expr="T = 100 × Σ(β_i × C_i)" />
              <Eq
                label="Expansion"
                expr={(() => {
                  const P = `${(safeHybridWeights.performance ?? 0).toFixed(3)}×${(safeComponentScores.performance ?? 0).toFixed(3)}`;
                  const H = `${(safeHybridWeights.health ?? 0).toFixed(3)}×${(safeComponentScores.health ?? 0).toFixed(3)}`;
                  const F = safeRiskValues.fairness_excluded
                    ? ""
                    : ` + ${(safeHybridWeights.fairness ?? 0).toFixed(3)}×${(safeComponentScores.fairness ?? 0).toFixed(3)}`;
                  const R = `${(safeHybridWeights.robustness ?? 0).toFixed(3)}×${(safeComponentScores.robustness ?? 0).toFixed(3)}`;
                  return `T = 100 × (${P} + ${H}${F} + ${R})`;
                })()}
                result={(trustScoreRaw ?? safeTrustScore).toFixed(2)}
              />
              {globalPenaltyApplied && instabilityPenaltyValue != null && (
                <Eq
                  label="Penalty"
                  expr={`T_final = ${(trustScoreRaw ?? safeTrustScore).toFixed(2)} × (1 − 0.15 × ${safeDII.toFixed(4)})`}
                  result={safeTrustScore.toFixed(2)}
                />
              )}
            </div>

            {/* Guard Check */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Non-Compensatory Guard Check
              </h4>
              <Eq label="Condition" expr={`${safeRiskValues.fairness_excluded ? "min(P, H, R)" : "min(P, H, F, R)"} ≥ τ = ${safeGuardThreshold.toFixed(2)}`} />
              <Eq
                label="Evaluation"
                expr={(() => {
                  const components = safeRiskValues.fairness_excluded
                    ? [safeComponentScores.performance ?? 0, safeComponentScores.health ?? 0, safeComponentScores.robustness ?? 0]
                    : [safeComponentScores.performance ?? 0, safeComponentScores.health ?? 0, safeComponentScores.fairness ?? 0, safeComponentScores.robustness ?? 0];
                  const label = safeRiskValues.fairness_excluded ? "min(P, H, R)" : "min(P, H, F, R)";
                  return `${label} = ${components.map(v => (v ?? 0).toFixed(3)).join(", ")} → ${(Math.min(...components) ?? 0).toFixed(4)}`;
                })()}
                result={guardTriggered ? "TRIGGERED" : "PASSED"}
              />
              {guardTriggered && guardFailures && guardFailures.length > 0 && (
                <div className="mt-1 ml-28 text-xs text-destructive font-mono">
                  Failures: {guardFailures.map(f => `${f.component}=${(f.score ?? 0).toFixed(4)}`).join(", ")}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section C: Fairness Detail */}
        {fairnessMetrics && (
          <AccordionItem value="fairness" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 text-sm font-semibold text-foreground hover:no-underline">
              C. Fairness Metrics Detail
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-0.5">
                {fairnessMetrics.demographic_parity_difference != null && (
                  <DataRow label="Demographic Parity Difference (DP)" value={fairnessMetrics.demographic_parity_difference} />
                )}
                {fairnessMetrics.disparate_impact_ratio != null && (
                  <DataRow label="Disparate Impact Ratio (DI)" value={fairnessMetrics.disparate_impact_ratio} />
                )}
                {fairnessMetrics.equal_opportunity_difference != null && (
                  <DataRow label="Equal Opportunity Difference (EO)" value={fairnessMetrics.equal_opportunity_difference} />
                )}
                {fairnessMetrics.equalized_odds_difference != null && (
                  <DataRow label="Equalized Odds Difference (EqOdds)" value={fairnessMetrics.equalized_odds_difference} />
                )}
                {fairnessMetrics.overall_fairness_score != null && (
                  <DataRow label="Overall Fairness Score" value={fairnessMetrics.overall_fairness_score} />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </Card>
  );
}
