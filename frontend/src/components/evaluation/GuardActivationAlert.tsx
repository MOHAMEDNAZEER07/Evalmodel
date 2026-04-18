/**
 * Guard Activation Alert
 *
 * Large warning banner displayed when the non-compensatory guard is triggered.
 * Does NOT change the trust score — just adds a red highlight.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface GuardActivationAlertProps {
  guardFailures: Array<{ component: string; score: number }>;
  guardThreshold: number;
  trustMode: string;
}

export function GuardActivationAlert({
  guardFailures,
  guardThreshold,
  trustMode,
}: GuardActivationAlertProps) {
  if (!guardFailures || guardFailures.length === 0) return null;

  return (
    <Alert
      variant="destructive"
      className="border-2 border-destructive/70 bg-destructive/10 shadow-sm"
    >
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-base font-semibold">
        Non-Compensatory Guard Activated
      </AlertTitle>
      <AlertDescription className="mt-2 text-sm">
        <p>
          {guardFailures.length === 1 ? (
            <>
              <span className="font-semibold capitalize">{guardFailures[0].component}</span> score (
              <span className="font-mono font-bold">{(guardFailures[0].score ?? 0).toFixed(3)}</span>) is
              below the {trustMode} threshold (τ&nbsp;=&nbsp;{(guardThreshold ?? 0.3).toFixed(2)}).
            </>
          ) : (
            <>
              Multiple components are below the {trustMode} threshold (τ&nbsp;=&nbsp;{(guardThreshold ?? 0.3).toFixed(2)}):
            </>
          )}
        </p>
        {guardFailures.length > 1 && (
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {guardFailures.map((f) => (
              <li key={f.component}>
                <span className="font-semibold capitalize">{f.component}</span>{" "}
                = <span className="font-mono font-bold">{(f.score ?? 0).toFixed(4)}</span>{" "}
                &lt; {(guardThreshold ?? 0.3).toFixed(2)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-destructive/80 italic">
          The guard overrides the verdict to high-risk but does not alter the numeric trust score.
        </p>
      </AlertDescription>
    </Alert>
  );
}
