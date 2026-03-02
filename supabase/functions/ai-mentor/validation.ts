// validation.ts – Lightweight schema validation (no external deps)
// deno-lint-ignore-file

import { HttpError } from "./errors.ts";

export function isObject(o: unknown): o is Record<string, unknown> {
  return typeof o === "object" && o !== null && !Array.isArray(o);
}

export interface ValidatedPayload {
  messages: { role: string; content: string }[];
  context: Record<string, unknown>;
}

export function validatePayload(raw: unknown): ValidatedPayload {
  if (!isObject(raw))
    throw new HttpError(400, "Body must be a JSON object", "BAD_BODY");

  const out: ValidatedPayload = { messages: [], context: {} };

  if (raw.messages !== undefined) {
    if (!Array.isArray(raw.messages))
      throw new HttpError(400, "messages must be an array", "BAD_MESSAGES");

    out.messages = (raw.messages as unknown[]).map((m, i) => {
      if (!isObject(m))
        throw new HttpError(400, `messages[${i}] must be object`, "BAD_MESSAGES");
      const role = (m.role as string) ?? "user";
      const content = String(m.content ?? "");
      if (!content)
        throw new HttpError(400, `messages[${i}].content required`, "BAD_CONTENT");
      return { role, content };
    });
  }

  if (raw.context !== undefined) {
    if (!isObject(raw.context))
      throw new HttpError(400, "context must be an object", "BAD_CONTEXT");
    out.context = raw.context as Record<string, unknown>;
  }

  return out;
}
