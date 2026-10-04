import { describe, expect, it } from "vitest";
import { collectFacts, countRawFetchCallSites } from "../../scripts/audit-facts.mjs";

/**
 * The ratchet key `capabilities.networkLayer.rawFetchCalls` is a CALL-SITE
 * count ("raw fetch() bypassing the shared client"). It was measured by
 * scanning file text with /\bfetch\(/g, which also matched the string inside
 * comments and string literals. The first time anyone wrote the word in prose
 * — a doc comment describing the fetch chains being extracted out of the
 * interview page — the gate went red for a debt that did not exist.
 *
 * These fixtures pin the two directions that matter: prose must not count, and
 * a real indirect call must still count, so switching the instrument cannot
 * quietly relax the ceiling.
 */
const cases: Array<[string, string, number]> = [
  ["bare call", 'const r = await fetch("/api/x");', 1],
  ["indirect call still counts", 'const r = await window.fetch("/api/x");', 1],
  ["globalThis indirect", 'globalThis.fetch("/api/x");', 1],
  ["two calls in one file", 'await fetch("/a");\nawait fetch("/b");', 2],
  ["block comment prose", '/** the fetch("/a") chains were extracted */\nconst x = 1;', 0],
  ["line comment prose", '// rewrite fetch() later\nconst x = 1;', 0],
  ["string literal", 'toast("use fetch(url) to load it");', 0],
  ["template literal", "const s = `call fetch( here`;", 0],
  ["regex literal containing the token", 'const re = /\\bfetch\\(/g;', 0],
  ["prefetch is not fetch", 'const p = prefetch("/a");', 0],
  ["fetch as a value, never called", "const f = fetch;", 0],
];

describe.each(cases)("raw fetch counter: %s", (_label, body, expected) => {
  it(`counts ${expected}`, () => {
    expect(countRawFetchCallSites(body, "probe.ts")).toBe(expected);
  });
});

it("parses TSX without tripping over JSX", () => {
  const tsx =
    "export default function P() {\n" +
    "  return <button onClick={() => fetch(\"/api/y\")}>go</button>;\n" +
    "}\n";
  expect(countRawFetchCallSites(tsx, "probe.tsx")).toBe(1);
});

// Measured at module load rather than inside the test — see the note in
// any-escapes.test.ts. collectFacts() walks and parses all of src/, and a ~1.4s
// measurement inside a 5s test timeout is a gate that goes red on a busy runner.
const facts = collectFacts();

describe("the instrument change moved no real debt (R-19)", () => {
  it("still reports the seeded ceiling for src/", () => {
    // 17 is the value facts.limits.json carries, measured by the old scanner on
    // a clean tree. If this drifts, the new parser disagrees about a call site
    // rather than about prose, and the number must be re-adjudicated — not
    // just copied into the ceiling.
    //
    // Re-adjudicated to 15 in daea42b's follow-up: the interview page's two
    // per-utterance analysis fetches moved into runTurnAnalysis behind an
    // injected fetchImpl, so the parser no longer sees a literal fetch( there.
    // That is a real improvement — those two sites went from no tests to six —
    // and simultaneously the blind spot it exposes: indirection lowers this
    // number without removing a network call. Read a fall as "fewer unmanaged
    // call sites", never as "less fetching".
    expect(facts.capabilities.networkLayer.rawFetchCalls).toBe(15);
  });
});
