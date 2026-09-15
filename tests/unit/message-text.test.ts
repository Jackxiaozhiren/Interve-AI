// Phase 14: v6 message text extraction (parts-first, legacy fallback).
import { describe, it, expect } from "vitest";
import { getMessageText } from "../../src/lib/message-text";

describe("getMessageText", () => {
  it("reads v6 parts", () => {
    expect(
      getMessageText({ parts: [{ type: "text", text: "hello " }, { type: "text", text: "world" }] })
    ).toBe("hello world");
  });

  it("ignores non-text parts", () => {
    expect(
      getMessageText({ parts: [{ type: "reasoning", text: "hmm" }, { type: "text", text: "ok" }] })
    ).toBe("ok");
  });

  it("falls back to legacy content/text fields", () => {
    expect(getMessageText({ content: "legacy" })).toBe("legacy");
    expect(getMessageText({ text: "old" })).toBe("old");
    expect(getMessageText({ parts: [], content: "c" })).toBe("c");
  });

  it("returns empty string on garbage", () => {
    expect(getMessageText(null)).toBe("");
    expect(getMessageText(undefined)).toBe("");
    expect(getMessageText({})).toBe("");
    expect(getMessageText({ parts: [{ type: "tool", text: 1 }] })).toBe("");
  });
});
