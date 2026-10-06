/**
 * The setup wizard's step panels go through one component, in the order the
 * candidate actually sees them.
 *
 * Thirteen copies of the same header ("serif title + index badge over a rule")
 * lived inline in `src/app/setup/page.tsx`. That is not only 51 lines of
 * repetition — it is thirteen places where a heading can drift a pixel from its
 * neighbours without anyone noticing, and it was the reason the page sat 16
 * lines under its size ceiling, which is the point where a ratchet stops
 * constraining and starts being a tripwire for the next comment.
 *
 * The panels no longer all live in one file: step 5's upload and alignment panels
 * were extracted to `components/setup/ResumeIntegrationSections.tsx`. Counting per
 * file would therefore have to loosen, so instead this check follows the render:
 * it walks the page in document order, expands each child component that the page
 * renders for a step, and asserts on the flattened sequence. That keeps the
 * property the extraction could actually break — two panels swapping places still
 * produces the right titles in the wrong order, which a set-based check cannot see.
 */
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/setup/page.tsx";
const COMPONENT = "src/components/setup/WizardSection.tsx";
const SETUP_COMPONENTS_DIR = "src/components/setup";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

type Panel = { title: string; index: string };
type Slot = { kind: "panel"; panel: Panel } | { kind: "inline" } | { kind: "component"; name: string };

function parse(rel: string) {
  const src = read(rel);
  return { src, sf: ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
}

/** Panel slots of one file, in document order: WizardSection panels, inline headers, child components. */
function slotsOf(rel: string): Slot[] {
  const { sf } = parse(rel);
  const out: Slot[] = [];
  const propsOf = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    const map = new Map<string, string>();
    for (const attr of node.attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.initializer) {
        map.set(
          attr.name.getText(sf),
          ts.isStringLiteral(attr.initializer) ? attr.initializer.text : attr.initializer.getText(sf),
        );
      }
    }
    return map;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText(sf);
      if (name === "WizardSection") {
        const p = propsOf(node.openingElement);
        out.push({ kind: "panel", panel: { title: p.get("title") ?? "", index: p.get("index") ?? "" } });
      } else if (name === "motion.section") {
        out.push({ kind: "inline" });
      }
      node.children.forEach(visit);
    } else if (ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(sf);
      if (name === "WizardSection") {
        const p = propsOf(node);
        out.push({ kind: "panel", panel: { title: p.get("title") ?? "", index: p.get("index") ?? "" } });
      } else if (name === "motion.section") {
        out.push({ kind: "inline" });
      } else if (/^[A-Z]/.test(name)) {
        out.push({ kind: "component", name });
      }
    } else {
      node.forEachChild(visit);
    }
  };
  visit(sf);
  return out;
}

/** Panels contributed by a component, keyed by its exported function name. */
function panelsByComponent(): { panels: Map<string, Panel[]>; files: string[] } {
  const map = new Map<string, Panel[]>();
  const files: string[] = [];
  const dir = new URL(`../../${SETUP_COMPONENTS_DIR}`, import.meta.url);
  for (const entry of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const rel = `${SETUP_COMPONENTS_DIR}/${entry}`;
    if (rel === COMPONENT) continue;
    files.push(rel);
    const { sf } = parse(rel);
    let current: string | null = null;
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        current = node.name.getText(sf);
        if (!map.has(current)) map.set(current, []);
      } else if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && current) {
        const open = ts.isJsxElement(node) ? node.openingElement : node;
        if (open.tagName.getText(sf) === "WizardSection") {
          const p = new Map<string, string>();
          for (const attr of open.attributes.properties) {
            if (ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer)) {
              p.set(attr.name.getText(sf), attr.initializer.text);
            }
          }
          map.get(current)!.push({ title: p.get("title") ?? "", index: p.get("index") ?? "" });
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return { panels: map, files };
}

const componentIndex = panelsByComponent();
const componentPanels = componentIndex.panels;
const flattened: Panel[] = [];
const inline: string[] = [];

for (const slot of slotsOf(PAGE)) {
  if (slot.kind === "panel") flattened.push(slot.panel);
  else if (slot.kind === "inline") inline.push(PAGE);
  else {
    // A step component contributes its own panels; any other child component is a
    // leaf inside a panel (`<HardwareCheckPanel />`) and contributes none. A panel
    // that disappears is caught by the sequence below, not by naming leaves.
    const panels = componentPanels.get(slot.name);
    if (panels) flattened.push(...panels);
  }
}
// An inline header anywhere in the wizard's own components is the regression this
// file was written for, so the component files get the same predicate as the page.
for (const rel of componentIndex.files) {
  for (const slot of slotsOf(rel)) {
    if (slot.kind === "inline") inline.push(rel);
  }
}

const wizard = flattened;

describe("the wizard's panels are one component", () => {
  it("finds the panels it claims to count (instrument sanity)", () => {
    // A visitor that matched nothing would satisfy every assertion below.
    expect(wizard.length).toBeGreaterThan(10);
    expect(read(COMPONENT)).toContain("export function WizardSection");
  });

  it("has no panel inlining the section header any more", () => {
    expect(inline.map(() => "motion.section with an inline header"), `still inline: ${inline.length}`).toEqual([]);
  });

  it("gives every panel a title and a unique step index", () => {
    const titles = wizard.map((s) => s.title);
    const indexes = wizard.map((s) => s.index);
    expect(titles.every((t) => t.length > 0), "a panel lost its title").toBe(true);
    expect(new Set(titles).size, "two panels share a title").toBe(titles.length);
    expect(new Set(indexes).size, "two panels share a step index").toBe(indexes.length);
    for (const i of indexes) {
      expect(i, `step index "${i}" is not of the documented shape`).toMatch(/^\d\d[a-e]?$/);
    }
  });

  it("keeps the panel count matching the wizard's own narrative", () => {
    // Titles are user-visible copy; a rename should update this line rather than
    // the check being loosened. This is the sequence a candidate sees, so it is
    // also what pins the extracted step-5 panels to their old positions.
    expect(wizard.map((s) => s.title)).toEqual([
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
