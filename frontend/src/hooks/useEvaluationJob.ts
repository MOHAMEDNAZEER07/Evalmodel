/**
 * useEvaluationJob - React hook for async evaluation with progress tracking
 *
 * Usage:
 * ```tsx
 * const { job, startEvaluation, cancelPolling } = useEvaluationJob();
 *
 * // Start evaluation
 * await startEvaluation({ model_id: "...", dataset_id: "..." });
 *
 * // Render progress
 * {job.status === "running" && <ProgressBar value={job.progress} />}
 *
 * // Check result
 * {job.status === "completed" && <Results data={job.result} />}
 * ```
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export type JobStatus = "idle" | "pending" | "running" | "completed" | "failed";

export interface EvaluationJobState {
  jobId: string | null;
  status: JobStatus;
  progress: number;
  step: string;
  result: unknown;
  error: string | null;
}

export interface StartEvaluationParams {
  model_id: string;
  dataset_id: string;
  sensitive_attribute?: string | null;
  force_rerun?: boolean;
}

const POLL_INTERVAL_MS = 2500; // Poll every 2.5 seconds (reduced from 1.5s to prevent flooding)

export function useEvaluationJob() {
  const [job, setJob] = useState<EvaluationJobState>({
    jobId: null,
    status: "idle",
    progress: 0,
    step: "",
    result: null,
    error: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isPollingActiveRef = useRef<boolean>(false); // Guard against race conditions
  const isFetchingRef = useRef<boolean>(false); // Prevent overlapping fetch requests

  /**
   * Stop polling for job status
   */
  const cancelPolling = useCallback(() => {
    isPollingActiveRef.current = false;
    isFetchingRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  /**
   * Reset job state to idle
   */
  const reset = useCallback(() => {
    cancelPolling();
    setJob({
      jobId: null,
      status: "idle",
      progress: 0,
      step: "",
      result: null,
      error: null,
    });
  }, [cancelPolling]);

  /**
   * Start an async evaluation
   */
  const startEvaluation = useCallback(
    async (params: StartEvaluationParams) => {
      // Prevent starting a new evaluation if already polling
      if (isPollingActiveRef.current || pollRef.current) {
        console.warn("Evaluation already in progress, ignoring duplicate start request");
        return null;
      }

      // Cancel any existing polling (defensive)
      cancelPolling();

      // Reset state for new evaluation
      setJob({
        jobId: null,
        status: "pending",
        progress: 0,
        step: "Starting evaluation...",
        result: null,
        error: null,
      });

      try {
        // Start async evaluation - returns job_id immediately
        const response = await apiClient.evaluateModelAsync(
          params.model_id,
          params.dataset_id,
          params.sensitive_attribute ?? undefined,
          params.force_rerun ?? false
        );

        const jobId = response.job_id;

        setJob((prev) => ({
          ...prev,
          jobId,
          status: "pending",
          step: "Queued for evaluation",
        }));

        // Create abort controller for fetch requests
        abortRef.current = new AbortController();

        // Start polling for status
        isPollingActiveRef.current = true;
        pollRef.current = setInterval(async () => {
          // Guard: bail out if polling was cancelled (prevents race condition floods)
          if (!isPollingActiveRef.current) return;

          // Guard: skip if a request is already in flight (prevents overlapping requests)
          if (isFetchingRef.current) return;

          try {
            isFetchingRef.current = true;
            const statusData = await apiClient.getEvaluationJobStatus(jobId);

            // Guard: check again after async call (polling may have been cancelled mid-request)
            if (!isPollingActiveRef.current) {
              isFetchingRef.current = false;
              return;
            }

            setJob((prev) => ({
              ...prev,
              status: statusData.status as JobStatus,
              progress: statusData.progress ?? prev.progress,
              step: statusData.step ?? prev.step,
              result: statusData.result ?? null,
              error: statusData.error ?? null,
            }));

            // Stop polling when job is done
            if (statusData.status === "completed" || statusData.status === "failed") {
              cancelPolling();
            }
          } catch (pollError) {
            // Don't fail on transient polling errors — keep trying
            console.warn("Poll error (will retry):", pollError);
          } finally {
            isFetchingRef.current = false;
          }
        }, POLL_INTERVAL_MS);

        return jobId;
      } catch (error) {
        // Failed to start the job
        const errorMessage = error instanceof Error ? error.message : "Failed to start evaluation";
        setJob((prev) => ({
          ...prev,
          status: "failed",
          error: errorMessage,
        }));
        throw error;
      }
    },
    [cancelPolling]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPolling();
    };
  }, [cancelPolling]);

  return {
    job,
    startEvaluation,
    cancelPolling,
    reset,
    isEvaluating: job.status === "pending" || job.status === "running",
    isComplete: job.status === "completed",
    isFailed: job.status === "failed",
  };
}
