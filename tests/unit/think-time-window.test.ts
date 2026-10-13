import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THINK_TIME_SECONDS, thinkTimeBarWidth } from "@/lib/interview/think-time";

const LIB = "src/lib/interview/think-time.ts";
const PAGE = "src/app/interview/page.tsx";
const OVERLAYS = "src/components/interview/RoomOverlays.tsx";
const HEADER = "src/components/interview/RoomHeader.tsx";

const lib = readFileSync(new URL(`../../${LIB}`, import.meta.url), "utf8");
const page = readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8");
const overlays = readFileSync(new URL(`../../${OVERLAYS}`, import.meta.url), "utf8");
const header = readFileSync(new URL(`../../${HEADER}`, import.meta.url), "utf8");

/**
 * The calm-mode bar and the countdown it renders are now in different files. These
 * assertions hold them to one window: whatever `THINK_TIME_SECONDS` says, the bar
 * must start full, end empty, and never claim a share the clock does not have.
 */
describe("the think-time window has one owner", () => {
  const clock = Array.from({ length: THINK_TIME_SECONDS + 1 }, (_, i) => i);
  const widths = clock.map((s) => thinkTimeBarWidth(s));

  it("starts the bar full and closes it at zero", () => {
    expect(widths[widths.length - 1]).toBe("100%");
    expect(widths[0]).toBe("0%");
  });

  it("keeps every reading inside the window and proportional to the seconds left", () => {
    const percents = widths.map((w) => {
      expect(w, `not a CSS percentage: ${w}`).toMatch(/^\d+(\.\d+)?%$/);
      return Number.parseFloat(w);
    });
    for (const p of percents) {
      expect(p, `bar claims ${p}% with ${THINK_TIME_SECONDS}s on the clock`).toBeGreaterThanOrEqual(0);
      expect(p, `bar claims ${p}% with ${THINK_TIME_SECONDS}s on the clock`).toBeLessThanOrEqual(100);
    }
    // Ordered by seconds remaining, so the bar only ever shrinks as the clock runs.
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i], "more time left but a narrower bar").toBeGreaterThan(percents[i - 1]);
    }
  });

  it("sizes the bar by the window instead of a second copy of the number", () => {
    expect(lib).toMatch(/seconds \/ THINK_TIME_SECONDS/);
    expect(lib, "the divisor is a literal again").not.toMatch(/seconds \/ \d/);
  });

  it("arms the countdown from the same owner", () => {
    expect(page).toContain("setThinkCountdown(THINK_TIME_SECONDS)");
    // 0 and null are the "spend it now" / "cancel" sentinels; only a positive
    // number here would be a second copy of the window.
    expect(page, "a bare countdown length is back in the page").not.toMatch(/setThinkCountdown\([1-9]\d*\)/);
  });

  it("asks the owner for the width rather than computing its own", () => {
    expect(overlays).toContain("thinkTimeBarWidth(seconds)");
    expect(overlays, "the overlay grew its own denominator").not.toMatch(/\/ \d+\) \* 100/);
  });

  it("promises the candidate the window the code actually gives", () => {
    // The tooltip is the only place this number reaches a user as prose, and
    // `user-facing-numbers.test.ts` reads JSX text and never attributes, so a
    // transcribed 10 here had no owner: retune THINK_TIME_SECONDS and the button
    // goes on advertising the old buffer. Deriving it closes the gap at the source;
    // the negative half is the flip condition — a literal back in the copy reddens.
    expect(header).toContain('答题前 ${THINK_TIME_SECONDS} 秒缓冲');
    expect(header, "the tooltip restates the window as a literal again").not.toMatch(/答题前 \d+ 秒/);
  });
});
