/**
 * Claims the product cannot support.
 *
 * A link that resolves is not the same as a label that is true: 企业版 pointed at
 * /recruiter, which is a screen of hardcoded candidates, and the closing CTA
 * promised a 14-day trial with no trial, plan or billing code anywhere. Those are
 * placeholders of a kind no anchor check can see, so they are pinned here as
 * text the codebase must not contain, and as text it must.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const SOURCE_FILES = walkRepo("src", (rel) => /\.tsx?$/.test(rel));

/**
 * Reduce a source file to what a user could actually see. JSX block comments are
 * stripped first because the removals are documented in place — a comment saying
 * 企业版 used to link here is history, not a claim — and this is the third time a
 * text scan in this repo has had to learn that comments are not copy.
 */
const prose = (f: string) =>
  read(f)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

/**
 * Every anchor the product can render, as (href as written, element text).
 *
 * Parsed rather than grepped because the claim is about a link, and a link is a
 * shape: a line scan cannot tell the disclaimer 没有企业版 in AboutSection from a
 * footer entry that sells 企业版, and both contain the same four characters.
 * `href` keeps its quotes or backticks so a template href still classifies.
 */
type Anchor = { file: string; href: string; text: string };

function anchors(): Anchor[] {
  const found: Anchor[] = [];
  for (const rel of walkRepo("src", (r) => r.endsWith(".tsx"))) {
    const source = read(rel);
    const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      const open = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (open) {
        const tag = open.tagName.getText(sf);
        if (tag === "Link" || tag === "a") {
          const hrefAttr = open.attributes.properties.find(
            (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "href",
          );
          found.push({
            file: rel,
            href: hrefAttr?.initializer ? hrefAttr.initializer.getText(sf) : "",
            text: node.getText(sf).replace(/\{\/\*[\s\S]*?\*\//g, ""),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

const where = (a: Anchor) => `${a.file} -> ${a.href || "(no href)"}: ${a.text.replace(/\s+/g, " ").slice(0, 90)}`;

describe("no invented commercial claims", () => {
  const FORBIDDEN = [/14\s*天.*试用/, /免费试用/, /数百家/, /顶尖企业/];

  it("appear nowhere in user-visible source", () => {
    const hits = SOURCE_FILES.flatMap((f) => {
      const body = prose(f);
      return FORBIDDEN.filter((re) => re.test(body)).map((re) => `${f}: ${re}`);
    });
    expect(hits).toEqual([]);
  });

  it("are not hiding in a comment that re-states them as history", () => {
    // The filter above drops comment lines, so assert the pattern really is
    // absent from the shipped copy rather than merely unrendered.
    const cta = read("src/components/home/CtaSection.tsx");
    expect(cta).toMatch(/带原文证据的报告/);
    expect(cta).not.toMatch(/试用/);
  });
});

describe("the recruiter screen admits what it is", () => {
  const page = "src/app/recruiter/page.tsx";

  it("carries a demo notice in both languages", () => {
    const dict = read("src/lib/i18n/dictionaries.ts");
    const notices = [...dict.matchAll(/demoNotice:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(notices).toHaveLength(2);
    for (const n of notices) expect(n).toMatch(/demo|演示/i);
  });

  it("renders that notice rather than defining it and forgetting to show it", () => {
    expect(read(page)).toMatch(/t\.recruiter\.demoNotice/);
  });

  it("writes no evaluation rows against invented candidate ids", () => {
    // The handler used to persist notes keyed on mock ids like "C-105", filling a
    // real table with commentary about people who do not exist.
    const body = read(page);
    expect(body).not.toMatch(/db\.evaluations\.(add|update)\(/);
    expect(body).toMatch(/mockCandidates/);
  });

  it("has no button without a handler", () => {
    // 生成报告 was the page's headline action and did nothing when pressed.
    const body = read(page);
    expect(body).not.toMatch(/generateReport/);
  });
});

/**
 * This rule used to read two files. That is a list, and a list cannot fail for a
 * member nobody has written yet: planting
 * `<Link href="/recruiter">企业版</Link>` into terms/page.tsx left all 27 arms green,
 * because the sentence is not in the list rather than because the claim is absent.
 * The sweep is now over every anchor in src — measured as 72 anchors over 27 files —
 * and each arm asks a question of the element, which a disclaimer answers correctly:
 * 没有企业版 in AboutSection is prose about what the product is not, and is not the
 * label of a link, so it passes.
 */
describe("no anchor sells a capability the product does not have", () => {
  const ALL = anchors();

  it("sweeps the corpus, not a hand-written list of footers", () => {
    expect(ALL.length).toBeGreaterThanOrEqual(60);
    expect(new Set(ALL.map((a) => a.file)).size).toBeGreaterThanOrEqual(20);
  });

  it("never names a plan or edition as the label of a link", () => {
    const hits = ALL.filter((a) => /企业版|专业版|旗舰版|团队版|enterprise/i.test(a.text)).map(where);
    expect(hits).toEqual([]);
  });

  it("never offers a machine endpoint as a resource link", () => {
    const hits = ALL.filter((a) => /^["'`]\/api\//.test(a.href)).map(where);
    expect(hits).toEqual([]);
  });

  it("admits the demo wherever it points into the recruiter route from outside it", () => {
    // Inside the route the notice is already on the page; the claim at risk is a
    // navigation element elsewhere in the product leading someone into it.
    const into = ALL.filter(
      (a) => !a.file.startsWith("src/app/recruiter/") && /["'`]\/recruiter/.test(a.href),
    );
    const unlabelled = into.filter((a) => !/演示|[Dd]emo/.test(a.text)).map(where);
    expect(unlabelled).toEqual([]);
  });
});

describe("the site's footer columns do not repeat a destination", () => {
  // Deliberately narrower than the sweep above. This one is about a rendered list,
  // and "the same href appears twice in a file" is not that: knowledge/page.tsx
  // links /setup twice, once in a header action and once in the empty state, and
  // the two render on mutually exclusive branches of `hasData`.
  const files = ["src/components/layout/Footer.tsx", "src/app/landing/page.tsx"];

  it("do not list the same destination twice under different columns", () => {
    for (const f of files) {
      const hrefs = [...prose(f).matchAll(/href="(\/[a-z-]+)"/gi)].map((m) => m[1].toLowerCase());
      const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
      expect(dupes, `${f} repeats ${dupes.join(", ")}`).toEqual([]);
    }
  });
});

describe("the terms page agrees with the product", () => {
  it("acknowledges the recruiter demo instead of only denying it exists", () => {
    const terms = read("src/app/terms/page.tsx");
    expect(terms).toMatch(/未接真实数据的演示/);
    expect(terms).toMatch(/不会.{0,6}被保存/);
  });
});

/**
 * The frequency ceilings a user can actually be refused by, read off the shape
 * the routes hand to the limiter: an object literal carrying both `limit` and
 * `windowMs`. Both spellings are covered — `guardRequest`'s `rateLimit:` option
 * and the one route that calls `checkRateLimit` itself because it reads
 * `formData` — because the card quotes a range over all of them, and a range
 * measured from only the shared path would be short one lane.
 */
function declaredRateLimits(): number[] {
  const out: number[] = [];
  for (const rel of SOURCE_FILES.filter((f) => f.startsWith("src/app/api/"))) {
    const sourceFile = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (
        ts.isObjectLiteralExpression(node) &&
        node.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "windowMs")
      ) {
        for (const p of node.properties) {
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "limit" && ts.isNumericLiteral(p.initializer)) {
            out.push(Number(p.initializer.text));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }
  return out;
}

/**
 * The `/` route is the page a stranger actually lands on, and until this slice
 * it carried more invented proof than `/landing` ever did: 10,000+ active users,
 * 50,000+ completed interviews, a 95% satisfaction rate, a question bank of
 * "100+" that does not exist as data (prompts are generated per session), three
 * pricing tiers with no billing code behind any of them, and a testimonial
 * attributed to a named engineer at a named real employer. The employer and the
 * person are both invented, which is a different order of problem from a round
 * number — so these are pinned structurally, not phrase by phrase.
 */
describe("the homepage asserts nothing it cannot show", () => {
  const HOME = SOURCE_FILES.filter((f) => f.startsWith("src/components/home/"));

  it("renders no invented metric: no literal number carrying a + or % suffix", () => {
    // Derived values are safe here — StatsStrip interpolates a rate it computed
    // from the account's own rows, so `${rate}%` contains no numeric literal to ban.
    const hits = HOME.flatMap((f) =>
      [...prose(f).matchAll(/([0-9][0-9,]*)\s*[+%]/g)].map((m) => `${f}: ${m[0]}`)
    );
    expect(hits).toEqual([]);
  });

  it("attributes no quote to a person", () => {
    const hits = HOME.filter((f) => /<blockquote/.test(prose(f)));
    expect(hits).toEqual([]);
  });

  it("names no employer alongside a person", () => {
    // The removed card read 李明 / 前端工程师 · 腾讯. A middle dot between a role
    // and a company is the shape of every byline in this file family.
    const hits = HOME.filter((f) => /·\s*[\u4e00-\u9fa5]{2,6}\s*(?:<|")/.test(prose(f)));
    expect(hits).toEqual([]);
  });

  it("offers exactly one price, because one price exists", () => {
    const body = prose("src/components/home/PricingSection.tsx");
    expect([...body.matchAll(/¥/g)]).toHaveLength(1);
  });

  it("puts no phantom tier or CTA in the slots that would carry one", () => {
    // Checked as structure, not as a whole-file substring ban: the section's own
    // disclaimer says out loud that 企业版 does not exist, and a guard that
    // indicts a honest negation gets routed around instead of obeyed. Tier names
    // live in <h3>, calls to action live in <InterveButton>.
    const body = prose("src/components/home/PricingSection.tsx");
    const tiers = [...body.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1].trim());
    const ctas = [...body.matchAll(/<InterveButton[^>]*>([^<]*)<\/InterveButton>/g)].map((m) => m[1].trim());
    expect(tiers).toEqual(["免费"]);
    expect(ctas).toEqual(["免费注册"]);
    for (const label of [...tiers, ...ctas]) {
      expect(label).not.toMatch(/企业版|专业版|升级|联系销售/);
    }
  });

  it("has no billing surface for the copy to overreach into", () => {
    // If a checkout route ever lands, this fails and the pricing card gets
    // re-read — that is the point of checking the API surface and not only the prose.
    const api = SOURCE_FILES.filter((f) => f.startsWith("src/app/api/"));
    const billing = api.filter((f) => /billing|checkout|payment|subscription|upgrade/i.test(f));
    expect(billing).toEqual([]);
  });

  it("quotes the two numbers it shows from the code that owns them", () => {
    const body = read("src/components/home/PricingSection.tsx");
    expect(body).toMatch(/INTERVIEW_TYPES\.length/);
    expect(body).toMatch(/DEFAULT_USER_BUDGET_RPD/);
  });

  it("agrees with the budget module about the default ceiling", async () => {
    const { DEFAULT_USER_BUDGET_RPD, defaultUserBudget } = await import("@/lib/api/user-budget");
    expect(DEFAULT_USER_BUDGET_RPD).toBe(200);
    expect(defaultUserBudget()).toBe(DEFAULT_USER_BUDGET_RPD);
  });

  it("admits the guard enforces more than one limit", () => {
    // The disclaimer opened with 唯一限制 — "the only limit" — and named the daily
    // ceiling. `guardRequest` refuses on a per-route per-minute basis and on body
    // size long before a day's allowance is spent, and the frequency one is what a
    // real session trips: ten resume uploads in a minute is ordinary behaviour, and
    // the answer is a 429 the card said could not happen.
    const guard = read("src/lib/api/guard.ts");
    const enforced = ["checkRateLimit(", "readJsonBody(", "checkUserBudget("].filter((call) => guard.includes(call));
    expect(enforced.length, "the shared guard no longer enforces the three checks this arm reads").toBe(3);
    const copy = prose("src/components/home/PricingSection.tsx");
    expect(copy, "the card claims a single limit while the guard enforces several").not.toMatch(/唯一限制/);
    expect(copy, "the card has to name the frequency limit a user actually hits").toMatch(/分钟/);
  });

  it("quotes the frequency range the routes declare", async () => {
    const limits = declaredRateLimits();
    expect(limits.length, "no rate rule parsed — the shape, not the code, changed").toBeGreaterThanOrEqual(10);
    const { RATE_LIMIT_ENVELOPE } = await import("@/lib/api/rate-limit");
    const min = Math.min(...limits);
    const max = Math.max(...limits);
    expect(RATE_LIMIT_ENVELOPE.minPerMinute, `the tightest lane allows ${min}/min, the envelope says otherwise`).toBe(min);
    expect(RATE_LIMIT_ENVELOPE.maxPerMinute, `the loosest lane allows ${max}/min, the envelope says otherwise`).toBe(max);
    // The card prints the envelope instead of restating it, which is how a digit
    // a user reads gets one owner: move a lane and the sentence moves with it,
    // rather than the copy quietly keeping a number nothing allows any more.
    const copy = prose("src/components/home/PricingSection.tsx");
    expect(copy, "the card must interpolate the envelope, not retype it").toMatch(/RATE_LIMIT_ENVELOPE\.minPerMinute/);
    expect(copy).toMatch(/RATE_LIMIT_ENVELOPE\.maxPerMinute/);
    expect(copy, "and still call the limit what it is").toMatch(/分钟/);
  });

  it("counts requests, because a request is not one provider call", async () => {
    // The fuse increments once per validated request. The AI SDK then retries a
    // failed provider call up to `DEFAULT_MAX_RETRIES` times, so one allowed
    // request can be several model calls and the number the card would be quoting
    // in that unit is not measured anywhere.
    const { DEFAULT_MAX_RETRIES } = await import("@/ai/providers/registry");
    expect(DEFAULT_MAX_RETRIES, "if retries are gone, re-read this arm before changing the copy").toBeGreaterThanOrEqual(1);
    const copy = prose("src/components/home/PricingSection.tsx");
    expect(copy, "调用 names provider attempts; the guard counts requests").not.toMatch(/次\s*AI\s*调用|调用（/);
    expect(copy, "the daily number has to be stated in the unit the fuse counts").toMatch(/请求/);
  });

  it("shares the daily ceiling with the network egress and says so", async () => {
    // Proved by spending the allowance, not by reading the line that passes the
    // subject pair: one spent IP refuses a brand-new identity, and a different IP
    // still gets its own. Without the second half this would only show that a
    // budget exists.
    const { checkUserBudget, resetUserBudgets } = await import("@/lib/api/user-budget");
    resetUserBudgets();
    try {
      const route = "pricing-probe-route";
      expect(checkUserBudget(route, ["identity-a", "203.0.113.7"], 1).allowed).toBe(true);
      expect(checkUserBudget(route, ["identity-b", "203.0.113.7"], 1).allowed, "a new identity on a spent egress was let through").toBe(false);
      expect(checkUserBudget(route, ["identity-c", "203.0.113.8"], 1).allowed, "the ceiling became global instead of per-egress").toBe(true);
    } finally {
      resetUserBudgets();
    }
    const copy = prose("src/components/home/PricingSection.tsx");
    expect(copy, "a campus or office network splits one day's allowance, and the card promised a per-account number").toMatch(/出口|同一网络/);
  });

  it("lists only interview types that actually exist", async () => {
    // No pin on the total: the card renders INTERVIEW_TYPES.length, so adding a
    // type keeps the copy true and a length assertion would only punish the work.
    const { INTERVIEW_TYPES } = await import("@/ai/interview/types");
    const ids = INTERVIEW_TYPES.map((t) => t.id);
    for (const id of ["behavioral", "technical", "system-design", "business-case"]) {
      expect(ids, id).toContain(id);
    }
  });
});

/**
 * Where the data actually lives.
 *
 * The stats strip told every visitor — including the signed-out ones, who are
 * shown a hard `0` — that their interviews are "保存在本地 IndexedDB，无需上传".
 * They are not. `db` is `dbClient` (`src/lib/db.ts:182`) and the read behind that
 * number is `supabase.from('interviews').eq('user_id', uid)`
 * (`src/lib/api-client.ts:160-166`), which returns `[]` for an anonymous session:
 * the rows exist server-side precisely because they were uploaded. Observed in
 * the production DOM rather than inferred from the source — the hydrated
 * homepage renders "本地模拟面试 | 0 | 保存在本地 IndexedDB，无需上传".
 *
 * The general rule below is scoped to copy: a module may not name a storage
 * mechanism in text a human reads unless that module touches the mechanism.
 * Comments are deliberately outside it — this repo's comments legitimately
 * describe *other* modules' storage ("Storage is injected: localStorage in
 * prod"), and a gate that indicts accurate prose gets reworded around instead of
 * obeyed. The comments that were simply wrong are therefore pinned by name.
 */
describe("storage mechanisms are named only where they are used", () => {
  const TOKENS: { re: RegExp; key: string }[] = [
    { re: /\bIndexedDB\b|\bindexedDB\b/, key: "indexeddb" },
    { re: /\blocalStorage\b/, key: "localstorage" },
    { re: /\bDexie\b|\bdexie\b/, key: "dexie" },
  ];

  /**
   * Mechanisms the module really touches, from the parse tree: identifiers with
   * those exact names (so `interface SessionStorage` and a `useLocalStorageState`
   * helper do not count) and the `dexie` module specifier. Comments never reach
   * the token tree, which is why an AST and not a text scan.
   */
  const touched = (rel: string): Set<string> => {
    const src = read(rel);
    const sf = ts.createSourceFile(
      rel,
      src,
      ts.ScriptTarget.Latest,
      true,
      rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const used = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n)) {
        if (n.text === "indexedDB") used.add("indexeddb");
        if (n.text === "localStorage") used.add("localstorage");
      }
      if (
        (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
        /^dexie(\/|$)/.test(n.text)
      ) {
        used.add("dexie");
      }
      n.forEachChild(visit);
    };
    visit(sf);
    return used;
  };

  const namedInCopy = (rel: string): string[] => {
    const body = prose(rel);
    return TOKENS.filter((t) => t.re.test(body)).map((t) => t.key);
  };

  it("finds copy that names a mechanism, and code that legitimately does", () => {
    // Non-vacuity, in both directions, derived from the tree rather than typed:
    // with no naming site and no using site the rule below would pass on nothing.
    const namers = SOURCE_FILES.filter((f) => namedInCopy(f).length > 0);
    const users = SOURCE_FILES.filter((f) => touched(f).size > 0);
    expect(users.length, "no module touches a storage mechanism at all").toBeGreaterThan(0);
    expect(namers.length, "no copy names a storage mechanism at all").toBeGreaterThan(0);
  });

  it("no module's copy names a mechanism that module does not use", () => {
    const offenders = SOURCE_FILES.flatMap((f) => {
      const uses = touched(f);
      return namedInCopy(f).filter((key) => !uses.has(key)).map((key) => `${f}: copy says ${key}`);
    });
    expect(offenders).toEqual([]);
  });

  it("the stats strip says where the rows are and does not count for a stranger", () => {
    const copy = prose("src/components/home/StatsStrip.tsx");
    expect(copy).not.toMatch(/IndexedDB|无需上传|本地模拟面试/);
    // The number is the signed-in account's, so the card has to say account.
    expect(copy).toMatch(/账户/);
    const body = read("src/components/home/StatsStrip.tsx");
    // An anonymous read answers `[]`, which would render as a hard zero. Neither
    // the fetch nor the number may run without a session.
    expect(body).toMatch(/if \(!isAuthenticated\) return;/);
    expect(body).toMatch(/isAuthenticated \? counts : null/);
  });

  it("the four comments that named a store the code never opens admit the truth", () => {
    // Measured: `grep -rn "indexedDB" src` returns 0 hits in source positions —
    // no module in this app opens IndexedDB, and none imports dexie.
    for (const f of [
      "src/app/interview/page.tsx",
      "src/components/home/AboutSection.tsx",
      "src/components/home/StatsStrip.tsx",
    ]) {
      expect(read(f), `${f} still claims IndexedDB`).not.toMatch(/\bIndexedDB\b/);
    }
    // Its own catch names the table it failed to read, so the docstring can too.
    expect(read("src/lib/orama-client.ts")).toMatch(/orama_index/);
    expect(read("src/lib/orama-client.ts")).not.toMatch(/from Dexie/);
  });
});

/**
 * The homepage sells a data right — 所有记录随时可以导出或删除. The sentence has two
 * verbs and a scope word, so it is checkable rather than a vibe: the Privacy Center
 * has to bind a real click to a handler that reaches BOTH stores an account holds.
 * Taken off the parse tree, because a page that only mentions `exportAll` in prose
 * would satisfy a text scan.
 */
describe("the export-or-delete promise is backed by a wired handler", () => {
  const PRIVACY = "src/app/dashboard/privacy/page.tsx";
  const CLAIM = /所有记录随时可以导出或删除/;
  // "所有记录" is what makes this two stores and not one: an export that quietly
  // drops the practice sessions would still pass a single-store check.
  const STORES = ["interviews", "practiceSessions"];

  type Reach = { payload: Set<string>; removed: Set<string> };

  /**
   * What each locally-defined click handler really does, from its parse tree:
   * `payload` is the key set of the object handed to `downloadFile`, `removed`
   * the stores it calls `.remove(...)` on. Both are read off the call shapes, not
   * off identifiers in scope — a handler that fetches the practice sessions and
   * then leaves them out of the file must not count as exporting them.
   */
  const rightsHandlers = (src: string) => {
    const file = ts.createSourceFile(PRIVACY, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const onClickNames = new Set<string>();
    const bodies = new Map<string, Reach>();
    const walk = (n: ts.Node) => {
      if (ts.isJsxAttribute(n) && n.name.getText(file) === "onClick" && n.initializer) {
        const bound = /^\{([A-Za-z_$][\w$]*)\}$/.exec(n.initializer.getText(file));
        if (bound) onClickNames.add(bound[1]);
      }
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer &&
        (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
      ) {
        const reach: Reach = { payload: new Set(), removed: new Set() };
        const grab = (c: ts.Node) => {
          if (ts.isCallExpression(c)) {
            const called = ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : c.expression.getText();
            if (called === "downloadFile") {
              c.arguments[0]?.forEachChild((inner) => {
                if (ts.isObjectLiteralExpression(inner)) {
                  for (const prop of inner.properties) {
                    // `interviews,` is a ShorthandPropertyAssignment, so a check on
                    // PropertyAssignment alone would miss exactly one of the stores.
                    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                      reach.payload.add(prop.name.getText(file));
                    }
                  }
                }
              });
            }
            if (called === "remove" && ts.isPropertyAccessExpression(c.expression)) {
              const owner = c.expression.expression;
              if (ts.isPropertyAccessExpression(owner)) reach.removed.add(owner.name.text);
              else if (ts.isIdentifier(owner)) reach.removed.add(owner.text);
            }
          }
          c.forEachChild(grab);
        };
        grab(n.initializer);
        bodies.set(n.name.text, reach);
      }
      n.forEachChild(walk);
    };
    walk(file);
    return { onClickNames, bodies };
  };

  const reachOf = (bodies: Map<string, Reach>, name: string) => bodies.get(name);

  /** Pure: given an extraction, which clicked handlers cover every store this way. */
  const wiredCoveringOf = (
    handlers: { onClickNames: Set<string>; bodies: Map<string, Reach> },
    pick: (r: Reach) => Set<string>
  ) =>
    [...handlers.onClickNames].filter((name) => {
      const r = reachOf(handlers.bodies, name);
      return r !== undefined && STORES.every((s) => pick(r).has(s));
    });

  const wiredCovering = (pick: (r: Reach) => Set<string>) =>
    wiredCoveringOf(rightsHandlers(read(PRIVACY)), pick);

  it("still makes the promise, so the backing check has a subject", () => {
    const promised = SOURCE_FILES.filter(
      (f) => f.startsWith("src/components/home/") && CLAIM.test(prose(f))
    );
    expect(
      promised.length,
      "the copy changed wording; re-read the Privacy Center before re-pinning this"
    ).toBeGreaterThan(0);
  });

  it("has a click whose exported file carries every store", () => {
    const exporters = wiredCovering((r) => r.payload);
    expect(exporters, `no wired download covers ${STORES.join("+")}`).not.toEqual([]);
  });

  it("has a click whose delete reaches every store", () => {
    const deleters = wiredCovering((r) => r.removed);
    expect(deleters, `no wired removal reaches ${STORES.join("+")}`).not.toEqual([]);
  });

  it("counts only what a click reaches, and only what the file contains", () => {
    // Control over the extraction, run through the same function as the cases
    // above. Each arm isolates one reason a real implementation could pass by
    // accident, so neither case is satisfied by prose or by a dead function.
    const shape = `
      const P = () => {
        const exportAll = async () => { downloadFile(JSON.stringify({ exportedAt: 1, interviews, practiceSessions: practice }), name, "application/json"); };
        const deleteAll = async () => { db.interviews.remove(1); db.practiceSessions.remove(2); };
        return <button onClick={exportAll}>Export</button>;
      };`;
    const bound = rightsHandlers(shape);
    expect(wiredCoveringOf(bound, (r) => r.payload)).toEqual(["exportAll"]);
    expect(wiredCoveringOf(bound, (r) => r.removed)).toEqual([]);

    // same handlers, practice dropped from the file: not an export of 所有记录.
    const partial = rightsHandlers(shape.replace(", practiceSessions: practice ", " "));
    expect(wiredCoveringOf(partial, (r) => r.payload), "a one-store file is not a full export").toEqual([]);

    // same handlers, unwired: nothing a candidate can click.
    const dead = rightsHandlers(shape.replace("onClick={exportAll}", "onClick={() => {}}"));
    expect(wiredCoveringOf(dead, (r) => r.payload), "an unwired handler is not reachable").toEqual([]);
  });
});
