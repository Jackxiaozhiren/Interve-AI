/**
 * A capability the server implements and the product cannot reach.
 *
 * `POST /api/parse-resume` accepts `application/pdf` **or any `image/*`** (SVG
 * excepted) and routes images straight into the OCR fallback — a scanned resume
 * photographed on a phone would work. The only caller in the product is the
 * `/setup` wizard, which sets `accept="application/pdf"`, gates `handleFileUpload`
 * on the same exact string, and tells the candidate "PDF format up to 5MB". So
 * the image branch is unreachable from the UI, and also unreachable from any
 * keyless test: `isMockEnabled()` returns before validation, so driving that
 * branch for real needs a provider call, which this project does not spend.
 *
 * That is not automatically a bug — exposing it means choosing to spend OCR
 * tokens on every photo a candidate uploads, which is the owner's call. It *is* a
 * bug when the security doc describes the upload surface without saying the
 * second half of it has no door, because a reader then believes photo-resume OCR
 * is a shipped feature and a reviewer counts the branch as covered.
 *
 * So the gap is pinned in both directions. If someone wires images into the
 * wizard, this goes red and the disclosure has to be retired deliberately; if
 * someone drops the image branch from the route, it goes red and the doc gets
 * shorter. Neither drift is allowed to be silent.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROUTE = "src/app/api/parse-resume/route.ts";
const WIZARD = "src/app/setup/page.tsx";
const DOC = "docs/SECURITY.md";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

/** Types the route is willing to accept, as `file.type` tests in its body. */
function routeAcceptedTypes(): { pdf: boolean; image: boolean; svgRefused: boolean } {
  const sf = ts.createSourceFile(ROUTE, read(ROUTE), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const seen = { pdf: false, image: false, svgRefused: false };
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      const text = node.getText(sf);
      if (text.includes('"application/pdf"')) seen.pdf = true;
      if (text.includes('"image/svg+xml"')) seen.svgRefused = true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "startsWith" &&
      node.getText(sf).includes('"image/')
    ) {
      seen.image = true;
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return seen;
}

function wizardAccepts(): { acceptAttr: string | null; gateAllowsImage: boolean } {
  const src = read(WIZARD);
  const accept = /accept="([^"]*)"/.exec(src);
  const sf = ts.createSourceFile(WIZARD, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let gateAllowsImage = false;
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && node.getText(sf).includes("uploadedFile.type")) {
      // The gate is the whole condition, so the widest expression that mentions
      // the field is the one that decides. Assigning here instead of OR-ing let an
      // inner `!== "application/pdf"` overwrite the outer `&& startsWith("image/")`,
      // and a widened gate read as PDF-only — a plant caught it doing exactly that.
      gateAllowsImage = gateAllowsImage || /image\//.test(node.getText(sf));
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return { acceptAttr: accept ? accept[1] : null, gateAllowsImage };
}

const route = routeAcceptedTypes();
const wizard = wizardAccepts();

describe("the resume-upload surface is stated as it is", () => {
  it("reads the route and the wizard it claims to describe (instrument sanity)", () => {
    expect(route.pdf, "the route no longer mentions application/pdf at all").toBe(true);
    expect(wizard.acceptAttr, "no file input on the wizard").not.toBeNull();
  });

  it("keeps the wizard's gate and its picker in step with the route", () => {
    if (!route.image) return; // the route never took images; nothing to align

    if (wizard.gateAllowsImage) {
      expect(
        wizard.acceptAttr,
        "the gate accepts images but the picker still hides them from a click"
      ).toMatch(/image\//);
    } else {
      expect(
        wizard.acceptAttr,
        "the gate is PDF-only, so the picker must not promise otherwise"
      ).not.toMatch(/image\//);
    }
  });

  it("discloses the unreachable image branch exactly while it is unreachable", () => {
    const doc = read(DOC);
    const declared = /upload-image-branch:\s*`?unreachable-from-ui`?/.test(doc);
    // The gate, not the `accept` attribute, is what decides reachability: a
    // widened gate lets a dragged image through even while the picker still
    // offers only PDFs.
    const gapExists = route.image && !wizard.gateAllowsImage;

    // An equivalence, so neither drift is silent: a route that drops the image
    // branch leaves the disclosure behind as a false claim about a gap that is
    // gone, and a wizard that opens the door leaves it claiming a feature is
    // unreachable.
    expect(
      declared,
      gapExists
        ? "the route takes images and no product path does, and SECURITY.md does not say so"
        : "SECURITY.md still declares the image branch unreachable-from-ui, which is no longer true"
    ).toBe(gapExists);
  });

  it("keeps the SVG refusal it advertises", () => {
    expect(route.svgRefused, "SECURITY.md advertises SVG refusal").toBe(true);
  });
});
