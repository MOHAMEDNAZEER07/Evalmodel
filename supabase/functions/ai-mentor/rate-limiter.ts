// rate-limiter.ts – Sliding-window in-memory rate limiter
// deno-lint-ignore-file

import { CONFIG } from "./config.ts";

const rlBuckets = new Map<string, number[]>();

export function rateLimitKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return ip;
}

export function checkRateLimit(req: Request): { ok: boolean; remaining: number } {
  const key = rateLimitKey(req);
  const nowMs = Date.now();
  const windowStart = nowMs - CONFIG.RL_WINDOW_MS;
  const arr = rlBuckets.get(key) ?? [];
  const pruned = arr.filter((t) => t > windowStart);
  pruned.push(nowMs);
  rlBuckets.set(key, pruned);
  const remaining = Math.max(0, CONFIG.RL_MAX_REQUESTS - pruned.length);
  return { ok: pruned.length <= CONFIG.RL_MAX_REQUESTS, remaining };
}
