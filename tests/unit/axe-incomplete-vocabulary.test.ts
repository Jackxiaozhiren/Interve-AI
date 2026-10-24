/**
 * The a11y lane ratchets over axe's `incomplete` color-contrast nodes, bucketed by
 * `any[0].data.messageKey`. That bucketing is only honest while
 * `tests/axe-incomplete-reasons.ts` still describes the installed axe — so this
 * test derives the vocabulary from the bundle instead of trusting the table.
 *
 * axe keeps its undeterminable-contrast reasons as a keyed message table inside the
 * bundle (`bgOverlap: "Element's contrast ratio could not be determined because of
 * element overlap"`, and twelve more). Reading the keys off that table is what makes
 * an upgrade detectable: a new key means a new class of node the lane has no ceiling
 * for, and a dropped key means a ceiling is being spent on something that no longer
 * arrives. Both were invisible to the prose-matching version of this table, which
 * mapped two surface wordings of `bgOverlap` into two buckets and let
 * `outsideViewport` fall through counted nowhere.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AXE_CONTRAST_REASON_KEYS, classifyContrastNode } from "../axe-incomplete-reasons";

const AXE_BUNDLE = path.resolve(process.cwd(), "node_modules/axe-core/axe.js");
const BUNDLE = readFileSync(AXE_BUNDLE, "utf8");

/**
 * Every key in axe whose message says a contrast value could not be determined, or
 * that content was too short to judge. Values carry escaped apostrophes
 * (`Element\'s`), so the string body is matched as a literal — `[^']*` stops at the
 * first escape and truncates the message, which is how a phrase-based table went
 * missing reasons that were in front of it.
 */
const UNDETERMINABLE_KEYS = (() => {
  const out = new Map<string, string>();
  const entry = /([A-Za-z][A-Za-z0-9]*): '((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(BUNDLE)) !== null) {
    const value = m[2].replace(/\\'/g, "'");
    if (/could not be determined|too short to determine/.test(value)) out.set(m[1], value);
  }
  return out;
})();

describe("the axe incomplete-reason table matches the axe that is installed", () => {
  it("the bundle actually yields a vocabulary to check against", () => {
    // A regex that stops matching the bundle would make every case below pass on an
    // empty set — the blindness this test exists to prevent. Thirteen is the count
    // in the axe this repo pins; a floor, not an equality, so a reworded message
    // still has to be noticed by the two coverage cases rather than by arithmetic.
    expect(UNDETERMINABLE_KEYS.size, `found only ${UNDETERMINABLE_KEYS.size} reason keys in ${AXE_BUNDLE}`).toBeGreaterThanOrEqual(
      10
    );
  });

  it("every reason key axe can emit has a bucket here", () => {
    const missing = [...UNDETERMINABLE_KEYS.keys()].filter(
      (k) => !(AXE_CONTRAST_REASON_KEYS as readonly string[]).includes(k)
    );
    expect(
      missing,
      `axe can report these and tests/axe-incomplete-reasons.ts declares no bucket for them: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("every bucket here is still something axe can report", () => {
    const dead = AXE_CONTRAST_REASON_KEYS.filter((k) => !UNDETERMINABLE_KEYS.has(k));
    expect(
      dead.map((k) => `${k} — axe's bundle has no such reason key`),
      "dead buckets sit at zero forever while the real reason lands somewhere else"
    ).toEqual([]);
  });

  it("classifyContrastNode routes a keyed node to its own bucket", () => {
    const wrong = AXE_CONTRAST_REASON_KEYS.filter((k) => {
      const got = classifyContrastNode({ any: [{ data: { messageKey: k }, message: UNDETERMINABLE_KEYS.get(k) }] });
      return !("bucket" in got) || got.bucket !== k;
    });
    expect(wrong).toEqual([]);
  });

  it("a node without a messageKey, or with an unknown one, is reported as unknown", () => {
    // A node that classifies into a bucket it did not ask for would borrow that
    // bucket's ceiling and make the ratchet count something nobody chose.
    expect(classifyContrastNode({ any: [{ message: "Element's background could not be determined" }] })).toHaveProperty(
      "unknownKey"
    );
    expect(classifyContrastNode({ any: [{ data: { messageKey: "brandNewReason" } }] })).toEqual({
      unknownKey: "brandNewReason",
    });
    expect(("bucket" in classifyContrastNode({ any: [{ data: { messageKey: "bgOverlap" } }] }))).toBe(true);
  });

  it("bucket keys are unique", () => {
    const dupes = AXE_CONTRAST_REASON_KEYS.filter((k, i) => AXE_CONTRAST_REASON_KEYS.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });
});
