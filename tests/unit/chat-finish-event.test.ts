// R-09 guard: the chat finish callback crosses an AI SDK version boundary.
//
// v6 called `onFinish(message)`. v7 calls `onFinish(event)` where the event is
// `{message, messages, isAbort, isDisconnect, isError, finishReason}`. The
// interview page kept the v6 parameter name and handed the whole envelope to
// getMessageText, whose lookups (.parts/.content/.text) all miss on an event
// object — so TTS received "" while the UI still read "正在生成语音...".
//
// tsc cannot catch this: the call site cast to a type whose properties are all
// optional, so any object satisfies it. These tests pin the contract instead,
// including the negative case that stops anyone "fixing" it by making the
// helper accept both shapes — that ambiguity is what broke it in the first place.
import { describe, it, expect } from "vitest";
import { getTextFromFinishEvent } from "@/lib/message-text";

const message = (parts: unknown[]) => ({ id: "m1", role: "assistant", parts });

describe("getTextFromFinishEvent (v7 chat finish contract)", () => {
  it("extracts assistant text from a v7 finish event envelope", () => {
    const event = {
      message: message([{ type: "text", text: "Walk me through " }, { type: "text", text: "a project." }]),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: false,
      finishReason: "stop",
    };
    expect(getTextFromFinishEvent(event)).toBe("Walk me through a project.");
  });

  it("ignores non-text parts", () => {
    const event = {
      message: message([{ type: "tool-call", toolName: "x" }, { type: "text", text: "answer" }]),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: false,
    };
    expect(getTextFromFinishEvent(event)).toBe("answer");
  });

  // The regression, made unforgivable: a bare message is NOT an event. tsc
  // already rejects this call via weak-type detection (TS2559) — which the old
  // inline all-optional cast did not — so the cast below is deliberate, and the
  // runtime "" assertion is the second line of defence for untyped callers.
  it("returns empty for a bare message (no envelope) — the v6 call shape must not be accepted", () => {
    const bare = message([{ type: "text", text: "stale v6 shape" }]) as unknown as { message?: unknown };
    expect(getTextFromFinishEvent(bare)).toBe("");
  });

  it("is null-safe on absent input", () => {
    expect(getTextFromFinishEvent(null)).toBe("");
    expect(getTextFromFinishEvent(undefined)).toBe("");
    expect(getTextFromFinishEvent({})).toBe("");
  });
});
