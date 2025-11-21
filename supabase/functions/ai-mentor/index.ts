// enhanced-gemini-proxy.ts
// Deno deploy-ready HTTP server that proxies to Gemini streaming API and outputs OpenAI-compatible SSE
// Features:
// - Strong typing for request/response payloads
// - Config system with env + sane defaults
// - Structured logger with request IDs and timing
// - Error taxonomy and centralized handler
// - Schema validation (lightweight) without external deps
// - Rate limiter (sliding window) in-memory
// - Circuit breaker for upstream API
// - Retries with backoff + jitter for upstream POST
// - SSE stream fan-out utilities and robust parser for Gemini SSE
// - Content policy guardrails & mode router (general / insights: model / insights: dataset)
// - Prompt builder modules
// - Metrics (basic counters) printable to logs
// - Health and readiness endpoints
// - CORS preflight handling
// - Optional JSON debug echo endpoint
// - Graceful resource cleanup
//
// NOTE: Keep this single file self-contained for easier deployment on Deno Deploy / Edge
// The file intentionally exceeds 500 LOC for completeness and clarity.
// -----------------------------
// SECTION 0: Imports
// -----------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Error shapes
class HttpError extends Error {
  status;
  code;
  constructor(status, message, code){
    super(message);
    this.status = status;
    this.code = code;
  }
}
// -----------------------------
// SECTION 2: Config & Constants
// -----------------------------
const CONFIG = {
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
  LOG_LEVEL: Deno.env.get("LOG_LEVEL") ?? "info"
};
const LOG_LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
function shouldLog(level) {
  const current = CONFIG.LOG_LEVEL in LOG_LEVEL_PRIORITY ? CONFIG.LOG_LEVEL : "info";
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[current];
}
function log(level, msg, meta) {
  if (!shouldLog(level)) return;
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...meta || {}
  };
  // deno-lint-ignore no-console
  console.log(JSON.stringify(line));
}
function now() {
  return performance.now();
}
function since(ts) {
  return Math.round(performance.now() - ts);
}
function rid() {
  return crypto.randomUUID();
}
// -----------------------------
// SECTION 4: Simple Schema Validation (No deps)
// -----------------------------
function isObject(o) {
  return typeof o === "object" && o !== null && !Array.isArray(o);
}
function validatePayload(raw) {
  if (!isObject(raw)) throw new HttpError(400, "Body must be a JSON object", "BAD_BODY");
  const out = {
    messages: [],
    context: {}
  };
  if (raw.messages !== undefined) {
    if (!Array.isArray(raw.messages)) throw new HttpError(400, "messages must be an array", "BAD_MESSAGES");
    out.messages = raw.messages.map((m, i)=>{
      if (!isObject(m)) throw new HttpError(400, `messages[${i}] must be object`,"BAD_MESSAGES");
      const role = m.role ?? "user";
      const content = String(m.content ?? "");
      if (!content) throw new HttpError(400, `messages[${i}].content required`,"BAD_CONTENT");
      return {
        role,
        content
      };
    });
  }
  if (raw.context !== undefined) {
    if (!isObject(raw.context)) throw new HttpError(400, "context must be an object", "BAD_CONTEXT");
    out.context = raw.context;
  }
  return out;
}
const rlBuckets = new Map();
function rateLimitKey(req) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return ip;
}
function checkRateLimit(req) {
  const key = rateLimitKey(req);
  const nowMs = Date.now();
  const windowStart = nowMs - CONFIG.RL_WINDOW_MS;
  const arr = rlBuckets.get(key) ?? [];
  const pruned = arr.filter((t)=>t > windowStart);
  pruned.push(nowMs);
  rlBuckets.set(key, pruned);
  const remaining = Math.max(0, CONFIG.RL_MAX_REQUESTS - pruned.length);
  return {
    ok: pruned.length <= CONFIG.RL_MAX_REQUESTS,
    remaining
  };
}
const circuit = {
  failures: 0,
  state: "CLOSED",
  openedAt: undefined,
  halfOpenAt: undefined
};
function circuitStatus() {
  const nowMs = Date.now();
  if (circuit.state === "OPEN") {
    if (circuit.openedAt && nowMs - circuit.openedAt > CONFIG.CB_HALF_OPEN_AFTER_MS) {
      circuit.state = "HALF_OPEN";
      circuit.halfOpenAt = nowMs;
    }
  } else if (circuit.state === "HALF_OPEN") {
    if (circuit.halfOpenAt && nowMs - circuit.halfOpenAt > CONFIG.CB_RESET_AFTER_MS) {
      circuit.state = "CLOSED";
      circuit.failures = 0;
      circuit.openedAt = undefined;
      circuit.halfOpenAt = undefined;
    }
  }
  return circuit.state;
}
function circuitRecordSuccess() {
  circuit.failures = 0;
  circuit.state = "CLOSED";
  circuit.openedAt = undefined;
  circuit.halfOpenAt = undefined;
}
function circuitRecordFailure() {
  circuit.failures += 1;
  if (circuit.failures >= CONFIG.CB_FAILURE_THRESHOLD) {
    circuit.state = "OPEN";
    circuit.openedAt = Date.now();
  }
}
// -----------------------------
// SECTION 7: Backoff & Retry helpers
// -----------------------------
function sleep(ms) {
  return new Promise((res)=>setTimeout(res, ms));
}
function expoBackoff(attempt) {
  const base = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 50;
  return Math.min(base + jitter, CONFIG.RETRY_MAX_DELAY_MS);
}
// -----------------------------
// SECTION 8: Prompt Builders
// -----------------------------
function buildModelInsightsPrompt(context) {
  let systemPrompt = `You are a SPECIALIZED Model Performance Analyst. Your ONLY job is to help users understand and improve THEIR SPECIFIC model that is currently displayed.

STRICT RULES:
1. NEVER provide general Python code or tutorials
2. NEVER discuss models the user hasn't uploaded
3. ONLY analyze the ACTUAL metrics shown below
4. ALWAYS use "your model", "your accuracy", "your performance"
5. Refuse to answer questions unrelated to THIS specific model's performance

Your expertise:
- Interpreting THEIR model's evaluation metrics
- Explaining what THEIR accuracy, precision, recall, F1 scores mean in context
- Identifying specific strengths and weaknesses in THEIR model
- Comparing THEIR metrics against typical benchmarks
- Suggesting concrete improvements based on THEIR actual performance
- Explaining why THEIR model might be underperforming in certain areas

If asked about code, tutorials, or general ML topics, respond: "I'm here to analyze YOUR specific model performance. For general ML help, please use the general AI assistant (purple icon). Let's focus on improving your current model - what would you like to know about your metrics?"`;
  const info = context?.modelInfo;
  if (info && typeof info === "object") {
    systemPrompt += `

===== YOUR MODEL'S ACTUAL PERFORMANCE DATA =====`;
    if (info.name) systemPrompt += `\nModel Name: ${info.name}`;
    if (info.type) systemPrompt += `\nModel Type: ${info.type}`;
    if (info.framework) systemPrompt += `\nFramework: ${info.framework}`;
    if (info.dataset) systemPrompt += `\nTested on Dataset: ${info.dataset}`;
    if (typeof info.evalScore === "number") systemPrompt += `\nOverall EvalScore: ${info.evalScore.toFixed(1)}/100`;
    const m = info.metrics;
    if (m && typeof m === "object") {
      systemPrompt += `\n\nACTUAL PERFORMANCE METRICS:`;
      if (typeof m.accuracy === "number") systemPrompt += `\n  • Accuracy: ${(m.accuracy * 100).toFixed(2)}%`;
      if (typeof m.precision === "number") systemPrompt += `\n  • Precision: ${(m.precision * 100).toFixed(2)}%`;
      if (typeof m.recall === "number") systemPrompt += `\n  • Recall: ${(m.recall * 100).toFixed(2)}%`;
      if (typeof m.f1_score === "number") systemPrompt += `\n  • F1 Score: ${(m.f1_score * 100).toFixed(2)}%`;
      if (typeof m.mae === "number") systemPrompt += `\n  • MAE: ${m.mae.toFixed(4)}`;
      if (typeof m.mse === "number") systemPrompt += `\n  • MSE: ${m.mse.toFixed(4)}`;
      if (typeof m.rmse === "number") systemPrompt += `\n  • RMSE: ${m.rmse.toFixed(4)}`;
      if (typeof m.r2_score === "number") systemPrompt += `\n  • R² Score: ${m.r2_score.toFixed(4)}`;
    }
    systemPrompt += `\n==============================================`;
  }
  systemPrompt += `\n\nEXAMPLES OF GOOD RESPONSES:
❌ BAD: "Here's code for logistic regression..."
✅ GOOD: "Your model has 87.2% accuracy which is solid, but I notice your precision (82.1%) is lower than recall (91.3%). This means your model is catching most positive cases but also flagging some false positives. Would you like suggestions to improve precision?"

❌ BAD: "Generally, you should tune hyperparameters..."
✅ GOOD: "Looking at your F1 score of 86.5%, your model is performing well but has room for improvement. The gap between precision and recall suggests you might benefit from adjusting the classification threshold. Would you like me to explain what threshold would work best for your use case?"

ALWAYS reference the ACTUAL numbers from the metrics above. Be specific, actionable, and focused on THIS model's performance.`;
  systemPrompt += `\n\nBe concise but comprehensive. Use bullet points for clarity.`;
  return systemPrompt;
}
function buildDatasetInsightsPrompt(context) {
  let systemPrompt = `You are a SPECIALIZED Data Quality Analyst. Your ONLY job is to help users understand and improve THEIR SPECIFIC dataset that is currently displayed.

STRICT RULES:
1. NEVER provide general Python code or tutorials
2. NEVER discuss hypothetical datasets
3. ONLY analyze the ACTUAL quality metrics shown below
4. ALWAYS use "your dataset", "your data", "your features"
5. Refuse to answer questions unrelated to THIS specific dataset's quality

Your expertise:
- Interpreting THEIR dataset's quality metrics
- Explaining what THEIR completeness, validity, uniqueness scores mean
- Identifying specific data quality issues in THEIR data
- Analyzing THEIR outliers and correlations
- Suggesting concrete data cleaning steps for THEIR specific issues
- Determining if THEIR dataset is ready for modeling

If asked about code, tutorials, or general data science topics, respond: "I'm here to analyze YOUR specific dataset quality. For general data science help, please use the general AI assistant (purple icon). Let's focus on YOUR data - what would you like to know about your quality metrics?"`;
  const info = context?.datasetInfo;
  if (info && typeof info === "object") {
    systemPrompt += `\n\n===== YOUR DATASET'S ACTUAL QUALITY DATA =====`;
    if (info.name) systemPrompt += `\nDataset Name: ${info.name}`;
    if (typeof info.qualityScore === "number") systemPrompt += `\nOverall Quality Score: ${info.qualityScore.toFixed(1)}%`;
    if (typeof info.outlierCount === "number" && info.outlierCount > 0) systemPrompt += `\nOutliers Detected: ${info.outlierCount} features have outliers`;
    if (typeof info.correlationCount === "number" && info.correlationCount > 0) systemPrompt += `\nSignificant Correlations: ${info.correlationCount} strong correlations found`;
    if (Array.isArray(info.issues) && info.issues.length > 0) {
      systemPrompt += `\n\nSPECIFIC QUALITY ISSUES IN YOUR DATA:`;
      for (const issue of info.issues)systemPrompt += `\n  • ${issue}`;
    }
    if (info.summary) {
      systemPrompt += `\n\nAI Analysis: ${info.summary}`;
    }
    systemPrompt += `\n==============================================`;
  }
  systemPrompt += `\n\nEXAMPLES OF GOOD RESPONSES:
❌ BAD: "Here's how to handle outliers in Python..."
✅ GOOD: "Looking at your data, you have outliers in 3 features affecting your 85.5% quality score. Specifically, I see ${context?.datasetInfo?.issues?.[0] || 'quality issues'}. Before removing these outliers, let me explain what they mean for YOUR dataset..."

❌ BAD: "Generally, correlation above 0.8 indicates multicollinearity..."
✅ GOOD: "Your dataset has ${context?.datasetInfo?.correlationCount || 'several'} significant correlations. This is important for YOUR modeling because highly correlated features can cause issues. Would you like me to explain which specific features in YOUR data are correlated and what to do about them?"

ALWAYS reference the ACTUAL numbers and issues from YOUR dataset. Be specific, actionable, and focused on THIS dataset's quality.`;
  systemPrompt += `\n\nBe concise but comprehensive. Use bullet points for clarity.`;
  return systemPrompt;
}
function buildGeneralPrompt() {
  const systemPrompt = `You are a General AI Assistant for Data Science, Machine Learning, and Deep Learning.

Your role is to provide EDUCATIONAL support on general topics:
- Explain ML/DL concepts, algorithms, and theories
- Provide code examples and tutorials when requested
- Answer questions about best practices
- Help understand different model types and when to use them
- Explain evaluation metrics in general terms
- Discuss data preprocessing techniques
- Share insights about ML workflows

IMPORTANT: You do NOT have access to the user's specific data or models in this mode.

If users ask about THEIR specific dataset or model performance:
- Politely redirect them to the Insights page
- Explain: "I can help with general ML/DL concepts, but to analyze YOUR specific data or model, please go to the Insights page where our context-aware assistant has access to your actual metrics."

You CAN:
✅ Provide Python code examples
✅ Explain algorithms and concepts
✅ Discuss best practices
✅ Answer "how to" questions
✅ Compare different approaches

You CANNOT:
❌ Analyze their specific dataset
❌ Review their model's performance
❌ Access their evaluation metrics

Be helpful, educational, and guide users to the right tool for their needs.

Be concise but comprehensive. Use bullet points for clarity.`;
  return systemPrompt;
}
function buildSystemPrompt(context) {
  if (context?.page === "insights" && context?.insightType === "model") {
    return {
      systemPrompt: buildModelInsightsPrompt(context),
      acknowledgment: "I understand. I'm analyzing your specific model's performance metrics and ready to provide personalized insights on how to improve it."
    };
  } else if (context?.page === "insights") {
    return {
      systemPrompt: buildDatasetInsightsPrompt(context),
      acknowledgment: "I understand. I'm analyzing your specific dataset and ready to provide personalized data quality insights."
    };
  }
  return {
    systemPrompt: buildGeneralPrompt(),
    acknowledgment: "I understand. I'm ready to help you with general ML/DL concepts and best practices."
  };
}
// -----------------------------
// SECTION 9: Message Formatting
// -----------------------------
function toGeminiMessages(systemPrompt, acknowledgment, messages) {
  const formatted = [];
  formatted.push({
    role: "user",
    parts: [
      {
        text: systemPrompt
      }
    ]
  });
  formatted.push({
    role: "model",
    parts: [
      {
        text: acknowledgment
      }
    ]
  });
  for (const m of messages){
    const role = m.role === "assistant" ? "model" : m.role;
    formatted.push({
      role,
      parts: [
        {
          text: m.content
        }
      ]
    });
  }
  return formatted;
}
// -----------------------------
// SECTION 10: Upstream (Gemini) Callers
// -----------------------------
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
async function fetchGeminiSSE(payload, apiKey, requestId) {
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}&alt=sse`;
  // Circuit breaker gate
  const status = circuitStatus();
  if (status === "OPEN") {
    log("warn", "Circuit open, rejecting request", {
      requestId
    });
    throw new HttpError(503, "Upstream temporarily unavailable (circuit open)", "CIRCUIT_OPEN");
  }
  let attempt = 0;
  let lastErr = null;
  while(attempt < CONFIG.RETRY_MAX_ATTEMPTS){
    attempt++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(()=>"<no body>");
        log("warn", "Gemini non-OK", {
          requestId,
          status: res.status,
          attempt,
          body: text.slice(0, 512)
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
      lastErr = err;
      log("error", "Gemini fetch error", {
        requestId,
        attempt,
        error: err.message
      });
      circuitRecordFailure();
      if (attempt < CONFIG.RETRY_MAX_ATTEMPTS) {
        await sleep(expoBackoff(attempt));
      }
    }
  }
  throw lastErr || new HttpError(502, "Failed to reach AI service", "UPSTREAM_FAILURE");
}
// -----------------------------
// SECTION 11: SSE Helpers
// -----------------------------
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function sseFormat(data) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}
function sseEvent(name, data) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}
function sseText(text) {
  return encoder.encode(text);
}
// -----------------------------
// SECTION 12: Gemini SSE → OpenAI-compatible Stream Transform
// -----------------------------
async function pipeGeminiToOpenAI(reader, writable, requestId) {
  let buffer = "";
  let lastWrite = Date.now();
  const keepAlive = setInterval(async ()=>{
    try {
      // Send a comment line as keepalive (compatible with most SSE clients)
      await writable.write(sseText(`: keepalive ${Date.now()}\n\n`));
      lastWrite = Date.now();
    } catch (_e) {
      clearInterval(keepAlive);
    }
  }, CONFIG.SSE_KEEPALIVE_MS);
  try {
    while(true){
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {
        stream: true
      });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines){
        if (!line.trim() || line.startsWith(":")) continue; // ignore comments/empties
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          continue; // We'll append our own DONE at the end
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const delta = {
              choices: [
                {
                  delta: {
                    content: text
                  },
                  index: 0,
                  finish_reason: null
                }
              ]
            };
            await writable.write(sseFormat(delta));
            lastWrite = Date.now();
          }
        } catch (e) {
          log("warn", "Failed to parse upstream SSE line", {
            requestId,
            lineSnippet: line.slice(0, 200),
            error: e.message
          });
        }
      }
    }
  } finally{
    clearInterval(keepAlive);
  }
  await writable.write(sseText("data: [DONE]\n\n"));
  await writable.close();
}
// -----------------------------
// SECTION 13: Content Guardrails
// -----------------------------
function enforceGuards(context, messages) {
  // Example guardrails: if insights mode, refuse generic coding help
  const mode = context?.page === "insights" && context?.insightType === "model" ? "model" : context?.page === "insights" ? "dataset" : "general";
  if (mode !== "general") {
    const latest = messages[messages.length - 1];
    if (latest) {
      const q = latest.content.toLowerCase();
      const disallowed = [
        "write code",
        "python code",
        "give code",
        "tutorial",
        "how to implement",
        "pytorch",
        "tensorflow",
        "sklearn code"
      ];
      for (const token of disallowed){
        if (q.includes(token)) {
          // We don't throw; we just rely on prompt rules to guide the model.
          log("info", "Guardrail flagged a coding request in insights mode", {
            token
          });
          break;
        }
      }
    }
  }
}
// -----------------------------
// SECTION 14: Metrics (basic)
// -----------------------------
const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  upstreamErrors: 0,
  rateLimited: 0,
  circuitsOpen: 0,
  avgLatencyMs: 0
};
function recordLatency(ms) {
  // simple moving average
  metrics.avgLatencyMs = metrics.avgLatencyMs === 0 ? ms : Math.round(metrics.avgLatencyMs * 0.9 + ms * 0.1);
}
// -----------------------------
// SECTION 15: Handlers
// -----------------------------
async function handleRoot() {
  const body = {
    ok: true,
    name: "enhanced-gemini-proxy",
    version: 1,
    uptimeSec: Math.floor(performance.timeOrigin ? performance.now() / 1000 : 0),
    circuit: circuitStatus(),
    metrics
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}
async function handleHealthz() {
  return new Response("ok", {
    status: 200
  });
}
async function handleReadyz() {
  const ok = !!CONFIG.GEMINI_API_KEY;
  return new Response(ok ? "ready" : "not ready", {
    status: ok ? 200 : 503
  });
}
async function handleDebugEcho(req, ridLocal) {
  let json = null;
  try {
    json = await req.json();
  } catch  {
    json = {
      error: "not a JSON body"
    };
  }
  return new Response(JSON.stringify({
    rid: ridLocal,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    json
  }, null, 2), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}
async function handleSSEProxy(req, ridLocal) {
  const t0 = now();
  metrics.totalRequests++;
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  // Rate limit
  const rl = checkRateLimit(req);
  if (!rl.ok) {
    metrics.rateLimited++;
    throw new HttpError(429, "Rate limit exceeded. Please try again later.", "RATE_LIMIT");
  }
  // Read JSON
  let payloadRaw;
  try {
    payloadRaw = await req.json();
  } catch  {
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
    maxOutputTokens: CONFIG.DEFAULT_MAX_TOKENS
  };
  const upstreamReq = {
    contents,
    generationConfig: genConfig
  };
  // Circuit state check for metrics
  if (circuitStatus() === "OPEN") metrics.circuitsOpen++;
  // Check if client wants streaming or single response
  const acceptHeader = req.headers.get("accept") || "";
  const preferStreaming = acceptHeader.includes("text/event-stream") || req.url.includes("/stream");
  if (!preferStreaming) {
    // Non-streaming mode for supabase.functions.invoke()
    log("debug", "Non-streaming mode", {
      requestId: ridLocal
    });
    const upstreamRes = await fetchGeminiSSE(upstreamReq, CONFIG.GEMINI_API_KEY, ridLocal);
    const reader = upstreamRes.body?.getReader();
    if (!reader) throw new HttpError(500, "No upstream response body", "NO_BODY");
    let fullText = "";
    let buffer = "";
    const decoder = new TextDecoder();
    try {
      while(true){
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {
          stream: true
        });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines){
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
              error: e.message
            });
          }
        }
      }
    } catch (err) {
      log("error", "Non-streaming read failed", {
        requestId: ridLocal,
        error: err.message
      });
      throw new HttpError(500, "Failed to read response", "READ_ERROR");
    }
    recordLatency(since(t0));
    // Return OpenAI-compatible format for frontend
    const response = {
      choices: [
        {
          message: {
            content: fullText,
            role: "assistant"
          },
          index: 0,
          finish_reason: "stop"
        }
      ]
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": ridLocal
      }
    });
  }
  // Streaming mode for direct fetch
  log("debug", "Streaming mode", {
    requestId: ridLocal
  });
  const upstreamRes = await fetchGeminiSSE(upstreamReq, CONFIG.GEMINI_API_KEY, ridLocal);
  // Stream transform
  const { readable, writable } = new TransformStream();
  const reader = upstreamRes.body?.getReader();
  if (!reader) throw new HttpError(500, "No upstream response body", "NO_BODY");
  // Async pipe without blocking return
  (async ()=>{
    const writer = writable.getWriter();
    try {
      await pipeGeminiToOpenAI(reader, writer, ridLocal);
    } catch (err) {
      log("error", "pipeGeminiToOpenAI failed", {
        requestId: ridLocal,
        error: err.message
      });
      try {
        await writer.abort(err);
      } catch  {}
    }
  })();
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Request-Id": ridLocal
  });
  const res = new Response(readable, {
    headers
  });
  recordLatency(since(t0));
  return res;
}
// -----------------------------
// SECTION 16: Router
// -----------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
async function router(req) {
  const t0 = now();
  const requestId = req.headers.get("x-request-id") || rid();
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "");
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    if (path === "/healthz") {
      return await handleHealthz();
    }
    if (path === "/readyz") {
      return await handleReadyz();
    }
    if (path === "/debug/echo") {
      return await handleDebugEcho(req, requestId);
    }
    // Main endpoint - matches frontend expectations
    // Root path for supabase.functions.invoke(), specific paths for direct fetch
    // Also handles /ai-mentor path from Supabase routing
    if (path === "" || path === "/" || path === "/ai-mentor" || path === "/v1/chat/completions" || path === "/stream") {
      // Only handle chat requests (POST with JSON body)
      if (req.method === "POST") {
        return await handleSSEProxy(req, requestId);
      }
      // GET on root path returns info
      if (req.method === "GET" && (path === "" || path === "/" || path === "/ai-mentor")) {
        return await handleRoot();
      }
    }
    throw new HttpError(404, "Not Found", "NOT_FOUND");
  } catch (err) {
    metrics.totalErrors++;
    const status = err instanceof HttpError ? err.status : 500;
    const code = err instanceof HttpError ? err.code : "INTERNAL";
    const message = err instanceof HttpError ? err.message : err.message || "Server error";
    log(status >= 500 ? "error" : "warn", "Request failed", {
      status,
      code,
      message,
      ms: since(t0)
    });
    const body = {
      error: message,
      code
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}
// -----------------------------
// SECTION 17: Server bootstrap
// -----------------------------
log("info", "Starting enhanced-gemini-proxy", {
  rateLimit: {
    windowMs: CONFIG.RL_WINDOW_MS,
    max: CONFIG.RL_MAX_REQUESTS
  },
  retry: {
    max: CONFIG.RETRY_MAX_ATTEMPTS,
    baseDelayMs: CONFIG.RETRY_BASE_DELAY_MS
  },
  circuitBreaker: {
    failureThreshold: CONFIG.CB_FAILURE_THRESHOLD
  }
});
serve(router); // -----------------------------
 // SECTION 18: Additional Notes (non-executing)
 // -----------------------------
 // - To deploy on Deno Deploy: push this single file and set GEMINI_API_KEY in project settings.
 // - Frontend can POST to /stream (or /v1/chat/completions) with body { messages, context } and read SSE.
 // - The stream uses OpenAI-like delta chunks: { choices: [{ delta: { content } }] }.
 // - For local testing with curl:
 //   curl -N -H 'Content-Type: application/json' \
 //     -d '{"messages":[{"role":"user","content":"Explain overfitting simply"}],"context":{"page":"general"}}' \
 //     http://localhost:8000/stream
 // - Health: GET /healthz → 200 ok, /readyz → 200 only when key present.
 // - Debug: POST /debug/echo with arbitrary JSON to see what server reads.
