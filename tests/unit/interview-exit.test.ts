import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Two gates stand between a candidate and the room, and both used to be one-way.
 *
 * The Green Room and the standby card each fill the screen (`inset-0`, z-50), so
 * the end-interview control in the transcript panel is behind them; before this,
 * changing your mind meant the browser's back button. The browser proof is in
 * tests/e2e/interview-exit.spec.ts — this file is the wiring check that
 * survives a refactor of that spec: an exit control that is rendered but not
 * connected is the exact failure a component test would miss without a DOM
 * harness, and this repo has none (unit tests read source, the browser spec
 * presses the button).
 */

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const BUTTON = "src/components/interview/LeaveRoomButton.tsx";
const GATES = ["src/components/interview/GreenRoom.tsx", "src/components/interview/StandbyOverlay.tsx"];
const ROOM_PAGE = "src/app/interview/page.tsx";

describe("the room can be left before it starts", () => {
  it("one control owns the words and the handler", () => {
    const src = read(BUTTON);
    expect(src).toContain("onClick={onExit}");
    expect(src).toContain("先不面试，返回控制台");
  });

  it.each(GATES)("%s renders that control and passes its own handler", (gate) => {
    const src = read(gate);
    expect(src).toContain("onExit: () => void");
    expect(src).toContain("<LeaveRoomButton onExit={onExit} />");
    // A gate that re-types the label is a gate that can drift from the other one.
    expect(src).not.toContain("先不面试，返回控制台");
  });

  it("the page connects both gates to the same destination", () => {
    const wired = read(ROOM_PAGE).match(/onExit=\{\(\) => router\.push\("\/dashboard"\)\}/g) ?? [];
    expect(wired).toHaveLength(2);
  });

  it("the standby exit sits under the start CTA, not beside it", () => {
    const src = read(GATES[1]);
    expect(src.indexOf("<LeaveRoomButton")).toBeGreaterThan(src.indexOf("开始面试"));
  });
});
