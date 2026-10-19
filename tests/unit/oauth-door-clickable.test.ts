// A press must not be discarded by an answer it does not need.
//
// `isLoading` is the mount-time session probe's answer. It starts true on every
// page load and is released only once AuthContext's probe settles. When a
// Supabase session is present that probe is a token refresh plus a `GET /user`,
// i.e. two serial cold round trips to the auth host — measured from the owner's
// own network at 1.50-1.90 s (6 samples of `/auth/v1/health`) and 1.66-2.41 s
// (3 samples of an authorize-shaped request), so the pair can consume the probe's
// entire 4 s cap. Every control below was `disabled` for that window, and a press
// on a disabled button produces literally nothing: no request, no message, no
// hint that the page is still working. That is the reported symptom — "I have to
// click Google several times before one of them works".
//
// None of those presses needed the probe's answer:
//   - starting a provider flow works with or without a session. This client's
//     flowType is `implicit`, so auth-js builds the authorize URL locally and
//     hands it straight to `window.location.assign` — observed in the browser, the
//     press's first network act *is* that navigation, with no round trip in front
//     of it;
//   - a router push is local and synchronous.
// The credential form is the exception and stays gated: a demo `login()` that
// wins the race overwrites the real identity the probe is about to bridge, so
// there its wait is a lock, not a mistake. R1 tells the two apart by what the
// handler does (starts a provider flow, or never waits at all) rather than by
// which button it is on.
//
// R2 exists because the handoff still has to be owned: the provider hop is a
// cross-continental round trip, so a press marks itself in flight (a second press
// must not start a second competing navigation) and takes the mark back if the
// browser never leaves. A lock with no way out is the same dead door in a
// different costume.
//
// Rules, as predicates:
//   R1  a press that needs no session answer is never `disabled` by `isLoading`;
//   R2  an OAuth press writes state before its first await;
//   R3  every file that imports the OAuth entry point calls it;
//   R4  the inventories are non-empty, so R1-R3 cannot pass by seeing nothing;
//   R5  a press that locks its own door can unlock it without an error.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { walkRepo } from "./repo-tree";

/** Component sources — a prose mention in `docs/` must never satisfy a rule. */
const COMPONENT_SOURCES = walkRepo("src", (rel) => rel.endsWith(".tsx"));

const sourceOf = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

function parse(rel: string, source: string): ts.SourceFile {
  return ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function contains(node: ts.Node, predicate: (n: ts.Node) => boolean): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (predicate(n)) found = true;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** The entry point is imported free and also reached off a client. */
const isOAuthCall = (node: ts.Node): boolean => {
  if (!ts.isCallExpression(node)) return false;
  const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
  return ts.isIdentifier(callee) && callee.text === "signInWithOAuth";
};

/** `.then()` / `.finally()` await a promise as surely as the keyword does. */
const isAwait = (node: ts.Node): boolean =>
  ts.isAwaitExpression(node) ||
  (ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    (node.expression.name.text === "then" || node.expression.name.text === "finally"));

/** Like `contains`, but stops at a nested function: a call made by an inner
 *  handler belongs to that handler, not to the component that declares it. */
function containsOwn(node: ts.Node, predicate: (n: ts.Node) => boolean): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (predicate(n)) found = true;
    if (n !== node && ts.isFunctionLike(n)) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function identifiers(sf: ts.SourceFile, node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** A JSX attribute's name; `JsxAttributeName` is an identifier or a namespace. */
const attrName = (a: ts.JsxAttribute): string => (ts.isIdentifier(a.name) ? a.name.text : a.name.getText());

function functionName(fn: ts.Node): string | null {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  if (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
  return null;
}

type Handler = {
  line: number;
  awaits: boolean;
  oauth: boolean;
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
};

/** Named handlers, and whether each waits or opens a provider flow. */
function handlers(sf: ts.SourceFile): Map<string, Handler> {
  const out = new Map<string, Handler>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const name = functionName(node);
      if (name && !out.has(name)) {
        out.set(name, {
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          awaits: containsOwn(node, isAwait),
          oauth: containsOwn(node, isOAuthCall),
          node,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** `const { isLoading } = useAuth()` — the only way a control can read the probe. */
export function readsSessionProbe(source: string): boolean {
  const sf = parse("probe.tsx", source);
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "useAuth" &&
      ts.isObjectBindingPattern(node.name) &&
      node.name.elements.some((e) => ts.isIdentifier(e.name) && e.name.text === "isLoading")
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Components whose controls can be gated on the mount-time probe. */
export function probeGatedFiles(): string[] {
  return COMPONENT_SOURCES.filter((rel) => readsSessionProbe(sourceOf(rel)));
}

/** Files that import the entry point by name, off the AST: a comment that
 *  quotes the import must not be read as wiring. */
function importersOfOAuth(): string[] {
  return COMPONENT_SOURCES.filter((rel) =>
    parse(rel, sourceOf(rel)).statements.some(
      (stmt) =>
        ts.isImportDeclaration(stmt) &&
        stmt.importClause?.namedBindings &&
        ts.isNamedImports(stmt.importClause.namedBindings) &&
        stmt.importClause.namedBindings.elements.some((e) => e.name.text === "signInWithOAuth")
    )
  );
}

const IMPORTERS = importersOfOAuth();

function doorFiles(): string[] {
  return IMPORTERS.filter((rel) => [...handlers(parse(rel, sourceOf(rel))).values()].some((h) => h.oauth));
}

const PROBE_FILES = new Map<string, string>();
for (const rel of probeGatedFiles()) PROBE_FILES.set(rel, sourceOf(rel));
const DOOR_FILES = new Map<string, string>();
for (const rel of doorFiles()) DOOR_FILES.set(rel, sourceOf(rel));

/** A press that needs no probe answer but is gated on one. */
export type LockedPress = {
  file: string;
  line: number;
  reason: "oauth" | "no await";
  disabledRefs: string[];
};

/**
 * Session-independent presses of a file, and the gated subset.
 *
 * A press qualifies when the code behind its `onClick` starts a provider flow
 * (works with or without a session) or never waits on anything. A handler that
 * awaits and does not call a provider — the credential form's `login()` — is
 * not qualified: its gate is a documented race.
 */
export function lockedPresses(files: Map<string, string>): LockedPress[] {
  const out: LockedPress[] = [];
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    const named = handlers(sf);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const onClick = attrs.find((a) => attrName(a) === "onClick");
        const clickExpr =
          onClick?.initializer && ts.isJsxExpression(onClick.initializer) ? onClick.initializer.expression : undefined;
        if (clickExpr) {
          const referenced = identifiers(sf, clickExpr)
            .map((id) => named.get(id))
            .filter((h): h is Handler => h !== undefined);
          const oauth = contains(clickExpr, isOAuthCall) || referenced.some((h) => h.oauth);
          const awaits = contains(clickExpr, isAwait) || referenced.some((h) => h.awaits);
          if (oauth || !awaits) {
            const disabled = attrs.find((a) => attrName(a) === "disabled");
            if (disabled) {
              const init = disabled.initializer;
              const refs = init && ts.isJsxExpression(init) && init.expression ? identifiers(sf, init.expression) : [];
              // `disabled` with no initializer is `disabled={true}` — always locked.
              if (refs.includes("isLoading") || init === undefined) {
                out.push({
                  file: rel,
                  line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
                  reason: oauth ? "oauth" : "no await",
                  disabledRefs: refs.length ? refs : ["<no initializer: always disabled>"],
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

/** Every press the reader can see, gated or not — the inventory R4 counts. */
export function sessionIndependentPresses(files: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    const named = handlers(sf);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const onClick = attrs.find((a) => attrName(a) === "onClick");
        const clickExpr =
          onClick?.initializer && ts.isJsxExpression(onClick.initializer) ? onClick.initializer.expression : undefined;
        if (clickExpr) {
          const referenced = identifiers(sf, clickExpr)
            .map((id) => named.get(id))
            .filter((h): h is Handler => h !== undefined);
          if (contains(clickExpr, isOAuthCall) || referenced.some((h) => h.oauth) || !contains(clickExpr, isAwait)) {
            const tag = ts.isIdentifier(node.tagName) ? node.tagName.text : node.tagName.getText(sf);
            out.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${tag}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

/**
 * A press that locks its own door without a way back.
 *
 * `signInWithOAuth` does not throw when the browser refuses to leave — an
 * extension or a blocked hop resolves the promise and keeps the page. A handler
 * that disables on press and only re-enables in its `catch` therefore leaves a
 * permanently dead door, which is the defect this slice fixes wearing the fix's
 * clothes. The unlock has to be on a timer as well as on the error path.
 */
export function pressesThatNeverUnlock(files: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    for (const handler of handlers(sf).values()) {
      if (!handler.oauth) continue;
      const locks = containsOwn(handler.node, (n) => ts.isCallExpression(n) && /^set[A-Z]/.test(identifiers(sf, n)[0] ?? ""));
      if (!locks) continue;
      const unlocksOnTimer = contains(handler.node, (n) => {
        if (!ts.isCallExpression(n)) return false;
        const fn = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : undefined;
        if (fn !== "setTimeout" && fn !== "setInterval") return false;
        const callback = n.arguments[0];
        return !!callback && contains(callback, (inner) => ts.isCallExpression(inner) && /^set[A-Z]/.test(identifiers(sf, inner)[0] ?? ""));
      });
      if (!unlocksOnTimer) out.push(`${rel}:${handler.line}`);
    }
  }
  return out;
}

/**
 * OAuth handlers that wait before they speak.
 *
 * Flags a handler whose first state write lands after its first await, or that
 * writes no state at all: either way the press is silent for the length of a
 * network round trip, which is how a working button gets pressed three times.
 */
export function pressesWithoutImmediateFeedback(files: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    for (const handler of handlers(sf).values()) {
      if (!handler.oauth) continue;
      const body = handler.node.body;
      if (!body || !ts.isBlock(body)) continue;
      const setter = body.statements.find(
        (stmt) =>
          ts.isExpressionStatement(stmt) &&
          ts.isCallExpression(stmt.expression) &&
          /^set[A-Z]/.test(identifiers(sf, stmt.expression)[0] ?? "")
      );
      let firstAwait = -1;
      const scan = (n: ts.Node) => {
        if (firstAwait === -1 && isAwait(n)) firstAwait = n.getStart(sf);
        if (n !== handler.node && ts.isFunctionLike(n)) return;
        ts.forEachChild(n, scan);
      };
      scan(handler.node);
      if (!setter || firstAwait === -1 || setter.getStart(sf) > firstAwait) {
        out.push(`${rel}:${handler.line}`);
      }
    }
  }
  return out;
}

describe("a sign-in press is never gated on an answer it does not need", () => {
  it("R1: nothing that opens a door waits on the session probe", () => {
    const locked = lockedPresses(PROBE_FILES);
    expect(
      locked.map((p) => `${p.file}:${p.line} (${p.reason}) disabled reads ${p.disabledRefs.join(", ")}`),
      "presses discarded while the mount-time session probe runs"
    ).toEqual([]);
  });

  it("R2: an OAuth press says something before it awaits the provider", () => {
    expect(
      pressesWithoutImmediateFeedback(DOOR_FILES),
      "the press is silent for the length of a network round trip"
    ).toEqual([]);
  });

  it("R5: a press that locks the door can also unlock it without an error", () => {
    expect(
      pressesThatNeverUnlock(DOOR_FILES),
      "the control disables on press and only re-enables on a throw"
    ).toEqual([]);
  });

  it("R3: every file that imports the OAuth entry point calls it", () => {
    expect(IMPORTERS.length, "no door imports signInWithOAuth at all").toBeGreaterThan(0);
    const silent = IMPORTERS.filter((rel) => !doorFiles().includes(rel));
    expect(silent, "imports signInWithOAuth but never calls it").toEqual([]);
  });

  it("R4: the inventories are the ones R1-R2 claim to check", () => {
    // Without this, a reader that went blind — on the probe destructuring, on
    // the handler attribution, or on JSX attributes — turns R1 and R2 green.
    expect([...PROBE_FILES.keys()].sort()).toEqual(
      expect.arrayContaining(["src/app/signup/page.tsx", "src/components/auth/LoginForm.tsx"])
    );
    expect(doorFiles().sort()).toEqual(["src/app/signup/page.tsx", "src/components/auth/LoginForm.tsx"]);
    const presses = sessionIndependentPresses(PROBE_FILES);
    // Measured floor of what the reader sees in the shipped tree: the four
    // provider buttons on the two doors, plus the local-action controls beside
    // them (the password reveal on /login, a dashboard control). A real removal
    // is a deliberate edit to this number, never a silent narrowing of the rule.
    expect(presses.length, `reader saw: ${presses.join(", ")}`).toBeGreaterThanOrEqual(6);
  });
});

describe("the readers can fail", () => {
  const OAUTH_LOCKED = `

import { useState } from "react";
import { signInWithOAuth } from "@/lib/auth";
export function Door({ isLoading }: { isLoading: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const handle = async (provider: "google") => {
    await signInWithOAuth(provider);
  };
  return <button onClick={() => handle("google")} disabled={isLoading}>Google</button>;
}
`;

  const OAUTH_OK = `

import { useState } from "react";
import { signInWithOAuth } from "@/lib/auth";
export function Door({ isLoading }: { isLoading: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const handle = async (provider: "google") => {
    setPending(provider);
    await signInWithOAuth(provider);
  };
  return <button onClick={() => handle("google")} disabled={pending !== null}>Google</button>;
}
`;

  const NAV_LOCKED = `

import { useRouter } from "next/navigation";
export function Cta({ isLoading }: { isLoading: boolean }) {
  const router = useRouter();
  const handleClick = () => router.push("/login");
  return <button onClick={handleClick} disabled={isLoading}>Start</button>;
}
`;

  const CREDENTIAL_LOCKED = `

import { useAuth } from "@/context/AuthContext";
export function Door({ isLoading }: { isLoading: boolean }) {
  const { login } = useAuth();
  const handleLogin = async () => {
    await login({ id: "x", email: "a@b.c", username: "a" });
  };
  return <button onClick={() => handleLogin()} disabled={isLoading}>Sign In</button>;
}
`;

  const PROSE = `

// It used to be <button disabled={isLoading} onClick={() => handle("google")}> and
// handle() called signInWithOAuth without telling the user anything.
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { signInWithOAuth } from "@/lib/auth";
export function Door({ isLoading }: { isLoading: boolean }) {
  const { isAuthenticated } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const handle = async (provider: "google") => { setPending(provider); await signInWithOAuth(provider); };
  const submit = () => undefined;
  return (
    <>
      <button onClick={() => handle("google")} disabled={pending !== null}>Google</button>
      <button onClick={() => submit()} disabled={isAuthenticated}>Sign In</button>
    </>
  );
}
`;

  it("flags an OAuth press gated on the probe, and not one gated on its own press", () => {
    expect(lockedPresses(new Map([["door.tsx", OAUTH_LOCKED]])).map((p) => p.reason)).toEqual(["oauth"]);
    expect(lockedPresses(new Map([["door.tsx", OAUTH_OK]]))).toEqual([]);
  });

  it("flags a navigation press gated on the probe", () => {
    // The line is the `<button>`; asserted as file + reason + gate so editing a
    // fixture's blank leading lines cannot silently retarget this arm.
    expect(
      lockedPresses(new Map([["cta.tsx", NAV_LOCKED]])).map((p) => ({
        file: p.file,
        reason: p.reason,
        disabledRefs: p.disabledRefs,
      }))
    ).toEqual([{ file: "cta.tsx", reason: "no await", disabledRefs: ["isLoading"] }]);
  });

  it("leaves a gated press alone when the handler itself awaits the server", () => {
    // The credential form's exemption, enforced rather than assumed: this fixture
    // is that form's shape and must not be reported.
    expect(lockedPresses(new Map([["door.tsx", CREDENTIAL_LOCKED]]))).toEqual([]);
  });

  it("does not read a lock out of a comment or a different button", () => {
    const files = new Map([["door.tsx", PROSE]]);
    expect(lockedPresses(files), "a non-OAuth button was counted as a door").toEqual([]);
    expect(pressesWithoutImmediateFeedback(files)).toEqual([]);
  });

  it("names the probe only where a control destructures it from useAuth", () => {
    // Page loaders keep their own `isLoading` and legitimately disable buttons
    // while fetching; the rule keys on the probe, not on the identifier.
    expect(readsSessionProbe(OAUTH_LOCKED)).toBe(false);
    expect(readsSessionProbe(CREDENTIAL_LOCKED)).toBe(false);
    expect(
      readsSessionProbe(`const { login, isLoading } = useAuth();
export default function P() { return null; }`)
    ).toBe(true);
    expect(
      readsSessionProbe(`const isLoading = useRef(true);
export default function P() { return null; }`)
    ).toBe(false);
  });

  it("flags a door that only re-opens on an error", () => {
    const NO_RECOVERY = `

import { useState } from "react";
import { signInWithOAuth } from "@/lib/auth";
export function Door() {
  const [pending, setPending] = useState(null);
  const handle = async () => {
    setPending("google");
    try { await signInWithOAuth("google"); }
    catch { setPending(null); }
  };
  return <button onClick={() => handle()} disabled={pending !== null}>Google</button>;
}
`;
    const RECOVERING = NO_RECOVERY.replace(
      "catch { setPending(null); }",
      "catch { setPending(null); } window.setTimeout(() => setPending(null), 5000);"
    );
    expect(pressesThatNeverUnlock(new Map([["door.tsx", NO_RECOVERY]]))).toHaveLength(1);
    expect(pressesThatNeverUnlock(new Map([["door.tsx", RECOVERING]]))).toEqual([]);
    // The replace has to land, or the pair proves nothing.
    expect(RECOVERING).not.toBe(NO_RECOVERY);
  });

  it("flags a press that only speaks after the round trip", () => {
    // Named by file rather than line: the entry is `file:line`, and a fixture's
    // blank leading lines must not be able to retarget this arm.
    const flagged = pressesWithoutImmediateFeedback(new Map([["door.tsx", OAUTH_LOCKED]]));
    expect(flagged.map((entry) => entry.split(":")[0])).toEqual(["door.tsx"]);
    expect(flagged.length, "the component itself was counted as a press").toBe(1);
    expect(pressesWithoutImmediateFeedback(new Map([["door.tsx", OAUTH_OK]]))).toEqual([]);
  });
});
