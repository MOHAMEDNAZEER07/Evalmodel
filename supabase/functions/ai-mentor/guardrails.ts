// guardrails.ts – Content policy guardrails
// deno-lint-ignore-file

import { log } from "./logger.ts";

interface ChatMessage {
  role: string;
  content: string;
}

export function enforceGuards(
  context: Record<string, unknown>,
  messages: ChatMessage[],
): void {
  const mode =
    context?.page === "insights" && context?.insightType === "model"
      ? "model"
      : context?.page === "insights"
        ? "dataset"
        : "general";

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
        "sklearn code",
      ];
      for (const token of disallowed) {
        if (q.includes(token)) {
          log("info", "Guardrail flagged a coding request in insights mode", { token });
          break;
        }
      }
    }
  }
}
