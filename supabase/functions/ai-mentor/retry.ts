// retry.ts – Backoff & retry helpers
// deno-lint-ignore-file

import { CONFIG } from "./config.ts";

export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function expoBackoff(attempt: number): number {
  const base = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 50;
  return Math.min(base + jitter, CONFIG.RETRY_MAX_DELAY_MS);
}
