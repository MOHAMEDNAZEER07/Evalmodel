// gemini-client.ts – Upstream Gemini API caller with retry and circuit breaker
// deno-lint-ignore-file

import { CONFIG, GEMINI_ENDPOINT } from "./config.ts";
import { HttpError } from "./errors.ts";
import { log } from "./logger.ts";
import { circuitStatus, circuitRecordSuccess, circuitRecordFailure } from "./circuit-breaker.ts";
import { sleep, expoBackoff } from "./retry.ts";

export async function fetchGeminiSSE(
  payload: unknown,
  apiKey: string,
  requestId: string,
): Promise<Response> {
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}&alt=sse`;

  // Circuit breaker gate
  const status = circuitStatus();
  if (status === "OPEN") {
    log("warn", "Circuit open, rejecting request", { requestId });
    throw new HttpError(503, "Upstream temporarily unavailable (circuit open)", "CIRCUIT_OPEN");
  }

  let attempt = 0;
  let lastErr: Error | null = null;

  while (attempt < CONFIG.RETRY_MAX_ATTEMPTS) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        log("warn", "Gemini non-OK", {
          requestId,
          status: res.status,
          attempt,
          body: text.slice(0, 512),
        });

        if (res.status >= 500 || res.status === 429) {
          circuitRecordFailure();
          if (attempt < CONFIG.RETRY_MAX_ATTEMPTS) {
            await sleep(expoBackoff(attempt));
            continue;
          }
        }
        // client error: do not retry
        throw new HttpError(res.status, "AI service error", "UPSTREAM_ERROR");
      }

      // success
      circuitRecordSuccess();
      return res;
    } catch (err) {
      lastErr = err as Error;
      log("error", "Gemini fetch error", {
        requestId,
        attempt,
        error: (err as Error).message,
      });
      circuitRecordFailure();
      if (attempt < CONFIG.RETRY_MAX_ATTEMPTS) {
        await sleep(expoBackoff(attempt));
      }
    }
  }

  throw lastErr || new HttpError(502, "Failed to reach AI service", "UPSTREAM_FAILURE");
}
