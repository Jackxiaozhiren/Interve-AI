/**
 * A component's first render must be computable on the server.
 *
 * `SystemHealthIndicator` initialised its state with `typeof navigator !==
 * "undefined" ? navigator.onLine : …`. On the server that is the fallback, in the
 * browser it is the real value, so the two paints disagree and React logs a
 * hydration error on `/interview` — a dot that is emerald in the HTML and slate
 * once hydrated. The guard was that no test looked at the console at all.
 *
 * The rule is a shape rule over one file: a `useState` / `useRef` / `useMemo`
 * initializer expression that names a browser global. It does not follow the value
 * through an imported helper, and it deliberately flags the
 * `typeof window !== 'undefined'` form, because a guard that selects *different
 * values* per environment is the bug, not the cure.
 *
 * Why the guard is structural rather than a browser assertion: the mismatch React
 * logs for this bug reaches the dev server's stdout, and a probe with
 * `page.on('console')` saw zero matching messages in both the broken and the fixed
 * build, so a console-sniffing spec here could not fail. This one can.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HOOKS = new Set(["useState", "useRef", "useMemo"]);
const BROWSER_GLOBALS = new Set(["navigator", "window", "document", "localStorage", "sessionStorage"]);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = path.posix.join(dir, entry);
    const abs = new URL(`../../${rel}`, import.meta.url);
    if (statSync(abs).isDirectory()) out.push(...tsxFiles(rel));
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** Does this expression subtree read a browser global, guarded or not? */
function readsBrowserGlobal(node: ts.Node): boolean {
  let hit = false;
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && BROWSER_GLOBALS.has(n.text)) hit = true;
    n.forEachChild(visit);
  };
  visit(node);
  return hit;
}

function offendersIn(rel: string): string[] {
  const src = readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && HOOKS.has(node.expression.text)) {
      const arg = node.arguments[0];
      // No argument (useState()) and a plain literal are both server-computable.
      if (arg && readsBrowserGlobal(arg)) {
        const { line } = sf.getLineAndCharacterOfPosition(arg.getStart(sf));
        found.push(`${rel}:${line + 1} ${node.expression.text}`);
      }
    }
    node.forEachChild(visit);
  };
  sf.forEachChild(visit);
  return found;
}

const all = tsxFiles("src").flatMap(offendersIn);

describe("first render is server-computable", () => {
  it("finds the hook initializer that motivated the rule", () => {
    // Non-vacuity: the exact shape that produced the /interview hydration error.
    const control = ts.createSourceFile("C.tsx", `
      const C = () => {
        const [online] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
        return null;
      };`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let saw = false;
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && HOOKS.has(n.expression.text)) {
        const arg = n.arguments[0];
        if (arg && readsBrowserGlobal(arg)) saw = true;
      }
      n.forEachChild(walk);
    };
    walk(control);
    expect(saw, "the detector no longer detects the bug it was written for").toBe(true);
  });

  it("does not flag an initializer that only mentions a browser global in a nested callback", () => {
    // useState(() => 7) is fine; useState(() => navigator.onLine) is not. Distinguish.
    const safe = ts.createSourceFile("S.tsx", `
      const S = () => {
        const [n] = useState(0);
        const [m] = useState(() => 7);
        useEffect(() => { setN(navigator.onLine ? 1 : 0); }, []);
        return null;
      };`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let hits = 0;
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && HOOKS.has(n.expression.text)) {
        const arg = n.arguments[0];
        if (arg && readsBrowserGlobal(arg)) hits++;
      }
      n.forEachChild(walk);
    };
    walk(safe);
    expect(hits, "a browser read inside useEffect is correct, not a violation").toBe(0);
  });

  it("names every production component that reads a browser global to render itself", () => {
    expect(all, "these initialise state from a browser-only global").toEqual([]);
  });
});
