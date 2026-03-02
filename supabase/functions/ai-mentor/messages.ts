// messages.ts – Gemini message formatting
// deno-lint-ignore-file

interface ChatMessage {
  role: string;
  content: string;
}

interface GeminiMessage {
  role: string;
  parts: { text: string }[];
}

export function toGeminiMessages(
  systemPrompt: string,
  acknowledgment: string,
  messages: ChatMessage[],
): GeminiMessage[] {
  const formatted: GeminiMessage[] = [];

  formatted.push({ role: "user", parts: [{ text: systemPrompt }] });
  formatted.push({ role: "model", parts: [{ text: acknowledgment }] });

  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : m.role;
    formatted.push({ role, parts: [{ text: m.content }] });
  }

  return formatted;
}
