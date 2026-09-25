// Chat message text extraction (AI SDK v6 -> v7).
//
// v6 and v7 both carry `{id, role, parts[]}` on a UIMessage — there is NO
// `.content` or `.text`. Legacy code reading those fields renders empty
// bubbles (found by the Phase 14 mock journey: valid streams, zero visible
// text). This helper is the single reader: parts first, legacy string fields
// second. Pure + unit-tested.
//
// What v7 DID change is the `onFinish` callback: it went from `onFinish(message)`
// to `onFinish(event)` with the message nested at `event.message`. That is why
// `getTextFromFinishEvent` exists — see its comment.

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

/**
 * Pull the assistant text out of a v7 `useChat` finish event.
 *
 * v7 delivers `onFinish(event)` where `event = {message, messages, isAbort,
 * isDisconnect, isError, finishReason}`. Reading the envelope itself with
 * `getMessageText` yields "" because an event has no `parts`/`content`/`text`,
 * and a call site casting to an all-optional type typechecks anyway — so TTS
 * silently spoke nothing while the UI claimed it was generating audio.
 *
 * Deliberately narrow: it does NOT also accept a bare message. Accepting both
 * shapes is the ambiguity that hid the bug; a wrong call must return "" and
 * fail a test, not work by accident.
 */
export function getTextFromFinishEvent(event: { message?: unknown } | null | undefined): string {
  if (!event || typeof event !== "object") return "";
  return getMessageText(event.message as MaybeMessage | undefined);
}

/**
 * Phase B2 (LLM10): deterministic HTML escaping for the message-card sink.
 *
 * `InterveAIResponse` renders via dangerouslySetInnerHTML (currently zero
 * call sites). Any future caller wiring LLM/echoed-user text here gets
 * escaped text, never executable markup — structure guarantees it, no
 * model or allowlist needed. Escapes &, <, >, ", ' (covers elements,
 * attributes, and script/style contexts for text-node injection).
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
