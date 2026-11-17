// W56 / STAR-mode stage-collapse regression guard.
//
// Production geometry at 1249x720 (framework=star&stressTest=true&testMode=true,
// signed-in session) showed the left column fixed at 460px while the inline STAR
// strip reserved 225px (shrink-0) and TelemetryRow reserved 202px (shrink-0).
// Those two siblings plus two 16px gaps consumed 459px, squeezing the only
// flex-1 RoomStage to 2px: the agent spheres, waveform and composer dock were
// pushed out of the clipped stage and vanished. general mode had no strip, so
// its stage stayed 242px.
//
// Fix: collapse TelemetryRow in STAR mode (same AnimatePresence path as focus
// mode) so only one shrink-0 sibling remains, and give the stage a min-height
// floor as a second line of defence. This is a static contract test (unit tests
// run in node with no DOM); it pins the structural property so a future edit
// cannot silently reintroduce the collapse without CI noticing.
import { describe, it, expect } from "vitest";
import { readRepo } from "./repo-tree";

const interviewPage = readRepo("src/app/interview/page.tsx");
const telemetryRow = readRepo("src/components/interview/TelemetryRow.tsx");
const roomStage = readRepo("src/components/interview/RoomStage.tsx");

describe("STAR tracker / stage height (W56 collapse fix)", () => {
  it("interview page collapses TelemetryRow only in STAR mode, keyed to framework", () => {
    expect(interviewPage, "TelemetryRow call site missing").toContain("<TelemetryRow");
    expect(interviewPage, "collapsed prop not wired at call site").toMatch(
      /<TelemetryRow[\s\S]{0,200}collapsed=\{framework === 'star'\}/
    );
  });

  it("TelemetryRow accepts an explicit collapsed prop and gates its render on it", () => {
    expect(telemetryRow, "collapsed prop not declared").toMatch(/collapsed\s*=\s*false/);
    expect(telemetryRow, "collapsed type missing").toMatch(/collapsed\?:\s*boolean/);
    expect(telemetryRow, "render not gated by collapsed").toMatch(/\{!isFocusMode && !collapsed && \(/);
  });

  it("RoomStage carries a min-height floor on the framework stage so it cannot collapse to 2px", () => {
    expect(roomStage, "stage diagnostic attribute lost").toContain("data-framework={framework}");
    expect(roomStage, "stage lost its flex-1 growth").toMatch(/flex-1 min-h-\[\d+px\]/);
  });

  it("the W53 overlap fix stays intact: inline strip remains a normal-flow sibling above the stage", () => {
    expect(interviewPage, "inline STAR strip missing").toContain('<StarTracker variant="inline" />');
    const stripAt = interviewPage.indexOf('<StarTracker variant="inline" />');
    const stageAt = interviewPage.indexOf("<RoomStage");
    expect(stripAt).toBeGreaterThan(-1);
    expect(stageAt).toBeGreaterThan(-1);
    expect(stripAt, "strip must stay above the stage").toBeLessThan(stageAt);
    // Still no absolute STAR layer inside the stage.
    expect(roomStage, "STAR panel reintroduced inside the stage").not.toContain("<StarTracker");
  });
});
