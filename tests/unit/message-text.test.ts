// Phase 14: v6 message text extraction (parts-first, legacy fallback).
import { describe, it, expect } from "vitest";
import { getMessageText, escapeHtml } from "../../src/lib/message-text";

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

describe("escapeHtml (Phase B2 message-card sink)", () => {
  it("neutralizes element, attribute, and script payloads", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(escapeHtml('"><svg onload=alert(1)>')).toBe("&quot;&gt;&lt;svg onload=alert(1)&gt;");
    expect(escapeHtml("it's & \"quoted\"")).toBe("it&#39;s &amp; &quot;quoted&quot;");
  });

  it("leaves plain prose byte-identical (no over-escaping)", () => {
    expect(escapeHtml("Mock answer excerpt addressing the question.")).toBe(
      "Mock answer excerpt addressing the question."
    );
    expect(escapeHtml("")).toBe("");
  });
});
