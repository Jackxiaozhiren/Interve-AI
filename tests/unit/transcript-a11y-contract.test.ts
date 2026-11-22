/**
 * The interview transcript's user-visible contract, kept intact across the move.
 *
 * `src/app/interview/page.tsx` shed its conversation column into
 * `InterviewTranscript.tsx` to get off the God-component ceiling. A move like
 * that is invisible to the test suite — nothing asserts the live-region role, the
 * action buttons' accessible names, or which key the message list uses — so those
 * are asserted here.
 *
 * The key rule is not pedantry: while writing the component I transcribed
 * `key={m.id}` as `key={idx}`, which would have made every list mutation reuse a
 * DOM node belonging to a different message. tsc, eslint, the build and four
 * browser lanes all accepted it. Only an assertion on the key can fail it.
 *
 * A second hop has since appeared (page -> TranscriptPanel -> this component), so
 * the render-site counts below are taken over both outer layers, not the page alone.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COMPONENT = "src/components/interview/InterviewTranscript.tsx";
const PANEL = "src/components/interview/TranscriptPanel.tsx";
const PAGE = "src/app/interview/page.tsx";

const component = readFileSync(new URL(`../../${COMPONENT}`, import.meta.url), "utf8");
const panel = readFileSync(new URL(`../../${PANEL}`, import.meta.url), "utf8");
// S4 (2026-11-22): the room's JSX moved verbatim into the view component; the
// assertions below span page + view so they keep binding wherever the element
// lives. Behaviour is unchanged — this is the same markup, one file over.
const page = readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8");
// S4: the room's JSX (and the endRef handoff) moved into the view component.
const pageOrView =
  page + readFileSync(new URL(`../../src/components/interview/room/RoomView.tsx`, import.meta.url), "utf8");

describe("the transcript keeps its accessibility contract", () => {
  it("is still a single live region", () => {
    expect(component).toMatch(/role="log"/);
    expect(component).toMatch(/aria-live="polite"/);
    expect(component).toMatch(/aria-atomic="false"/);
  });

  it("names every message action accessibly", () => {
    for (const title of ["复制", "重新生成", "删除消息"]) {
      expect(component, `action title "${title}" lost`).toContain(`title="${title}"`);
    }
    // Regenerate is conditional on being the last message; if that gate is lost
    // every message grows a button it should not have. Assert the gate itself —
    // the identifier alone survives deleting the `{… && (` wrapper.
    expect(component).toContain("{isLastMessage && (");
  });

  it("keeps the empty state the candidate sees before their first answer", () => {
    expect(component).toContain("长按麦克风或输入文本以开始面试");
    expect(component).toMatch(/messages\.length === 0/);
  });

  it("keys messages by their own id, never by position", () => {
    expect(component).toMatch(/key=\{m\.id\}/);
    expect(component).not.toMatch(/key=\{idx\}/);
  });

  it("leaves exactly one transcript in the room, and it is the component", () => {
    // The room is now composed over two layers (page -> TranscriptPanel), so the
    // "exactly one" claim has to be counted across both: a second <InterviewTranscript
    // in the page, or a hand-rolled log region in either layer, is the regression.
    // S4: the render site now lives in the view component, so page+view is the
    // outer layer that must hold exactly one — a second copy injected into
    // either half is the regression this counts.
    const rendered = [pageOrView, panel].map((src) => (src.match(/<InterviewTranscript\b/g) || []).length);
    expect(rendered.reduce((a, b) => a + b, 0), "transcript render sites").toBe(1);
    for (const [name, src] of [["page+view", pageOrView], ["panel", panel]] as const) {
      expect(src, `${name} re-implemented the live region`).not.toMatch(/role="log"/);
      expect(src, `${name} grew a second copilot panel`).not.toMatch(/<CopilotPanel/);
    }
  });

  it("still hands the scroll anchor to the component rather than duplicating it", () => {
    expect(component).toMatch(/ref=\{endRef\}/);
    const wired = [pageOrView, panel].map((src) => (src.match(/endRef=\{messagesEndRef\}/g) || []).length);
    expect(wired.reduce((a, b) => a + b, 0), "endRef wiring sites").toBe(1);
    // Counted over page + view together: the anchor is declared once and passed
    // through one view model. Six references across two files is the same one
    // handoff this assertion has always measured.
    expect((pageOrView.match(/messagesEndRef/g) || []).length).toBeLessThanOrEqual(7);
  });
});
