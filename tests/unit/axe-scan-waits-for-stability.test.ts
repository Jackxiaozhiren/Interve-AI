// The axe arms must wait for *change to stop*, not for a duration to pass.
//
// `tests/a11y-visual.spec.ts` guarded its interview-room scan with
// `await page.waitForTimeout(2500)`. That is a guess at where an animation cycle
// happens to be, and it fails in both directions: under a loaded runner the pill is
// still mid-fade at 2500 ms (observed once on 2026-10-20 as `color-contrast: 2 nodes`
// immediately after the smoke and mock lanes, then 4/4 green in isolation), and on an
// idle machine it spends 2.5 s doing nothing. Measured census of that room: 14-26
// animations are running at every time slice — pulsing dots and an ambient 15 s ring —
// so "wait until nothing is animating" cannot settle either. The arm now compares the
// opacity of every text-bearing node 200 ms apart and waits for that set to stop
// changing, which is what a contrast check can actually see.
//
// These rules keep the replacement from decaying back:
//
//   AX1  an axe arm may not contain a fixed delay, and must call the settle helper;
//   AX2  exactly one `AxeBuilder` exists, so a new arm cannot skip the helper that
//        prints the violating selectors (the old message said only
//        `color-contrast: 2 nodes`, which left attribution as a guess);
//   AX3  the helper decides by comparing two observations — an equality between two
//        identifiers each initialised by a call to the same function — and its sample
//        interval is bounded, so it cannot become a long sleep wearing its name.
//
// Red-first note: the fix landed before this file, so the product-side demonstration
// is the plants themselves — AX1 restores `waitForTimeout(2500)` and removes the
// settle call, which is byte-for-byte the state this slice started from.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const SPEC = "tests/a11y-visual.spec.ts";

function parse(rel: string, source: string): ts.SourceFile {
  return ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function callsNamed(sf: ts.SourceFile, node: ts.Node, names: (name: string) => boolean): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const text = n.expression.getText(sf);
      if (names(text)) out.push(text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** Every `test("…", async (…) => { … })` in the file, by title. */
function testBodies(sf: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "test" && n.arguments.length >= 2) {
      const title = n.arguments[0];
      const body = n.arguments[1];
      if (ts.isStringLiteral(title) && body && ts.isArrowFunction(body) && body.body) out.set(title.text, body.body);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** AX1: an axe arm that waits on a duration, or that scans without settling. */
export function fixedDelayArms(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  for (const [title, body] of testBodies(sf)) {
    if (!/axe violations/.test(title)) continue;
    const sleeps = callsNamed(sf, body, (name) => /waitForTimeout|setTimeout$/.test(name));
    for (const s of sleeps) {
      const line = sf.getLineAndCharacterOfPosition(body.getStart(sf)).line + 1;
      out.push(`${title}: fixed delay (${s}) at line ${line}`);
    }
    if (!callsNamed(sf, body, (name) => name === "settleForScan").length) out.push(`${title}: scans without settleForScan`);
  }
  return out;
}

/** AX2: one scan helper, so every arm reports its violating selectors. */
export function scanCopies(sf: ts.SourceFile): { count: number; lines: number[] } {
  const lines: number[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isNewExpression(n) && n.expression.getText(sf) === "AxeBuilder") {
      lines.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { count: lines.length, lines };
}

/** AX3: the settle helper compares two reads, and its interval is a sample, not a wait. */
export function settleHelperDefects(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  // Any function shape counts. The first draft matched only `const settleForScan = () => …`
  // and reported the real helper — written as `async function settleForScan(page)` — as
  // missing, which is the same blind spot this slice exists to close.
  type SettleFn = ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration | ts.ArrowFunction;
  let helper: SettleFn | undefined;
  const named = (n: ts.Node): n is ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n);
  const find = (n: ts.Node) => {
    if (helper) return;
    if (named(n) && n.name && ts.isIdentifier(n.name) && n.name.text === "settleForScan") {
      helper = n;
    } else if (ts.isVariableDeclaration(n) && n.name.getText(sf) === "settleForScan" && n.initializer) {
      if (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) helper = n.initializer;
    }
    ts.forEachChild(n, find);
  };
  find(sf);
  if (!helper || !helper.body) return ["settleForScan is missing, or has no body"];
  const body = helper.body;

  // Two variables, each assigned by calling the same zero-arg reader, compared with `===`.
  const reads = new Map<string, string>();
  const collect = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && !n.initializer.arguments.length) {
      reads.set(n.name.getText(sf), n.initializer.expression.getText(sf));
    }
    ts.forEachChild(n, collect);
  };
  collect(body);
  const compared: string[] = [];
  const findCompare = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      const l = n.left.getText(sf);
      const r = n.right.getText(sf);
      if (reads.has(l) && reads.has(r) && l !== r && reads.get(l) === reads.get(r)) compared.push(`${l}===${r}`);
    }
    ts.forEachChild(n, findCompare);
  };
  findCompare(body);
  if (!compared.length) {
    out.push("settleForScan declares no two-read comparison — a wait that always reports settled");
  }
  const polls = callsNamed(sf, body, (name) => /^expect\s*\.\s*poll$/.test(name));
  if (!polls.length) {
    out.push("settleForScan does not retry (no expect.poll), so one observation decides it");
  }

  // The sample interval must stay an interval: a second-scale delay is a sleep again.
  if (callsNamed(sf, body, (name) => name === "setTimeout").length) {
    let ms = NaN;
    const grab = (n: ts.Node) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === "setTimeout" && n.arguments[1] && ts.isNumericLiteral(n.arguments[1])) {
        ms = Number(n.arguments[1].text);
      }
      ts.forEachChild(n, grab);
    };
    grab(body);
    if (!(ms >= 0 && ms <= 1000)) out.push(`settleForScan samples ${ms} ms apart — that is a wait, not a sample`);
  }
  return out;
}

describe("the axe arms wait for the page to stop changing, not for a clock", () => {
  const sf = parse(SPEC, readRepo(SPEC));

  it("AX1: no axe arm sleeps, and every axe arm settles first", () => {
    expect(fixedDelayArms(sf), "a duration is standing in for a condition").toEqual([]);
  });

  it("AX2: one scan helper serves every arm", () => {
    const { count, lines } = scanCopies(sf);
    expect(count, `AxeBuilder appears on lines ${lines.join(", ")}; the shared helper is being bypassed`).toBe(1);
  });

  it("AX3: the settle helper is a comparison, and its delay is a sample", () => {
    expect(settleHelperDefects(sf), "the settle predicate can pass without seeing change").toEqual([]);
  });

  it("the arms are the three flows the lane claims to cover", () => {
    const titles = [...testBodies(sf).keys()].filter((t) => /axe violations/.test(t));
    expect(titles.length, "an arm was renamed or dropped: retarget these rules").toBe(3);
    expect(titles.join("|"), "the landing/login/room coverage moved").toMatch(/landing/);
    expect(titles.join("|")).toMatch(/login/);
    expect(titles.join("|")).toMatch(/interview room/);
  });
});

describe("the rules can fail", () => {
  const fixture = (body: string): ts.SourceFile => parse("fixture.ts", `\n${body}\n`);

  it("AX1 fires on the sleep it replaced, and on a settle-less scan", () => {
    const SLEEP = `test('interview room has no serious/critical axe violations', async ({ page }) => {
  await page.waitForTimeout(2500);
  await settleForScan(page);
  await expectNoSeriousViolations(page);
});
`;
    const SLEEP_AND_NO_SETTLE = `test('login has no serious/critical axe violations', async ({ page }) => {
  await page.waitForTimeout(2500);
  await expectNoSeriousViolations(page);
});
`;
    const NO_SETTLE = `test('login has no serious/critical axe violations', async ({ page }) => {
  await page.goto('/login');
  await expectNoSeriousViolations(page);
});
`;
    const GOOD = `test('landing has no serious/critical axe violations', async ({ page }) => {
  await page.goto('/');
  await settleForScan(page);
  await expectNoSeriousViolations(page);
});
`;
    // One finding each way, and two when both halves are wrong: the arm reports the
    // delay and the missing settle independently, so removing one cannot mask the other.
    // The line number is diagnostic, so the controls match the finding's shape rather
    // than pinning a byte offset that moves with HEAD.
    const sleep = fixedDelayArms(fixture(SLEEP));
    expect(sleep, "a fixed delay was accepted").toHaveLength(1);
    expect(sleep[0]).toMatch(/fixed delay \(page\.waitForTimeout\)/);
    expect(fixedDelayArms(fixture(SLEEP_AND_NO_SETTLE))).toHaveLength(2);
    const unsettled = fixedDelayArms(fixture(NO_SETTLE));
    expect(unsettled, "a scan without settle was accepted").toHaveLength(1);
    expect(unsettled[0]).toMatch(/scans without settleForScan/);
    expect(fixedDelayArms(fixture(GOOD))).toEqual([]);
  });

  it("AX2 counts a second AxeBuilder copy", () => {
    const TWO = `const scan = (page) => new AxeBuilder({ page }).analyze();
test('extra has no serious/critical axe violations', async ({ page }) => {
  await new AxeBuilder({ page }).analyze();
});
`;
    expect(scanCopies(fixture(TWO)).count).toBe(2);
    expect(scanCopies(fixture(`const scan = (page) => new AxeBuilder({ page }).analyze();\n`)).count).toBe(1);
  });

  it("AX3 rejects a settle that only waits, and a sample that is a nap", () => {
    const ALWAYS_SETTLED = `const settleForScan = async (page) => {
  await expect.poll(() => page.evaluate(() => new Promise((resolve) => setTimeout(() => resolve('settled'), 200)))).toBe('settled');
};
`;
    const ONE_READ = `const settleForScan = async (page) => {
  await expect.poll(async () => {
    const v = await page.evaluate(() => 1);
    return v === v ? 'settled' : 'moving';
  }).toBe('settled');
};
`;
    const LONG_SAMPLE = `const settleForScan = async (page) => {
  const read = () => 1;
  await expect.poll(() => new Promise((resolve) => {
    const before = read();
    setTimeout(() => { const after = read(); resolve(before === after ? 'settled' : 'moving'); }, 9000);
  })).toBe('settled');
};
`;
    expect(settleHelperDefects(fixture(ALWAYS_SETTLED)), "a wait that always answers 'settled' passed").toContain(
      "settleForScan declares no two-read comparison — a wait that always reports settled",
    );
    expect(settleHelperDefects(fixture(ONE_READ)), "a single observation compared to itself passed").toContain(
      "settleForScan declares no two-read comparison — a wait that always reports settled",
    );
    expect(settleHelperDefects(fixture(LONG_SAMPLE))).toEqual([
      "settleForScan samples 9000 ms apart — that is a wait, not a sample",
    ]);
    // The real helper passes, so the three arms above are not the only shape accepted.
    expect(settleHelperDefects(parse(SPEC, readRepo(SPEC)))).toEqual([]);
  });

  it("the corpus is the file the lane actually runs", () => {
    const files = walkRepo("tests", (p) => p.endsWith(".spec.ts")).filter((rel) => /a11y-visual/.test(rel));
    expect(files).toEqual([SPEC]);
  });
});
