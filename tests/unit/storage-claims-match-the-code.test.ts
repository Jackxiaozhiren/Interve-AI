// A message that says where data went must match where the code sends it.
//
// Two sentences failed that test, both found by resolving the write rather than by
// reading the wording:
//
//   src/app/recruiter/assessments/page.tsx  — `Failed to save to local database.` sits in
//     the catch of a `try` whose only write is `db.assessments.add`, which is
//     `supabase.from('assessments').insert(...)`;
//   src/app/dashboard/privacy/page.tsx      — `无法读取会话列表（数据库未连接时仅本地数据可用）`
//     sits in the catch of a read that only ever queries Supabase, and no line of that
//     file feeds `setSessions` from local storage. The browser snapshot is real, but it
//     is the interview room's recovery mechanism, not this list.
//
// In a product whose privacy centre enumerates what is stored where, error copy that
// names the wrong store is a data-location disclosure, not a wording slip: "it stayed
// local" tells the user nothing left the browser when the row that failed was a cloud
// insert.
//
// Why this is not a word ban. Three honest sentences sit in the same shape and must
// stay green, and the guard treats each as a control:
//
//   `浏览器拒绝访问本地存储。`          — its guarded try calls `localStorage.key` and
//                              `localStorage.removeItem`, so the claim is proven locally;
//   `未连接数据库，本次面试仅保存在当前浏览器。` — the same catch then assigns
//                              `` id = `local-${crypto.randomUUID()}` ``, and
//                              `isPersistableInterviewId` refuses to write such an id, so
//                              the row genuinely cannot leave the browser;
//   `请在浏览器设置中允许麦克风权限`      — about permissions, not storage. Matching on the
//                              word 浏览器 or local alone would flag it.
//
// So the predicate is a *claim plus its contradiction*: a message that names a local
// destination for data, in a flow whose store calls resolve — through a map generated
// from `src/lib/api-client.ts` — to a Supabase table, with no local mechanism anywhere
// in that flow.
//
//   SC1  every `db.<store>.<method>` call shape in the tree must exist in the generated
//        accessor map. This is the anti-vacuity arm: a resolver that silently returned
//        nothing would make SC2 see no cloud writes and pass everything. Measured:
//        24 call shapes against a 27-entry accessor surface.
//   SC2  no contradicted local-destination claim.
//   SC3  the controls: proven-local and permission-wording messages are not reported.
//
// Which rule owns what: `tests/unit/no-unverifiable-claims.test.ts:384` ("storage
// mechanisms are named only where they are used") forbids a module from naming a
// mechanism token — `localStorage`, `IndexedDB`, `Dexie` — in copy it does not touch.
// Neither false sentence above uses a token, which is exactly why that rule stayed
// green while both were wrong. This rule reads the *destination* instead: local words
// in any language, resolved against the operation the guarded flow performs. The two
// are complementary and deliberately do not assert each other's numbers.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

type Sources = Map<string, string>;

const API_CLIENT = "src/lib/api-client.ts";

function parse(rel: string, source: string): ts.SourceFile {
  return ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

const clientTree = (): Sources => {
  const map: Sources = new Map();
  for (const rel of walkRepo("src", (p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))) map.set(rel, readRepo(rel));
  return map;
};

/** `store.method` → the operations it really performs, read off the client. */
export function accessorMap(files: Sources): Map<string, string> {
  const source = files.get(API_CLIENT);
  if (!source) throw new Error(`${API_CLIENT} moved: regenerate this rule's corpus`);
  const sf = parse(API_CLIENT, source);
  const out = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const store = node.name.text;
      for (const prop of node.initializer.properties) {
        if (!(ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop))) continue;
        const method = prop.name.getText(sf).replace(/["']/g, "");
        const ops = new Set<string>();
        const scan = (m: ts.Node) => {
          if (ts.isCallExpression(m) && ts.isPropertyAccessExpression(m.expression)) {
            const inner = m.expression.expression;
            if (ts.isCallExpression(inner) && /(^|\.)from$/.test(inner.expression.getText(sf))) {
              const table = inner.arguments[0] ? inner.arguments[0].getText(sf) : "?";
              ops.add(`${m.expression.name.text}:${table}`);
            }
          }
          ts.forEachChild(m, scan);
        };
        scan(prop);
        if (ops.size) out.set(`${store}.${method}`, [...ops].sort().join(", "));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Every `db.<store>.<method>(…)` call shape the app actually uses. */
export function callShapes(files: Sources): Map<string, string> {
  const out = new Map<string, string>();
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const m = /^db\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(n.expression.getText(sf).replace(/\s+/g, ""));
        if (m && !out.has(`${m[1]}.${m[2]}`)) out.set(`${m[1]}.${m[2]}`, `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

/** A claim that data lives, or was written, somewhere local. */
function isLocalDestinationClaim(text: string): boolean {
  const local = /(local|本机|本地|浏览器|IndexedDB|localStorage|Dexie)/i;
  const storage = /(database|\bdb\b|存储|数据|保存|存|save|saved|write|written|写入)/i;
  return local.test(text) && storage.test(text);
}

function stringClaims(sf: ts.SourceFile, node: ts.Node): string[] {
  const out: string[] = [];
  // Only inside a call that shows a message to the user, or in that call's options
  // object. Scanning every string literal in the flow instead would also match text
  // stored for other reasons, and the claim being policed is the sentence shown.
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(sf);
      if (/(setError|setErrorMsg|setMessage|toast\.(error|info|warning|success)|alert)$/.test(name)) {
        for (const arg of n.arguments) {
          if (ts.isStringLiteral(arg)) {
            if (isLocalDestinationClaim(arg.text)) out.push(arg.text);
          }
          if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) && prop.initializer && ts.isStringLiteral(prop.initializer)) {
                if (isLocalDestinationClaim(prop.initializer.text)) out.push(prop.initializer.text);
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

type Proof = "local-store" | "non-persistable-id" | null;

/**
 * Which mechanism, if any, proves the claim: a local store the flow really touches, or
 * the ``local-`` id shape the client refuses to persist. Two distinct kinds, because a
 * rule that collapses them cannot say which one is still being exercised.
 */
function localProof(sf: ts.SourceFile, tryBlock: ts.Node | undefined, catchNode: ts.Node): Proof {
  const search = (n: ts.Node | undefined): Proof => {
    if (!n) return null;
    let store = false;
    let idShape = false;
    const visit = (m: ts.Node) => {
      if (ts.isPropertyAccessExpression(m) && /^(localStorage|sessionStorage|indexedDB|IDBDatabase)$/.test(m.expression.getText(sf))) store = true;
      if (ts.isIdentifier(m) && /^(localStorage|sessionStorage|indexedDB)$/.test(m.text)) store = true;
      // `id = \`local-${crypto.randomUUID()}\`` — the id the client will not write.
      if (ts.isTemplateExpression(m) && /^local-/.test(m.head.text)) idShape = true;
      if (ts.isStringLiteral(m) && /^local-/.test(m.text)) idShape = true;
      ts.forEachChild(m, visit);
    };
    visit(n);
    return store ? "local-store" : idShape ? "non-persistable-id" : null;
  };
  return search(tryBlock) ?? search(catchNode) ?? null;
}

export interface LocalClaim {
  rel: string;
  line: number;
  claim: string;
  proof: Proof;
  proven: boolean;
  cloud: string;
}

/** The `db.X.Y` shapes a flow performs, read off the given scope. */
function cloudWrites(sf: ts.SourceFile, scope: ts.Node | undefined, map: Map<string, string>): string[] {
  if (!scope) return [];
  const out: string[] = [];
  const scan = (m: ts.Node) => {
    if (ts.isCallExpression(m)) {
      const shape = /^db\.([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)$/.exec(m.expression.getText(sf).replace(/\s+/g, ""));
      if (shape && map.has(shape[1]) && !out.includes(`${shape[1]}->${map.get(shape[1])}`)) out.push(`${shape[1]}->${map.get(shape[1])}`);
    }
    ts.forEachChild(m, scan);
  };
  scan(scope);
  return out;
}

/**
 * Every local-destination claim in a catch, with whether the flow proves it.
 *
 * SC2 asserts an absence, so this list is what keeps that absence honest: a run that
 * saw zero claims and a run where every claim is genuinely proven look identical
 * otherwise. The counts are printed in the assertion messages.
 */
export function localClaims(files: Sources): LocalClaim[] {
  const map = accessorMap(files);
  const out: LocalClaim[] = [];
  for (const [rel, source] of files) {
    if (rel === API_CLIENT) continue;
    const sf = parse(rel, source);
    const visit = (n: ts.Node) => {
      // Both spellings of "the promise failed": a `catch` clause, and the `.catch(h)`
      // of a chain. The privacy page's second load site is the chain form, and reading
      // only catch clauses left it outside the rule.
      const handler =
        ts.isCatchClause(n)
          ? { claims: n.block, guard: n.parent && ts.isTryStatement(n.parent) ? n.parent.tryBlock : undefined, self: n as ts.Node }
          : ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "catch" && n.arguments[0] && (ts.isArrowFunction(n.arguments[0]) || ts.isFunctionExpression(n.arguments[0]))
            ? { claims: n.arguments[0].body, guard: n.parent, self: n as ts.Node }
            : null;
      if (handler) {
        const claims = stringClaims(sf, handler.claims);
        if (claims.length) {
          const proof = localProof(sf, handler.guard, handler.self);
          const cloud = cloudWrites(sf, handler.guard ?? handler.self, map);
          const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          for (const claim of claims) out.push({ rel, line, claim, proof, proven: proof !== null, cloud: cloud.join(", ") });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

/** A claim of local storage in a flow that touches only the cloud. */
export function contradictedClaims(files: Sources): LocalClaim[] {
  return localClaims(files).filter((c) => !c.proven && c.cloud.length > 0);
}

describe("a message about where data went matches where the code sends it", () => {
  const files = clientTree();

  it("SC1: every db accessor the app calls resolves in the generated map", () => {
    const map = accessorMap(files);
    const shapes = callShapes(files);
    expect(shapes.size, "no db.* call shapes found — the corpus or the shape moved").toBeGreaterThan(0);
    expect(map.size, "the accessor map is empty — SC2 would pass on nothing").toBeGreaterThanOrEqual(20);
    const unresolved = [...shapes.keys()].filter((k) => !map.has(k));
    expect(unresolved, `call shapes the map cannot resolve: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("SC1b: the map resolves cloud writes, not just reads", () => {
    const map = accessorMap(files);
    expect(map.get("assessments.add"), "the write behind the false message is not resolving").toBe("insert:'assessments'");
    expect(map.get("interviews.orderBy")).toBe("select:'interviews'");
    expect([...map.values()].some((v) => v.startsWith("delete:")), "no delete op resolved — the map is half-read");
  });

  it("SC2: no message claims a local destination the code contradicts", () => {
    const found = contradictedClaims(files);
    expect(found.map((f) => `${f.rel}:${f.line} "${f.claim}" while ${f.cloud}`), "error copy names the wrong store").toEqual([]);
  });

  it("SC3: both exemption mechanisms are exercised, and nothing is unproven", () => {
    // SC2 asserts an absence, so this arm is what keeps that absence meaningful: the
    // corpus still carries claims, and each exemption kind still has a case to swallow.
    const claims = localClaims(files);
    const appetite = claims.map((c) => `${c.rel}:${c.line} proof=${c.proof ?? "none"} cloud=${c.cloud || "-"}`);
    expect(claims.length, `SC2 would pass on an empty corpus; claims seen:\n${appetite.join("\n")}`).toBeGreaterThanOrEqual(2);
    expect(claims.filter((c) => c.proof === "local-store").length, "nothing is proven by a local store any more: retarget this rule").toBeGreaterThanOrEqual(1);
    expect(claims.filter((c) => c.proof === "non-persistable-id").length, "the `local-` id exemption is no longer exercised").toBeGreaterThanOrEqual(1);
    // The absence itself is SC2's claim; this arm only proves SC2 has something to see.
    expect(claims.every((c) => c.proven), `claims without proof: ${appetite.join("\n")}`).toBe(true);
  });
});

describe("the rules can fail", () => {
  const HEAD = `\n`;

  const withClient = (body: string): Sources =>
    new Map([
      [
        "src/lib/api-client.ts",
        `${HEAD}const assessments = {
  async add(data: any) { const { error } = await supabase.from('assessments').insert(data); if (error) throw error; },
};
export const db = { assessments };
`,
      ],
      ["src/app/x/page.tsx", `${HEAD}${body}`],
    ]);

  it("SC2 fires on the exact sentence that was wrong", () => {
    const FALSE = `export function P() {
  const setError = (s: string) => s;
  const save = async () => {
    try {
      await db.assessments.add({ title: "x" });
    } catch {
      setError("Failed to save to local database.");
    }
  };
  return save;
}
`;
    const found = contradictedClaims(withClient(FALSE));
    expect(found, "a false local-destination claim passed").toHaveLength(1);
    expect(found[0].cloud).toContain("insert:'assessments'");
  });

  it("SC2 sees the claim inside a toast's options object", () => {
    // The privacy page puts the claim in `{ description: "…" }`, second argument. A
    // probe that read only `arguments[0]` missed both of its occurrences.
    const OPTS = `export function P() {
  const reload = async () => {
    try {
      await db.assessments.add({ title: "x" });
    } catch {
      toast.error("加载失败", { description: "数据库未连接时仅本地数据可用" });
    }
  };
  return reload;
}
`;
    expect(contradictedClaims(withClient(OPTS)), "a claim in the options object was invisible").toHaveLength(1);
  });

  it("SC2 stays quiet when the flow proves locality by mechanism", () => {
    const WITH_ID = `export function P() {
  const setError = (s: string) => s;
  let interviewId = "";
  const go = async () => {
    try {
      await db.assessments.add({ title: "x" });
    } catch {
      toast.info("本地模式", { description: "未连接数据库，本次面试仅保存在当前浏览器。" });
      interviewId = \`local-\${crypto.randomUUID()}\`;
    }
  };
  return go;
}
`;
    expect(contradictedClaims(withClient(WITH_ID)), "the honest local-only mode was reported").toEqual([]);
    // The same sentence with the id assignment removed must be reported, which is what
    // proves the exemption is conditional rather than a blanket skip.
    const assignment = 'interviewId = `local-${crypto.randomUUID()}`;';
    expect(WITH_ID, "the fixture does not contain the assignment the exemption keys on").toContain(assignment);
    const WITHOUT = WITH_ID.replace(assignment, 'interviewId = "persistable-id";');
    expect(WITHOUT, "the replacement did not land, so the control below proves nothing").not.toContain("local-");
    expect(contradictedClaims(withClient(WITHOUT)), "an unproven claim passed because the exemption is unconditional").toHaveLength(1);
  });

  it("SC2 sees the promise-chain spelling of a failure", () => {
    const CHAIN = `export function P() {
  const reload = () =>
    db.assessments.add({ title: "x" })
      .then((r) => r)
      .catch(() => { toast.error("加载失败", { description: "数据库未连接时仅本地数据可用" }); });
  return reload;
}
`;
    expect(contradictedClaims(withClient(CHAIN)), "a claim in `.catch(h)` was outside the rule").toHaveLength(1);
  });

  it("SC2 sees a chain that is written across lines", () => {
    // The privacy page breaks each link onto its own line, so the dotted name the
    // matcher reads contains newlines. A fixture written on one line stayed green
    // while the live site was invisible — STG3 escaped for exactly that reason.
    const MULTILINE = `export function P() {
  const reload = () =>
    db.assessments
      .add({ title: "x" })
      .then((r) => r)
      .catch(() => { toast.error("加载失败", { description: "数据库未连接时仅本地数据可用" }); });
  return reload;
}
`;
    expect(contradictedClaims(withClient(MULTILINE)), "a chain split across lines resolved to no cloud write").toHaveLength(1);
  });

  it("SC2 ignores a permission sentence that merely mentions the browser", () => {
    const PERMISSION = `export function P() {
  const setError = (s: string) => s;
  const go = async () => {
    try {
      await db.assessments.add({ title: "x" });
    } catch {
      setError("无法访问麦克风。请在浏览器设置中允许麦克风权限，或重试。");
    }
  };
  return go;
}
`;
    expect(contradictedClaims(withClient(PERMISSION)), "a settings-path sentence was read as a storage claim").toEqual([]);
  });

  it("SC2 reads code, not prose", () => {
    const COMMENT = `export function P() {
  const go = async () => {
    try {
      await db.assessments.add({ title: "x" });
    } catch {
      // the old copy said "Failed to save to local database." and that was wrong.
    }
  };
  return go;
}
`;
    expect(contradictedClaims(withClient(COMMENT)), "a comment quoting the old claim was reported").toEqual([]);
  });

  it("SC1 refuses a map that silently stopped resolving", () => {
    const shapes = callShapes(withClient(`export const f = () => db.assessments.add({});\n`));
    expect(shapes.has("assessments.add")).toBe(true);
    const broken = accessorMap(
      new Map([
        ["src/lib/api-client.ts", `${HEAD}const unrelated = { async nope() { return 1; } };\n`],
        ["src/app/x/page.tsx", `${HEAD}export const f = () => db.assessments.add({});\n`],
      ]),
    );
    expect(broken.size, "an empty map would make SC2 pass on every message").toBe(0);
    const unresolved = [...shapes.keys()].filter((k) => !broken.has(k));
    expect(unresolved, "the containment arm did not notice the resolver going blind").toEqual(["assessments.add"]);
  });
});
