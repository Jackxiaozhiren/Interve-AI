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
import ts from "typescript";
import { getTextFromFinishEvent } from "@/lib/message-text";
import { readRepo } from "./repo-tree";

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

/**
 * The call-site half of R-09, which nothing held.
 *
 * The helper above was pinned; the `onFinish` handler that feeds it was not, and
 * the probe whose whole job was to notice exactly that reported a clean zero —
 * its test side was a regex over the corpus, so this file's header comment
 * ("v7 calls `onFinish(event)`") read as the test that named the callback. A
 * v8 signature change would have been caught by nothing again.
 *
 * So the contract is read off the page's parse tree: the handler takes the
 * envelope v7 hands it, passes that envelope whole to the helper, and speaks the
 * text the helper returned. Forged samples drive the same predicate so the shape
 * of a regression is demonstrated, not assumed.
 */
describe("the interview page's onFinish handler (call-site contract)", () => {
  type Contract = {
    handlers: number;
    params: number;
    forwardsWholeEnvelope: boolean;
    extractedTextIsUsed: boolean;
  };

  function finishContract(sourceText: string): Contract {
    const sourceFile = ts.createSourceFile("page.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const handlers: ts.ArrowFunction[] = [];
    const collect = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "onFinish" &&
        ts.isArrowFunction(node.initializer)
      ) {
        handlers.push(node.initializer);
      }
      ts.forEachChild(node, collect);
    };
    ts.forEachChild(sourceFile, collect);

    const [handler] = handlers;
    const param0 = handler?.parameters[0];
    const firstParam = param0 && ts.isIdentifier(param0.name) ? param0.name.text : null;
    let extractedName: string | null = null;
    let forwardedWhole = false;
    const usesExtracted: boolean[] = [];
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "getTextFromFinishEvent") {
        const arg = node.arguments[0];
        if (firstParam && ts.isIdentifier(arg) && arg.text === firstParam) forwardedWhole = true;
        const holder = node.parent;
        if (holder && ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) extractedName = holder.name.text;
      }
      if (
        extractedName &&
        ts.isIdentifier(node) &&
        node.text === extractedName &&
        !(node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name === node)
      ) {
        usesExtracted.push(true);
      }
      ts.forEachChild(node, walk);
    };
    if (handler) walk(handler);

    return {
      handlers: handlers.length,
      params: handler ? handler.parameters.length : -1,
      forwardsWholeEnvelope: forwardedWhole,
      extractedTextIsUsed: usesExtracted.length > 0,
    };
  }

  const CLEAN = {
    handlers: 1,
    params: 1,
    forwardsWholeEnvelope: true,
    extractedTextIsUsed: true,
  };

  it("keeps the real onFinish wired to the envelope", () => {
    expect(finishContract(readRepo("src/app/interview/page.tsx"))).toEqual(CLEAN);
  });

  it("rejects the v6 shape it exists to catch", () => {
    // Three ways the same bug arrives, each run through the shipped predicate.
    // The second is the subtle one: reading `event.message` looks like it
    // unwraps the envelope, and the helper answers "" to a bare message.
    expect(
      finishContract(`const c = useChat({ onFinish: (message) => speak(getMessageText(message)) });`)
    ).toEqual({ handlers: 1, params: 1, forwardsWholeEnvelope: false, extractedTextIsUsed: false });

    expect(
      finishContract(`const c = useChat({ onFinish: (event) => {
        const t = getTextFromFinishEvent(event.message);
        new SpeechSynthesisUtterance(t);
      } });`)
    ).toEqual({ handlers: 1, params: 1, forwardsWholeEnvelope: false, extractedTextIsUsed: true });

    expect(
      finishContract(`const c = useChat({ onFinish: (event) => {
        const t = getTextFromFinishEvent(event);
        speak("the transcript is ready");
      } });`)
    ).toEqual({ handlers: 1, params: 1, forwardsWholeEnvelope: true, extractedTextIsUsed: false });
  });

  it("counts every handler it is shown", () => {
    // Denominator proof: the clean fixture above is clean because one handler is
    // wired and read. Two of them is a fork, not coverage, and a predicate that
    // always reported 1 would never see it.
    expect(
      finishContract(`const a = useChat({ onFinish: (event) => {
        const t = getTextFromFinishEvent(event);
        speak(t);
      } });
      const b = { onFinish: (event) => { const t = getTextFromFinishEvent(event); speak(t); } };`)
    ).toEqual({ ...CLEAN, handlers: 2 });
    expect(finishContract(`const c = useChat({ onFinish: () => {} });`)).toEqual({
      handlers: 1,
      params: 0,
      forwardsWholeEnvelope: false,
      extractedTextIsUsed: false,
    });
  });
});
