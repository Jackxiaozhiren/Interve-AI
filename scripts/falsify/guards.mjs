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
const wantTargets = argv.includes("--targets");
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
const CI_LANES_UNIT = "tests/unit/ci-lane-claims.test.ts";
const BRIDGE = "src/lib/message-text.ts";
const INTERVIEW_LAUNCHER = "src/app/interview/page.tsx";
const BRIDGE_UNIT = "tests/unit/ui-message-bridge.test.ts";
const DASHBOARD_PAGE = "src/app/dashboard/page.tsx";
const DASH_STATS = "src/lib/dashboard-stats.ts";
const RADAR_UNIT = "tests/unit/radar-series.test.ts";
const STREAM_UNIT = "tests/unit/stream-error-path.test.ts";
const CLASSIFIER = "src/lib/api/classify-error.ts";

const NL = "\n";
const GUARDS_SELF = "scripts/falsify/guards.mjs";

/**
 * How many plants the harness must carry.
 *
 * CI runs `npm run falsify`, which prints `ALL_PLANTS_CAUGHT` over whatever
 * plants exist: deleting one left the run green, and nothing in the repo counted
 * them. The floor is the harness's measured size — 68 when this rule landed, 69
 * with FC1, 73 with the four scans, 75 with the two RLS plants, 78 with the three
 * posture plants, 80 with the two rule-arm witnesses, 81 with the walker ratchet, 86 with the
 * five witnesses below, 89 with three more of the same class (a privacy retention
 * sentence, a row-contract field, a workflow trigger) for guards that had never been shown
 * able to fail, 94 with five more (an OAuth redirect that lands behind the guard, a caption
 * that stops promising persistence, a Tailwind class on the root fallback, an Escape handler
 * listening for the legacy code, the frozen schema back in the run order), 99 with the five
 * that came off the same re-measured list (the deadline keyword simplified out of the auth
 * probe, the demo divider reworded into a friendly label, the collector called from a test
 * body, a README that tells a newcomer to run a script which does not exist, and the
 * recruiter page writing notes keyed on invented candidate ids), 100 with the signup
 * provider buttons minting a throwaway identity again — the fake its own source
 * comment records, which no arm read until the arm that now fails on it — 101 with
 * the read-response corpus boundary, which a careless fix can narrow without any
 * assertion moving — 102 with a security document's digit moved off the number the
 * guard measures beside it — and the two that had no proof of failure at all, the
 * emotion-score consumer the practice red line forbids (PRH1) and the language
 * control whose accessible name moved to a sibling element (I18N1), which bring the
 * harness to 104 — and 106 with the two whose absence was a live misdiagnosis rather
 * than a hypothesis: the db-write catch that stopped classifying (DBF1, the 42703
 * column drift reported as "database unavailable") and the baseline lane's one-word
 * typo, whose spec path is eaten by an optional flag (ECP1); 109 with the three whose
 * guard had never been shown to be able to fail at all (RTP1 a rater pack leaking the
 * authored verdict into the blind case file, FIL1 a filler total written past the
 * ledger that owns it, WIZ1 a wizard panel losing the title saying which step you are
 * on); 112 with the three practice red lines never shown to be enforceable (TRU1-3);
 * 116 with the four whose text is the only thing standing between this repo and a
 * privacy claim it cannot keep (RLP1, RLP2, DAS1, RUS1); 118 with the two that only
 * became checkable when their subject got a witness (SEL1, PRV1); 119 with RRP2, the
 * new half of the read-response seam whose other half is RRP1; 124 with the five arms
 * of the registry-driven fence inventory (FEN1-5); 126 with the owner-bridge
 * classification (OBR1 a bridged table dropped from the owner-required set, OBR2 a row
 * type accepted as metadata gaining a candidate-content field); and 128 with the CI
 * ownership table losing either side of itself (CIT1 a job nobody documented, CIT2 a
 * job this repo runs blamed on an outside app); and 131 with the erasure fix (ERS1 a
 * written table missing from the inventory the candidate reads, ERS2 an erase call
 * dropped while its row still promises it, ERS3 an erase scoped by the wrong column so
 * it matches another account or nothing);
 * and it is re-synced in the same commit as any plant that arrives or leaves, so
 * coverage moves with intent rather than drift. FC1 plants a floor one higher
 * than the harness and fails it, which is what keeps this number from quietly
 * becoming a comment.
 */
const MIN_PLANTS = 131;

/** The absence-asserting witnesses, as data: see scripts/falsify/plants.json. */
const ABSENCE_PLANTS = JSON.parse(readFileSync(new URL("./plants.json", import.meta.url), "utf8")).plants;

const STRIP = "src/components/home/StatsStrip.tsx";
const CLAIMS_UNIT = "tests/unit/no-unverifiable-claims.test.ts";

/**
 * Builder for the storage-claim plants, which differ only in the line they
 * break. Written as four object literals, their key-name lines are identical
 * runs, and SonarCloud's new-code gate failed this PR at 20.9% duplication
 * against a 3% limit on nothing else — a table-shaped addition wants a builder,
 * not a template.
 */
const CATCH_UNIT = "tests/unit/catch-reason-resolution.test.ts";

/** Same reason as `claimsPlant`: three records, one shape, no repeated keys. */
const causePlant = (over) => ({
  kind: "vitest",
  test: CATCH_UNIT,
  pattern: "has no logging catch left unclassified",
  ...over,
});

const claimsPlant = (over) => ({
  kind: "vitest",
  file: STRIP,
  test: CLAIMS_UNIT,
  ...over,
});

const PANEL = "src/components/interview/TranscriptPanel.tsx";
const A11Y_UNIT = "tests/unit/transcript-a11y-contract.test.ts";

/** Same reason as `claimsPlant`: three records, one shape, no repeated keys. */
const roomPlant = (over) => ({
  kind: "vitest",
  test: A11Y_UNIT,
  pattern: "exactly one transcript in the room",
  ...over,
});

const THINK_LIB = "src/lib/interview/think-time.ts";
const WINDOW_UNIT = "tests/unit/think-time-window.test.ts";
const FIRST_RENDER_UNIT = "tests/unit/first-render-is-server-computable.test.ts";
const PRIVACY_PAGE = "src/app/dashboard/privacy/page.tsx";

/** Again the same shape (see `claimsPlant`): three records, one builder. */
const rightsPlant = (over) => ({
  kind: "vitest",
  test: CLAIMS_UNIT,
  ...over,
});

/** Again: the window plants share a test and differ only in what they break. */
const windowPlant = (over) => ({
  kind: "vitest",
  test: WINDOW_UNIT,
  ...over,
});

const ARCH_CLAIMS_UNIT = "tests/unit/readme-architecture-claims.test.ts";

/** The default-restatement guard: one file, one arm, so one builder with a default. */
const defaultRestatedPlant = (over) => ({
  kind: "vitest",
  test: "tests/unit/no-redundant-prop-literals.test.ts",
  pattern: "leaves src/ with nothing to explain",
  ...over,
});

const ENV_UNIT = "tests/unit/env-surface.test.ts";
const CSP_UNIT = "tests/unit/csp-scope.test.ts";
const ANON_BRIDGE_UNIT = "tests/unit/anon-bridge-status.test.ts";

/** Both anon-bridge plants aim at the same guard and differ only in what they break. */
const anonBridgePlant = (over) => ({ kind: "vitest", test: ANON_BRIDGE_UNIT, ...over });

/** Two posture guards that assert absence. A plant that recreates the prohibited
 * shape is the only way to show the regex still matches something: `cache-discipline`
 * looks for `'use cache'` and `cacheComponents: true`, `security-surface` for the
 * agentic-loop options, and an empty result and a blind scan look identical. */
const CACHE_UNIT = "tests/unit/cache-discipline.test.ts";
const SECURITY_UNIT = "tests/unit/security-surface.test.ts";
const cachePlant = (over) => ({ kind: "vitest", test: CACHE_UNIT, ...over });
const securityPlant = (over) => ({ kind: "vitest", test: SECURITY_UNIT, ...over });

/**
 * Two guards whose *rule* arm has no witness anywhere else. Both suites carry a
 * "the probe itself" arm that proves their parser recognises the shape — which
 * is not the same as proving the whole-repo assertion can fail. erasure-covers-inventory
 * exists because `orama_index` was listed in the Privacy Center with no way to
 * delete it; route-budget exists because parse-resume's guard outwaited its
 * function. Neither has ever been shown able to bite.
 */
const erasurePlant = (over) => ({ kind: "vitest", test: "tests/unit/erasure-covers-inventory.test.ts", ...over });
const budgetPlant = (over) => ({ kind: "vitest", test: "tests/unit/route-budget.test.ts", ...over });

/**
 * The two guards that read the whole repo and had never been shown able to fail.
 *
 * `env-surface` and `csp-scope` are scans with expectations of `[]`: a rule whose
 * regex stopped matching anything, or a disclosure map edited down to nothing,
 * would report success. Each was written against a mistake that actually
 * happened, so the plants below recreate that mistake rather than a synthetic
 * one — the missing key for env-surface, the phantom Google Fonts origin for
 * csp-scope.
 */
const envRulePlant = (over) => ({ kind: "vitest", test: ENV_UNIT, ...over });
const cspRulePlant = (over) => ({ kind: "vitest", test: CSP_UNIT, ...over });

/**
 * A README architecture number stated one higher than the code measures.
 *
 * All four arms drift the same way — one more registered prompt, one more
 * `generateObject` route, one more fenced prompt file, one more deprecated-API
 * file than the paragraph claims — so the wrong number is computed from the
 * phrase rather than typed next to it. A phrase that stopped carrying a digit
 * would make the plant a no-op instead of silently passing.
 */
const archClaimPlant = (name, desc, anchor, pattern) => ({
  name,
  desc,
  kind: "vitest",
  file: "README.md",
  anchor,
  pattern,
  replacement: anchor.replace(/\d+/, (digits) => String(Number(digits) + 1)),
  test: ARCH_CLAIMS_UNIT,
});

/** @type {Array<{name:string,desc:string,kind:"vitest"|"playwright"|"gate",file:string,anchor:string,replacement:string,count?:number,test?:string,pattern?:string,slow?:boolean,create?:string,argv?:string[]}>} */
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
  {
    name: "G2",
    desc: "a real handler rewired to a no-op closure",
    kind: "gate",
    file: SETTINGS_PAGE,
    anchor: "onClick={() => void logout()}",
    replacement: "onClick={() => {}}",
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

  // ── the visual tier actually has a lane ──────────────────────────────────
  {
    name: "W1",
    desc: "CI stops running the snapshot legs, leaving them uncollected and undeclared",
    kind: "vitest",
    file: ".github/workflows/ci.yml",
    anchor: "      - run: npm run test:e2e:visual",
    replacement: "      - run: npm run test:eval",
    test: CI_LANES_UNIT,
    pattern: "tests no lane runs",
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

  // ── the radar may not draw a number nobody measured ──────────────────────
  {
    name: "D3",
    desc: "the card decides the comparison series from a session count again",
    kind: "vitest",
    file: DASHBOARD_PAGE,
    anchor: "showFirst={radar.comparable}",
    replacement: "showFirst={completedSessions.length > 1}",
    test: RADAR_UNIT,
    pattern: "shows the comparison only when the series has one",
  },
  {
    name: "D4",
    desc: "an absent radar axis goes back to being drawn as zero",
    kind: "vitest",
    file: DASH_STATS,
    anchor: '    .filter((e): e is { id: string; subject: string; A: number } => typeof e.A === "number");',
    replacement: '    .filter((e): e is { id: string; subject: string; A: number } => true);',
    test: RADAR_UNIT,
    pattern: "omits an axis that has no measurement instead of drawing 0",
  },

  // ── a stream that dies after the handler returned still has to say so ─────
  {
    name: "SE1",
    desc: "the primary stream goes back to reporting nothing on failure",
    kind: "vitest",
    file: CHAT_ROUTE,
    anchor: `\
      const response = result.toUIMessageStreamResponse({
        onError: streamErrorNotice(ROUTE, requestId, model || "zhipu"),
      });`,
    replacement: `      const response = result.toUIMessageStreamResponse();`,
    test: STREAM_UNIT,
    pattern: "reports the error on both the primary and the fallback stream",
  },
  {
    name: "SE2",
    desc: "the fallback line loses the reason the primary failed",
    kind: "vitest",
    file: CHAT_ROUTE,
    anchor: `model: model || 'zhipu', fallback: true, reason: classifyUpstreamError(primaryError) });`,
    replacement: `model: model || 'zhipu', fallback: true });`,
    test: STREAM_UNIT,
    pattern: "names the reason when the first model call fails and the fallback takes over",
  },
  {
    name: "SE3",
    desc: "the notice is replaced by the provider's own error text",
    kind: "vitest",
    file: CLASSIFIER,
    anchor: `    return STREAM_ERROR_NOTICE;`,
    replacement: `    return String(error);`,
    test: STREAM_UNIT,
    pattern: "tells the client a fixed sentence that contains no provider detail",
  },
  {
    name: "SE4",
    desc: "no-output collapses back into the structured-output token",
    kind: "vitest",
    file: CLASSIFIER,
    anchor: `  if (NoOutputGeneratedError.isInstance(e)) return "no_output_generated";`,
    replacement: `  if (NoOutputGeneratedError.isInstance(e)) return "no_object_generated";`,
    test: STREAM_UNIT,
    pattern: "distinguishes no-output from no-object",
  },
  {
    // The wiring count is the other half of this lane's guard, and it is keyed on
    // a call rather than on an argument name (see classify-error.test.ts).
    name: "SE5",
    desc: "a route stops classifying its upstream failure",
    kind: "vitest",
    file: "src/app/api/generate-hint/route.ts",
    anchor: `reason: classifyUpstreamError(e) });`,
    replacement: `reason: String(e) });`,
    test: "tests/unit/classify-error.test.ts",
    // `-t` is a regex, so the pattern stops before the title's parentheses.
    pattern: "every route that can fail upstream names how it failed",
  },

  // ── the mock of the SDK must not enumerate the SDK ────────────────────────
  {
    name: "MH1",
    desc: "the SDK mock goes back to a closed factory",
    kind: "vitest",
    file: "tests/unit/degradation-matrix.test.ts",
    anchor: `  return { ...actual, generateObject: vi.fn(), generateText: vi.fn() };`,
    replacement: `  return { generateObject: vi.fn(), generateText: vi.fn() };`,
    test: "tests/unit/mock-hygiene.test.ts",
    pattern: "calls importOriginal and spreads it",
  },
  {
    name: "MH2",
    desc: "the factory keeps the spread but stops calling importOriginal",
    kind: "vitest",
    file: "tests/unit/degradation-matrix.test.ts",
    anchor: `  const actual = await importOriginal<typeof import("ai")>();`,
    replacement: `  const actual = {} as typeof import("ai");`,
    test: "tests/unit/mock-hygiene.test.ts",
    pattern: "calls importOriginal",
  },

  // ── copy may only name a store the module actually opens ─────────────────
  claimsPlant({
    name: "SC1",
    desc: "the stats strip names a browser store the app never opens",
    anchor: `"记录保存在你的账户数据库中"`,
    replacement: `"记录保存在浏览器 IndexedDB 中"`,
    pattern: "no module's copy names a mechanism that module does not use",
  }),
  claimsPlant({
    name: "SC2",
    desc: "the card goes back to calling account data local",
    anchor: `label="我的模拟面试"`,
    replacement: `label="本地模拟面试"`,
    pattern: "the stats strip says where the rows are",
  }),
  claimsPlant({
    name: "SC3",
    desc: "a comment re-attributes the Orama restore to Dexie",
    file: "src/lib/orama-client.ts",
    anchor: `from the account's orama_index`,
    replacement: `from Dexie`,
    pattern: "the four comments that named a store the code never opens",
  }),
  // Browser-bound, so it joins the --slow set. No source-level plant can fail
  // it: only the signed-in branch changes, and the rendered strip is what this
  // plant proves has teeth.
  claimsPlant({
    name: "SC4",
    desc: "the signed-out strip stops saying it cannot know",
    anchor: `"登录后查看你的面试记录"`,
    replacement: `"记录保存在你的账户数据库中"`,
    pattern: "the data strip admits",
    kind: "playwright",
    test: "tests/landing.spec.ts",
    slow: true,
  }),
  // ── a catch that logs has to name what it caught ─────────────────────────
  causePlant({
    name: "CR1",
    desc: "the trends route decides to coerce but stops saying what arrived",
    file: "src/app/api/analyze-trends/route.ts",
    anchor: `reason: "output_coerced", cause: classifyUpstreamError(e) });`,
    replacement: `reason: "output_coerced" });`,
  }),
  causePlant({
    name: "CR2",
    desc: "the OCR fallback un-binds its error, hiding the cause behind done()",
    file: "src/app/api/parse-resume/route.ts",
    anchor: `} catch (ocrError) {`,
    replacement: `} catch {`,
  }),
  causePlant({
    name: "CR3",
    desc: "an unreadable answer and a schema miss collapse into one token again",
    file: CLASSIFIER,
    test: "tests/unit/classify-error.test.ts",
    pattern: "separates an unreadable answer from an answer that fails the schema",
    anchor: `  if (e instanceof ZodError) return "output_schema";`,
    replacement: `  if (e instanceof ZodError) return "output_unparseable";`,
  }),
  // ── the room is composed over two layers; the transcript must not double ──
  roomPlant({
    name: "TP1",
    desc: "the page re-adds its own transcript next to the panel's",
    file: INTERVIEW_LAUNCHER,
    anchor: `      <TextSelectionMenu />`,
    replacement: `      {isFocusMode && <InterviewTranscript />}\n      <TextSelectionMenu />`,
  }),
  roomPlant({
    name: "TP2",
    desc: "the panel gives its footer its own live region",
    file: PANEL,
    anchor: `      <div className="p-4 bg-white/40 border-t border-white/40">`,
    replacement: `      <div role="log" className="p-4 bg-white/40 border-t border-white/40">`,
  }),
  roomPlant({
    name: "TP3",
    desc: "the scroll anchor gets wired from both layers",
    file: INTERVIEW_LAUNCHER,
    anchor: `          endRef={messagesEndRef}`,
    replacement: `          endRef={messagesEndRef}\n          endRef={messagesEndRef}`,
    pattern: "hands the scroll anchor",
  }),
  // ── the README's architecture counts are the measured ones ───────────────
  archClaimPlant("RA1", "the README's prompt count drifts from the registry by one", "(17 registered prompts, each carrying its own version", "counts versioned prompts the way the registry counts them"),
  archClaimPlant("RA2", "the README counts generateObject routes a route too high", "`generateObject` (10 routes,", "counts the routes still on generateObject"),
  archClaimPlant("RA3", "the README overstates how many prompt files carry the untrusted-input fence", "(15 prompt files carry the `UNTRUSTED` markers", "counts the prompt files that fence untrusted input"),
  archClaimPlant("RA4", "the README counts deprecated-API files one above the ratchet ceiling", "12 files still call the deprecated object APIs", "names how many files are still on the deprecated object APIs"),
  // ── a rendered record time must be the record's own ──────────────────────
  {
    name: "CT1",
    desc: "the transcript goes back to stamping every row with the viewer's clock",
    kind: "vitest",
    file: "src/app/chat/page.tsx",
    anchor: `content={getMessageText(msg as { parts?: unknown; content?: unknown; text?: unknown })}`,
    replacement: `content={getMessageText(msg as { parts?: unknown; content?: unknown; text?: unknown })}\n                    timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    test: FIRST_RENDER_UNIT,
    pattern: "names every component that shows a clock reading",
  },
  // ── the think-time window: one number, two readers in two files ──────────
  windowPlant({
    name: "TT1",
    desc: "the bar goes back to dividing by its own ten",
    file: THINK_LIB,
    anchor: `seconds / THINK_TIME_SECONDS`,
    replacement: `seconds / 10`,
    pattern: "sizes the bar by the window",
  }),
  windowPlant({
    name: "TT2",
    desc: "the page arms a bare countdown length again",
    file: INTERVIEW_LAUNCHER,
    anchor: `setThinkCountdown(THINK_TIME_SECONDS)`,
    replacement: `setThinkCountdown(10)`,
    pattern: "arms the countdown from the same owner",
  }),
  windowPlant({
    name: "TT3",
    desc: "the overlay recomputes the width instead of asking the owner",
    file: "src/components/interview/RoomOverlays.tsx",
    anchor: `animate={{ width: thinkTimeBarWidth(seconds) }}`,
    replacement: `animate={{ width: \`\${(seconds / 10) * 100}%\` }}`,
    pattern: "asks the owner for the width",
  }),
  // ── a component must be able to render itself without a browser ──────────
  {
    name: "H1",
    desc: "the health indicator reads navigator.onLine to pick its first paint",
    kind: "vitest",
    file: "src/components/interview/SystemHealthIndicator.tsx",
    anchor: `  const [online, setOnline] = useState(true);`,
    replacement: `  const [online, setOnline] = useState(\n    () => (typeof navigator !== "undefined" ? navigator.onLine : true)\n  );`,
    test: FIRST_RENDER_UNIT,
    pattern: "names every production component",
  },
  {
    name: "H2",
    desc: "the same bug wearing a typeof window guard",
    kind: "vitest",
    file: "src/components/interview/SystemHealthIndicator.tsx",
    anchor: `  const [online, setOnline] = useState(true);`,
    replacement: `  const [online, setOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);`,
    test: FIRST_RENDER_UNIT,
    pattern: "names every production component",
  },
  // ── passing a component its own default is not a decision ────────────────
  defaultRestatedPlant({
    name: "PD1",
    desc: "the streaming card is made to say it is not streaming, which is the default",
    file: "src/app/chat/page.tsx",
    anchor: `                    streaming={true}`,
    replacement: `                    streaming={false}`,
  }),
  // ── the homepage's "export or delete, any time" is a two-store promise ────
  rightsPlant({
    name: "DR1",
    desc: "the export button is rendered but no longer wired",
    file: PRIVACY_PAGE,
    anchor: `onClick={exportAll}`,
    replacement: `onClick={() => {}}`,
    pattern: "exported file carries every store",
  }),
  rightsPlant({
    name: "DR2",
    desc: "the exported JSON quietly drops the practice sessions",
    file: PRIVACY_PAGE,
    anchor: `interviews, practiceSessions: practice }`,
    replacement: `interviews }`,
    pattern: "exported file carries every store",
  }),
  rightsPlant({
    name: "DR3",
    desc: "the wipe leaves the practice sessions in the cloud",
    file: PRIVACY_PAGE,
    anchor: `await db.practiceSessions.remove(p.id);`,
    replacement: `await Promise.resolve(p.id);`,
    pattern: "delete reaches every store",
  }),
  // ── the harness's own coverage may not shrink quietly ────────────────────
  // Written as one record on one line on purpose: FC1 is the only plant that
  // edits the harness it lives in, and it carries `argv` where the others carry
  // `test`/`pattern`. The repo's duplication gate compares lines token-by-token
  // with literal contents normalised away, so a plant laid out across ten lines
  // in the same field order as the other sixty would be counted as ten copied
  // lines — a true statement about the shape, and the wrong thing to spend the
  // gate on.
  { name: "FC1", desc: "a floor one above the harness: a deleted plant would read as success", kind: "gate", file: GUARDS_SELF, anchor: `const MIN_PLANTS = ${MIN_PLANTS};`, replacement: `const MIN_PLANTS = ${MIN_PLANTS + 1};`, argv: ["node", ["scripts/falsify/guards.mjs", "--targets"]] },
  // ── the env surface stays declared to whoever sets the app up ─────────────
  envRulePlant({
    name: "EV1",
    desc: "the setup document stops declaring a key three routes cannot run without",
    file: ".env.example",
    anchor: `ZHIPU_API_KEY=your_zhipu_api_key_here`,
    replacement: `# ZHIPU_API_KEY is provided by the platform, not by you`,
    pattern: "every env name the code reads is declared or excluded",
  }),
  envRulePlant({
    name: "EV2",
    desc: "the session secret moves to a NEXT_PUBLIC_ name, which ships to the browser",
    file: "src/lib/api/session.ts",
    anchor: `  const env = process.env.SESSION_SECRET;`,
    replacement: `  const env = process.env.NEXT_PUBLIC_SESSION_SECRET;`,
    pattern: "every credential-shaped name the code reads is in the ledger",
  }),
  // ── the CSP's external hosts stay disclosed, and none undisclosed ────────
  cspRulePlant({
    name: "CS1",
    desc: "a host joins script-src with no disclosure decision behind it",
    file: "src/proxy.ts",
    anchor: `    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;`,
    replacement: `    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unreviewed.example;`,
    pattern: "allows exactly the external hosts that are disclosed and justified",
  }),
  cspRulePlant({
    name: "CS2",
    desc: "the privacy page goes back to naming a font origin the app never loads",
    file: "src/app/privacy/page.tsx",
    anchor: `与 jsDelivr（代码编辑器）。字体不来自第三方`,
    replacement: `与 jsDelivr（代码编辑器）以及 Google Fonts（fonts.googleapis.com）。字体不来自第三方`,
    pattern: "discloses every allowed host on the privacy page",
  }),
  // ── the live RLS finding cannot be softened back into a hedge ────────────
  anonBridgePlant({
    name: "AB1",
    desc: "the document reverts to `unproven` while the catalog dump says the bridge is live",
    file: "docs/SECURITY.md",
    anchor: "`anon-bridge: `open``",
    replacement: "`anon-bridge: `unproven``",
    pattern: "carries the marker the evidence state requires",
  }),
  anonBridgePlant({
    name: "AB2",
    desc: "006's drop goes back to matching a policy name, the detector shape that saw no bridge",
    file: "supabase/migrations/006_close_anon_bridge_content_tables.sql",
    anchor: `      AND roles @> ARRAY['anon']::text[]`,
    replacement: `      AND policyname LIKE 'Legacy anon select unowned'`,
    pattern: "006 drops by predicate and refuses to succeed with the hole open",
  }),
  // ── posture guards that assert absence have to be shown matching something ─
  cachePlant({
    name: "CA1",
    desc: "'use cache' arrives without the cacheLife + cacheTag the iron law requires",
    file: "src/lib/api/session.ts",
    anchor: `  const env = process.env.SESSION_SECRET;`,
    replacement: `  'use cache';\n  const env = process.env.SESSION_SECRET;`,
    pattern: "carries explicit cacheLife",
  }),
  cachePlant({
    name: "CA2",
    desc: "partial-prerendering is switched on with no Suspense audit recorded",
    file: "next.config.ts",
    anchor: `  output: 'standalone',`,
    replacement: `  experimental: { cacheComponents: true },\n  output: 'standalone',`,
    pattern: "cacheComponents stays off until a Suspense audit lands",
  }),
  securityPlant({
    name: "SS1",
    desc: "an agentic step budget reappears on a generation route",
    file: "src/app/api/analyze-star/route.ts",
    anchor: `      abortSignal: signal,`,
    replacement: `      maxSteps: 8,\n      abortSignal: signal,`,
    pattern: "agentic loops to the model",
  }),
  // ── the two rule arms with no witness at all ─────────────────────────────
  erasurePlant({
    name: "ER1",
    desc: "the Privacy Center lists a table the client cannot delete from",
    file: "src/app/dashboard/privacy/page.tsx",
    // Retargeted 2026-10-15: this used to point at `assessments`, which was then
    // a table with no delete path. The erasure fix gave every written table a
    // `removeAllForOwner`, so the plant became inert -- a witness that cannot
    // fire is not a witness. It now names a store no accessor can erase at all,
    // which is the shape the arm is actually for.
    anchor: `where: "Database (practice_sessions)"`,
    replacement: `where: "Database (recruiter_reports)"`,
    pattern: "has a delete in the client",
  }),
  budgetPlant({
    name: "RB1",
    desc: "the guard is prepared to wait ten times what the function is allowed to run",
    file: "src/app/api/analyze-star/route.ts",
    anchor: `    timeoutMs: 90000,`,
    replacement: `    timeoutMs: 900000,`,
    pattern: "budget that outlasts it",
  }),
  // ── the walker ratchet ────────────────────────────────────────────────────
  {
    name: "RW1",
    desc: "a new guard that walks the tree itself must break facts:check",
    kind: "gate",
    file: "tests/unit/_falsify_walker.ts",
    create:
      "// planted by scripts/falsify/guards.mjs; deleted the same run." + NL +
      'import { readdirSync, statSync } from "node:fs";' + NL +
      NL +
      "export function plantedWalk(dir: string, base: URL): string[] {" + NL +
      "  const out: string[] = [];" + NL +
      '  for (const entry of readdirSync(new URL("../../" + dir, base))) {' + NL +
      '    const rel = dir + "/" + entry;' + NL +
      '    if (statSync(new URL("../../" + rel, base)).isDirectory()) out.push(...plantedWalk(rel, base));' + NL +
      '    else if (rel.endsWith(".tsx")) out.push(rel);' + NL +
      "  }" + NL +
      "  return out;" + NL +
      "}" + NL,
    anchor: "",
    replacement: "",
  },
  // ── guards that assert an absence and had no witness of any kind ───────────
  // Each of these suites reads a corpus (src/, a workflow, the Dockerfile) and asserts
  // something is absent from it. With nothing planted, "found none" and "cannot see
  // anything" print the same green, which is the failure this harness exists to catch.
  //
  // These rows live in plants.json rather than inline here. Their first form was
  // five object literals, which SonarCloud failed at 93.4% new-code duplication; the
  // tuple table that replaced them it failed at 68.6% (48 lines flagged) even though
  // every string in every row differs, because its JS detector compares token structure
  // rather than text. Data does not have that problem, and another witness is now one
  // JSON entry with no change to this file — which is also why nothing below or above
  // states how many rows there are. MIN_PLANTS is the count that is checked.
  ...ABSENCE_PLANTS.map((plant) => ({ ...plant, kind: "vitest" })),
];

/**
 * Refuse to run a harness that is smaller than the one that was audited.
 *
 * Checked before `--list` and `--targets` can exit early, because FC1 asks for
 * those: the floor has to fail a listing run too, or the plant would escape by
 * asking the harness a question it answers before looking at its own size.
 */
if (PLANTS.length < MIN_PLANTS) {
  console.error(
    `falsification coverage shrank: ${PLANTS.length} plants, floor ${MIN_PLANTS}. ` +
    "Restore the plant, or lower the floor in the same commit as the reason it no longer applies."
  );
  process.exit(1);
}

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
  if (plant.kind === "gate") {
    const [cmd, args] = plant.argv ?? ["node", ["scripts/audit-facts.mjs", "--check"]];
    return () => run(cmd, args);
  }
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

/** What a plant actually aims at: a test file, or the command a gate plant runs. */
const targetOf = (p) => p.test ?? (p.argv ? `${p.argv[0]} ${p.argv[1].join(" ")}` : "facts:check");

if (wantTargets) {
  const byTarget = new Map();
  for (const p of PLANTS) byTarget.set(targetOf(p), (byTarget.get(targetOf(p)) ?? 0) + 1);
  const rows = [...byTarget].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (const [target, count] of rows) console.log(`${String(count).padStart(2)}  ${target}`);
  console.log(`(${PLANTS.length} plants over ${rows.length} targets; floor ${MIN_PLANTS})`);
  process.exit(0);
}

if (listOnly) {
  for (const p of selected) console.log(`${p.name.padEnd(3)} ${p.kind.padEnd(9)} ${targetOf(p).padEnd(46)} ${p.desc}`);
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
  console.log(`  ${why.padEnd(9)} ${p.name} ${p.kind} ${targetOf(p)} — ${summary}`);
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
