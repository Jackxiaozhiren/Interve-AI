/**
 * A stream that fails after the handler returned must still say what failed.
 *
 * `POST /api/interview-chat` logged `status: 200` the moment it built the
 * response object, and passed `toUIMessageStreamResponse()` no `onError`. So a
 * generation that died mid-stream — which is what `AI_NoOutputGeneratedError`
 * is — produced exactly one log line, and that line claimed success. The audit
 * item this closes could not be attributed for the same reason the E4 pilot
 * could not: the classifier names `NoObjectGeneratedError` (the structured-output
 * routes) and nothing that only the streaming path throws, so every streaming
 * failure collapsed into the token `upstream_error`.
 *
 * Fix is two-layered on purpose: the classifier gains the streaming classes, and
 * the route gains a terminal log line. Either alone leaves a hole — a named class
 * nobody logs, or a log line that cannot name it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidMessageRoleError,
  MessageConversionError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  streamText,
} from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { readFileSync } from "node:fs";
import {
  STREAM_ERROR_NOTICE,
  classifyUpstreamError,
  streamErrorNotice,
} from "../../src/lib/api/classify-error";

// One console capture for the whole file, and one way to run a stream. Spelling
// these out per describe is how a lane accumulates duplicated lines — which is
// not a style preference here: the project's quality gate fails a PR over
// new-code duplication above 3%.
let lines: string[];
beforeEach(() => {
  lines = [];
  vi.spyOn(console, "error").mockImplementation((...args) => lines.push(String(args[0])));
  vi.spyOn(console, "log").mockImplementation((...args) => lines.push(String(args[0])));
});
afterEach(() => vi.restoreAllMocks());

/**
 * Only the lines this module writes. The SDK prints the raw provider error to
 * the server console on its own — measured here, not assumed — so a PII
 * assertion has to name its own sink rather than the whole console.
 */
const ours = () =>
  lines
    .map((l) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((j): j is Record<string, unknown> => j?.route === "interview-chat");

const modelThatThrows = (message: string, extra?: Record<string, unknown>) =>
  new MockLanguageModelV3({
    doStream: async () => {
      throw Object.assign(new Error(message), extra);
    },
  });

/** The route's exact call shape, with or without the hook under test. */
async function streamOnce(model: MockLanguageModelV3, requestId: string, hooked: boolean) {
  const result = streamText({ model, prompt: "hi", maxRetries: 0 });
  const response = result.toUIMessageStreamResponse(
    hooked ? { onError: streamErrorNotice("interview-chat", requestId, "glm-4-flash") } : undefined
  );
  return await response.text();
}

describe("the classifier names the classes the streaming route can throw", () => {
  it("distinguishes no-output from no-object", () => {
    const noOutput = new NoOutputGeneratedError({ cause: new Error("provider sent nothing") });
    expect(NoOutputGeneratedError.isInstance(noOutput), "fixture: the brand is real").toBe(true);
    expect(classifyUpstreamError(noOutput)).toBe("no_output_generated");

    const noObject = new NoObjectGeneratedError({
      cause: new Error("validation failed"),
      text: "raw",
      response: { id: "r", modelId: "m" } as never,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as never,
      finishReason: "stop" as never,
    });
    expect(classifyUpstreamError(noObject)).toBe("no_object_generated");
  });

  it("distinguishes the two message-conversion failures", () => {
    // Constructor shapes transcribed from node_modules/ai/dist/index.d.ts:7740,
    // :7751 — neither takes a `cause`, and a fixture built with one would still
    // be `isInstance`-true while naming a field the SDK never sets.
    const conversion = new MessageConversionError({
      originalMessage: { role: "user", parts: [{ type: "text", text: "answer" }] } as never,
      message: "Unsupported part type",
    });
    expect(MessageConversionError.isInstance(conversion), "fixture: the brand is real").toBe(true);
    expect(classifyUpstreamError(conversion)).toBe("message_conversion");

    const badRole = new InvalidMessageRoleError({ role: "function", message: "Invalid role" });
    expect(InvalidMessageRoleError.isInstance(badRole), "fixture: the brand is real").toBe(true);
    expect(classifyUpstreamError(badRole)).toBe("invalid_message_role");
  });

  it("emits a token, never the error's own text", () => {
    // Provider messages can echo request bytes, which here means résumé and
    // answer text. The classifier's whole contract is PII-free tokens.
    const secret = "candidate said: my phone is 13800000000";
    const err = new NoOutputGeneratedError({ cause: new Error(secret) });
    expect(classifyUpstreamError(err)).not.toMatch(/138|candidate|phone/);
    expect(classifyUpstreamError(err)).toMatch(/^[a-z_0-9]+$/);
  });
});

describe("the stream's terminal log line", () => {
  it("records one warn-level line with the reason and the requestId", () => {
    streamErrorNotice("interview-chat", "req-7", "glm-4-flash")(
      new NoOutputGeneratedError({ cause: new Error("empty completion") })
    );

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      route: "interview-chat",
      requestId: "req-7",
      status: 502,
      reason: "no_output_generated",
      model: "glm-4-flash",
    });
  });

  it("tells the client a fixed sentence that contains no provider detail", () => {
    const returned = streamErrorNotice("interview-chat", "req-8", "glm-4-flash")(
      new Error("429 too many requests from open.bigmodel.cn for key sk-abc123")
    );
    expect(returned).toBe(STREAM_ERROR_NOTICE);
    expect(returned).not.toMatch(/open\.bigmodel|sk-|429|glm/);
    expect(STREAM_ERROR_NOTICE.length).toBeGreaterThan(8);
  });

  it("classifies a timeout distinctly, because that one is retryable by the user", () => {
    streamErrorNotice("interview-chat", "req-9", "glm-4-flash")(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );
    expect(JSON.parse(lines[0]).reason).toBe("upstream_timeout");
  });
});

describe("the hook fires for real, on a stream that dies", () => {
  // Source-shape assertions at the bottom of this file prove the wiring is
  // present; these prove it works, against the SDK's own mock model and with no
  // API key — a stream that fails, and a completion that yields nothing.

  it("logs the failure and puts only the fixed sentence on the wire", async () => {
    const secret = "HTTP error 429 from open.bigmodel.cn for key sk-abc123def456";
    const body = await streamOnce(modelThatThrows(secret, { statusCode: 429 }), "req-live", true);

    // 1. Exactly one terminal line, and it carries a token instead of text.
    const logged = ours();
    expect(logged, `expected one line, got: ${JSON.stringify(logged)}`).toHaveLength(1);
    expect(logged[0]).toMatchObject({ status: 502, requestId: "req-live", model: "glm-4-flash" });
    expect(logged[0].reason).toBe("upstream_429");

    // 2. The candidate sees the notice and nothing else.
    expect(body).toContain(STREAM_ERROR_NOTICE);

    // 3. Our log line and the transcript carry no provider bytes.
    expect(JSON.stringify(logged)).not.toMatch(/sk-abc123|bigmodel|HTTP error/);
    expect(body).not.toMatch(/sk-abc123|bigmodel|HTTP error/);
  });

  it("names a completion that produced no output", async () => {
    // The audit item this lane closes was an `AI_NoOutputGeneratedError`, so the
    // token has to survive the real streaming path, not just the fixture.
    const empty = new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      }),
    });
    await streamOnce(empty, "req-empty", true);

    const logged = ours();
    expect(logged, "an empty completion must be reported, not counted as a success").toHaveLength(1);
    expect(logged[0].reason).toBe("no_output_generated");
  });

  it("control: without onError the same failure logs nothing at all", async () => {
    // Without this, the test above could be proving that the line is emitted by
    // something other than the hook.
    await streamOnce(modelThatThrows("provider gave up"), "req-none", false);
    expect(ours()).toEqual([]);
  });
});

describe("the route actually wires it", () => {
  const route = readFileSync(
    new URL("../../src/app/api/interview-chat/route.ts", import.meta.url),
    "utf8"
  );

  it("reports the error on both the primary and the fallback stream", () => {
    const withHandler = [...route.matchAll(/toUIMessageStreamResponse\(\{\s*onError:/g)].length;
    const total = [...route.matchAll(/toUIMessageStreamResponse\(/g)].length;
    expect(total, "the route stopped building a UI stream response").toBe(2);
    expect(withHandler, "a stream without onError logs success and nothing else").toBe(2);
  });

  it("names the reason when the first model call fails and the fallback takes over", () => {
    // The primary `catch {}` discarded the error, so the fallback line could not
    // say why it happened; every fallback looked like a random 200.
    expect(route).toMatch(/catch \(primaryError\)[\s\S]{0,400}reason: classifyUpstreamError\(primaryError\)/);
    expect(route).not.toMatch(/\}\s*catch\s*\{\s*\n\s*logApi\(ROUTE, \{ requestId, status: 200/);
  });
});
