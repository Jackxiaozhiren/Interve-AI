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

export function buildHealthBody(db: DbState, dbLatencyMs: number) {
  return {
    status: db === "ok" ? "ok" : "degraded",
    checks: { db, dbLatencyMs },
  };
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

  // One statement, zero rows: exact count over the smallest user table.
  let db: DbState = "degraded";
  try {
    const probe = await supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(5000))
      .limit(1);
    if (!probe.error) db = "ok";
  } catch {
    db = "degraded"; // network/timeout/abort — class only, never error text
  }
  const latencyMs = Math.round(performance.now() - started);
  const body = buildHealthBody(db, latencyMs);
  logApi(ROUTE, {
    requestId,
    status: 200,
    latencyMs,
    ...(db === "ok" ? {} : { reason: "db_degraded" }),
  });
  return done(body);
}
