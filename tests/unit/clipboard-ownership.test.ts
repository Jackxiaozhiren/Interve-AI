/**
 * Nothing may claim a copy succeeded before the browser has agreed.
 *
 * Five affordances copy text (the transcript, both selection menus, the
 * scratchpad, the chat code block). Four of them used to announce success — a
 * toast or a "Copied" state — without ever reading the result of
 * `navigator.clipboard.writeText()`, a promise nobody awaited and a call that
 * throws outright when `navigator.clipboard` is undefined (insecure context).
 * The UI was asserting something it could not have known.
 *
 * Predicates over `src/**`:
 *   1. only the file exporting `copyTextToClipboard` may touch
 *      `navigator.clipboard` or `execCommand`;
 *   2. every call to it is awaited;
 *   3. every success claim (`toast.success` with copy wording, `setCopied(true)`)
 *      sits behind a guard that tests that call's outcome in the same function;
 *   4. the corpus still holds the five claims, so 1-3 cannot go green because
 *      the copy affordances disappeared.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const OWNER_EXPORT = "copyTextToClipboard";
const COPY_CLAIM = /(复制|Copied|copied)/;

interface Analysis {
  findings: string[];
  owner: boolean;
  copyCalls: number;
  claims: number;
}

function parse(label: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    label,
    text,
    ts.ScriptTarget.Latest,
    true,
    label.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function enclosingFunction(node: ts.Node): ts.Node | null {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
}

function bodyBlock(scope: ts.Node): ts.Block | null {
  if (
    ts.isArrowFunction(scope) ||
    ts.isFunctionExpression(scope) ||
    ts.isFunctionDeclaration(scope) ||
    ts.isMethodDeclaration(scope)
  ) {
    return scope.body && ts.isBlock(scope.body) ? scope.body : null;
  }
  return null;
}

/** Index of the statement that directly contains `node` inside `block`. */
function statementIndex(block: ts.Block, node: ts.Node): number {
  let current: ts.Node = node;
  while (current.parent && current.parent !== block) {
    if (ts.isFunctionLike(current)) return -1; // crossed into another function
    current = current.parent;
  }
  if (!current.parent || !ts.isStatement(current)) return -1;
  return block.statements.indexOf(current as ts.Statement);
}

function isCopyCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === OWNER_EXPORT;
}

function resultIdentifiers(scope: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = node.initializer;
      if (ts.isAwaitExpression(init) && isCopyCall(init.expression)) names.add(node.name.text);
    }
    node.forEachChild(visit);
  };
  scope.forEachChild(visit);
  return names;
}

/** An `if` whose test is the copy outcome: bound to a name, or awaited inline. */
function guardsOutcome(node: ts.IfStatement, names: Set<string>, source: ts.SourceFile): boolean {
  const test = node.expression.getText(source);
  return [...names].some((name) => new RegExp(`\\b${name}\\b`).test(test)) || test.includes(OWNER_EXPORT);
}

function containsReturn(node: ts.Node): boolean {
  if (ts.isReturnStatement(node)) return true; // `if (!ok) return;` — the branch *is* the return
  let found = false;
  const visit = (child: ts.Node) => {
    if (ts.isReturnStatement(child)) found = true;
    child.forEachChild(visit);
  };
  node.forEachChild(visit);
  return found;
}

function ifStatementsIn(scope: ts.Node): ts.IfStatement[] {
  const found: ts.IfStatement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node)) found.push(node);
    node.forEachChild(visit);
  };
  scope.forEachChild(visit);
  return found;
}

function claimIsGuarded(claim: ts.Node, scope: ts.Node, names: Set<string>, source: ts.SourceFile): boolean {
  const claimStart = claim.getStart(source);
  const block = bodyBlock(scope);
  for (const guard of ifStatementsIn(scope)) {
    if (!guardsOutcome(guard, names, source)) continue;
    if (guard.getStart(source) >= claimStart) continue;
    if (claimStart <= guard.getEnd()) return true; // the claim lives in the guarded branch
    if (block && containsReturn(guard.thenStatement)) {
      const guardIndex = statementIndex(block, guard);
      const claimIndex = statementIndex(block, claim);
      if (guardIndex >= 0 && claimIndex >= 0 && guardIndex < claimIndex) return true;
    }
  }
  return false;
}

function isCopySuccessClaim(node: ts.Node, source: ts.SourceFile): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression.getText(source);
  if (callee === "setCopied" && node.arguments.length === 1 && node.arguments[0].getText(source) === "true") {
    return true;
  }
  if (callee === "toast.success") {
    const first = node.arguments[0];
    return !!first && COPY_CLAIM.test(first.getText(source));
  }
  return false;
}

function analyze(label: string, text: string): Analysis {
  const source = parse(label, text);
  const rawPlatform: string[] = [];
  const findings: string[] = [];
  let owner = false;
  let copyCalls = 0;
  let claims = 0;
  const pendingClaims: ts.Node[] = [];
  const line = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === OWNER_EXPORT) {
      if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) owner = true;
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "clipboard") {
      if (node.expression.getText(source) === "navigator") {
        rawPlatform.push(`${label}:${line(node)}: touches navigator.clipboard directly`);
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "execCommand") {
      rawPlatform.push(`${label}:${line(node)}: calls execCommand directly`);
    }
    if (isCopyCall(node)) {
      copyCalls += 1;
      if (!node.parent || !ts.isAwaitExpression(node.parent)) {
        findings.push(`${label}:${line(node)}: copy call not awaited`);
      }
    }
    if (isCopySuccessClaim(node, source)) {
      claims += 1;
      pendingClaims.push(node);
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);

  for (const claim of pendingClaims) {
    const scope = enclosingFunction(claim);
    if (!scope) {
      findings.push(`${label}: copy claim outside any function`);
      continue;
    }
    if (!claimIsGuarded(claim, scope, resultIdentifiers(scope), source)) {
      findings.push(`${label}:${line(claim)}: claims a copy the outcome never confirmed`);
    }
  }

  // The owner file is the one place the platform API belongs.
  if (!owner) findings.push(...rawPlatform);
  return { findings, owner, copyCalls, claims };
}

function findSrc(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(process.cwd(), "src"));
  return out;
}

describe("the probe itself (it must be able to fail)", () => {
  it("flags a direct clipboard write in a consumer", () => {
    const code = `const handleCopy = () => { navigator.clipboard.writeText(code); };`;
    expect(analyze("probe.tsx", code).findings[0]).toContain("navigator.clipboard directly");
  });

  it("flags a direct legacy copy command", () => {
    const code = `const handleCopy = () => { document.execCommand("copy"); };`;
    expect(analyze("probe.tsx", code).findings[0]).toContain("execCommand directly");
  });

  it("flags an unawaited helper call", () => {
    const code = `const handleCopy = () => { copyTextToClipboard(code); };`;
    const { findings, copyCalls } = analyze("probe.tsx", code);
    expect(copyCalls).toBe(1);
    expect(findings.some((f) => f.includes("not awaited"))).toBe(true);
  });

  it("flags a success claim placed before the outcome guard", () => {
    const code = `const handleCopy = async () => {
      const ok = await copyTextToClipboard(code);
      toast.success("Copied to clipboard");
      if (!ok) return;
    };`;
    const { findings, claims } = analyze("probe.tsx", code);
    expect(claims).toBe(1);
    expect(findings.some((f) => f.includes("never confirmed"))).toBe(true);
  });

  it("flags a copy state set without ever testing the result", () => {
    const code = `const handleCopy = async () => { await copyTextToClipboard(code); setCopied(true); };`;
    expect(analyze("probe.tsx", code).findings.some((f) => f.includes("never confirmed"))).toBe(true);
  });

  it("leaves a claim in a sibling function unguarded", () => {
    // The guard has to be reachable: an outcome test in another closure proves nothing.
    const code = `const other = async () => { const ok = await copyTextToClipboard(code); if (!ok) return; };
      const show = () => { toast.success("Copied to clipboard"); };`;
    expect(analyze("probe.tsx", code).findings.some((f) => f.includes("never confirmed"))).toBe(true);
  });

  it("accepts the early-guard shape and the guarded-branch shape", () => {
    const earlyGuard = `const handleCopy = async () => {
      const ok = await copyTextToClipboard(code);
      if (!ok) { toast.error("failed"); return; }
      toast.success("Copied to clipboard");
    };`;
    const inlineBranch = `const handleCopy = async () => {
      const ok = await copyTextToClipboard(code);
      if (ok) toast.success("Copied to clipboard"); else toast.error("failed");
    };`;
    const inlineAwait = `const handleCopy = async () => {
      if (!(await copyTextToClipboard(code))) return;
      setCopied(true);
    };`;
    for (const code of [earlyGuard, inlineBranch, inlineAwait]) {
      const { findings, claims } = analyze("probe.tsx", code);
      expect(claims).toBe(1);
      expect(findings).toEqual([]);
    }
  });

  it("recognises its own owner file", () => {
    const code = `export async function copyTextToClipboard(text: string): Promise<boolean> {
      navigator.clipboard.writeText(text);
      document.execCommand("copy");
      return true;
    }`;
    const { owner, findings } = analyze("probe.ts", code);
    expect(owner).toBe(true);
    expect(findings).toEqual([]);
  });
});

describe("src/ clipboard discipline", () => {
  const reports = findSrc().map((file) => {
    const label = path.relative(process.cwd(), file);
    return { label, ...analyze(label, fs.readFileSync(file, "utf8")) };
  });
  const owners = reports.filter((r) => r.owner);

  it("has exactly one file allowed to reach for the platform clipboard", () => {
    expect(owners.map((r) => r.label)).toEqual(["src/lib/clipboard.ts"]);
  });

  it("still ships the five copy claims the rule is written about", () => {
    const claims = reports.reduce((sum, r) => sum + r.claims, 0);
    const consumerCalls = reports
      .filter((r) => !r.owner)
      .reduce((sum, r) => sum + r.copyCalls, 0);
    expect({ claims, consumerCalls }).toEqual({ claims: 5, consumerCalls: 5 });
  });

  it("finds no unowned clipboard access, unawaited call, or unconfirmed success claim", () => {
    expect(reports.flatMap((r) => r.findings)).toEqual([]);
  });
});
