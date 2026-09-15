// Phase 11: keyed eval runner (27.1-27.5).
//
// Calls the REAL analyze-interview handler in-process (same schema, guard,
// and provider path as production). Requires ZHIPU_API_KEY (+ optional
// GOOGLE_API_KEY fallbacks) and SESSION_SECRET; without them every suite
// self-skips with a clear message and exit 0.
//
// Cost note: golden (12) + stability (1×3) + injection (4×2) + fairness
// (4×2) ≈ 31 model calls per full run, plus the free smoke (+3 when keyed).
// Run the full lane nightly/manual, not per-PR; per-push use the free smoke
// (evals/free.eval.test.ts, ≤3 flash-routed calls) or keyless skip.

import { signSession } from "../src/lib/api/session";

export interface TurnMessage {
  role: string;
  content: string;
}

export interface CaseEvaluation {
  readiness: string;
  dimensions: { id: string; score: number; score100: number; evidence: string[]; confidence: string }[];
  rawText: string;
}

export function evalEnv(): { ready: boolean; reason: string } {
  if (!process.env.ZHIPU_API_KEY) {
    return { ready: false, reason: "ZHIPU_API_KEY not set — live evals skipped (harness + datasets still validated keylessly)." };
  }
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "eval-secret-0123456789abcdef";
  return { ready: true, reason: "" };
}

async function sessionCookie(): Promise<string> {
  const { randomUUID } = await import("node:crypto");
  const signed = await signSession(
    { id: randomUUID(), email: "eval@local.test", username: "eval" },
    process.env.SESSION_SECRET!
  );
  return `interveai_user=${encodeURIComponent(signed)}`;
}

export async function evaluateTranscript(
  messages: TurnMessage[],
  framework?: string
): Promise<CaseEvaluation> {
  const { POST } = await import("../src/app/api/analyze-interview/route");
  const res = await POST(
    new Request("http://eval.local/api/analyze-interview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: await sessionCookie(),
        "x-forwarded-for": "10.77.0.1",
        "x-request-id": `eval-${Date.now()}`,
      },
      body: JSON.stringify({ messages, framework }),
    })
  );
  const rawText = await res.text();
  if (res.status !== 200) {
    throw new Error(`eval call failed (${res.status}): ${rawText.slice(0, 300)}`);
  }
  const body = JSON.parse(rawText) as {
    readiness: string;
    dimensions: { id: string; score: number; evidence: string[]; confidence: string }[];
  };
  return {
    readiness: body.readiness,
    dimensions: body.dimensions.map((d) => ({ ...d, score100: d.score * 20 })),
    rawText,
  };
}

/** Max per-dimension score100 drift + readiness flip between two evals. */
export function drift(a: CaseEvaluation, b: CaseEvaluation): { maxDelta: number; readinessFlip: boolean } {
  const byId = new Map(b.dimensions.map((d) => [d.id, d.score100]));
  let maxDelta = 0;
  for (const d of a.dimensions) {
    const other = byId.get(d.id);
    if (other !== undefined) maxDelta = Math.max(maxDelta, Math.abs(d.score100 - other));
  }
  return { maxDelta, readinessFlip: a.readiness !== b.readiness };
}
