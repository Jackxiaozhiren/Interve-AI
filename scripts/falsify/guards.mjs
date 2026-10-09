#!/usr/bin/env node
// Plant a known defect, prove the named guard rejects it, restore byte-identically.
//
// Why this file exists: a guard that cannot fail is not a guard, and the proof
// that it can fail used to live in a throwaway script under /tmp — which macOS
// reclaims on its own schedule, taking with it the evidence a published report
// cited. This is that proof, in the repo, re-runnable after any refactor.
//
//   node scripts/falsify/guards.mjs              # fast plants (vitest + the ratchet gate)
//   node scripts/falsify/guards.mjs --slow       # also run the browser plants
//   node scripts/falsify/guards.mjs --list       # print the inventory, run nothing
//   node scripts/falsify/guards.mjs --only K3    # one plant by name
//
// Exit 0 requires three things, and reports each separately:
//   1. every selected guard is GREEN before any plant (a red baseline would make
//      "it went red" meaningless, so the run stops there);
//   2. every plant made its guard RED — a plant that stays green is ESCAPED;
//   3. every touched file came back byte-identical.
//
// Anchors are exact strings with an expected occurrence count. If a guard's
// fixture or a product file moves, the anchor check fails loudly rather than
// silently planting nothing — the classic way a falsification battery turns into
// decoration.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const wantSlow = argv.includes("--slow");
const listOnly = argv.includes("--list");
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

const P = (p) => path.join(ROOT, p);
const SETTINGS_PAGE = "src/app/dashboard/settings/page.tsx";
const SETTINGS_SPEC = "tests/settings.spec.ts";
const SETTINGS_UNIT = "tests/unit/settings-controls-are-real.test.ts";
const SHORTCUT_UNIT = "tests/unit/keyboard-shortcut-claims.test.ts";
const ANCHOR_UNIT = "tests/unit/anchor-integrity.test.ts";
const UPLOAD_UNIT = "tests/unit/upload-surface-routing.test.ts";
const DASH_SPEC = "tests/dashboard.spec.ts";
const SHORTCUT_PAGE = SETTINGS_PAGE;
const PROVIDER = "src/components/global-shortcuts-provider.tsx";
const SHORTCUT_HOOK = "src/hooks/useKeyboardShortcuts.ts";
const COMPOSER = "src/components/interve-ui/chat/prompt-input.tsx";
const INTERVIEW_PAGE = "src/app/dashboard/interview/page.tsx";
const RESUME_PAGE = "src/app/dashboard/resume/page.tsx";
const SHELL = "src/app/dashboard/dashboard-shell.tsx";
const STATE_BLOCKS = "src/components/data/StateBlocks.tsx";
const RESUME_SECTION = "src/components/setup/ResumeIntegrationSections.tsx";
const SPECS_UNIT = "tests/unit/specs-must-assert.test.ts";
const SWEEP = "tests/e2e/core-visual-consistency.spec.ts";
const CHAT_ROUTE = "src/app/api/interview-chat/route.ts";
const CHAT_SHAPE = "tests/integration/chat-message-shape.test.ts";
const BRIDGE = "src/lib/message-text.ts";
const INTERVIEW_LAUNCHER = "src/app/interview/page.tsx";
const BRIDGE_UNIT = "tests/unit/ui-message-bridge.test.ts";

const NL = "\n";

/** @type {Array<{name:string,desc:string,kind:"vitest"|"playwright"|"gate",file:string,anchor:string,replacement:string,count?:number,test?:string,pattern?:string,slow?:boolean,create?:string}>} */
const PLANTS = [
  // ── the settings page: nothing may pretend to be a control ────────────────
  {
    name: "S1",
    desc: "sign-out button unwired",
    kind: "vitest",
    file: SETTINGS_PAGE,
    anchor: "onClick={() => void logout()}",
    replacement: "onClick={() => undefined}",
    test: SETTINGS_UNIT,
    pattern: "no button without a handler",
  },
  {
    name: "S2",
    desc: "identity stops reading the session",
    kind: "vitest",
    file: SETTINGS_PAGE,
    anchor: 'value={user?.email ?? "not signed in"}',
    replacement: 'value="e2e@example.com"',
    test: SETTINGS_UNIT,
    pattern: "keeps the reason visible",
  },
  {
    name: "S3",
    desc: "the honest notification sentence deleted to dodge the check",
    kind: "vitest",
    file: SETTINGS_PAGE,
    anchor: "This app has no email sender and no SMS provider, so there are no reminders to switch on.",
    replacement: "Alerts appear in the dashboard.",
    test: SETTINGS_UNIT,
    pattern: "keeps the reason visible",
  },
  // ── the browser spec that used to certify the mock ────────────────────────
  {
    name: "P1",
    desc: "identity hard-coded (second session must disagree)",
    kind: "playwright",
    slow: true,
    file: SETTINGS_PAGE,
    anchor: 'value={user?.email ?? "not signed in"}',
    replacement: 'value="e2e@example.com"',
    test: SETTINGS_SPEC,
    pattern: "identity fields come from the session",
  },
  {
    name: "P2",
    desc: "fabricated prefill and a dead Save Profile return",
    kind: "playwright",
    slow: true,
    file: SETTINGS_PAGE,
    anchor: '              <Label htmlFor="identityUsername">Display name</Label>',
    replacement:
      '              <Label htmlFor="firstName">First Name</Label>' + NL +
      '              <Input id="firstName" defaultValue="Alex" />' + NL +
      '              <Button variant="default">Save Profile</Button>' + NL +
      '              <Label htmlFor="identityUsername">Display name</Label>',
    test: SETTINGS_SPEC,
    pattern: "invented profile and its dead save button",
  },
  {
    name: "P3",
    desc: "sign-out stops working",
    kind: "playwright",
    slow: true,
    file: SETTINGS_PAGE,
    anchor: "onClick={() => void logout()}",
    replacement: "onClick={() => undefined}",
    test: SETTINGS_SPEC,
    pattern: "sign out ends this browser",
  },
  {
    name: "P4",
    desc: "preference toggle stops persisting",
    kind: "playwright",
    slow: true,
    file: SETTINGS_PAGE,
    anchor: "onClick={toggle}",
    replacement: "onClick={() => undefined}",
    test: SETTINGS_SPEC,
    pattern: "preference toggles that remain",
  },
  // ── keyboard shortcut claims ─────────────────────────────────────────────
  {
    name: "K1",
    desc: "card row for an unregistered combination",
    kind: "vitest",
    file: SHORTCUT_PAGE,
    anchor: '                { keys: "Ctrl / ⌘ + N", desc: "新建对话" },',
    replacement:
      '                { keys: "Ctrl / ⌘ + N", desc: "新建对话" },' + NL +
      '                { keys: "Ctrl / ⌘ + J", desc: "打开命令面板" },',
    test: SHORTCUT_UNIT,
    pattern: "has rows to check",
  },
  {
    name: "K2",
    desc: "provider stops registering ctrl+s",
    kind: "vitest",
    file: PROVIDER,
    anchor: '    ...createCtrlCmdShortcut("s", handleSave, {',
    replacement: '    ...createCtrlCmdShortcut("b", handleSave, {',
    test: SHORTCUT_UNIT,
    pattern: "backed by a registration",
  },
  {
    name: "K3",
    desc: "card promises a settings save again",
    kind: "vitest",
    file: SHORTCUT_PAGE,
    anchor: 'desc: "提交本页表单（有提交按钮时）"',
    replacement: 'desc: "保存设置"',
    test: SHORTCUT_UNIT,
    pattern: "real mechanism",
  },
  {
    name: "K4",
    desc: "a second copy of the shortcut list reappears",
    kind: "vitest",
    file: SHORTCUT_HOOK,
    anchor: "export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {",
    replacement:
      'export const GLOBAL_SHORTCUT_LIST = [{ keys: "x", description: "聚焦搜索框" }] as const;' +
      NL + NL + "export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {",
    test: SHORTCUT_UNIT,
    pattern: "exactly one owner",
  },
  {
    name: "K5",
    desc: "composer drops the Shift+Enter branch",
    kind: "vitest",
    file: COMPOSER,
    anchor: 'if (e.key === "Enter" && !e.shiftKey) {',
    replacement: 'if (e.key === "Enter") {',
    test: SHORTCUT_UNIT,
    pattern: "backed by a registration",
  },
  // ── dead controls ratchet ────────────────────────────────────────────────
  {
    name: "G1",
    desc: "a dead button anywhere in src/ must break facts:check",
    kind: "gate",
    file: "src/_falsify_probe.tsx",
    create:
      'export const Probe = () => (' + NL + '  <div>' + NL + '    <Button>Noop</Button>' + NL + "  </div>" + NL + ");" + NL,
    anchor: "",
    replacement: "",
  },
  // ── link-target guard ────────────────────────────────────────────────────
  {
    name: "L1",
    desc: "typo'd route in an href",
    kind: "vitest",
    file: INTERVIEW_PAGE,
    anchor: 'href="/setup"',
    replacement: 'href="/dashbaord"',
    test: ANCHOR_UNIT,
    pattern: "resolves to a page",
  },
  {
    name: "L2",
    desc: "typo'd route in router.push",
    kind: "vitest",
    file: SHELL,
    anchor: 'router.push("/login")',
    replacement: 'router.push("/nope")',
    test: ANCHOR_UNIT,
    pattern: "resolves to a page",
  },
  {
    name: "L3",
    desc: "a link aimed at an API route",
    kind: "vitest",
    file: INTERVIEW_PAGE,
    anchor: 'href="/dashboard"',
    replacement: 'href="/api/session"',
    // Was 2: the hall's third card duplicated the second card's destination, and
    // `/dashboard/resume` was unreachable. The reachability rule fixed both, so
    // only one of these links is left to point at an API route.
    count: 1,
    test: ANCHOR_UNIT,
    pattern: "resolves to a page",
  },
  // ── upload-surface routing ───────────────────────────────────────────────
  {
    name: "U1",
    desc: "both knowledge CTAs back to the marketing homepage",
    kind: "vitest",
    file: "src/app/dashboard/knowledge/page.tsx",
    anchor: '<Link href="/setup">',
    replacement: '<Link href="/">',
    count: 2,
    test: UPLOAD_UNIT,
    pattern: "sends every page that tells the user",
  },
  {
    name: "U2",
    desc: "a second file input appears elsewhere",
    kind: "vitest",
    file: STATE_BLOCKS,
    anchor: "      {actionLabel && actionHref && (",
    replacement: '      <input type="file" aria-hidden />' + NL + "      {actionLabel && actionHref && (",
    test: UPLOAD_UNIT,
    pattern: "exactly one component that can pick a file",
  },
  {
    name: "U3",
    desc: "the one upload surface stops being one",
    kind: "vitest",
    file: RESUME_SECTION,
    anchor: '                type="file"',
    replacement: '                type="text"',
    test: UPLOAD_UNIT,
    pattern: "reaches that component from /setup",
  },
  // ── specs must be able to fail ───────────────────────────────────────────
  {
    name: "V1",
    desc: "a new spec with no assertions appears",
    kind: "vitest",
    file: "tests/_falsify_noassert.spec.ts",
    create:
      "import { test } from '@playwright/test';" + NL +
      "test('silently does nothing', async ({ page }) => {" + NL +
      "  await page.goto('/');" + NL + "});" + NL,
    anchor: "",
    replacement: "",
    test: SPECS_UNIT,
    pattern: "names every assertion-less spec",
  },
  {
    name: "V2",
    desc: "the sweep gains an assertion but keeps its 'zero assertions' row",
    kind: "vitest",
    file: SWEEP,
    anchor: "      await page.goto('/', { waitUntil: 'domcontentloaded' });",
    replacement:
      "      expect(1).toBe(1);" + NL +
      "      await page.goto('/', { waitUntil: 'domcontentloaded' });",
    test: SPECS_UNIT,
    pattern: "keeps the table honest",
  },
  {
    name: "V3",
    desc: "the sweep points again at a route that does not exist",
    kind: "vitest",
    file: SWEEP,
    anchor: "      { url: '/practice', name: 'practice' },",
    replacement:
      "      { url: '/practice', name: 'practice' }," + NL +
      "      { url: '/history', name: 'history' },",
    test: SPECS_UNIT,
    pattern: "does not let the sweep claim routes",
  },

  // ── transport messages must be converted, never cast ─────────────────────
  {
    name: "C1",
    desc: "the route goes back to casting UIMessages as ModelMessage[]",
    kind: "vitest",
    file: CHAT_ROUTE,
    anchor: "const recentMessages = await convertToModelMessages(recentUi);",
    replacement: "const recentMessages = recentUi as unknown as ModelMessage[];",
    test: CHAT_SHAPE,
    pattern: "reaches the provider as a ModelMessage",
  },
  {
    name: "C2",
    desc: "an empty transcript is accepted instead of refused",
    kind: "vitest",
    file: CHAT_ROUTE,
    anchor: "}).passthrough()).min(1).max(100),",
    replacement: "}).passthrough()).min(0).max(100),",
    test: CHAT_SHAPE,
    pattern: "refuses an empty transcript",
  },

  // ── the one bridge that answers a message-shape question ─────────────────
  {
    name: "N1",
    desc: "the session restore goes back to `as never[]`",
    kind: "gate",
    file: INTERVIEW_LAUNCHER,
    anchor: "setMessages(toUiMessages(snapshot.messages));",
    replacement: "setMessages(snapshot.messages as never[]);",
  },
  {
    name: "N2",
    desc: "the bridge stops checking role",
    kind: "vitest",
    file: BRIDGE,
    anchor: "if (!isUiRole(raw.role)) return null;",
    replacement: "if (typeof raw.role !== \"string\") return null;",
    test: BRIDGE_UNIT,
    pattern: "rejects a role the transport cannot carry",
  },
  {
    name: "N3",
    desc: "a message with no text loses its parts array instead of getting an empty one",
    kind: "vitest",
    file: BRIDGE,
    anchor: ": [{ type: \"text\" as const, text: getMessageText(raw) }];",
    replacement: ": [];",
    test: BRIDGE_UNIT,
    pattern: "still yields a total message when there is no text anywhere",
  },

  // ── the version the landing badge states ─────────────────────────────────
  {
    name: "B1",
    desc: "a hero retypes the version instead of interpolating it",
    kind: "vitest",
    file: "src/components/home/HeroSection.tsx",
    anchor: "{`Interve AI v${APP_VERSION} 现已发布`}",
    replacement: "Interve AI 2.0 现已发布",
    test: "tests/unit/app-version-claim.test.ts",
    pattern: "finds no hardcoded brand-plus-number text node anywhere in src/",
  },
  {
    name: "B2",
    desc: "the version constant drifts from the manifest",
    kind: "vitest",
    file: "src/lib/app-version.ts",
    anchor: 'export const APP_VERSION = "1.0.0";',
    replacement: 'export const APP_VERSION = "1.0.1";',
    test: "tests/unit/app-version-claim.test.ts",
    pattern: "is the version the manifest declares",
  },

  // ── the launcher links, in a browser ─────────────────────────────────────
  {
    name: "D1",
    desc: "launcher card back to a bare button",
    kind: "playwright",
    slow: true,
    file: INTERVIEW_PAGE,
    anchor:
      '          <Link href="/setup" className="mt-auto">' + NL +
      '            <InterveButton className="w-full mt-2">开始面试</InterveButton>' + NL +
      "          </Link>",
    replacement: '          <InterveButton className="w-full mt-2">开始面试</InterveButton>',
    test: DASH_SPEC,
    pattern: "cards route to real destinations",
  },
  {
    name: "D2",
    desc: "resume CTA points at a route that does not exist",
    kind: "playwright",
    slow: true,
    file: RESUME_PAGE,
    anchor: '<Link href="/setup">',
    replacement: '<Link href="/nowhere">',
    test: DASH_SPEC,
    pattern: "points at the step that actually parses",
  },

  // ── who navigates where, in both directions ──────────────────────────────
  {
    name: "R1",
    desc: "the sidebar stops linking to the knowledge base (a page goes dark)",
    kind: "vitest",
    file: SHELL,
    anchor: '{ name: "Knowledge Base", href: "/dashboard/knowledge", icon: CloudArrowUp },',
    // Repointed at a route that exists, so the outbound rule stays green and only
    // the inbound rule can fire — a plant that trips two guards proves nothing
    // about either one.
    replacement: '{ name: "Knowledge Base", href: "/dashboard", icon: CloudArrowUp },',
    test: ANCHOR_UNIT,
    pattern: "no route is orphaned beyond the declared list",
  },
  {
    name: "R2",
    desc: "a typo inside a templated router.push",
    kind: "vitest",
    file: "src/components/dashboard/SessionDetailModal.tsx",
    anchor: "`/dashboard/replay/${session.id}`",
    replacement: "`/dashboard/reply/${session.id}`",
    test: ANCHOR_UNIT,
    pattern: "every literal href / router target resolves to a page or a public asset",
  },
];

function run(cmd, args) {
  const proc = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_PROXY: "*", no_proxy: "*" },
  });
  const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
  const summary = out
    .split(NL)
    .filter((l) => /Tests\s+\d|passed \(|failed|ESCAPED|violation/.test(l))
    .slice(-1)[0]
    ?.trim();
  // How many cases actually ran. A `-t` pattern that names nothing leaves every
  // test skipped and the runner exits 0, which would read as "green baseline" and
  // then as "the plant escaped" — a typo'd pattern must be loud instead.
  const matched = /No test files found/.test(out) ? 0 : (out.match(/(\d+) passed/)?.[1] ?? (summary ? "1" : "0"));
  return { rc: proc.status ?? -1, summary: summary ?? `rc ${proc.status}`, ran: Number(matched) };
}

function commandFor(plant) {
  if (plant.kind === "gate") return () => run("node", ["scripts/audit-facts.mjs", "--check"]);
  if (plant.kind === "playwright") {
    return () =>
      run("npx", [
        "playwright", "test",
        "--project=chrome-1280x720", "--reporter=line", "--workers=1",
        "-g", plant.pattern, plant.test,
      ]);
  }
  return () => run("npx", ["vitest", "run", "-t", plant.pattern, plant.test]);
}

const selected = PLANTS.filter((p) => (only ? p.name === only : wantSlow || !p.slow));

if (listOnly) {
  for (const p of selected) console.log(`${p.name.padEnd(3)} ${p.kind.padEnd(9)} ${p.desc}`);
  console.log(`(${selected.length}/${PLANTS.length} selected; --slow adds the browser plants)`);
  process.exit(0);
}

console.log(`falsification: ${selected.length} plants (${wantSlow ? "fast + slow" : "fast; --slow for browser"})`);

// ── 1. green baseline, so that "it went red" means something ────────────────
const groups = new Map();
for (const p of selected) {
  const key = `${p.kind}|${p.test ?? ""}|${p.pattern ?? ""}`;
  if (!groups.has(key)) groups.set(key, p);
}
console.log("baseline (no plant applied):");
let baselineBad = false;
for (const p of groups.values()) {
  const { rc, summary, ran } = commandFor(p)();
  const matched = p.kind === "gate" ? 1 : ran;
  const ok = rc === 0 && matched > 0;
  if (!ok) baselineBad = true;
  const why = rc !== 0 ? "RED" : matched === 0 ? "NO MATCH" : "green";
  console.log(`  ${why.padEnd(9)} ${p.name} ${p.kind} ${p.test ?? "facts:check"} — ${summary}`);
}
if (baselineBad) {
  console.error("REFUSING to plant: a guard that is red, or that matched no test at all, proves nothing. Fix the baseline first.");
  process.exit(2);
}

// ── 2. plant, expect red, restore ───────────────────────────────────────────
const rows = [];
for (const plant of selected) {
  const abs = P(plant.file);
  const original = plant.create ? null : readFileSync(abs, "utf8");
  const count = plant.count ?? 1;

  if (plant.create) {
    // A plant that has to exist as its own file (a new spec, a stray control).
    if (existsSync(abs)) {
      rows.push({ plant, verdict: "REFUSED", note: `${plant.file} already exists` });
      continue;
    }
    writeFileSync(abs, plant.create, "utf8");
    const { rc, summary, ran } = commandFor(plant)();
    rmSync(abs, { force: true });
    const caught = rc !== 0 || ran === 0;
    rows.push({
      plant,
      verdict: caught ? (rc !== 0 ? "red ✓" : "RED VIA NO-MATCH") : "ESCAPED",
      note: `${summary}; removed=${!existsSync(abs)}`,
    });
    continue;
  }

  const parts = original.split(plant.anchor);
  const hits = parts.length - 1;
  if (hits !== count) {
    rows.push({ plant, verdict: "ANCHOR", note: `found ${hits}, expected ${count} — the file moved under this battery` });
    continue;
  }
  // Rejoin every occurrence: replacing only the first leaves a working sibling
  // behind, and the guard correctly stays green — measured, not theorised, when
  // a two-link plant reported ESCAPED for exactly that reason.
  writeFileSync(abs, parts.join(plant.replacement), "utf8");
  if (readFileSync(abs, "utf8") === original) {
    rows.push({ plant, verdict: "NOOP", note: "replacement equals the anchor" });
    writeFileSync(abs, original, "utf8");
    continue;
  }
  const { rc, summary } = commandFor(plant)();
  writeFileSync(abs, original, "utf8");
  const restored = readFileSync(abs, "utf8") === original;
  rows.push({
    plant,
    verdict: rc !== 0 ? (restored ? "red ✓" : "red, NOT RESTORED") : restored ? "ESCAPED" : "ESCAPED, NOT RESTORED",
    note: summary,
  });
}

console.log("plants:");
for (const r of rows) console.log(`  ${r.verdict.padEnd(19)} ${r.plant.name.padEnd(3)} ${r.plant.desc} — ${r.note}`);

const escaped = rows.filter((r) => r.verdict !== "red ✓");
console.log(escaped.length === 0 ? "ALL_PLANTS_CAUGHT" : `${escaped.length} PLANT(S) NOT CAUGHT`);
process.exit(escaped.length === 0 ? 0 : 1);
