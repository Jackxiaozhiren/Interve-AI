/**
 * The Keyboard Shortcuts card on /dashboard/settings is a claim about the
 * product, so it has to be checked against the code that would honour it.
 *
 * Two shapes of drift are red here. A row whose combination nothing handles —
 * the card previously promised `Ctrl / ⌘ + S → 保存设置` ("save settings") on a
 * page that had no save action at all, and the handler behind that shortcut
 * clicks a `button[type=submit]`, which this page does not render. And a second
 * copy of the same list: `useKeyboardShortcuts.ts` exported its own
 * `GLOBAL_SHORTCUT_LIST` with the identical six rows and no consumer, so the
 * claim had two owners and only one of them was rendered.
 *
 * The implemented set is derived from the provider and the chat composer, not
 * restated here, so deleting a handler turns a green suite red.
 */
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/dashboard/settings/page.tsx";
const PROVIDER = "src/components/global-shortcuts-provider.tsx";
const COMPOSER = "src/components/interve-ui/chat/prompt-input.tsx";

function parse(path: string) {
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  return {
    text,
    sf: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

const page = parse(PAGE);
const provider = parse(PROVIDER);
const composer = parse(COMPOSER);

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/** "Ctrl / ⌘ + K" -> "ctrl+k"; "Shift + Enter" -> "shift+enter"; "Esc" -> "escape". */
function normalizeCombo(raw: string): string {
  const parts = raw
    .split("+")
    .flatMap((p) => p.split(/[/\s]+/))
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0 && p !== "⌘");
  const key = parts[parts.length - 1] ?? "";
  const mods = parts.slice(0, -1).filter((p) => p === "ctrl" || p === "shift" || p === "alt");
  const normalizedKey = key === "esc" ? "escape" : key;
  return [...mods, normalizedKey].join("+");
}

// ── what the code actually handles ───────────────────────────────────────────
const implemented = new Set<string>();

walk(provider.sf, (node) => {
  // createCtrlCmdShortcut("k", …) registers ctrl+k and, on macOS, cmd+k.
  if (ts.isCallExpression(node) && node.expression.getText(provider.sf) === "createCtrlCmdShortcut") {
    const first = node.arguments[0];
    if (first && ts.isStringLiteral(first)) implemented.add(`ctrl+${first.text.toLowerCase()}`);
  }
  // A bare { key: "Escape", handler } entry in the useKeyboardShortcuts list.
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (prop.name.getText(provider.sf) !== "key") continue;
      if (ts.isStringLiteral(prop.initializer)) {
        implemented.add(prop.initializer.text.toLowerCase() === "escape" ? "escape" : prop.initializer.text.toLowerCase());
      }
    }
  }
});

// The composer sends on Enter and lets Shift+Enter insert a newline: both halves
// of that are a keydown condition, so look for a comparison against "Enter" and
// whether the same condition also reads shiftKey.
walk(composer.sf, (node) => {
  if (!ts.isBinaryExpression(node)) return;
  const text = node.getText(composer.sf);
  const comparesKey = /(^|[^a-zA-Z])e\.key\s*===\s*["']Enter["']/.test(text);
  if (comparesKey) {
    implemented.add("enter");
    if (text.includes("shiftKey")) implemented.add("shift+enter");
  }
});

// ── what the card claims ────────────────────────────────────────────────────
interface Row {
  keys: string;
  desc: string;
}

const rows: Row[] = [];
walk(page.sf, (node) => {
  if (!ts.isObjectLiteralExpression(node)) return;
  let keys: string | null = null;
  let desc: string | null = null;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.initializer)) continue;
    const name = prop.name.getText(page.sf);
    if (name === "keys") keys = prop.initializer.text;
    if (name === "desc") desc = prop.initializer.text;
  }
  if (keys !== null && desc !== null) rows.push({ keys, desc });
});

describe("the keyboard shortcuts card only claims handled combinations", () => {
  it("has rows to check, and the code registers handlers", () => {
    // Sanity in both directions: an empty card would pass the loop vacuously,
    // and an empty implemented set would make every row a false claim.
    expect(rows.length).toBe(6);
    expect(implemented.size).toBeGreaterThanOrEqual(4);
    expect([...implemented].sort()).toEqual(
      expect.arrayContaining(["ctrl+k", "ctrl+n", "ctrl+s", "escape", "enter", "shift+enter"])
    );
  });

  it("every row is backed by a registration in the provider or the composer", () => {
    for (const row of rows) {
      const combo = normalizeCombo(row.keys);
      expect(implemented.has(combo), `${row.keys} (${combo}) has no handler`).toBe(true);
    }
  });

  it("normalisation maps each distinct row to a distinct combo", () => {
    const combos = rows.map((r) => normalizeCombo(r.keys));
    expect(new Set(combos).size).toBe(combos.length);
    expect(combos).toContain("shift+enter");
  });

  it("describes Ctrl/Cmd+S by its real mechanism, not by a settings save", () => {
    const save = rows.find((r) => normalizeCombo(r.keys) === "ctrl+s");
    expect(save).toBeDefined();
    // The handler clicks the page's submit button; it does not persist settings.
    expect(save?.desc).not.toContain("保存设置");
    expect(save?.desc).toContain("表单");
  });

  it("keeps exactly one owner for the shortcut list", () => {
    const files = readdirSync(new URL("../../src/", import.meta.url), { recursive: true })
      .map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f));
    const claimOwners = files.filter((f) =>
      readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").includes("聚焦搜索框")
    );
    // The provider's own `description` is the machine-readable one; the card is
    // the only rendered copy. A second exported list would be a second owner.
    expect(claimOwners.sort()).toEqual([
      "app/dashboard/settings/page.tsx",
      "components/global-shortcuts-provider.tsx",
    ]);
    expect(provider.text).not.toContain("GLOBAL_SHORTCUT_LIST");
  });
});
