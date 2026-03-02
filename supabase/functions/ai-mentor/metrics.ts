// metrics.ts – Basic request counters
// deno-lint-ignore-file

export const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  upstreamErrors: 0,
  rateLimited: 0,
  circuitsOpen: 0,
  avgLatencyMs: 0,
};

export function recordLatency(ms: number): void {
  metrics.avgLatencyMs =
    metrics.avgLatencyMs === 0
      ? ms
      : Math.round(metrics.avgLatencyMs * 0.9 + ms * 0.1);
}
