/**
 * A full-viewport overlay that fades out has to stop intercepting clicks the moment it
 * starts leaving, not when its fade ends.
 *
 * Measured on the interview room on 2026-10-25, sampling the viewport centre every 25 ms
 * from the press of "开始面试": for **290 ms** after that click, `document.elementFromPoint`
 * still returned the `fixed inset-0 z-50` standby veil at opacities 0.77 → 0.03, because
 * framer keeps the node mounted for the exit animation and nothing released its pointer
 * target. Every click in that window is swallowed, and the window opens at the single
 * moment the user has just committed to an action and expects the room to respond.
 *
 * Adding `pointerEvents: "none"` to each exit object took the same measurement from 290 ms
 * to 30 ms — one sample interval, i.e. the exit value applies on the first frame.
 *
 * The rule is a predicate rather than a browser assertion because it needs no rendering to
 * check, and because the browser lane that could check it has to drive each overlay into
 * its own state, and only the room's standby veil was reachable that way. Writing the
 * predicate is what found the other seven: `PauseOverlay`, `ThinkTimeOverlay` and
 * `EndingOverlay` in the room, plus `SessionDetailModal`, `OnboardingTour`, the recruiter
 * detail backdrop and the mobile `Navbar` scrim. All eight now release.
 *
 * An element that has *no* `exit` prop is not required to release the pointer: a
 * permanently mounted full-screen layer is intercepting on purpose, and this repo already
 * has one that must keep doing so.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

type Overlay = {
  file: string;
  line: number;
  tag: string;
  hasExit: boolean;
  releasesPointer: boolean;
  exitText: string;
  classes: string;
};

const collect = (files: string[]): Overlay[] => {
  const out: Overlay[] = [];
  for (const f of files) {
    const src = readFileSync(path.resolve(process.cwd(), f), "utf8");
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      const el = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
      if (el) {
        const attr = (name: string) =>
          el.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name) as
            | ts.JsxAttribute
            | undefined;
        const classAttr = attr("className");
        const classText = classAttr?.initializer ? classAttr.initializer.getText(sf) : "";
        const isFullScreen = /\bfixed\b/.test(classText) && /\binset-0\b/.test(classText);
        if (isFullScreen) {
          const exit = attr("exit");
          const init = exit?.initializer;
          const obj = init && ts.isJsxExpression(init) && init.expression && ts.isObjectLiteralExpression(init.expression)
            ? init.expression
            : undefined;
          out.push({
            file: f,
            line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
            tag: el.tagName.getText(sf),
            hasExit: !!exit,
            releasesPointer: !!obj && obj.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === "pointerEvents"),
            exitText: obj ? obj.getText(sf).replace(/\s+/g, " ") : "",
            classes: classText.replace(/\s+/g, " ").slice(0, 90),
          });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
};

const OVERLAYS = collect(walkRepo("src", (rel) => rel.endsWith(".tsx")));

describe("a full-screen overlay releases the pointer while it exits", () => {
  it("the census finds the overlays it is supposed to cover", () => {
    // Without this, a change to how className is written could make every case below
    // pass on an empty list. Eight is the count read off this same assertion on
    // 2026-10-25; a new overlay may raise it, and nothing may lower it.
    const withExit = OVERLAYS.filter((o) => o.hasExit);
    expect(
      withExit.length,
      `expected at least 8 full-screen exiting overlays, found ${withExit.length} of ${OVERLAYS.length} fixed inset-0 elements: ${withExit.map((o) => `${o.file}:${o.line}`).join(", ")}`
    ).toBeGreaterThanOrEqual(8);
  });

  it("each one names the pointer release in its exit object", () => {
    const offenders = OVERLAYS.filter((o) => o.hasExit && !o.releasesPointer);
    expect(
      offenders.map((o) => `${o.file}:${o.line} <${o.tag}> exit= does not set pointerEvents — ${o.classes}`),
      "an exiting full-screen overlay keeps intercepting clicks for its whole fade: 290 ms of swallowed clicks measured on the room"
    ).toEqual([]);
  });

  it("the release says `none`, not some other value", () => {
    // `pointerEvents: "auto"` in an exit object would satisfy the shape and do nothing.
    const weak = OVERLAYS.filter((o) => o.hasExit && o.releasesPointer && !/pointerEvents:\s*["']none["']/.test(o.exitText));
    expect(weak.map((o) => `${o.file}:${o.line}`), "pointerEvents must be released to none").toEqual([]);
  });
});
