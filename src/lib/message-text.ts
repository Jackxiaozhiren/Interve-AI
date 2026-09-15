// AI SDK v6 message text extraction.
//
// v6 UIMessage carries `{id, role, parts[]}` — there is NO `.content` or
// `.text`. Legacy code reading those fields renders empty bubbles (found by
// the Phase 14 mock journey: valid streams, zero visible text). This helper
// is the single reader: v6 parts first, legacy string fields second.
// Pure + unit-tested.

interface MaybePart {
  type?: unknown;
  text?: unknown;
}

interface MaybeMessage {
  parts?: unknown;
  content?: unknown;
  text?: unknown;
}

export function getMessageText(msg: MaybeMessage | null | undefined): string {
  if (!msg || typeof msg !== "object") return "";
  if (Array.isArray(msg.parts)) {
    const text = (msg.parts as MaybePart[])
      .filter((p) => p !== null && typeof p === "object" && p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    if (text) return text;
  }
  if (typeof msg.content === "string" && msg.content) return msg.content;
  if (typeof msg.text === "string" && msg.text) return msg.text;
  return "";
}
