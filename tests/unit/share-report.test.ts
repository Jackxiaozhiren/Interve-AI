/**
 * What a shared link is allowed to contain, and what the read path is allowed
 * to do.
 *
 * The owner decision (2026-11-13) is the specification: the report is shared
 * WITHOUT verbatim evidence and WITHOUT the per-question review, for 7 days,
 * at most 20 opens. A leak here is not a rendering bug — it hands someone
 * else's own words to whoever holds the link — so the projection is tested as
 * a whitelist (a field is absent unless this file says it is present), and the
 * SQL is pinned on the two lines that keep the table closed to anonymous
 * readers.
 */
import { describe, expect, it } from "vitest";
import { readRepo } from "./repo-tree";
import {
  buildSharePayload,
  generateShareToken,
  hashShareToken,
  looksLikeShareToken,
  shareExpiry,
  shareUrl,
  SHARE_MAX_VIEWS,
  SHARE_TTL_DAYS,
} from "../../src/lib/share";
import type { EvaluationView } from "../../src/lib/eval-compat";

const view: EvaluationView = {
  kind: "v2",
  legacy: false,
  rubricId: "behavioral-v1",
  readinessLabel: "developing",
  readinessRationale: "两个维度有证据，深度不足。",
  average: 62,
  confidence: "medium",
  dimensions: [
    {
      id: "depth",
      name: "深度",
      score100: 60,
      anchorLevel: 3,
      evidence: ["我在某某公司用 Redis 做过缓存，同事张三负责网关"],
      rationale: "有实现细节，但缺少取舍。",
      confidence: "medium",
      improvement: "先说取舍再写代码。",
    },
  ],
  strengths: ["表达清晰"],
  weaknesses: ["深度不足"],
  nextDrills: ["练习讲取舍"],
  disclaimer: "练习反馈，不是招聘结论。",
};

const roadmap = {
  technical: ["建议先讲取舍再写代码，因为你的实现细节完整，但没说为什么这样选。"],
  behavioral: ["建议给结果补上可量化的影响，因为目前只说了做了什么。"],
  resources: ["建议重读「深度」一档的描述，因为追问停留在概念层面。"],
};

describe("the shared projection is a whitelist", () => {
  it("drops the verbatim evidence and the per-question review", () => {
    const payload = buildSharePayload(view, roadmap);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("同事张三");
    expect(serialized).not.toContain("Redis");
    expect(payload.dimensions.every((dim) => !("evidence" in dim))).toBe(true);
    expect("qaReview" in payload).toBe(false);
    expect("transcript" in payload).toBe(false);
    expect("title" in payload).toBe(false);
  });

  it("keeps what a mentor needs: readiness, rationale, dimensions, roadmap", () => {
    const payload = buildSharePayload(view, roadmap);
    expect(payload.readiness.label).toBe("developing");
    expect(payload.readiness.average).toBe(62);
    expect(payload.dimensions[0].rationale).toContain("缺少取舍");
    expect(payload.roadmap?.technical[0]).toContain("建议先讲取舍");
  });

  it("survives a report with no roadmap", () => {
    const payload = buildSharePayload(view, undefined);
    expect(payload.roadmap).toBeNull();
  });

  it("copies arrays instead of aliasing them", () => {
    const payload = buildSharePayload(view, roadmap);
    payload.strengths.push("被篡改");
    expect(view.strengths).toEqual(["表达清晰"]);
  });
});

describe("the link has the lifetime the owner chose", () => {
  it("expires in 7 days", () => {
    const now = new Date("2026-11-13T00:00:00Z");
    expect(shareExpiry(now)).toBe("2026-11-20T00:00:00.000Z");
    expect(SHARE_TTL_DAYS).toBe(7);
    expect(SHARE_MAX_VIEWS).toBe(20);
  });
});

describe("the token is a bearer credential", () => {
  it("is 43 base64url characters (256 bits)", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(43);
    expect(looksLikeShareToken(token)).toBe(true);
  });

  it("does not repeat", () => {
    expect(generateShareToken()).not.toBe(generateShareToken());
  });

  it("hashes deterministically to 64 hex characters", async () => {
    const token = generateShareToken();
    const a = await hashShareToken(token);
    const b = await hashShareToken(token);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashShareToken(`${token}x`)).not.toBe(a);
  });

  it("rejects a shape that is not a token", () => {
    expect(looksLikeShareToken("short")).toBe(false);
    expect(looksLikeShareToken("a".repeat(44))).toBe(false);
    expect(looksLikeShareToken("a".repeat(42) + "!")).toBe(false);
  });

  it("builds the link without doubling the slash", () => {
    expect(shareUrl("https://x.test", "abc")).toBe("https://x.test/s/abc");
    expect(shareUrl("https://x.test/", "abc")).toBe("https://x.test/s/abc");
  });
});

describe("the read path cannot widen by accident", () => {
  const sql = readRepo("supabase/migrations/008_report_shares.sql");

  it("keeps the table closed to anonymous readers", () => {
    expect(sql).toContain("REVOKE ALL ON TABLE public.report_shares FROM anon");
    expect(sql, "without an explicit revoke, a leaked anon key can enumerate shares").toContain(
      "ENABLE ROW LEVEL SECURITY"
    );
    expect(sql, "no anon SELECT grant may exist on the table").not.toContain(
      "GRANT SELECT ON TABLE public.report_shares TO anon"
    );
  });

  it("counts opens and enforces expiry in one atomic statement", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public, pg_temp");
    expect(sql).toContain("s.views < s.max_views");
    expect(sql).toContain("s.expires_at > now()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.consume_report_share(text) TO anon");
  });

  it("lets only the owner create a link for their own interview", () => {
    expect(sql).toContain("FOR INSERT TO authenticated");
    expect(sql).toContain("WHERE user_id = auth.uid()");
  });

  it("never reads the interviews table from the public page", () => {
    const page = readRepo("src/app/s/[token]/page.tsx");
    expect(page).not.toContain('from("interviews")');
    expect(page).toContain("consume_report_share");
    expect(page, "a shared page must not be indexable").toContain("index: false");
  });

  it("reports a missing migration instead of a generic failure", () => {
    const button = readRepo("src/components/evaluation/ShareReportButton.tsx");
    expect(button).toContain("42P01");
    expect(button).toContain("分享功能尚未启用");
  });

  it("is mounted on the report page", () => {
    const page = readRepo("src/app/dashboard/report/[id]/page.tsx");
    expect(page).toContain("<ShareReportButton");
  });
});
