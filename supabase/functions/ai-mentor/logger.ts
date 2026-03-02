// logger.ts – Structured logging with request IDs and timing
// deno-lint-ignore-file

import { CONFIG } from "./config.ts";

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function shouldLog(level: string): boolean {
  const current =
    CONFIG.LOG_LEVEL in LOG_LEVEL_PRIORITY ? CONFIG.LOG_LEVEL : "info";
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[current];
}

export function log(level: string, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const line = { level, time: new Date().toISOString(), msg, ...(meta || {}) };
  // deno-lint-ignore no-console
  console.log(JSON.stringify(line));
}

/** High-resolution timestamp (ms). */
export function now(): number {
  return performance.now();
}

/** Milliseconds elapsed since `ts`. */
export function since(ts: number): number {
  return Math.round(performance.now() - ts);
}

/** Generate a random request ID. */
export function rid(): string {
  return crypto.randomUUID();
}
