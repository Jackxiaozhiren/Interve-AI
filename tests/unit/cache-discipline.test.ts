// B3 cache-discipline guardrail (static, no live infra).
//
// 2026-09-19 audit: ZERO `use cache` domains exist in src/, and that is
// CORRECT, not a gap:
//   - Dashboard aggregates + knowledge reads are CLIENT-side (Dexie/Orama
//     memory via the api-client funnel) — `use cache` is server-only.
//   - All 19 Route Handlers are personalized (resume/JD/transcript per
//     request) → iron law 10 forbids shared caching of user-level data.
//   - Static data (question-bank via generateStaticParams, i18n imports,
//     achievement definitions) is already free — wrapping it would be theater.
//   - No Server Actions exist (`"use server"` absent) → updateTag N/A.
//   - Redis: declined per V5 (single-instance memory + direct Supabase).
//
// This test pins that posture: future `use cache` additions must carry
// explicit cacheLife + cacheTag (law 10), and cacheComponents must not be
// enabled without a Suspense audit (§B#12).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

describe("cache discipline (B3, law 10)", () => {
  it("every 'use cache' domain carries explicit cacheLife + cacheTag", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const text = readFileSync(f, "utf8");
      if (/'use cache'/.test(text) && !(/cacheLife/.test(text) && /cacheTag/.test(text))) {
        offenders.push(f);
      }
    }
    expect(
      offenders,
      `'use cache' without cacheLife+cacheTag: ${offenders.join(", ")}. ` +
        `Iron law 10: every use-cache domain needs explicit cacheLife + cacheTag.`
    ).toEqual([]);
  });

  it("no user-level data enters a shared-cache domain", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const text = readFileSync(f, "utf8");
      if (!/'use cache'/.test(text)) continue;
      if (/session|user_id|auth\.uid|transcript|resumeText/i.test(text)) offenders.push(f);
    }
    expect(
      offenders,
      `user-level data in a shared-cache domain: ${offenders.join(", ")}. ` +
        `Iron law 10: personalized data must NEVER enter shared cache.`
    ).toEqual([]);
  });

  it("cacheComponents stays off until a Suspense audit lands", () => {
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(
      config,
      `cacheComponents enabled without a recorded Suspense audit. ` +
        `See TECH_RESEARCH §B#12 — update this test with the audit evidence.`
    ).not.toMatch(/cacheComponents\s*:\s*true/);
  });
});
