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
import { findFunctionByName, testBodies } from "./spec-ast";

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

/**
 * Like `callsNamed`, but keeps the position: an arm's three steps are only ordered
 * if their offsets are known, and asserting "hides before settles before scans"
 * from the call names alone would pass on any order.
 */
function callPositions(sf: ts.SourceFile, node: ts.Node, name: string): number[] {
  const out: number[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === name) out.push(n.getStart(sf));
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/**
 * Does this reader descend from the *host element's* shadow root?
 *
 * Keyed on the descent, not on the word: a reader can mention `shadowRoot` inside a
 * helper it no longer calls — which is exactly what the first two versions of this
 * rule let DCM6 walk past, once by matching the token anywhere in the body and once
 * by matching any call argument whose text contained it. The fact that decides
 * whether the lane reads anything is that the element `document.querySelector`
 * returned is the one whose `shadowRoot` gets handed to the walk.
 */
function walksFromAShadowRoot(body: ts.Node): boolean {
  const unwrap = (e: ts.Expression): ts.Expression => {
    let x = e;
    for (;;) {
      if (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isNonNullExpression(x) || ts.isAwaitExpression(x)) {
        x = x.expression;
      } else break;
    }
    return x;
  };
  const isQuerySelectorCall = (e: ts.Expression) => {
    const x = unwrap(e);
    return ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "querySelector";
  };
  const hostVars = new Set<string>();
  let found = false;
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      if (isQuerySelectorCall(n.initializer)) hostVars.add(n.name.text);
    }
    if (ts.isCallExpression(n) && n.arguments.length) {
      const a0 = unwrap(n.arguments[0]);
      if (ts.isPropertyAccessExpression(a0) && a0.name.text === "shadowRoot" && ts.isIdentifier(a0.expression) && hostVars.has(a0.expression.text)) {
        found = true;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
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

  // The signature has to include *where* a text node sits, not only what it looks like.
  // axe resolves a node's background from what is painted behind it, so a node translated
  // a few pixels by an in-flight framer-motion transform is a different measurement. That
  // is the mechanism behind both the room's 17/18 unresolved-count jitter and the
  // intermittent `color-contrast` violation whose reported target was `:root` with an
  // empty message — a pill sampled while AnimatePresence was remounting it.
  if (!callsNamed(sf, body, (name) => /getBoundingClientRect$/.test(name)).length) {
    out.push("settleForScan's signature ignores geometry — a node moved mid-animation reads as unchanged");
  }

  // And the alpha must be the product down the ancestor chain, not the node's own.
  // A toast's `[data-description]` reports opacity 1 for its whole ~400 ms enter fade
  // while the `li` above it ramps 0 → 1; axe composites through the ancestor, so a
  // self-opacity signature watches a number that never moves and measures #838383
  // (3.79:1) where the resting colour is #3f3f3f (10.9:1).
  const walksAncestors = /parentElement/.test(body.getText(sf));
  const multipliesAlpha = /\*\s*=?\s*[^;\n]*opacity/i.test(body.getText(sf)) || /opacity[^;\n]*\*/i.test(body.getText(sf));
  if (!walksAncestors || !multipliesAlpha) {
    out.push("settleForScan reads each node's own opacity — a fade on an ancestor is invisible to it");
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

/**
 * AX4: the scan has to pin the resting alpha for **both** mechanisms that write
 * opacity in this app, because they are different mechanisms and a selector that
 * catches one misses the other.
 *
 * framer-motion writes `style="opacity: …"` per frame, which `[style*="opacity"]`
 * reaches. sonner's toast fades with a CSS `@keyframes` rule and never touches the
 * style attribute — that is the one the recording toast rides, measured at
 * `a=0.000 → #ffffff` and `a=0.645 → #838383` two samples after the arm's own click,
 * against a resting `#3f3f3f` (10.9:1). And a pin without `animation:none` loses the
 * cascade back to the next keyframe, so both halves are load-bearing.
 */
export function scanAtRestDefects(sf: ts.SourceFile): string[] {
  const fn = findFunctionByName(sf, "scanAtRest");
  if (!fn?.body) return ["scanAtRest is missing or has no body — the arms cannot pin the resting state"];
  const text = fn.body.getText(sf);
  const out: string[] = [];
  if (!/addStyleTag/.test(text)) out.push("scanAtRest injects no stylesheet, so an animating element is measured mid-fade");
  if (!/\[style\*="opacity"\]/.test(text)) out.push("scanAtRest does not pin the inline opacity framer-motion writes per frame");
  if (!/\[data-sonner-toast\]/.test(text)) out.push("scanAtRest does not pin sonner's toast, whose fade is a @keyframes rule and never appears in the style attribute");
  if (!/animation:\s*none/.test(text)) out.push("scanAtRest pins opacity but leaves the animation running, so the next keyframe overwrites the pin");
  if (!/opacity:\s*1\s*!important/.test(text)) out.push("scanAtRest's rule lacks an !important opacity and loses the cascade to the animation");
  return out;
}

/**
 * AX5: what each arm measures has to be the product, and a node axe already
 * measured must not be able to fall between the two checks.
 *
 * Two holes this closes, both found the same day:
 *
 *  - Next's dev-tools pill labels itself `div[data-description=""]` and arrives in
 *    `incomplete` as a contrast node the app does not own. The visual lane has hid it
 *    since PR #147 (DCM1/DCM2), but the axe lane never did, so one seat of every
 *    arm's unresolved-contrast ceiling was spent on harness chrome — and it
 *    appeared and disappeared between runs, which is a ±1 nobody could attribute.
 *    An arm that does not hide it is measuring Next's indicator and calling the
 *    result the product's accessibility.
 *
 *  - `measuredFailuresOf` and the `unmeasured` split have to agree on what "axe
 *    resolved this pair" means. They are two reads of one condition, so if the
 *    assertion starts requiring `fgColor` while the split still requires only
 *    `bgColor`, a node can be declared neither a measured failure nor an
 *    unmeasured blind spot — it drops out of both, and both stay green. That is a
 *    ceiling nobody counts against, which is the failure this lane has now made
 *    twice in two ways.
 */
export function laneCoverageDefects(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  for (const [title, body] of testBodies(sf)) {
    if (!/axe violations/.test(title)) continue;
    const hide = callPositions(sf, body, "hideDevChrome");
    const settle = callPositions(sf, body, "settleForScan");
    const scan = callPositions(sf, body, "expectNoSeriousViolations");
    if (!hide.length) {
      out.push(`${title}: scans without hiding Next's dev-tools host, so harness chrome sits in the unresolved-contrast count`);
    }
    if (!hide.length || !settle.length || !scan.length) continue;
    if (hide[0] > settle[0]) out.push(`${title}: hides the dev host after settling, so the settle signature still includes the indicator`);
    if (settle[0] > scan[0]) out.push(`${title}: scans before settling`);
    if (hide[0] > scan[0]) out.push(`${title}: hides the dev host after the scan runs`);
  }

  // The hide is only honest if the lane read the indicator first. Removing the pill
  // without saying what it said is how the harness's own "1 Issue" stayed unnamed
  // across three rounds, so this is checked on the helper itself rather than on each
  // arm — one place, and every arm inherits it. Only when the source actually defines
  // the helper: the synthetic fixtures above do not, and deleting `hideDevChrome`
  // altogether is already caught by the per-arm rule.
  const hideFn = findFunctionByName(sf, "hideDevChrome");
  if (hideFn?.body) {
    const read = callPositions(sf, hideFn.body, "readDevIssues");
    const styleAt = hideFn.body.getText(sf).search(/addStyleTag/);
    if (!read.length) {
      out.push("hideDevChrome never reads the indicator, so a dev-mode Issue is hidden rather than named");
    } else if (styleAt >= 0 && read[0] > hideFn.body.getStart(sf) + styleAt) {
      out.push("hideDevChrome reads the indicator after hiding it, so the read runs against a pill the lane has already taken off the page");
    }
    const reader = findFunctionByName(sf, "readDevIssues");
    if (!reader?.body) {
      out.push("readDevIssues is missing, so nothing prints what the dev-tools indicator reports");
    } else if (!walksFromAShadowRoot(reader.body)) {
      out.push(
        "readDevIssues never descends from the host element's shadow root, so it reads the light DOM where the indicator keeps no text and prints the same string whatever the pill says"
      );
    }
  }

  const measure = findFunctionByName(sf, "measuredFailuresOf");
  if (!measure?.body) return [...out, "measuredFailuresOf is missing — a node axe measured and did not file would be counted as unmeasurable"];
  const mtext = measure.body.getText(sf);
  if (!/fgColor/.test(mtext) || !/bgColor/.test(mtext)) {
    out.push("measuredFailuresOf does not require both resolved colours, so it reports nodes axe never measured as failures");
  }
  if (!/expectedContrastRatio/.test(mtext)) {
    out.push("measuredFailuresOf ignores the ratio axe itself expected, so it cannot tell a failure from a pass");
  }

  // The split must key on the same fields, otherwise the two checks disagree about a
  // node and it is counted nowhere. Matched loosely on the receiver's spelling so
  // renaming `d` to `data` does not read as a disagreement.
  const scanHelper = findFunctionByName(sf, "expectNoSeriousViolations");
  if (!scanHelper?.body) return [...out, "expectNoSeriousViolations is missing"];
  const stext = scanHelper.body.getText(sf);
  if (!/measuredFailuresOf/.test(stext)) out.push("expectNoSeriousViolations never calls measuredFailuresOf");
  const requiresField = (text: string, field: string) =>
    new RegExp(`typeof\\s+[^)]*?${field}\\s+===\\s+['"]string['"]`).test(text);
  for (const field of ["fgColor", "bgColor"]) {
    if (requiresField(mtext, field) !== requiresField(stext, field)) {
      out.push(
        `the unmeasured split and measuredFailuresOf disagree on ${field}: a node can be neither a failure nor a blind spot, and both checks stay green`
      );
    }
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

  it("AX4: the scan pins the resting alpha for both mechanisms that write opacity", () => {
    expect(
      scanAtRestDefects(sf),
      "the lane can measure an element mid-fade again: the injected rule no longer covers every path that writes opacity",
    ).toEqual([]);
  });

  it("AX5: every arm hides the harness and no measured node falls between the checks", () => {
    expect(laneCoverageDefects(sf), "the lane's own coverage of what it measures").toEqual([]);
  });

  it("the arms are the four flows the lane claims to cover", () => {
    const titles = [...testBodies(sf).keys()].filter((t) => /axe violations/.test(t));
    expect(titles.length, "an arm was renamed or dropped: retarget these rules").toBe(4);
    expect(titles.join("|"), "the landing/login/setup/room coverage moved").toMatch(/landing/);
    expect(titles.join("|")).toMatch(/login/);
    expect(titles.join("|")).toMatch(/setup/);
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
  const read = () => {
    let a = 1;
    for (let c = document.body; c; c = c.parentElement) a *= Number(getComputedStyle(c).opacity);
    return a + document.body.getBoundingClientRect().width;
  };
  await expect.poll(() => new Promise((resolve) => {
    const before = read();
    setTimeout(() => { const after = read(); resolve(before === after ? 'settled' : 'moving'); }, 9000);
  })).toBe('settled');
};
`;
    const OPACITY_ONLY = `const settleForScan = async (page) => {
  const read = () => getComputedStyle(document.body).opacity;
  await expect.poll(() => new Promise((resolve) => {
    const before = read();
    setTimeout(() => { const after = read(); resolve(before === after ? 'settled' : 'moving'); }, 200);
  })).toBe('settled');
};
`;
    const SELF_ALPHA = `const settleForScan = async (page) => {
  const read = () => getComputedStyle(document.body).opacity + document.body.getBoundingClientRect().width;
  await expect.poll(() => new Promise((resolve) => {
    const before = read();
    setTimeout(() => { const after = read(); resolve(before === after ? 'settled' : 'moving'); }, 200);
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
    expect(settleHelperDefects(fixture(OPACITY_ONLY))).toEqual([
      "settleForScan's signature ignores geometry — a node moved mid-animation reads as unchanged",
      "settleForScan reads each node's own opacity — a fade on an ancestor is invisible to it",
    ]);
    expect(settleHelperDefects(fixture(SELF_ALPHA))).toEqual([
      "settleForScan reads each node's own opacity — a fade on an ancestor is invisible to it",
    ]);
    // The real helper passes, so the arms above are not the only shape accepted.
    expect(settleHelperDefects(parse(SPEC, readRepo(SPEC)))).toEqual([]);
  });

  it("AX4 fires on a pin that misses a mechanism, and passes the real one", () => {
    const NO_TOAST = `async function scanAtRest(page) {
  await page.addStyleTag({ content: '[style*="opacity"]{opacity:1 !important;animation:none !important}' });
  return new AxeBuilder({ page }).analyze();
}
`;
    const NO_ANIMATION_OFF = `async function scanAtRest(page) {
  await page.addStyleTag({ content: '[style*="opacity"]{opacity:1 !important}[data-sonner-toast]{opacity:1 !important}' });
  return new AxeBuilder({ page }).analyze();
}
`;
    const WEAK_PIN = `async function scanAtRest(page) {
  await page.addStyleTag({ content: '[data-sonner-toast]{opacity:1;animation:none}' });
  return new AxeBuilder({ page }).analyze();
}
`;
    expect(scanAtRestDefects(fixture(NO_TOAST))).toEqual([
      "scanAtRest does not pin sonner's toast, whose fade is a @keyframes rule and never appears in the style attribute",
    ]);
    expect(scanAtRestDefects(fixture(NO_ANIMATION_OFF))).toEqual([
      "scanAtRest pins opacity but leaves the animation running, so the next keyframe overwrites the pin",
    ]);
    expect(scanAtRestDefects(fixture(WEAK_PIN))).toEqual([
      "scanAtRest does not pin the inline opacity framer-motion writes per frame",
      "scanAtRest's rule lacks an !important opacity and loses the cascade to the animation",
    ]);
    expect(scanAtRestDefects(parse(SPEC, readRepo(SPEC)))).toEqual([]);
  });

  it("AX5 fires on an arm that keeps the harness, on a reordered arm, and on two checks that disagree", () => {
    const ARM = (stmts: string) => `test('landing has no serious/critical axe violations', async ({ page }) => {
${stmts}});
`;
    const HELPER = (split: string, measure: string) => `
function measuredFailuresOf(unresolved) {
  return unresolved${measure};
}
async function expectNoSeriousViolations(page, ceilings) {
  const unresolved = [];
  const masked = measuredFailuresOf(unresolved);
  expect(masked).toEqual([]);
  const unmeasured = unresolved.filter(${split});
  return unmeasured;
}
`;
    const wellFormed = (inner: string, split: string, measure: string) =>
      fixture(`${HELPER(split, measure)}\n${ARM(inner)}`);

    const BOTH = `!(typeof n.any?.[0]?.data?.fgColor === "string" && typeof n.any?.[0]?.data?.bgColor === "string")`;
    const FILTER = `.filter(({ d }) => typeof d?.fgColor === "string" && typeof d?.bgColor === "string" && Number(d?.contrastRatio) < Number(d?.expectedContrastRatio))`;

    // Baseline: an arm in the right order with the two checks keyed identically.
    expect(
      laneCoverageDefects(wellFormed(`  await hideDevChrome(page);\n  await settleForScan(page);\n  await expectNoSeriousViolations(page, {});\n`, BOTH, FILTER)),
      "the well-formed fixture must not report anything, or the rule is satisfied by nothing"
    ).toEqual([]);

    expect(laneCoverageDefects(wellFormed(`  await settleForScan(page);\n  await expectNoSeriousViolations(page, {});\n`, BOTH, FILTER))).toEqual([
      "landing has no serious/critical axe violations: scans without hiding Next's dev-tools host, so harness chrome sits in the unresolved-contrast count",
    ]);

    expect(
      laneCoverageDefects(wellFormed(`  await settleForScan(page);\n  await hideDevChrome(page);\n  await expectNoSeriousViolations(page, {});\n`, BOTH, FILTER))[0]
    ).toMatch(/hides the dev host after settling/);

    // The one that matters most: the assertion starts requiring only bgColor, so a
    // node with fgColor resolved but bgColor missing is filed nowhere.
    expect(
      laneCoverageDefects(
        wellFormed(
          `  await hideDevChrome(page);\n  await settleForScan(page);\n  await expectNoSeriousViolations(page, {});\n`,
          `!(typeof n.any?.[0]?.data?.bgColor === "string")`,
          FILTER
        )
      )
    ).toContain(
      "the unmeasured split and measuredFailuresOf disagree on fgColor: a node can be neither a failure nor a blind spot, and both checks stay green"
    );

    expect(laneCoverageDefects(fixture(ARM(`  await hideDevChrome(page);\n  await settleForScan(page);\n  await expectNoSeriousViolations(page, {});\n`)))).toEqual([
      "measuredFailuresOf is missing — a node axe measured and did not file would be counted as unmeasurable",
    ]);
  });

  /**
   * The half of the hide that used to be missing.
   *
   * `hideDevChrome` deleted the only node in the page that knew what Next was
   * complaining about, so the harness's own "1 Issue" was reported by the baseline
   * pixels and by nothing else. The rule is on the helper rather than the arms,
   * which is why these fixtures have to build the helper themselves: an arm calling
   * a `hideDevChrome` that this synthetic source does not define is already covered
   * by AX5, and saying nothing here is what keeps that case honest.
   */
  it("AX6 fires on a hide that stops saying what it hid", () => {
    const HIDE_BODIES = `
const measuredFailuresOf = (unresolved) => unresolved.filter(({ d }) => typeof d?.fgColor === "string" && typeof d?.bgColor === "string" && Number(d?.contrastRatio) < Number(d?.expectedContrastRatio));
const expectNoSeriousViolations = async (page, ceilings) => {
  const unresolved = [];
  const failures = measuredFailuresOf(unresolved);
  const unmeasured = unresolved.filter((n) => !(typeof n.any?.[0]?.data?.fgColor === "string" && typeof n.any?.[0]?.data?.bgColor === "string"));
  expect(failures).toEqual([]);
  expect(unmeasured.length).toBeLessThanOrEqual(0);
};
const hideDevChrome = async (page) => {
  await readDevIssues(page);
  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });
  await expect(page.locator("nextjs-portal")).toHaveCount(1);
};
test('landing has no serious/critical axe violations', async ({ page }) => {
  await hideDevChrome(page);
  await settleForScan(page);
  await expectNoSeriousViolations(page, {});
});
`;
    const READER = `const readDevIssues = async (page) => {
  const found = await page.evaluate(() => {
    const acc = { texts: [] };
    const walk = (root, depth) => {
      if (depth > 4) return;
      for (const el of Array.from(root.querySelectorAll("*"))) {
        acc.texts.push(el.textContent);
        if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      }
    };
    const hostEl = document.querySelector("nextjs-portal");
    if (!hostEl || !hostEl.shadowRoot) return null;
    walk(hostEl.shadowRoot, 0);
    return acc;
  });
  console.log("[dev-issues]", page.url(), JSON.stringify(found));
};`;
    const defectsOver = (hide: string, reader = READER) => laneCoverageDefects(fixture(`${reader}\n${hide}`));

    // Well-formed: the reader reaches a shadow root, and the hide calls it first.
    expect(defectsOver(HIDE_BODIES), "the well-formed hide must report nothing, or the rule is satisfied by nothing").toEqual([]);

    expect(defectsOver(HIDE_BODIES.replace("  await readDevIssues(page);\n", ""))).toEqual([
      "hideDevChrome never reads the indicator, so a dev-mode Issue is hidden rather than named",
    ]);

    expect(
      defectsOver(
        HIDE_BODIES.replace("  await readDevIssues(page);\n", "").replace(
          '  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });',
          '  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });\n  await readDevIssues(page);'
        )
      )[0]
    ).toMatch(/reads the indicator after hiding it/);

    expect(defectsOver(HIDE_BODIES, `const readDevIssues = async (page) => {\n  console.log("[dev-issues]", page.url());\n};`)).toEqual([
      "readDevIssues never descends from the host element's shadow root, so it reads the light DOM where the indicator keeps no text and prints the same string whatever the pill says",
    ]);

    // DCM6's shape: the word survives, the descent does not. A check on the token
    // alone is green here, which is how the first version of this rule missed it.
    expect(
      defectsOver(
        HIDE_BODIES,
        `const readDevIssues = async (page) => {
  const found = await page.evaluate(() => {
    const walk = (root) => Array.from(root.querySelectorAll("*")).map((e) => e.textContent);
    const hostEl = document.querySelector("nextjs-portal");
    if (!hostEl) return null;
    const mentioned = hostEl.shadowRoot;
    return { texts: walk(hostEl), attrs: [], mentioned };
  });
  console.log("[dev-issues]", page.url(), JSON.stringify(found));
};`
      )
    ).toEqual([
      "readDevIssues never descends from the host element's shadow root, so it reads the light DOM where the indicator keeps no text and prints the same string whatever the pill says",
    ]);

    expect(defectsOver(HIDE_BODIES, "")).toEqual([
      "readDevIssues is missing, so nothing prints what the dev-tools indicator reports",
    ]);

    // And the real lane, which is the case that has to hold.
    expect(laneCoverageDefects(parse(SPEC, readRepo(SPEC))), "the lane as shipped").toEqual([]);
  });

  it("the corpus is the file the lane actually runs", () => {
    const files = walkRepo("tests", (p) => p.endsWith(".spec.ts")).filter((rel) => /a11y-visual/.test(rel));
    expect(files).toEqual([SPEC]);
  });
});
