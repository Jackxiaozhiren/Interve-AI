// Phase B5: CSP violation-report collector (report-only convergence).
//
// Browsers POST violation reports here per the Report-Only header in
// proxy.ts. Always 204 (never an oracle, never echoes input). No session
// required: logged-out pages report too. Tightly bounded (4KB body,
// 20/min/IP) so the endpoint cannot become a log-spam vector.
//
// PII discipline: only the violated directive + blocked host are logged
// (via PII-free logApi). Document URIs, cookies, and raw bodies are
// dropped on the floor.
import { NextResponse } from "next/server";
import { z } from "zod";
import { logApi } from "@/lib/api/logging";
import { getRequestId, withRequestId } from "@/lib/api/request-id";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

export const runtime = "edge";

const ROUTE = "csp-report";

const ReportSchema = z.object({
  "csp-report": z
    .object({
      "violated-directive": z.string().max(128).optional(),
      "blocked-uri": z.string().max(512).optional(),
    })
    .passthrough(),
});

function hostOf(uri: string | undefined): string {
  if (!uri) return "-";
  if (uri === "inline" || uri === "eval" || uri.startsWith("data:")) return uri.slice(0, 16);
  try {
    return `${new URL(uri, "http://x").protocol}//${new URL(uri, "http://x").host}`.slice(0, 96);
  } catch {
    return "unparseable";
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  // 204 responses must carry no body — build directly, not via okResponse.
  const done = () => new NextResponse(null, { status: 204, headers: withRequestId(new Headers(), requestId) });
  const rl = checkRateLimit(ROUTE, getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return done();
  try {
    const raw = await req.text();
    if (raw.length > 4096) return done();
    const parsed = ReportSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const report = parsed.data["csp-report"];
      logApi(ROUTE, {
        requestId,
        status: 204,
        latencyMs: 0,
        reason: `csp-violation:${(report["violated-directive"] ?? "-").slice(0, 64)} blocked:${hostOf(report["blocked-uri"])}`,
      });
    }
  } catch {
    // Swallow everything: a telemetry endpoint must never 500.
  }
  return done();
}
