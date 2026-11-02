import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Two gates stand between a candidate and the room, and both used to be one-way.
 *
 * The Green Room and the standby card each fill the screen (`inset-0`, z-50), so
 * the end-interview control in the transcript panel is behind them; before this,
 * changing your mind meant the browser's back button. The browser proof is in
 * tests/e2e/interview-greenroom.spec.ts — this file is the wiring check that
 * survives a refactor of that spec: an exit control that is rendered but not
 * connected is the exact failure a component test would miss without a DOM
 * harness, and this repo has none (unit tests read source, the browser spec
 * presses the button).
 */

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const EXIT_LABEL = "先不面试，返回控制台";

const GREEN_ROOM = "src/components/interview/GreenRoom.tsx";
const STANDBY = "src/components/interview/StandbyOverlay.tsx";
const ROOM_PAGE = "src/app/interview/page.tsx";

describe("the room can be left before it starts", () => {
  it("the Green Room renders an exit wired to its own handler", () => {
    const src = read(GREEN_ROOM);
    expect(src).toContain("onExit: () => void");
    expect(src).toContain("onClick={onExit}");
    expect(src).toContain(EXIT_LABEL);
  });

  it("the standby card renders the same exit, under the start button", () => {
    const src = read(STANDBY);
    expect(src).toContain("onExit: () => void");
    expect(src).toContain("onClick={onExit}");
    expect(src).toContain(EXIT_LABEL);
    // The start CTA owns the eye; the exit is a way out, not a second invitation.
    expect(src.indexOf(EXIT_LABEL)).toBeGreaterThan(src.indexOf("开始面试"));
  });

  it("the page connects both gates to the same destination", () => {
    const src = read(ROOM_PAGE);
    const wired = src.match(/onExit=\{\(\) => router\.push\("\/dashboard"\)\}/g) ?? [];
    expect(wired).toHaveLength(2);
  });

  it("the exit says where it goes, in the room's own words", () => {
    // "返回控制台" is the wording every other report surface uses for the same
    // destination; an exit that says "取消" leaves the reader guessing.
    expect(read(GREEN_ROOM)).toContain("返回控制台");
    expect(read(STANDBY)).toContain("返回控制台");
  });
});
