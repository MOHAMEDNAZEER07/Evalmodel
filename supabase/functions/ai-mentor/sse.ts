// sse.ts – SSE encoding helpers and Gemini → OpenAI stream transform
// deno-lint-ignore-file

import { CONFIG } from "./config.ts";
import { log } from "./logger.ts";

// ─── Encoding helpers ────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sseFormat(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function sseEvent(name: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sseText(text: string): Uint8Array {
  return encoder.encode(text);
}

// ─── Gemini SSE → OpenAI-compatible stream transform ─────────────────────────

export async function pipeGeminiToOpenAI(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writable: WritableStreamDefaultWriter<Uint8Array>,
  requestId: string,
): Promise<void> {
  let buffer = "";
  let lastWrite = Date.now();

  const keepAlive = setInterval(async () => {
    try {
      await writable.write(sseText(`: keepalive ${Date.now()}\n\n`));
      lastWrite = Date.now();
    } catch (_e) {
      clearInterval(keepAlive);
    }
  }, CONFIG.SSE_KEEPALIVE_MS);

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
          if (text) {
            const delta = {
              choices: [
                { delta: { content: text }, index: 0, finish_reason: null },
              ],
            };
            await writable.write(sseFormat(delta));
            lastWrite = Date.now();
          }
        } catch (e) {
          log("warn", "Failed to parse upstream SSE line", {
            requestId,
            lineSnippet: line.slice(0, 200),
            error: (e as Error).message,
          });
        }
      }
    }
  } finally {
    clearInterval(keepAlive);
  }

  await writable.write(sseText("data: [DONE]\n\n"));
  await writable.close();
}
