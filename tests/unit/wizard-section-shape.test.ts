/**
 * The setup wizard's step panels go through one component.
 *
 * Thirteen copies of the same header ("serif title + index badge over a rule")
 * lived inline in `src/app/setup/page.tsx`. That is not only 51 lines of
 * repetition — it is thirteen places where a heading can drift a pixel from its
 * neighbours without anyone noticing, and it was the reason the page sat 16
 * lines under its size ceiling, which is the point where a ratchet stops
 * constraining and starts being a tripwire for the next comment.
 *
 * This check keeps the collapsed form collapsed. It counts real JSX elements, so
 * adding a fourteenth panel inline goes red rather than being grepped past.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/setup/page.tsx";
const COMPONENT = "src/components/setup/WizardSection.tsx";

const src = readFileSync(new URL(`../../${PAGE}`, import.meta.url), "utf8");
const sf = ts.createSourceFile(PAGE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function tagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return node.tagName.getText(sf);
}

const sections: { name: string; props: Map<string, string> }[] = [];

function record(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
  const name = tagName(node);
  if (name !== "WizardSection" && name !== "motion.section") return;
  const props = new Map<string, string>();
  for (const attr of node.attributes.properties) {
    if (ts.isJsxAttribute(attr) && attr.initializer) {
      props.set(
        attr.name.getText(sf),
        ts.isStringLiteral(attr.initializer) ? attr.initializer.text : attr.initializer.getText(sf)
      );
    }
  }
  sections.push({ name, props });
}

const visit = (node: ts.Node) => {
  // A JsxElement's opening element is also its child, so handling both here
  // counted every panel twice — which a `> 10` sanity bound happily accepted.
  if (ts.isJsxElement(node)) {
    record(node.openingElement);
    node.children.forEach(visit);
  } else if (ts.isJsxSelfClosingElement(node)) {
    record(node);
  } else {
    node.forEachChild(visit);
  }
};
visit(sf);

const wizard = sections.filter((s) => s.name === "WizardSection");
const inline = sections.filter((s) => s.name === "motion.section");

describe("the wizard's panels are one component", () => {
  it("finds the panels it claims to count (instrument sanity)", () => {
    // A visitor that matched nothing would satisfy every assertion below.
    expect(wizard.length).toBeGreaterThan(10);
    expect(readFileSync(new URL(`../../${COMPONENT}`, import.meta.url), "utf8")).toContain(
      "export function WizardSection"
    );
  });

  it("has no panel inlining the section header any more", () => {
    expect(inline.map(() => "motion.section with an inline header"), `still inline: ${inline.length}`).toEqual([]);
  });

  it("gives every panel a title and a unique step index", () => {
    const titles = wizard.map((s) => s.props.get("title") ?? "");
    const indexes = wizard.map((s) => s.props.get("index") ?? "");
    expect(titles.every((t) => t.length > 0), "a panel lost its title").toBe(true);
    expect(new Set(titles).size, "two panels share a title").toBe(titles.length);
    expect(new Set(indexes).size, "two panels share a step index").toBe(indexes.length);
    for (const i of indexes) {
      expect(i, `step index "${i}" is not of the documented shape`).toMatch(/^\d\d[a-e]?$/);
    }
  });

  it("keeps the panel count matching the wizard's own narrative", () => {
    // Titles are user-visible copy; a rename should update this line rather than
    // the check being loosened.
    expect(wizard.map((s) => s.props.get("title"))).toEqual([
      "Target Role",
      "Target Company",
      "Interviewer Persona",
      "Interview Framework",
      "Interview Type",
      "Difficulty & Duration",
      "Stress Test Mode",
      "AI Model Engine",
      "Resume Integration",
      "Additional Context",
      "Resume Alignment",
      "Technical Assessment",
      "Hardware Check",
    ]);
  });
});
