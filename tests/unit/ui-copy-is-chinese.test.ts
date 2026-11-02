// Every user-facing string in this app is Simplified Chinese. This file is the
// denominator for that sentence, and it is a ratchet: the list below is what is
// still English, it may only shrink, and a row whose file is fully translated
// fails until someone deletes it.
//
// Why a list and not a rule: "no English" is not decidable — Interve AI, React,
// GitHub, PDF and WPM are the correct words for those things, and /privacy names
// database tables on purpose. So the guard strips a declared set of proper nouns
// and identifiers, then reports what is left. The declared set is the thing to
// argue about in review; the file list is just the work order.
//
// Measured 2026-11-02: 158 tsx files, 67 with English UI copy, 434 strings.
// The two doors (/login, /signup) are done; 61 files / 402 strings remain, and
// they are grouped by surface in the PR body rather than here.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

/** Proper nouns, product names, and identifiers that are correct in English. */
const ALLOWED = new Set([
  "interve", "ai", "react", "next", "typescript", "javascript", "github", "google",
  "pdf", "markdown", "wpm", "csv", "json", "api", "supabase", "vercel", "llm", "sql",
  "css", "html", "http", "url", "id", "mb", "kb", "ms", "px", "glm", "zhipu", "mcp",
  "sse", "svg", "png", "npm", "node", "ok", "vs",
  // Table names /privacy quotes verbatim. Translating them would be a lie about
  // what the database holds, so they are exempt rather than pending.
  "interviews", "practice", "sessions", "evaluations", "assessments",
  "achievements", "telemetry", "profiles", "messages", "resumes", "knowledge",
]);

/** Attributes that carry copy, as opposed to className or href. */
const COPY_ATTRS = new Set([
  "placeholder", "title", "alt", "label", "aria-label", "description", "hint", "emptyText",
]);

/** Files still carrying English UI copy. Only deletions are allowed. */
const PENDING: string[] = [
  "src/app/setup/page.tsx",
  "src/components/interview/TechnicalScratchpad.tsx",
  "src/app/privacy/page.tsx",
  "src/components/setup/ResumeIntegrationSections.tsx",
  "src/app/dashboard/replay/[id]/page.tsx",
  "src/app/dashboard/settings/page.tsx",
  "src/components/dashboard/PrintableDossier.tsx",
  "src/components/interview/PrintLayout.tsx",
  "src/app/dashboard/page.tsx",
  "src/components/dashboard/ContinuousLearning.tsx",
  "src/components/dashboard/SessionDetailModal.tsx",
  "src/components/interview/LiveStats.tsx",
  "src/app/practice/[id]/client.tsx",
  "src/app/dashboard/knowledge/page.tsx",
  "src/components/setup/HardwareCheckPanel.tsx",
  "src/app/practice/page.tsx",
  "src/app/recruiter/assessments/page.tsx",
  "src/app/recruiter/page.tsx",
  "src/app/dashboard/report/[id]/page.tsx",
  "src/components/dashboard/KnowledgeMatchGraph.tsx",
  "src/components/evaluation/EvaluationView.tsx",
  "src/app/global-error.tsx",
  "src/components/interview/SystemDesignBoard.tsx",
  "src/components/dashboard/SystemTelemetry.tsx",
  "src/components/interview/RoomStage.tsx",
  "src/app/error.tsx",
  "src/app/not-found.tsx",
  "src/components/dashboard/AchievementShowcase.tsx",
  "src/components/interview/TelemetryWidget.tsx",
  "src/components/dashboard/EmptyDashboardState.tsx",
  "src/components/interview/CopilotPanel.tsx",
  "src/app/dashboard/dashboard-shell.tsx",
  "src/app/terms/page.tsx",
  "src/components/dashboard/KnowledgeMatchLoader.tsx",
  "src/components/interve-ui/chat/code-block.tsx",
  "src/components/interve-ui/chat/history-item.tsx",
  "src/components/interve-ui/chat/prompt-input.tsx",
  "src/components/interve-ui/select.tsx",
  "src/components/interview/CameraSelfView.tsx",
  "src/components/interview/SoftPacingBar.tsx",
  "src/components/interview/StarTracker.tsx",
  "src/components/setup/TextSelectionMenu.tsx",
  "src/components/ui/dialog.tsx",
  "src/app/dashboard/privacy/page.tsx",
  "src/app/loading.tsx",
  "src/components/dashboard/OnboardingTour.tsx",
  "src/components/dashboard/ProgressInsights.tsx",
  "src/components/interve-ui/drawer.tsx",
  "src/components/interve-ui/input.tsx",
  "src/components/interve-ui/modal.tsx",
  "src/components/interve-ui/navigation.tsx",
  "src/components/interve-ui/pagination.tsx",
  "src/components/interve-ui/tag.tsx",
  "src/components/interve-ui/toast.tsx",
  "src/components/interview/CopilotHints.tsx",
  "src/components/interview/InterviewTimeline.tsx",
  "src/components/interview/LiveWaveform.tsx",
  "src/components/interview/RoomHeader.tsx",
  "src/components/interview/RoomOverlays.tsx",
  "src/components/interview/SystemHealthIndicator.tsx",
  "src/components/interview/TranscriptPanel.tsx",
];

const CJK = /[\u4e00-\u9fff]/;

function englishStrings(rel: string): string[] {
  const source = readRepo(rel);
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const englishWords = (text: string) =>
    (text.match(/[A-Za-z][A-Za-z'-]{1,}/g) || []).filter((w) => !ALLOWED.has(w.toLowerCase()));
  const check = (text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length < 2) return;
    // A string with Chinese in it is Chinese copy that happens to name a product.
    if (CJK.test(t)) return;
    if (englishWords(t).length > 0) out.push(t.slice(0, 80));
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) check(node.getText(sf));
    if (ts.isJsxAttribute(node) && COPY_ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) check(init.text);
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
      const t = node.expression.text;
      // Single tokens are usually keys or class names; a sentence is copy.
      if (/\s/.test(t) && t.length > 3) check(t);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const tsxFiles = () => walkRepo("src", (rel) => rel.endsWith(".tsx"));

describe("user-facing copy is Simplified Chinese", () => {
  it("no file outside the pending list still carries English copy", () => {
    const pending = new Set(PENDING);
    const offenders = tsxFiles()
      .filter((rel) => !pending.has(rel))
      .map((rel) => [rel, englishStrings(rel)] as const)
      .filter(([, hits]) => hits.length > 0);
    expect(
      offenders.map(([rel, hits]) => `${rel}: ${hits.join(" | ")}`),
      "translate these, or add the file to PENDING if it is not in scope yet",
    ).toEqual([]);
  });

  it("a pending row is deleted once its file is translated", () => {
    const stale = PENDING.filter((rel) => englishStrings(rel).length === 0);
    expect(stale, "these files are already Chinese — drop their rows so the list keeps shrinking").toEqual([]);
  });

  it("the instrument can see", () => {
    // A scanner that goes blind turns both arms above green against a tree that
    // is all English, which is the failure mode every guard in this repo has had
    // to prove it does not have.
    expect(tsxFiles().length, "no tsx files found — the scan would be vacuous").toBeGreaterThan(100);
    expect(PENDING.length, "an empty work list means the programme is done; until then it is not").toBeGreaterThan(0);
  });
});
