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

import type { UIMessage } from "ai";

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
 * The one bridge from "some JSON" to a UIMessage the v7 transport reads.
 *
 * Two boundaries need it and were written independently, which is how the same
 * shape question got answered twice: POST /api/interview-chat bridged with
 * `messages as ModelMessage[]` (every real turn then died in schema validation
 * before a provider was contacted — PR #58), and the localStorage session
 * restore on /interview bridged with `snapshot.messages as never[]`, the bottom
 * type, which stops the checker looking at the value at all.
 *
 * Both inputs are untrusted *and* versioned: a snapshot was written by whatever
 * the app shipped up to 30 days ago. So the bridge is total over shape and
 * strict about the one thing it cannot derive — `role`. A part list it cannot
 * recognise is repaired into a single text part from the legacy fields, because
 * dropping a turn would silently shorten the transcript the model reads.
 */
/**
 * The roles a UIMessage can carry, owned here so the request contract and the
 * bridge cannot drift: a role this list allows but the bridge rejects would
 * pass validation and then silently lose its turn.
 */
export const UI_MESSAGE_ROLES = ["system", "user", "assistant"] as const;

function isUiRole(value: unknown): value is UIMessage["role"] {
  return typeof value === "string" && (UI_MESSAGE_ROLES as readonly string[]).includes(value);
}

function isRecognisablePart(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function toUiMessage(source: unknown, fallbackId: string): UIMessage | null {
  if (source === null || typeof source !== "object") return null;
  const raw = source as Record<string, unknown>;
  if (!isUiRole(raw.role)) return null;
  const parts =
    Array.isArray(raw.parts) && raw.parts.length > 0 && raw.parts.every(isRecognisablePart)
      ? (raw.parts as UIMessage["parts"])
      : [{ type: "text" as const, text: getMessageText(raw) }];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    role: raw.role,
    parts,
  };
}

export function toUiMessages(list: readonly unknown[]): UIMessage[] {
  const restored: UIMessage[] = [];
  list.forEach((entry, index) => {
    const message = toUiMessage(entry, `restored-${index}`);
    if (message) restored.push(message);
  });
  return restored;
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
