import { it, expect } from "vitest";
import { signSession } from "../../src/lib/api/session";

async function call(path: string, body: unknown): Promise<{ status: number; head: string }> {
  const { randomUUID } = await import("node:crypto");
  process.env.SESSION_SECRET ??= "eval-secret-0123456789abcdef";
  const signed = await signSession(
    { id: randomUUID(), email: "eval@local.test", username: "eval" },
    process.env.SESSION_SECRET!
  );
  const mod = await import(`../../src/app/api/${path}/route`);
  const res: Response = await mod.POST(
    new Request(`http://eval.local/api/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `interveai_user=${encodeURIComponent(signed)}`,
        "x-forwarded-for": "10.77.9.9",
        "x-request-id": `probe-${path}`,
      },
      body: JSON.stringify(body),
    })
  );
  const text = await res.text();
  return { status: res.status, head: text.slice(0, 120).replace(/\n/g, " ") };
}

it("probe zhipu structured routes live", async () => {
  const t = "S: 双十一大促。T: 接口800ms。A: 加缓存降到120ms。R: 错误率降一半。";
  for (const [path, body] of [
    ["analyze-star", { transcript: t }],
    ["analyze-behavior", { transcript: t }],
    ["analyze-chunk", { text: t, role: "Backend", level: "Junior" }],
    ["analyze-match", { resumeText: "3年后端，Redis/MySQL", jobDescription: "后端工程师，需缓存优化经验" }],
    ["init-context", { jobDescription: "后端工程师，需缓存优化经验", resumeContext: "3年后端，Redis/MySQL" }],
  ] as const) {
    const t0 = Date.now();
    const r = await call(path, body);
    console.log(`PROBE ${path} status=${r.status} ms=${Date.now() - t0} head=${r.head}`);
  }
  expect(true).toBe(true);
}, 600_000);
