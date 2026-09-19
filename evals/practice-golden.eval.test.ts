// Phase 4: practice-lane golden agreement suite. KEYED — skips without env.
//
// Calls the REAL analyze-practice handler in-process (same schema, guard,
// and provider path as production). Requires GOOGLE_GENERATIVE_AI_API_KEY
// (Gemini flash lane) + SESSION_SECRET; without them the suite self-skips
// with a clear message and exit 0.
//
// Cost note: 5 cases × 1 call ≈ 5 flash calls per run. Nightly/manual lane,
// not per-PR. Keyless structural validation lives in
// tests/integration/eval-datasets.test.ts ("practice-golden.json").
import { describe, it, expect } from "vitest";
import practiceGolden from "./practice-golden.json";
import { signSession } from "../src/lib/api/session";
import { quotaCheck, quotaRecord } from "../scripts/quota-ledger.mjs";

function practiceEnv(need = 5): { ready: boolean; reason: string } {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { ready: false, reason: "GOOGLE_GENERATIVE_AI_API_KEY not set — practice golden skipped (dataset still validated keylessly)." };
  }
  // Phase C1: ledger first — 5 cases × 1 Gemini flash call per run.
  const q = quotaCheck("gemini", need);
  if (!q.ok) {
    return { ready: false, reason: `quota ledger: gemini ${q.used}/${q.budget} used in PT window ${q.window} — need ${q.need}, ${q.remaining} left — practice golden skipped (exit 0).` };
  }
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "eval-secret-0123456789abcdef";
  return { ready: true, reason: "" };
}

const env = practiceEnv(5);
const suite = env.ready ? describe : describe.skip;

interface PracticeCase {
  id: string;
  question: { title: string; description?: string; category?: string };
  answer: string;
  expected: { scoreBand: [number, number]; mustQuote: string[] };
}

const CASES = (practiceGolden as unknown as { cases: PracticeCase[] }).cases;

async function evaluatePracticeAnswer(
  question: PracticeCase["question"],
  answer: string
): Promise<{ score: number; evidence: string[]; confidence: string; rawText: string }> {
  const { POST } = await import("../src/app/api/analyze-practice/route");
  const { randomUUID } = await import("node:crypto");
  const signed = await signSession(
    { id: randomUUID(), email: "eval@local.test", username: "eval" },
    process.env.SESSION_SECRET!
  );
  const res = await POST(
    new Request("http://eval.local/api/analyze-practice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `interveai_user=${encodeURIComponent(signed)}`,
        "x-forwarded-for": "10.77.0.2",
        "x-request-id": `eval-practice-${Date.now()}`,
      },
      body: JSON.stringify({ question, answer }),
    })
  );
  const rawText = await res.text();
  if (res.status !== 200) {
    throw new Error(`eval call failed (${res.status}): ${rawText.slice(0, 300)}`);
  }
  quotaRecord("gemini", 1); // HTTP 200 only: 429s/500s never consume quota
  return JSON.parse(rawText) as { score: number; evidence: string[]; confidence: string; rawText: string };
}

suite("practice golden agreement (keyed)", () => {
  it("scores land in authored bands with verbatim evidence", async () => {
    for (const c of CASES) {
      const out = await evaluatePracticeAnswer(c.question, c.answer);
      expect(out.score, `${c.id}: score in [${c.expected.scoreBand}]`).toBeGreaterThanOrEqual(c.expected.scoreBand[0]);
      expect(out.score, `${c.id}: score in [${c.expected.scoreBand}]`).toBeLessThanOrEqual(c.expected.scoreBand[1]);
      // Evidence envelope: at least one verbatim quote, and every authored
      // quote must be traceable to the evidence (case-insensitive: models
      // occasionally normalize punctuation/casing).
      expect(out.evidence.length, `${c.id}: non-empty evidence`).toBeGreaterThan(0);
      const joined = out.evidence.join("\n").toLowerCase();
      for (const q of c.expected.mustQuote) {
        expect(joined, `${c.id}: evidence quotes "${q}"`).toContain(q.toLowerCase());
      }
      expect(["high", "medium", "low"], `${c.id}: confidence enum`).toContain(out.confidence);
    }
  }, 600_000);
});
