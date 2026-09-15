// Gate-hardening: OnboardingTour is a pointer-trapping first-run modal —
// it MUST stay keyboard-dismissable and screen-reader named, or it blocks
// dashboard CTAs for everyone (found via mock-journey timeout) and is
// invisible to assistive tech. Static contract in the repo's
// prohibitions/truthfulness style (no DOM needed).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const SRC = new URL("../../src/components/dashboard/OnboardingTour.tsx", import.meta.url);
const src = () => readFileSync(SRC, "utf8");

describe("OnboardingTour accessibility contract", () => {
  it('exposes role="dialog" with aria-modal and a labelled title', () => {
    const s = src();
    expect(s).toContain('role="dialog"');
    expect(s).toContain('aria-modal="true"');
    expect(s).toContain('aria-labelledby="onboarding-tour-title"');
    expect(s).toContain('id="onboarding-tour-title"');
  });

  it("icon-only close button has an accessible name", () => {
    expect(src()).toContain('aria-label="Close onboarding tour"');
  });

  it("Escape dismisses like the X button (keyboard parity)", () => {
    const s = src();
    expect(s).toContain('"Escape"');
    expect(s).toContain("removeEventListener");
  });

  it("dismissal persists the seen flag (tour never returns)", () => {
    expect(src()).toContain('localStorage.setItem("interve_has_seen_onboarding"');
  });
});
