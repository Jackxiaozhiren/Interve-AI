// W53 / STAR-mode layout overlap regression guard.
//
// The room used to render <StarTracker /> as an `absolute top-6 left-6` layer
// inside RoomStage's `relative` stage, sharing the box with the three agent
// spheres (a centred flex row) and the `absolute bottom-8` controls dock. With
// limited vertical height — reproduced in production at 1249x720 under
// `framework=star&stressTest=true` — the layers collided and the STAR panel
// covered the spheres, the connecting line and the dock, making the stage
// unreadable. The fix moves the tracker into a normal-flow `shrink-0` strip in
// the interview page's left column, above the `flex-1` stage. Two blocks in
// normal flow cannot overlap regardless of viewport height.
//
// This is a static contract test (the repo runs unit tests in `node` with no
// DOM). It pins the structural property that caused the bug, so a future edit
// that reintroduces an absolute STAR layer inside the stage fails CI.
import { describe, it, expect } from "vitest";
import { readRepo } from "./repo-tree";

const roomStage = readRepo("src/components/interview/RoomStage.tsx");
const interviewPage = readRepo("src/app/interview/page.tsx");
const starTracker = readRepo("src/components/interview/StarTracker.tsx");
const copilotPanel = readRepo("src/components/interview/CopilotPanel.tsx");

describe("STAR tracker / agent-sphere layout (W53 overlap fix)", () => {
  it("RoomStage no longer imports or renders StarTracker as a stage layer", () => {
    expect(roomStage, "stale StarTracker import in RoomStage").not.toMatch(/import\s*\{[^}]*StarTracker/);
    expect(roomStage, "STAR panel reintroduced inside the stage").not.toContain("<StarTracker");
  });

  it("RoomStage's stage box still carries framework for diagnostics, with no absolute STAR layer", () => {
    expect(roomStage).toContain("data-framework={framework}");
    // The stage must not wrap the tracker in an absolute inset-0 layer again.
    expect(roomStage, "absolute inset-0 tracker wrapper returned").not.toMatch(/absolute inset-0[\s\S]{0,200}StarTracker/);
    expect(roomStage, "tracker wrapper returned").not.toMatch(/StarTracker[\s\S]{0,200}absolute inset-0/);
  });

  it("interview page renders STAR as a normal-flow strip above the flex-1 stage", () => {
    expect(interviewPage, "inline STAR strip missing").toContain('<StarTracker variant="inline" />');
    expect(interviewPage, "strip lost its shrink-0 reservation").toMatch(/shrink-0[\s\S]{0,120}<StarTracker variant="inline"/);
    // The strip must sit before the stage in source order (above it on screen).
    const stripAt = interviewPage.indexOf('<StarTracker variant="inline" />');
    const stageAt = interviewPage.indexOf("<RoomStage");
    expect(stripAt, "strip not found").toBeGreaterThan(-1);
    expect(stageAt, "stage not found").toBeGreaterThan(-1);
    expect(stripAt, "STAR strip must be above the stage").toBeLessThan(stageAt);
    // Gated to the same condition as before, so non-STAR modes render nothing new.
    expect(interviewPage).toMatch(/!isFocusMode && framework === 'star'[\s\S]{0,200}StarTracker variant="inline"/);
  });

  it("StarTracker keeps both variants: floating absolute for CopilotPanel, inline relative for the room", () => {
    // The default variant must stay absolute — CopilotPanel relies on it.
    expect(starTracker, "default variant changed").toContain('variant = "floating"');
    expect(starTracker, "floating absolute positioning lost").toContain('"absolute top-6 left-6 z-20 min-w-[280px] p-4 gap-4"');
    // The inline variant must be relative so it occupies a real row.
    expect(starTracker, "inline relative positioning lost").toContain('"relative w-full p-3 gap-2"');
    expect(starTracker, "inline variant branch missing").toContain('variant === "inline"');
  });

  it("CopilotPanel still uses the default floating StarTracker (unchanged behaviour)", () => {
    expect(copilotPanel, "CopilotPanel's tracker call changed").toContain("<StarTracker />");
  });
});
