/**
 * The repo-wide dead-control predicate, including the arm it did not have.
 *
 * `debt.deadControls` was seeded at 0 on 2026-10-08 after eight inert controls were
 * removed. Every one of those eight had *no* handler at all — which is why the
 * predicate only asked "is a handler attribute present?". A control wired to a
 * closure that does nothing answers that question "yes" and stays invisible, even
 * though the user experience is identical: the click lands, nothing changes.
 *
 * The settings page guard (`settings-controls-are-real.test.ts`) has rejected the
 * no-op shape since PR #52, so a page-level rule was stricter than the repo-wide
 * ratchet that is supposed to back it up. These cases pin the stricter predicate
 * and, importantly, its conservatism: a handler whose body lives elsewhere
 * (`onClick={submit}`) is treated as alive, because a name is not a no-op.
 */
import { describe, expect, it } from "vitest";
import { findDeadControls } from "../../scripts/audit-facts.mjs";

const wrap = (jsx: string) => `export const P = () => (\n  <div>\n    ${jsx}\n  </div>\n);\n`;

function dead(jsx: string): number {
  return findDeadControls(wrap(jsx), "probe.tsx").length;
}

describe("no handler at all", () => {
  it("counts a bare button", () => {
    expect(dead("<Button>Save</Button>")).toBe(1);
    expect(dead("<button>Save</button>")).toBe(1);
  });

  it("counts a toggle with no handler", () => {
    expect(dead('<input type="checkbox" defaultChecked />')).toBe(1);
  });

  it("does not count a button that submits a form", () => {
    expect(dead('<button type="submit">Save</button>')).toBe(0);
  });
});

describe("a handler that does nothing", () => {
  it("counts an empty arrow body", () => {
    expect(dead("<Button onClick={() => {}}>Save</Button>")).toBe(1);
  });

  it("counts an empty body with only whitespace", () => {
    expect(dead('<Button onClick={() => {\n   }}>Save</Button>')).toBe(1);
  });

  it("counts `() => undefined` and `() => void 0`", () => {
    expect(dead("<Button onClick={() => undefined}>Save</Button>")).toBe(1);
    expect(dead("<Button onClick={() => void 0}>Save</Button>")).toBe(1);
  });

  it("counts an empty function expression, async included", () => {
    expect(dead("<Button onClick={function () {}}>Save</Button>")).toBe(1);
    expect(dead("<Button onClick={async () => {}}>Save</Button>")).toBe(1);
  });

  it("counts a no-op onChange on a checkbox", () => {
    expect(dead('<input type="checkbox" onChange={() => {}} />')).toBe(1);
  });

  it("does not count a comment-only body as alive", () => {
    // The statement list is empty even though the block has text in it, so the
    // shape a developer would use to "keep the button" is still reported.
    expect(dead('<Button onClick={() => {\n  // TODO wire me\n}}>Save</Button>')).toBe(1);
  });
});

describe("what still counts as alive", () => {
  it("accepts an arrow with a real body", () => {
    expect(dead("<Button onClick={() => save()}>Save</Button>")).toBe(0);
  });

  it("accepts a named handler, whose body is not visible here", () => {
    expect(dead("<Button onClick={handleSubmit}>Save</Button>")).toBe(0);
  });

  it("does not double-count a primitive handed through render=", () => {
    // Measured, not assumed: the escape applies to the element *inside* the
    // render= value, so the `<a>` is not reported; the outer `<Button>` is,
    // because nothing in this fixture gives it a handler, an escape or an
    // ancestor. `debt.deadControls` is 0 today, so no component in src/ is
    // shaped like this — the case is here to pin the ancestor rule, not to
    // certify that a render= Button is alive.
    const hits = findDeadControls(wrap('<Button render={<a onClick={() => go()} />} />'), "probe.tsx");
    expect(hits.map((h) => h.tag)).toEqual(["Button"]);
  });

  it("accepts a control inside a Link", () => {
    expect(dead('<Link href="/setup"><Button onClick={() => {}}>Go</Button></Link>')).toBe(0);
  });

  it("accepts a spread of props", () => {
    expect(dead("<Button {...props}>Save</Button>")).toBe(0);
  });
});
