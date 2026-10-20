// A provider handoff that comes back failed has to say so on the door.
//
// Reproduced against the production build (not theorised): loading
// `/login#error=access_denied&error_description=User+cancelled+the+flow` renders
// the ordinary sign-in form, mentions the failure nowhere, leaves the fragment in
// the address bar after 3 s, and writes nothing to the console — so a visitor who
// cancelled (or was refused) at the provider sees exactly the page they left, and
// pressing the button again is the only thing available. That is a co-cause of
// "I have to click Google several times before one works".
//
// Why the app is the only place that can notice: with this client's `implicit`
// flowType, the installed auth-js throws `AuthImplicitGrantRedirectError` from
// `_getSessionFromURL` when the fragment carries `error`, `error_description` or
// `error_code`, and `_initialize` returns that error **without notifying any
// subscriber** — the `window.location.hash = ''` that cleans a successful
// handoff is on the success path only, so the fragment survives a reload too.
// Nothing in our own tree read a callback fragment before this file existed
// (`grep -rn "location.hash" src` was empty), so nothing could report it either.
//
// Rules, as predicates:
//   P1  an error-bearing callback yields a message that names the provider code;
//   P2  a callback carrying a session is never consumed and never cleared —
//       that URL belongs to the bridge, and wiping it would log the visitor out;
//   P3  the message quotes no provider text, because `error_description` is
//       gotrue's and Google's wording, not this app's;
//   P4  something in the shipped tree actually calls the consumer (a helper
//       nobody wires reports nothing), and it runs in a mount effect, not during
//       render, so `window` is guaranteed. Measured while writing this: the
//       consumer clears the fragment as it reports, so a second pass over the
//       effect finds nothing and would erase the notice it just caused — the call
//       site has to write state only on a positive read. tests/landing.spec.ts
//       holds that behaviour, because it is invisible to any source-level rule.
//   P5  a clean visit consumes nothing and touches no history entry.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { consumeProviderCallbackFailure } from "../../src/lib/auth";
import { readRepo, walkRepo } from "./repo-tree";

/**
 * A stand-in for `window.location` and `window.history`, narrow on purpose: the
 * consumer needs the fragment, the query and the ability to rewrite the address,
 * and naming exactly those makes the token-safety rule (P2) testable without a
 * browser.
 */
function harness(input: { hash?: string; search?: string; pathname?: string }) {
  const url = {
    hash: input.hash ?? "",
    search: input.search ?? "",
    pathname: input.pathname ?? "/login",
  };
  const rewrites: string[] = [];
  const history = { replace: (next: string) => void rewrites.push(next) };
  return { url, history, rewrites };
}

type Visit = { hash?: string; search?: string; pathname?: string };

function consume(input: Visit) {
  const h = harness(input);
  return { message: consumeProviderCallbackFailure(h.url, h.history), rewrites: h.rewrites };
}

describe("a failed provider handoff is reported", () => {
  it("P1: names the provider code when the callback came back with an error", () => {
    const { message, rewrites } = consume({
      hash: "#error=access_denied&error_description=User+cancelled+the+flow&error_code=user_cancelled",
    });
    expect(message).not.toBeNull();
    expect(message, message ?? "").toContain("access_denied");
    // The address bar is the other half: leaving it there means every reload of
    // the page re-reports a handoff that already happened.
    expect(rewrites).toEqual(["/login"]);
  });

  it("P1: reads a query-shaped callback too, and keeps the params it needs", () => {
    // proxy.ts forwards a guarded visit as /login?from=…, so an error arriving in
    // the query must be reported without destroying where the visitor wanted to go.
    const { message, rewrites } = consume({ search: "?error=server_error&from=%2Fdashboard" });
    expect(message, message ?? "").toContain("server_error");
    expect(rewrites).toEqual(["/login?from=%2Fdashboard"]);
  });

  it("P2: never consumes or clears a callback that carries a session", () => {
    // The mixed pairs are what make the exemption load-bearing. A plain success
    // fragment carries no error keys, so the presence test alone already leaves it
    // alone — drop the exemption and only `#access_token=…&error=…` can tell, which
    // is why both shapes are in one list rather than one arm each.
    for (const fragment of [
      "#access_token=eyJhbGciOi&refresh_token=abc&expires_in=3600&type=implicit",
      "#code=some-pkce-code&state=xyz",
      "#access_token=eyJhbGciOi&error=access_denied",
      "#code=abc&error_description=Something+went+wrong",
    ]) {
      const { message, rewrites } = consume({ hash: fragment });
      expect(message, `${fragment} was treated as a failure`).toBeNull();
      expect(rewrites, `${fragment} was rewritten away`).toEqual([]);
    }
  });

  it("P3: quotes no provider wording in the user-facing sentence", () => {
    const description = "User cancelled the flow";
    const { message } = consume({
      hash: `#error=access_denied&error_description=${encodeURIComponent(description)}`,
    });
    expect(message, message ?? "").not.toContain(description);
    expect(message, message ?? "").not.toContain("cancelled the flow");
  });

  it("P6: echoes only gotrue's own identifiers, not whatever the URL carried", () => {
    // These keys arrive on a URL a third party can construct. React escapes the
    // text, so the risk is not markup — it is the app putting words in its own
    // mouth that a phishing fragment chose.
    for (const hostile of [
      "click-here-to-lose-your-account",
      "x".repeat(200),
      "账号已被锁定，请联系客服",
    ]) {
      const { message } = consume({ hash: `#error=${encodeURIComponent(hostile)}` });
      expect(message, message ?? "").toContain("provider_error");
      expect(message, message ?? "").not.toContain(hostile.slice(0, 20));
    }
  });

  it("P6: still names the codes gotrue really sends", () => {
    // The companion arm proves unknown values degrade; this one proves the
    // allow-list was not emptied into always-degrading, which would pass it.
    for (const code of ["access_denied", "server_error", "identity_not_found"]) {
      expect(consume({ hash: `#error=${code}` }).message, code).toContain(`(${code})`);
    }
  });

  it("P5: a clean visit consumes nothing and touches no history entry", () => {
    for (const visit of [{}, { hash: "#section-2" }, { search: "?from=%2Fsetup" }]) {
      const { message, rewrites } = consume(visit);
      expect(message, `${JSON.stringify(visit)} read as an error`).toBeNull();
      expect(rewrites).toEqual([]);
    }
  });

  it("reports on any of the three keys gotrue uses", () => {
    // auth-js treats error, error_description OR error_code as a failed callback;
    // a reader that only looked for `error` would miss the other two shapes.
    for (const fragment of [
      "#error=provider_error",
      "#error_description=Something+went+wrong",
      "#error_code=no_permission",
    ]) {
      expect(consume({ hash: fragment }).message, fragment).not.toBeNull();
    }
  });
});

describe("the consumer is wired, not just available", () => {
  /** Call sites of a named export, off the AST: a comment naming it is not wiring. */
  function productionCallers(name: string): string[] {
    const found: string[] = [];
    for (const rel of walkRepo("src", (p) => /\.(ts|tsx)$/.test(p))) {
      const source = readRepo(rel);
      if (!source.includes(name)) continue;
      const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === name &&
          // the definition itself is not a caller
          !(ts.isFunctionDeclaration(node.parent) && node.parent.name?.text === name)
        ) {
          found.push(rel);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return [...new Set(found)];
  }

  it("P4: a shipped component consumes the callback on mount", () => {
    const callers = productionCallers("consumeProviderCallbackFailure");
    expect(callers, "nothing calls the consumer, so no failed handoff is ever reported").toEqual([
      "src/components/auth/LoginForm.tsx",
    ]);
    // In an effect, not during render: `window` is not there on the server, and a
    // render-phase history rewrite is a hydration difference waiting to happen.
    const form = readRepo("src/components/auth/LoginForm.tsx");
    const sf = ts.createSourceFile("LoginForm.tsx", form, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let inEffect = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "useEffect" &&
        node.arguments[0] &&
        node.arguments[0].getText(sf).includes("consumeProviderCallbackFailure")
      ) {
        inEffect = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(inEffect, "the consumer runs during render, where window is not guaranteed").toBe(true);
  });

  it("P4: the result reaches a surface that does not time out", () => {
    // The page's transient `error` state clears itself after 5 s. A reason the
    // visitor did not cause must not vanish before they read it, so the notice
    // gets its own state and an announced role.
    const form = readRepo("src/components/auth/LoginForm.tsx");
    expect(form).toMatch(/providerNotice/);
    expect(form, "the notice is not announced to assistive technology").toMatch(/role=["']status["']/);
    expect(form, "the notice shares the 5 s timer with the form errors").not.toMatch(
      /providerNotice\s*=\s*useState[\s\S]{0,400}setTimeout\(\(\)\s*=>\s*setProviderNotice/
    );
  });
});
