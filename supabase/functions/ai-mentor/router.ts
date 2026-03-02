// router.ts – HTTP router with CORS and error handling
// deno-lint-ignore-file

import { corsHeaders } from "./config.ts";
import { HttpError } from "./errors.ts";
import { log, now, since, rid } from "./logger.ts";
import { metrics } from "./metrics.ts";
import {
  handleRoot,
  handleHealthz,
  handleReadyz,
  handleDebugEcho,
  handleSSEProxy,
} from "./handlers.ts";

export async function router(req: Request): Promise<Response> {
  const t0 = now();
  const requestId = req.headers.get("x-request-id") || rid();

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "");

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/healthz") return await handleHealthz();
    if (path === "/readyz") return await handleReadyz();
    if (path === "/debug/echo") return await handleDebugEcho(req, requestId);

    // Main endpoint – matches frontend expectations
    // Root path for supabase.functions.invoke(), specific paths for direct fetch
    // Also handles /ai-mentor path from Supabase routing
    if (
      path === "" ||
      path === "/" ||
      path === "/ai-mentor" ||
      path === "/v1/chat/completions" ||
      path === "/stream"
    ) {
      if (req.method === "POST") return await handleSSEProxy(req, requestId);
      if (
        req.method === "GET" &&
        (path === "" || path === "/" || path === "/ai-mentor")
      ) {
        return await handleRoot();
      }
    }

    throw new HttpError(404, "Not Found", "NOT_FOUND");
  } catch (err) {
    metrics.totalErrors++;
    const status = err instanceof HttpError ? err.status : 500;
    const code = err instanceof HttpError ? err.code : "INTERNAL";
    const message =
      err instanceof HttpError
        ? err.message
        : (err as Error).message || "Server error";

    log(status >= 500 ? "error" : "warn", "Request failed", {
      status,
      code,
      message,
      ms: since(t0),
    });

    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
