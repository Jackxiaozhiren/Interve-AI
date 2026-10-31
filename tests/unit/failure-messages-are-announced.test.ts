// A failure that appears after a press must be announced, not just painted.
//
// Four surfaces set a message state after an await and render it inside a plain
// `<div>` / `<motion.div>`:
//
//   src/components/auth/LoginForm.tsx            the credential failure and the
//       provider-press result from `OAuthProviderButtons onResult={setError}` — the
//       message #135 made *visible* still lived in an unroled container;
//   src/app/recruiter/assessments/page.tsx       after `await fetch("/api/parse-jd")`;
//   src/components/interview/GreenRoom.tsx       the microphone-permission failure,
//       the first gate a candidate meets, with its own retry button;
//   src/components/interview/CopilotHints.tsx    the pacing hint (polite is right).
//
// CI cannot see this. `test:e2e:axe` scans the pages as they first render, and these
// containers only mount after an action fails; and axe has no rule that requires an
// asynchronous error to sit in a live region, because WCAG 4.1.3 is AAA. So the lane
// is green while a screen-reader user presses 登录, waits, and is told nothing.
//
// The rules are name-independent — they do not look for a variable called `error`:
//
//   M1  a `useState` value whose setter is called with a string literal, and which a
//       JSX conditional then renders as text, must sit inside a live region
//       (`role="alert"`, `role="status"`, or `aria-live`);
//   M2  in a sign-in door, a message produced inside a `catch` must be *assertive*:
//       the surface clears itself after 5 s (`LoginForm`'s timer), and a polite
//       region can be missed before it is gone;
//   M3  the shapes M1 polices are proven on fixtures, so a rule that stopped seeing
//       ternaries, parenthesised branches, or dynamic roles cannot pass by looking
//       narrower — three of those three blind spots were real, in the first drafts.
//
// Components are excluded from M1 on purpose: `<StateBlocks.ErrorState>` owns its own
// markup and already renders `role="alert"` (src/components/data/StateBlocks.tsx:96),
// which is what `src/app/dashboard/report/[id]/page.tsx:128` goes through. A rule that
// flagged the component as well would demand a role on a tag that renders none.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

type Sources = Map<string, string>;

const liveTree = (): Sources => {
  const map: Sources = new Map();
  for (const rel of walkRepo("src", (p) => p.endsWith(".tsx"))) map.set(rel, readRepo(rel));
  return map;
};

function parse(rel: string, source: string): ts.SourceFile {
  return ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** `[value, setter]` bindings of `useState(...)` in this file. */
/**
 * Message states written by a provider callback rather than a catch.
 *
 * Both doors used to obtain a refusal from their own submit `catch`. After
 * §15.2 = a the doors have no submit: the provider handoff is what can fail, and
 * its result reaches the same state through `onResult={setError}`. The property
 * this file exists to protect — a refusal the page shows must land in a live
 * region — is unchanged, so the analyser learns the second source rather than the
 * assertion being dropped.
 */
function providerMessageStates(sf: ts.SourceFile, bindings: Map<string, string>): Set<string> {
  const setterToValue = new Map([...bindings].map(([value, setter]) => [setter, value]));
  const out = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf).startsWith("on")) {
      const init = node.initializer;
      if (init && ts.isJsxExpression(init) && init.expression && ts.isIdentifier(init.expression)) {
        const name = init.expression.text;
        if (setterToValue.has(name)) out.add(setterToValue.get(name) as string);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function stateBindings(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      /(^|\.)useState$/.test(node.initializer.expression.getText(sf))
    ) {
      const [value, setter] = node.name.elements;
      // `ArrayBindingElement` also covers `OmittedExpression`, which has no `name`, so
      // the narrowing has to go through `isBindingElement` — `value.name &&` typechecks
      // nowhere and vitest's transform would not notice.
      if (
        value &&
        ts.isBindingElement(value) &&
        ts.isIdentifier(value.name) &&
        setter &&
        ts.isBindingElement(setter) &&
        ts.isIdentifier(setter.name)
      ) {
        out.set(value.name.text, setter.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Values whose setter is called with a string literal — a message someone writes. */
function messageStates(sf: ts.SourceFile, bindings: Map<string, string>): Set<string> {
  const setterToValue = new Map([...bindings].map(([value, setter]) => [setter, value]));
  const out = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && setterToValue.has(node.expression.text)) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) out.add(setterToValue.get(node.expression.text) as string);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The same, restricted to literals written inside a `catch` — a refusal, not a hint. */
function catchMessageStates(sf: ts.SourceFile, bindings: Map<string, string>): Set<string> {
  const setterToValue = new Map([...bindings].map(([value, setter]) => [setter, value]));
  const out = new Set<string>();
  const scanBlock = (block: ts.Node) => {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && setterToValue.has(node.expression.text)) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) out.add(setterToValue.get(node.expression.text) as string);
      }
      ts.forEachChild(node, visit);
    };
    visit(block);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCatchClause(node)) scanBlock(node.block);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Static `role="x"` / `aria-live="x"`, or `role={"x"}`; `dynamic` when the value is computed. */
function liveRegionAttribute(sf: ts.SourceFile, node: ts.JsxOpeningLikeElement): string | null {
  for (const prop of node.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue;
    const name = prop.name.getText(sf);
    if (name !== "role" && name !== "aria-live") continue;
    const init = prop.initializer;
    if (!init) return "dynamic";
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) return init.expression.text;
    return "dynamic";
  }
  return null;
}

/**
 * Does this tag put an element on the screen?
 *
 * The last name segment is what lands in the DOM, so `div` and `motion.div` count and
 * `ErrorState` / `StateBlocks.ErrorState` do not. Reading only `ts.isIdentifier` here
 * is a blind spot: it called `motion.div` a component and reported a clean tree that
 * had four unannounced messages in it.
 */
function rendersDomElement(tag: ts.JsxTagNameExpression | undefined): boolean {
  if (!tag) return false;
  if (ts.isIdentifier(tag)) return /^[a-z]/.test(tag.text);
  if (ts.isPropertyAccessExpression(tag)) return /^[a-z]/.test(tag.name.text);
  return true;
}

type Finding = { rel: string; line: number; tag: string; role: string; name: string };

/**
 * Elements whose own children render this message as text.
 *
 * The live region belongs around the *sentence*, not around the whole card: an
 * `role="alert"` container that also holds a retry button and a device picker tells
 * some screen readers to interrupt, then hides the controls. That distinction is what
 * `GreenRoom`'s error card is — so the rule looks for the element that displays the
 * message and accepts a live region on it or on any ancestor up to the branch root.
 */
function messageHolders(node: ts.Node, name: string): ts.JsxOpeningElement[] {
  const out: ts.JsxOpeningElement[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.children.some((c) => ts.isJsxExpression(c) && c.expression && ts.isIdentifier(c.expression) && c.expression.text === name)) {
      if (rendersDomElement(n.openingElement.tagName)) out.push(n.openingElement);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/**
 * Every message rendered by a JSX conditional, outside a live region.
 *
 * `accept` decides which attributes count, which is what lets one walk serve both M1
 * (any live region) and M2 (assertive only).
 */
function unannounced(
  rel: string,
  sf: ts.SourceFile,
  names: Set<string>,
  accept: (role: string | null) => boolean,
): Finding[] {
  const out: Finding[] = [];
  if (!names.size) return out;
  const rootOf = (node: ts.Node): ts.Node => (ts.isParenthesizedExpression(node) ? rootOf(node.expression) : node);
  const check = (branch: ts.Node, name: string) => {
    const root = rootOf(branch);
    for (const holder of messageHolders(root, name)) {
      // An element's attributes live on its `openingElement`, which is a *child* of the
      // JsxElement node, so climbing `parent` alone steps past every ancestor's role
      // without ever reading it. Each step asks the node it landed on for the element
      // that owns the attributes.
      const attributesOf = (node: ts.Node): ts.JsxOpeningLikeElement | null => {
        if (ts.isJsxElement(node)) return node.openingElement;
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) return node;
        return null;
      };
      let satisfied = false;
      let nearest: string | null = null;
      let current: ts.Node | undefined = holder;
      while (current) {
        const owner = attributesOf(current);
        if (owner) {
          const role = liveRegionAttribute(sf, owner);
          if (accept(role)) {
            satisfied = true;
            break;
          }
          if (role !== null && nearest === null) nearest = role;
        }
        if (current === root) break;
        current = current.parent;
      }
      if (satisfied) continue;
      out.push({
        rel,
        line: sf.getLineAndCharacterOfPosition(holder.getStart(sf)).line + 1,
        tag: holder.tagName.getText(sf),
        role: nearest ?? "none",
        name,
      });
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxExpression(node) && node.expression) {
      const e = node.expression;
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && ts.isIdentifier(e.left) && names.has(e.left.text)) {
        check(e.right, e.left.text);
      } else if (ts.isConditionalExpression(e) && ts.isIdentifier(e.condition) && names.has(e.condition.text)) {
        for (const branch of [e.whenTrue, e.whenFalse]) check(branch, e.condition.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function unannouncedMessages(files: Sources): Finding[] {
  const out: Finding[] = [];
  for (const [rel, source] of files) {
    const sf = parse(rel, source);
    const names = messageStates(sf, stateBindings(sf));
    out.push(
      ...unannounced(rel, sf, names, (role) => role === "alert" || role === "status" || role === "polite" || role === "assertive"),
    );
  }
  return out;
}

/** M2: a refusal message in a sign-in door must be assertive, not merely announced. */
export function softAnnouncedRefusals(files: Sources): Finding[] {
  const out: Finding[] = [];
  for (const [rel, source] of files) {
    if (!/auth|signup/.test(rel)) continue;
    const sf = parse(rel, source);
    const names = catchMessageStates(sf, stateBindings(sf));
    out.push(...unannounced(rel, sf, names, (role) => role === "alert" || role === "assertive"));
  }
  return out;
}

const LOGIN = "src/components/auth/LoginForm.tsx";
const SIGNUP = "src/app/signup/page.tsx";
const ASSESSMENTS = "src/app/recruiter/assessments/page.tsx";
const GREENROOM = "src/components/interview/GreenRoom.tsx";
const COPILOT = "src/components/interview/CopilotHints.tsx";

const HEAD = `\n"use client";\nimport { useState } from "react";\n`;
const fixture = (body: string): Sources => new Map([["fixture.tsx", `${HEAD}${body}`]]);

describe("a message the page shows after an await is announced", () => {
  it("M1: no rendered message sits outside a live region", () => {
    const found = unannouncedMessages(liveTree());
    expect(found.map((f) => `${f.rel}:${f.line} <${f.tag}> role=${f.role}`), "an AT user gets no announcement").toEqual([]);
  });

  it("M2: a sign-in door announces a refusal assertively", () => {
    const found = softAnnouncedRefusals(liveTree());
    expect(
      found.map((f) => `${f.rel}:${f.line} <${f.tag}> role=${f.role}`),
      "a polite region on a surface that clears itself in 5s can be missed entirely",
    ).toEqual([]);
  });

  it("M3: the doors announce the same class the same way", () => {
    const tree = liveTree();
    for (const rel of [LOGIN, SIGNUP]) {
      expect(tree.has(rel), `${rel} moved or was renamed: retarget this rule`).toBe(true);
    }
    // Both doors hand the provider result to a message state that lands in a live
    // region; a door that stops doing it silently drops the parity #141 established.
    for (const rel of [LOGIN, SIGNUP]) {
      const sf = parse(rel, tree.get(rel) as string);
      const bindings = stateBindings(sf);
      const names = new Set([
        ...catchMessageStates(sf, bindings),
        ...providerMessageStates(sf, bindings),
      ]);
      expect(names.size, `${rel} no longer writes a refusal message from a catch or a provider callback`).toBeGreaterThan(0);
      expect(unannounced(rel, sf, names, (role) => role === "alert"), `${rel} shows a refusal without asserting it`).toEqual([]);
    }
  });
});

describe("the walk sees every shape a message can be rendered in", () => {
  it("flags an && branch and a parenthesised one", () => {
    const BARE = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return <div onClick={boom}>{error && <div>{error}</div>}</div>;
}
`;
    const PAREN = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return <div onClick={boom}>{error && (<div>{error}</div>)}</div>;
}
`;
    for (const [label, body] of [["bare &&", BARE], ["parenthesised &&", PAREN]] as const) {
      const found = unannouncedMessages(fixture(body));
      expect(found, `${label} spelling was missed`).toHaveLength(1);
      expect(found[0].role, `${label} reported the wrong reason`).toBe("none");
    }
  });

  it("flags a ternary branch that shows the message, and not the one that does not", () => {
    const TERNARY = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return (
    <div onClick={boom}>
      {error ? (
        <div className="card"><p>{error}</p></div>
      ) : (
        <div className="panel"><span>all good</span></div>
      )}
    </div>
  );
}
`;
    const found = unannouncedMessages(fixture(TERNARY));
    expect(found, "the ternary error branch was missed").toHaveLength(1);
    expect(found[0].tag, "the finding should point at the sentence, not the card around it").toBe("p");
    // The reported line is the element that renders the message, not a hand-derived
    // offset: count from the fixture's own text so moving HEAD cannot lie.
    const source = `${HEAD}${TERNARY}`;
    const reported = source.split("\n")[found[0].line - 1];
    expect(reported, `line ${found[0].line} is not the message`).toContain("{error}");
    expect(reported).not.toContain("panel");
  });

  it("accepts a live region on an ancestor inside the branch", () => {
    // The shape the fixes land on: the sentence carries no attribute of its own and
    // the element around it carries the region. Demanding the role on the text node
    // instead would be a stricter rule than accessibility requires, and it would push
    // authors to put `role="alert"` on the card that also holds a retry button.
    const ANCESTOR = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return (
    <div onClick={boom}>
      {error && (
        <div className="card" role="status">
          <div><p>{error}</p></div>
          <button onClick={boom}>Retry</button>
        </div>
      )}
    </div>
  );
}
`;
    expect(unannouncedMessages(fixture(ANCESTOR))).toEqual([]);
    // And the same tree with the role moved outside the branch is not enough: the
    // region has to mount with the message, or nothing is announced.
    const OUTSIDE = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return (
    <div onClick={boom} role="alert">
      {error && <div className="card"><p>{error}</p></div>}
    </div>
  );
}
`;
    expect(unannouncedMessages(fixture(OUTSIDE)), "a permanent region outside the branch was accepted").toHaveLength(1);
  });

  it("accepts a role or an aria-live, and rejects a wrong role or a computed one", () => {
    const SATISFIED = [
      `<div role="alert">{error}</div>`,
      `<div role="status">{error}</div>`,
      `<div aria-live="polite">{error}</div>`,
      `<motion.div role="alert">{error}</motion.div>`,
    ];
    for (const markup of SATISFIED) {
      const body = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return <div onClick={boom}>{error && ${markup}}</div>;
}
`;
      expect(unannouncedMessages(fixture(body)), `${markup} was reported as unannounced`).toEqual([]);
    }
    const REJECTED = [`<div role="button">{error}</div>`, `<div role={which}>{error}</div>`, `<div aria-live={mode}>{error}</div>`];
    for (const markup of REJECTED) {
      const body = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  const which = "alert";
  const mode = "polite";
  return <div onClick={boom}>{error && ${markup}}</div>;
}
`;
      expect(unannouncedMessages(fixture(body)), `${markup} was accepted`).toHaveLength(1);
    }
  });

  it("leaves a component to own its own markup, and names the exclusion in a control", () => {
    const COMPONENT = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return <div onClick={boom}>{error && <ErrorState message={error} />}</div>;
}
`;
    expect(unannouncedMessages(fixture(COMPONENT)), "a component tag was policed as if it rendered a div").toEqual([]);
    // And the same file, one letter away from a DOM tag: `motion.div` renders one.
    const MOTION = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return <div onClick={boom}>{error && <motion.div>{error}</motion.div>}</div>;
}
`;
    expect(unannouncedMessages(fixture(MOTION)), "motion.div was treated as a component and skipped").toHaveLength(1);
  });

  it("reads attributes, not prose: a comment about role=\"alert\" satisfies nothing", () => {
    const CLAIMS = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const boom = () => setError("it failed");
  return (
    <div onClick={boom}>
      {/* role="alert" is applied by the wrapper, so this one is fine. */}
      {error && <div>{error}</div>}
    </div>
  );
}
`;
    expect(unannouncedMessages(fixture(CLAIMS)), "a comment describing a role was read as the role").toHaveLength(1);
  });

  it("M2: a hint may stay polite, a refusal may not", () => {
    const POLITE_REFUSAL = `export default function F() {
  const [error, setError] = useState<string | null>(null);
  const go = () => { try { throw new Error("x"); } catch { setError("Login failed."); } }
  return <div onClick={go}>{error && <p role="status">{error}</p>}</div>;
}
`;
    const POLITE_HINT = `export default function F() {
  const [hint, setHint] = useState<string | null>(null);
  const go = () => setHint("Slow down a little.");
  return <div onClick={go}>{hint && <p role="status">{hint}</p>}</div>;
}
`;
    const tree: Sources = new Map([["src/components/auth/Door.tsx", `${HEAD}${POLITE_REFUSAL}`]]);
    expect(softAnnouncedRefusals(tree), "a catch-produced refusal in a polite region was passed").toHaveLength(1);
    expect(unannouncedMessages(tree), "the same message failed M1 too, so M1 cannot tell hint from refusal").toEqual([]);
    const hintTree: Sources = new Map([["src/components/auth/Door.tsx", `${HEAD}${POLITE_HINT}`]]);
    expect(softAnnouncedRefusals(hintTree), "a hint was held to the assertive standard").toEqual([]);
  });

  it("the five named surfaces are in the scanned tree", () => {
    const tree = liveTree();
    for (const rel of [LOGIN, SIGNUP, ASSESSMENTS, GREENROOM, COPILOT]) {
      expect(tree.has(rel), `${rel} moved or was renamed: retarget this rule`).toBe(true);
    }
    // Each of the four fixed surfaces still writes a literal message from a setter.
    for (const rel of [LOGIN, ASSESSMENTS, GREENROOM, COPILOT]) {
      const sf = parse(rel, tree.get(rel) as string);
      const bindings = stateBindings(sf);
      // LOGIN is the one door that no longer composes its own refusal text: the
      // provider handoff is the only thing that can fail, and it reports through
      // `onResult`. The surface still owns a message state and still renders it in
      // an alert region (M3 above), so the count includes that source. The other
      // three keep the stricter literal-message requirement.
      const owns =
        messageStates(sf, bindings).size +
        (rel === LOGIN ? providerMessageStates(sf, bindings).size : 0);
      expect(owns, `${rel} no longer renders a message state`).toBeGreaterThan(0);
    }
  });
});
