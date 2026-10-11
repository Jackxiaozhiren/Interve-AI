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
import {
  InvalidMessageRoleError,
  MessageConversionError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
} from "ai";
import { logApi } from "./logging";
import { ZodError } from "zod";

export function classifyUpstreamError(e: unknown): string {
  if (NoObjectGeneratedError.isInstance(e)) return "no_object_generated";
  // The three below only appear on the streaming path, and until 2026-10-09 they
  // all collapsed into `upstream_error` — which is why an `AI_NoOutputGeneratedError`
  // reported in production logs could not be attributed to a failure mode.
  if (NoOutputGeneratedError.isInstance(e)) return "no_output_generated";
  if (MessageConversionError.isInstance(e)) return "message_conversion";
  if (InvalidMessageRoleError.isInstance(e)) return "invalid_message_role";
  // The two below are the model's *answer* failing, not the provider: routes
  // that coerce malformed output into a fallback used to log only their policy
  // token (`output_coerced`, `json_coerced`), which could not tell an unreadable
  // blob apart from a schema miss — the difference between a prompt bug and a
  // model regression.
  if (e instanceof SyntaxError) return "output_unparseable";
  if (e instanceof ZodError) return "output_schema";
  const status = (e as { statusCode?: unknown })?.statusCode;
  if (typeof status === "number" && Number.isInteger(status)) return `upstream_${status}`;
  if ((e as { name?: unknown })?.name === "AbortError") return "upstream_timeout";
  return "upstream_error";
}

/**
 * What the candidate sees when a stream dies. Fixed wording on purpose: the
 * provider's own message can quote request bytes (résumé text, the candidate's
 * answer), and this string goes into the transcript.
 */
export const STREAM_ERROR_NOTICE = "模型这一轮没有返回内容，请重试。";

/**
 * The `onError` hook for `toUIMessageStreamResponse`.
 *
 * Without it the SDK swallows the failure into a stream chunk and the route's
 * only log line — written when the Response object was built, before any token
 * arrived — reads `status: 200`. So the observability layer counted a failed
 * generation as a success, and `classifyUpstreamError` never saw the error at
 * all. This emits the terminal line the request was missing.
 */
export function streamErrorNotice(
  route: string,
  requestId: string,
  model: string
): (error: unknown) => string {
  return (error: unknown) => {
    logApi(route, {
      requestId,
      // 502 describes the upstream failure. The HTTP response itself is already
      // 200 and cannot be recalled; this line is what the dashboards count.
      status: 502,
      latencyMs: 0,
      model,
      reason: classifyUpstreamError(error),
    });
    return STREAM_ERROR_NOTICE;
  };
}
