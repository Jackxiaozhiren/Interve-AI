/**
 * S2 layering contract (§12.13 S2 criteria ① and ③, §12.10 architecture).
 *
 * Three layers with one-way references: domain → pattern → primitive.
 *
 *  - primitives/: base controls. Must not import patterns, domains, or
 *    business components. (Today the physical implementations live in ui/ —
 *    §12.10's "同名只允许一份实现" forbids a second copy, and the primitives
 *    barrel is the boundary. The contract below follows imports, not folders.)
 *  - patterns/: compositions of primitives. May import primitives; must not
 *    import domain directories.
 *  - domains (interview/dashboard/setup/evaluation/chat/home/auth/data/
 *    layout/recruiter/app): may import primitives and patterns; must not
 *    import another domain's internals (own-directory imports are fine).
 *
 * Criterion ① reads as "the library is adopted": business files (everything
 * under src/app plus domain components) that render an interactive control
 * import the library — interve-ui, ui, primitives, or patterns — rather than
 * hand-rolling. The numerator/denominator mirror §12.13's "当前 8/81".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

const LIBRARY = /components\/(interve-ui|ui|primitives|patterns)/;
const DOMAIN_DIRS = [
  "src/components/interview",
  "src/components/dashboard",
  "src/components/setup",
  "src/components/evaluation",
  "src/components/chat",
  "src/components/home",
  "src/components/auth",
  "src/components/data",
  "src/components/layout",
];

const domainOf = (rel: string) => DOMAIN_DIRS.find((d) => rel.startsWith(d + "/"));

describe("S2: component layering", () => {
  it("primitives barrel never imports patterns or domain components", () => {
    const src = read("src/components/primitives/index.ts");
    expect(src).not.toMatch(/components\/(patterns|interview|dashboard|setup|evaluation|chat|home|auth|data|layout)\b/);
  });

  it("patterns never import domain components or each other's business logic", () => {
    for (const f of walkRepo("src/components/patterns", (r) => r.endsWith(".tsx") || r.endsWith(".ts"))) {
      const src = read(f);
      const bad = src.match(/from\s+["']@?\/?[^"']*components\/(interview|dashboard|setup|evaluation|chat|home|auth|layout)\/[^"']+["']/g);
      expect(bad, `${f} reaches into a domain`).toBeNull();
    }
  });

  it("domain components never import another domain's internals", () => {
    const cross: string[] = [];
    for (const f of walkRepo("src/components", (r) => r.endsWith(".tsx"))) {
      const own = domainOf(f);
      if (!own) continue;
      const src = read(f);
      for (const d of DOMAIN_DIRS) {
        if (d === own) continue;
        if (new RegExp(`from\\s+["'][^"']*components/${d.split("/").pop()}/`).test(src)) {
          cross.push(`${f} -> ${d}`);
        }
      }
    }
    expect(cross, "domain-to-domain imports break the layer contract").toEqual([]);
  });

  it("the library is adopted: interactive business files import it (≥60%)", () => {
    const business = walkRepo("src/app", (r) => r.endsWith("page.tsx"))
      .concat(walkRepo("src/components", (r) => r.endsWith(".tsx") && domainOf(r) !== undefined));
    const interactive = business.filter((f) => read(f).match(/<(button|input|select|textarea|dialog)\b/i));
    const adopted = interactive.filter((f) => LIBRARY.test(read(f)));
    const rate = adopted.length / Math.max(interactive.length, 1);
    expect(
      interactive.length,
      "the denominator must not be empty or the rate is meaningless",
    ).toBeGreaterThan(0);
    expect(
      rate,
      `library adoption ${adopted.length}/${interactive.length} = ${(rate * 100).toFixed(0)}%`,
    ).toBeGreaterThanOrEqual(0.6);
  });
});

/**
 * Criterion ② read as "standard action buttons live in the library" — the
 * wording the委托方 adjudicated on 2026-11-21 (option A). A raw count of
 * `<button` ≤5 is unreachable for a real product: selection cards, icon
 * tools, sorters and brand-auth buttons are native-button territory, and
 * forcing them into the shared Button would break interaction semantics, not
 * consolidate it. So the enforceable invariant is the reverse: every native
 * button in business code must sit inside a declared exemption with a reason
 * a reviewer can check. New code with a native button outside the list fails
 * here, and the facts ratchet `debt.nativeButtons` (seeded 39, now 34)
 * bounds regressions independently.
 */
const NATIVE_BUTTON_EXEMPT: Record<string, string> = {
  "src/app/setup/page.tsx": "selection cards (role picker) with layoutId shared animations — option semantics, not action semantics",
  "src/app/practice/page.tsx": "category switcher pill (tab semantics) and a text-link Dismiss inside a banner",
  "src/app/global-error.tsx": "Next.js global error boundary must stay self-contained; component-tree imports here are forbidden by the framework",
  "src/app/recruiter/page.tsx": "carousel arrow, a circular icon control with bespoke positioning",
  "src/app/dashboard/replay/[id]/page.tsx": "role=tab strip — the ARIA pattern requires raw buttons wired to the tablist",
  "src/components/interview/InterviewTranscript.tsx": "per-message icon tools (copy/regenerate/delete) with custom hover tints",
  "src/components/interview/GreenRoom.tsx": "permission-recovery controls in a warning context with bespoke rose styling",
  "src/components/interview/LeaveRoomButton.tsx": "quiet text-link exit; the shared Button's variants do not include a bare underline text form",
  "src/components/interview/RoomHeader.tsx": "menu trigger carrying aria-haspopup/aria-expanded wiring to an external popover",
  "src/components/evaluation/TopImprovements.tsx": "filter chip inside a pill cluster",
  "src/components/dashboard/SessionDetailModal.tsx": "circular prev/next pager control",
  "src/components/dashboard/OnboardingTour.tsx": "absolute-positioned dismiss X over the tour overlay",
  "src/components/data/DataTable.tsx": "column sorter with aria-sort wiring on the table header",
  "src/components/auth/oauth-buttons.tsx": "brand-authorized OAuth button — provider marks forbid restyling through variants",
  "src/components/setup/TextSelectionMenu.tsx": "floating selection toolbar on the dark scrim with its own hover system",
  "src/components/setup/ResumeIntegrationSections.tsx": "inline file-clear pill in a warning context",
  "src/components/layout/Navbar.tsx": "mobile menu toggles with focus-visible ring wired to the nav state machine",
};

describe("S2: native buttons are exempted only on record", () => {
  it("every business-side native <button> sits inside a declared exemption", () => {
    const offenders: string[] = [];
    for (const f of walkRepo("src", (r) => r.endsWith(".tsx"))) {
      if (LIBRARY.test(f)) continue;
      const n = (read(f).match(/<button\b/g) ?? []).length;
      if (n > 0 && !NATIVE_BUTTON_EXEMPT[f]) offenders.push(`${f} (${n})`);
    }
    expect(offenders, "native buttons outside the exemption list — use the shared Button or declare why not").toEqual([]);
  });

  it("the exemption list is exact — no stale rows, every reason checkable", () => {
    for (const [f, why] of Object.entries(NATIVE_BUTTON_EXEMPT)) {
      expect(read(f), `${f} is exempted but no longer exists or no longer has a native button`).toMatch(/<button\b/);
      expect(why.length, `${f}'s reason is too thin to review`).toBeGreaterThan(30);
    }
  });
});

/**
 * S4 (2026-11-22): the room talks to itself through window events, and a lift
 * that moves the listener but not the dispatcher (or the reverse) leaves a dead
 * channel that no type check can see. TextSelectionMenu dispatches `ask-ai` and
 * the composer effect listens — CI's selection arm caught exactly this channel
 * going silent after the effects were lifted out of page.tsx. Every custom event
 * dispatched anywhere in src must have at least one listener in src.
 */
describe("S4: custom events keep both ends", () => {
  it("every dispatched window event has a listener", () => {
    const dispatchers = new Map<string, string[]>();
    const listeners = new Set<string>();
    for (const f of walkRepo("src", (r) => r.endsWith(".tsx") || r.endsWith(".ts"))) {
      const src = read(f);
      for (const m of src.matchAll(/dispatchEvent\(\s*new\s+CustomEvent(?:<[^>]*>)?\(\s*["']([\w-]+)["']/g)) {
        const list = dispatchers.get(m[1]) ?? [];
        list.push(f);
        dispatchers.set(m[1], list);
      }
      for (const m of src.matchAll(/addEventListener\(\s*["']([\w-]+)["']/g)) {
        listeners.add(m[1]);
      }
    }
    const dead = [...dispatchers.entries()]
      .filter(([name]) => !listeners.has(name))
      .map(([name, files]) => `${name} (dispatched by ${files.join(", ")})`);
    expect(dead, "custom events nobody listens for").toEqual([]);
    expect(dispatchers.size, "the probe found at least one custom event, or it is blind").toBeGreaterThan(0);
  });
});
