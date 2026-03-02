// handlers.ts – HTTP request handlers
// deno-lint-ignore-file

import { CONFIG, corsHeaders } from "./config.ts";
import { HttpError } from "./errors.ts";
import { log, now, since } from "./logger.ts";
import { validatePayload } from "./validation.ts";
import { checkRateLimit } from "./rate-limiter.ts";
import { circuitStatus } from "./circuit-breaker.ts";
import { buildSystemPrompt } from "./prompts.ts";
import { toGeminiMessages } from "./messages.ts";
import { fetchGeminiSSE } from "./gemini-client.ts";
import { sseFormat, sseText, pipeGeminiToOpenAI } from "./sse.ts";
import { enforceGuards } from "./guardrails.ts";
import { metrics, recordLatency } from "./metrics.ts";

// ─── Utility handlers ───────────────────────────────────────────────────────

export async function handleRoot(): Promise<Response> {
  const body = {
    ok: true,
    name: "enhanced-gemini-proxy",
    version: 1,
    uptimeSec: Math.floor(performance.timeOrigin ? performance.now() / 1000 : 0),
    circuit: circuitStatus(),
    metrics,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleHealthz(): Promise<Response> {
  return new Response("ok", { status: 200 });
}

export async function handleReadyz(): Promise<Response> {
  const ok = !!CONFIG.GEMINI_API_KEY;
  return new Response(ok ? "ready" : "not ready", { status: ok ? 200 : 503 });
}

export async function handleDebugEcho(req: Request, ridLocal: string): Promise<Response> {
  let json: unknown = null;
  try {
    json = await req.json();
  } catch {
    json = { error: "not a JSON body" };
  }
  return new Response(
    JSON.stringify(
      {
        rid: ridLocal,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
        json,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  );
}

// ─── Main SSE proxy handler ─────────────────────────────────────────────────

export async function handleSSEProxy(req: Request, ridLocal: string): Promise<Response> {
  const t0 = now();
  metrics.totalRequests++;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit
  const rl = checkRateLimit(req);
  if (!rl.ok) {
    metrics.rateLimited++;
    throw new HttpError(429, "Rate limit exceeded. Please try again later.", "RATE_LIMIT");
  }

  // Read JSON
  let payloadRaw: unknown;
  try {
    payloadRaw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON", "BAD_JSON");
  }

  // Validate
  const { messages = [], context = {} } = validatePayload(payloadRaw);

  // Guardrails
  enforceGuards(context, messages);

  // Build prompts
  const { systemPrompt, acknowledgment } = buildSystemPrompt(context);
  const contents = toGeminiMessages(systemPrompt, acknowledgment, messages);

  // Build config & request
  if (!CONFIG.GEMINI_API_KEY) {
    throw new HttpError(500, "GEMINI_API_KEY is not configured", "NO_API_KEY");
  }

  const genConfig = {
    temperature: CONFIG.DEFAULT_TEMPERATURE,
    topK: CONFIG.DEFAULT_TOP_K,
    topP: CONFIG.DEFAULT_TOP_P,
    maxOutputTokens: CONFIG.DEFAULT_MAX_TOKENS,
  };

  const upstreamReq = { contents, generationConfig: genConfig };

  // Circuit state check for metrics
  if (circuitStatus() === "OPEN") metrics.circuitsOpen++;

  // Check if client wants streaming or single response
  const acceptHeader = req.headers.get("accept") || "";
  const preferStreaming =
    acceptHeader.includes("text/event-stream") || req.url.includes("/stream");

  if (!preferStreaming) {
    // ── Non-streaming mode for supabase.functions.invoke() ──
    log("debug", "Non-streaming mode", { requestId: ridLocal });

    const upstreamRes = await fetchGeminiSSE(upstreamReq, CONFIG.GEMINI_API_KEY, ridLocal);
    const reader = upstreamRes.body?.getReader();
    if (!reader) throw new HttpError(500, "No upstream response body", "NO_BODY");

    let fullText = "";
    let buffer = "";
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) fullText += text;
          } catch (e) {
            log("warn", "Failed to parse SSE line", {
              requestId: ridLocal,
              error: (e as Error).message,
            });
          }
        }
      }
    } catch (err) {
      log("error", "Non-streaming read failed", {
        requestId: ridLocal,
        error: (err as Error).message,
      });
      throw new HttpError(500, "Failed to read response", "READ_ERROR");
    }

    recordLatency(since(t0));

    const response = {
      choices: [
        {
          message: { content: fullText, role: "assistant" },
          index: 0,
          finish_reason: "stop",
        },
      ],
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": ridLocal,
      },
    });
  }

  // ── Streaming mode for direct fetch ──
  log("debug", "Streaming mode", { requestId: ridLocal });

  const upstreamRes = await fetchGeminiSSE(upstreamReq, CONFIG.GEMINI_API_KEY, ridLocal);
  const { readable, writable } = new TransformStream();
  const reader = upstreamRes.body?.getReader();
  if (!reader) throw new HttpError(500, "No upstream response body", "NO_BODY");

  // Async pipe without blocking return
  (async () => {
    const writer = writable.getWriter();
    try {
      await pipeGeminiToOpenAI(reader, writer, ridLocal);
    } catch (err) {
      log("error", "pipeGeminiToOpenAI failed", {
        requestId: ridLocal,
        error: (err as Error).message,
      });
      try {
        await writer.abort(err);
      } catch {}
    }
  })();

  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Request-Id": ridLocal,
  });

  const res = new Response(readable, { headers });
  recordLatency(since(t0));
  return res;
}
