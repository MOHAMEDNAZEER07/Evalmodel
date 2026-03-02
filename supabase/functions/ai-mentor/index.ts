// index.ts – Entry point for ai-mentor Supabase Edge Function
// Enhanced Gemini proxy with SSE, rate limiting, circuit breaker, and prompt routing.
//
// Module structure:
//   config.ts         – Environment & tuning constants
//   errors.ts         – HttpError class
//   logger.ts         – Structured logging (JSON, request IDs, timing)
//   validation.ts     – Lightweight request schema validation
//   rate-limiter.ts   – Sliding-window in-memory rate limiter
//   circuit-breaker.ts– Circuit breaker for upstream API
//   retry.ts          – Exponential backoff with jitter
//   prompts.ts        – System prompt builders (model / dataset / general)
//   messages.ts       – Gemini message formatting
//   gemini-client.ts  – Upstream fetch with retry + circuit breaker
//   sse.ts            – SSE encoding helpers & Gemini→OpenAI stream transform
//   guardrails.ts     – Content policy guardrails
//   metrics.ts        – Basic request counters
//   handlers.ts       – HTTP request handlers (root, health, debug, SSE proxy)
//   router.ts         – URL router with CORS and error handling
//
// Deploy: push this directory and set GEMINI_API_KEY in project settings.
// Frontend POSTs to / (or /stream, /v1/chat/completions) with { messages, context }.
// Health: GET /healthz → 200, /readyz → 200 when key configured.
// Debug:  POST /debug/echo with arbitrary JSON.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CONFIG } from "./config.ts";
import { log } from "./logger.ts";
import { router } from "./router.ts";

log("info", "Starting enhanced-gemini-proxy", {
  rateLimit: { windowMs: CONFIG.RL_WINDOW_MS, max: CONFIG.RL_MAX_REQUESTS },
  retry: { max: CONFIG.RETRY_MAX_ATTEMPTS, baseDelayMs: CONFIG.RETRY_BASE_DELAY_MS },
  circuitBreaker: { failureThreshold: CONFIG.CB_FAILURE_THRESHOLD },
});

serve(router);
