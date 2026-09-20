// P1-07: 健康内检加深（多探针，不断恒 200 语义）。
// 取证：src/ 无 supabase.storage 用量（加 storage 探针必常红），
// 服务端 auth 检查需 service_role（禁区）——加深 = 第二表探针 +
// 分探针延迟。db 字段保持兼容（proxy-guard H2.4 断言不动）。
import { describe, it, expect } from "vitest";
import { buildHealthBody, GET } from "../../src/app/api/health/route";

describe("health body (P1-07 multi-probe)", () => {
  it("ok only when every probe is ok", () => {
    expect(buildHealthBody("ok", 10, "ok", 12)).toEqual({
      status: "ok",
      checks: { db: "ok", dbLatencyMs: 10, practice: "ok", practiceLatencyMs: 12 },
    });
    expect(buildHealthBody("ok", 10, "degraded", 5000).status).toBe("degraded");
    expect(buildHealthBody("degraded", 5000, "ok", 12).status).toBe("degraded");
  });

  it("GET always 200 with both probes reported (DB-down is degraded, never 500)", async () => {
    const res = await GET(
      new Request("http://test.local/api/health", { headers: { "x-forwarded-for": "10.202.0.7" } })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: { db: string; dbLatencyMs: number; practice: string; practiceLatencyMs: number };
    };
    expect(["ok", "degraded"]).toContain(body.status);
    expect(["ok", "degraded"]).toContain(body.checks.db);
    expect(["ok", "degraded"]).toContain(body.checks.practice);
    expect(typeof body.checks.practiceLatencyMs).toBe("number");
  }, 15000);
});
