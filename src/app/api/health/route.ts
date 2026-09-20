// H2.4: GET /api/health — public liveness + DB one-statement probe.
//
// Public (no session): load balancers / CI / Docker smoke cannot auth.
// Always 200 while the process serves (DB-down is `degraded`, never a
// 500 — a sick database must not make orchestrators kill the app).
// Tightly rate-limited; PII-free (class-only db reason, never error text).
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logApi } from "@/lib/api/logging";
import { getRequestId, withRequestId } from "@/lib/api/request-id";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

export const runtime = "edge";

const ROUTE = "health";

type DbState = "ok" | "degraded";

export function buildHealthBody(db: DbState, dbLatencyMs: number, practice: DbState, practiceLatencyMs: number) {
  return {
    status: db === "ok" && practice === "ok" ? "ok" : "degraded",
    checks: { db, dbLatencyMs, practice, practiceLatencyMs },
  };
}

type ProbeTable = "interviews" | "practice_sessions";

// P1-07: one statement, zero rows per probe (exact count over the smallest
// user tables). Storage/auth probes deliberately excluded: src/ has zero
// supabase.storage usage (a storage probe would report degraded forever)
// and server-side auth checks need service_role (never leaves the vault).
async function probe(table: ProbeTable): Promise<{ state: DbState; latencyMs: number }> {
  const started = performance.now();
  try {
    const res = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(5000))
      .limit(1);
    if (!res.error) return { state: "ok", latencyMs: Math.round(performance.now() - started) };
  } catch {
    // network/timeout/abort — class only, never error text
  }
  return { state: "degraded", latencyMs: Math.round(performance.now() - started) };
}

export async function GET(req: Request) {
  const started = performance.now();
  const requestId = getRequestId(req);
  const done = (body: ReturnType<typeof buildHealthBody>) =>
    NextResponse.json(body, { status: 200, headers: withRequestId(new Headers(), requestId) });
  const rl = checkRateLimit(ROUTE, getClientIp(req), { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return new NextResponse(null, { status: 429, headers: withRequestId(new Headers(), requestId) });
  }

  // One statement, zero rows per probe: exact counts over the smallest user tables.
  const [dbProbe, practiceProbe] = await Promise.all([probe("interviews"), probe("practice_sessions")]);
  const latencyMs = Math.round(performance.now() - started);
  const body = buildHealthBody(dbProbe.state, dbProbe.latencyMs, practiceProbe.state, practiceProbe.latencyMs);
  logApi(ROUTE, {
    requestId,
    status: 200,
    latencyMs,
    ...(body.status === "ok"
      ? {}
      : { reason: dbProbe.state === "ok" ? "practice_degraded" : "db_degraded" }),
  });
  return done(body);
}
