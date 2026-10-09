/**
 * The single bridge from "some JSON" to a UIMessage the v7 transport accepts.
 *
 * Two boundaries need it and both were written without the other in mind:
 *   - POST /api/interview-chat, whose `messages as ModelMessage[]` cast made
 *     every real turn die in schema validation before a provider was contacted
 *     (reproduced keyless in PR #58);
 *   - the localStorage session restore on /interview, which bridged with
 *     `snapshot.messages as never[]` — the bottom type, so the checker stopped
 *     looking at the value entirely.
 * A snapshot is written by whatever the app shipped up to 30 days ago and read
 * by today's transport, so neither boundary may answer a shape question with a
 * type assertion. This is the one place that decides the shape.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_MESSAGE_ROLES, toUiMessages } from "../../src/lib/message-text";

/** The singular form is private; every caller goes through a list. */
const one = (source: unknown) => toUiMessages([source])[0] ?? null;

describe("parts survive the bridge", () => {
  it("keeps id, role and the original parts array", () => {
    const parts = [
      { type: "text", text: "Why did you choose " },
      { type: "text", text: "a queue?" },
    ];
    const out = one({ id: "m1", role: "assistant", parts });
    expect(out).toMatchObject({ id: "m1", role: "assistant" });
    expect(out?.parts).toEqual(parts);
  });

  it("keeps non-text parts (reasoning, files) rather than flattening them", () => {
    const out = one({
      id: "m2",
      role: "assistant",
      parts: [{ type: "reasoning", text: "hmm" }, { type: "text", text: "ok" }],
    });
    expect(out?.parts).toHaveLength(2);
  });
});

describe("a message with no usable parts gets one", () => {
  it("derives a text part from the legacy content field", () => {
    expect(one({ id: "greeting", role: "assistant", content: "您好" })?.parts).toEqual([
      { type: "text", text: "您好" },
    ]);
  });

  it("derives from text when content is absent", () => {
    expect(one({ id: "x", role: "user", text: "old" })?.parts).toEqual([
      { type: "text", text: "old" },
    ]);
  });

  it("repairs a parts array that holds junk instead of parts", () => {
    // `parts: ["stray"]` is what a hand-built message looks like when someone
    // confuses a part list with a word list. Restoring it would render an empty
    // bubble forever, so the text field wins.
    expect(one({ id: "y", role: "user", parts: ["stray"], content: "real" })?.parts).toEqual([
      { type: "text", text: "real" },
    ]);
  });

  it("still yields a total message when there is no text anywhere", () => {
    // Dropping the turn would silently shorten the transcript the model reads;
    // an empty text part is visible and countable.
    expect(one({ id: "z", role: "user" })?.parts).toEqual([{ type: "text", text: "" }]);
  });
});

describe("role is the one field the bridge will not invent", () => {
  it("rejects a role the transport cannot carry", () => {
    expect(one({ id: "a", role: "function", content: "x" })).toBeNull();
    expect(one({ id: "b", content: "x" })).toBeNull();
    expect(one({ id: "c", role: 42, content: "x" })).toBeNull();
  });

  it("rejects non-objects, including the null an array hole deserialises to", () => {
    expect(one(null)).toBeNull();
    expect(one("string")).toBeNull();
    expect(one(undefined)).toBeNull();
  });

  it("accepts exactly the roles the request contract names", () => {
    for (const role of UI_MESSAGE_ROLES) {
      expect(one({ id: "r", role, content: "t" })?.role).toBe(role);
    }
    expect(UI_MESSAGE_ROLES).toEqual(["system", "user", "assistant"]);
  });
});

describe("toUiMessages — the restore boundary", () => {
  it("preserves order and count for a healthy transcript", () => {
    const list = [
      { id: "1", role: "user", parts: [{ type: "text", text: "q" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "a" }] },
    ];
    expect(toUiMessages(list).map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("gives an id to a message that has none, deterministically", () => {
    const first = toUiMessages([{ role: "user", content: "no id" }]);
    expect(first[0]?.id).toBeTruthy();
    expect(toUiMessages([{ role: "user", content: "no id" }])[0]?.id).toBe(first[0]?.id);
  });

  it("drops corrupt entries without dropping their neighbours", () => {
    const out = toUiMessages([
      { id: "1", role: "user", parts: [{ type: "text", text: "keep" }] },
      null,
      "junk",
      { role: "nonsense", content: "x" },
      { id: "5", role: "assistant", parts: [{ type: "text", text: "keep" }] },
    ]);
    expect(out.map((m) => m.id)).toEqual(["1", "5"]);
  });

  it("compiles against the signature useChat's setMessages expects", () => {
    // The typecheck gate is the assertion: `as never[]` was only ever needed
    // because the bridge handed back unknown[].
    const accept: (messages: import("ai").UIMessage[]) => number = (m) => m.length;
    expect(accept(toUiMessages([{ id: "1", role: "user", content: "x" }]))).toBe(1);
  });
});

describe("both boundaries actually call it", () => {
  const read = (file: string) =>
    readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

  it("restores a session through the bridge instead of an assertion", () => {
    const page = read("src/app/interview/page.tsx");
    expect(page).toMatch(/setMessages\(\s*toUiMessages\(snapshot\.messages\)\s*\)/);
  });

  it("converts the request transcript through the bridge", () => {
    const route = read("src/app/api/interview-chat/route.ts");
    expect(route).toMatch(/const recentUi = toUiMessages\(/);
    // A second local adapter would let the two boundaries drift again, which is
    // the exact shape of the PR #58 bug.
    expect(route).not.toMatch(/function toUiMessage/);
  });
});
