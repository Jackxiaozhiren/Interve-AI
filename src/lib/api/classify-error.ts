// Upstream-error classifier (E4 MVVP follow-up, server-only).
//
// Lesson from the E4 pilot: every AI route logged bare `upstream_error`,
// so generation failures (model output unvalidatable) were indistinguishable
// from provider failures (429/500/timeout) without burning more keyed calls
// to re-attribute. This maps unknown throws to PII-free reason tokens:
// class + numeric status only — never error text (may echo prompt bytes).
// Client responses stay generic; only the server log gains resolution.
//
// Server-only: imports the AI SDK error brand. Never import from client
// components (the "ai" package must stay out of the browser bundle).
import { NoObjectGeneratedError } from "ai";

export function classifyUpstreamError(e: unknown): string {
  if (NoObjectGeneratedError.isInstance(e)) return "no_object_generated";
  const status = (e as { statusCode?: unknown })?.statusCode;
  if (typeof status === "number" && Number.isInteger(status)) return `upstream_${status}`;
  if ((e as { name?: unknown })?.name === "AbortError") return "upstream_timeout";
  return "upstream_error";
}
