// Turn-level steering calibration (STEERING_SIGNAL lane, NOT an evaluation).
//
// Calls the REAL analyze-star handler in-process (same schema, guard, and
// provider path as production). Requires ZHIPU_API_KEY + SESSION_SECRET;
// without them the suite self-skips with a clear message and exit 0.
//
// Cost: 3 cases x 1 flash call per run. Nightly/manual lane, not per-PR.
// Keyless structural validation lives in
// tests/integration/eval-datasets.test.ts ("turn-golden.json").
import { describe, it, expect } from "vitest";
import turnGolden from "./turn-golden.json";
import { signSession } from "../src/lib/api/session";
import { quotaCheck, quotaRecord } from "../scripts/quota-ledger.mjs";

function turnEnv(need = 3): { ready: boolean; reason: string } {
  if (!process.env.ZHIPU_API_KEY) {
    return { ready: false, reason: "ZHIPU_API_KEY not set — turn golden skipped (dataset still validated keylessly)." };
  }
  // Phase C1: ledger first — 3 cases × 1 flash call per run.
  const q = quotaCheck("zhipu", need);
  if (!q.ok) {
    return { ready: false, reason: `quota ledger: zhipu ${q.used}/${q.budget} used in PT window ${q.window} — need ${q.need}, ${q.remaining} left — turn golden skipped (exit 0).` };
  }
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "eval-secret-0123456789abcdef";
  return { ready: true, reason: "" };
}

const env = turnEnv(3);
const suite = env.ready ? describe : describe.skip;

interface TurnCase {
  id: string;
  question: string;
  answer: string;
  expected: { avgProgressBand: [number, number]; mustQuote: string[] };
}

const CASES = (turnGolden as unknown as { cases: TurnCase[] }).cases;

async function evaluateStarTurn(question: string, answer: string): Promise<{
  s: { progress: number }; t: { progress: number }; a: { progress: number }; r: { progress: number };
  evidence: string[]; confidence: string;
}> {
  const { POST } = await import("../src/app/api/analyze-star/route");
  const { randomUUID } = await import("node:crypto");
  const signed = await signSession(
    { id: randomUUID(), email: "eval@local.test", username: "eval" },
    process.env.SESSION_SECRET!
  );
  const res = await POST(
    new Request("http://eval.local/api/analyze-star", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `interveai_user=${encodeURIComponent(signed)}`,
        "x-forwarded-for": "10.77.0.3",
        "x-request-id": `eval-turn-${Date.now()}`,
      },
      body: JSON.stringify({ transcript: `Q: ${question}\nA: ${answer}` }),
    })
  );
  const rawText = await res.text();
  if (res.status !== 200) {
    throw new Error(`eval call failed (${res.status}): ${rawText.slice(0, 300)}`);
  }
  quotaRecord("zhipu", 1); // HTTP 200 only: 429s/500s never consume quota
  return JSON.parse(rawText) as {
    s: { progress: number }; t: { progress: number }; a: { progress: number }; r: { progress: number };
    evidence: string[]; confidence: string;
  };
}

suite("turn-level star steering (keyed)", () => {
  it("complete STAR turns outscore vague/thin ones, with verbatim evidence", async () => {
    for (const c of CASES) {
      const out = await evaluateStarTurn(c.question, c.answer);
      const avg = (out.s.progress + out.t.progress + out.a.progress + out.r.progress) / 4;
      expect(avg, `${c.id}: avg progress in [${c.expected.avgProgressBand}]`).toBeGreaterThanOrEqual(c.expected.avgProgressBand[0]);
      expect(avg, `${c.id}: avg progress in [${c.expected.avgProgressBand}]`).toBeLessThanOrEqual(c.expected.avgProgressBand[1]);
      expect(out.evidence.length, `${c.id}: non-empty evidence`).toBeGreaterThan(0);
      const joined = out.evidence.join("\n").toLowerCase();
      for (const q of c.expected.mustQuote) {
        expect(joined, `${c.id}: evidence quotes "${q}"`).toContain(q.toLowerCase());
      }
      expect(["high", "medium", "low"], `${c.id}: confidence enum`).toContain(out.confidence);
    }
  }, 600_000);
});
