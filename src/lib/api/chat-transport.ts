import { DefaultChatTransport } from "ai";
import { quotaAwareFetch } from "./quota";

/**
 * The interview room's transport, with the allowance header wired in.
 *
 * A JSON lane records `RateLimit-Remaining` inside `readApiJson`, but a stream
 * is handed straight to the transport and never passes through that function.
 * `interview-chat` does send the header on the response that opens the stream;
 * without this wrapper the badge shows whatever an earlier JSON call left there
 * — stale in exactly the place the allowance is spent.
 *
 * Kept out of the room component on purpose: that file sits on the God-component
 * ceiling, and adding lines to it is what a ratchet is for.
 */
export function createQuotaAwareTransport(body: Record<string, unknown>) {
  return new DefaultChatTransport({
    api: "/api/interview-chat",
    fetch: quotaAwareFetch,
    body,
  });
}
