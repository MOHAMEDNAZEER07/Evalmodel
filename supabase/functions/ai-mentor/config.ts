// config.ts – Configuration constants and environment variables
// deno-lint-ignore-file

export const CONFIG = {
  // Env
  GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY") ?? "",
  // Tuning
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TOP_K: 40,
  DEFAULT_TOP_P: 0.95,
  DEFAULT_MAX_TOKENS: 2048,
  // Rate limiting
  RL_WINDOW_MS: 60_000,
  RL_MAX_REQUESTS: 60,
  // Circuit breaker
  CB_FAILURE_THRESHOLD: 5,
  CB_HALF_OPEN_AFTER_MS: 30_000,
  CB_RESET_AFTER_MS: 300_000,
  // Retry
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 250,
  RETRY_MAX_DELAY_MS: 2_000,
  // SSE
  SSE_KEEPALIVE_MS: 20_000,
  // Misc
  LOG_LEVEL: Deno.env.get("LOG_LEVEL") ?? "info",
};

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
