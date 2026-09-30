// The email sign-in path is a demo: login() mints a client-side identity with no
// verification, and stampOwner() then refuses to write content rows without a
// Supabase session, so an account made that way can run an interview but cannot
// keep it.
//
// Both forms already say so — the divider reads 或用演示账号(不保存数据). That copy
// is the candidate's only warning before they spend 40 minutes on a session that
// will not persist, so it is pinned here rather than trusted: rewording the
// divider to something like "快速体验" keeps the sentence flowing and drops the
// disclosure, and no other test notices.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const signup = readFileSync(new URL("../../src/app/signup/page.tsx", import.meta.url), "utf8");
const loginForm = readFileSync(new URL("../../src/components/auth/LoginForm.tsx", import.meta.url), "utf8");

/**
 * Counts placeholder anchors from the parse tree, not the text. A comment-only
 * scan went red on the very comment explaining why the dead link was removed —
 * the same instrument defect that already bit rawFetchCalls and anyEscapes.
 */
function countPlaceholderAnchors(sourceText: string, fileName: string): number {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let n = 0;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const tagName = ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sf)
        : node.openingElement.tagName.getText(sf);
      if (tagName === "a" || tagName === "Link") {
        const attrs = ts.isJsxSelfClosingElement(node)
          ? node.attributes.properties
          : node.openingElement.attributes.properties;
        for (const attr of attrs) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "href") continue;
          const init = attr.initializer;
          if (!init) continue;
          const value = ts.isJsxExpression(init) ? init.expression?.getText(sf) : init.getText(sf);
          if (value === '"#"' || value === "'#'" || value === "{#}") n += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
}

describe("demo-auth disclosure", () => {
  for (const [name, src] of [["signup", signup], ["login", loginForm]]) {
    it(`${name} renders what the demo path costs, in the JSX`, () => {
      // Asserted as JSX text, so a comment that mentions it cannot pass.
      expect(src, `${name} divider`).toMatch(/>\s*或用演示账号\(不保存数据\)/);
    });
  }

  it("promises persistence only for the path that has it", () => {
    // The counterpart line claims reports and replays are saved. If that ever
    // sits under the email form instead of the OAuth one, the page is lying.
    expect(signup).toMatch(/用账号注册[\s\S]{0,400}都会保存/);
    expect(loginForm).toMatch(/用账号登录[\s\S]{0,400}都会保存/);
  });
});

describe("no placeholder links in the auth forms", () => {
  it("has no href=\"#\" dead link", () => {
    // "Forgot password?" was one: dead, and meaningless under demo auth, where
    // no password is ever checked so there is nothing to reset.
    expect(countPlaceholderAnchors(signup, "signup/page.tsx")).toBe(0);
    expect(countPlaceholderAnchors(loginForm, "LoginForm.tsx")).toBe(0);
  });
});
