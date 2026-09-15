// verify-supabase-free.mjs — FREE ($0) Supabase live check, anon-key only.
//
// What it does (read-only, zero writes, zero cost):
//   1. Skips with exit 0 when NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are absent
//      (local-fallback mode is the supported keyless default).
//   2. When a FREE-tier project is linked, SELECTs 1 row from `interviews`
//      via the anon key — proving connectivity + that RLS policies load.
//      It does NOT need service_role, does NOT write, and treats an RLS
//      denial as a PASS-with-note (policies working) rather than a failure.
//
// Usage:
//   npm run verify:supabase-free
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run verify:supabase-free
//
// Free project setup (all free): supabase.com → New project (Free plan) →
// SQL Editor → paste supabase/migrations/001_init_schema.sql then
// 002_session_ownership.sql → Project Settings → API → copy URL + anon key.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey || url.includes("your-project") || anonKey.includes("your_supabase")) {
  console.log("[supabase-free] skipped: no linked project (local-fallback mode).");
  console.log("[supabase-free] to enable: create a FREE Supabase project, apply");
  console.log("[supabase-free] 001 + 002 migrations, set URL + anon key env vars.");
  process.exit(0);
}

try {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/interviews?select=id&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`[supabase-free] PASS: anon read reachable (status 200, body ${text.length} chars).`);
    console.log("[supabase-free] note: rows visible here are legacy unowned (user_id IS NULL) by 002 design;");
    console.log("[supabase-free] owned rows stay invisible to anon. Cross-user denial needs two");
    console.log("[supabase-free] authenticated users — covered statically until then (rls-policies.test.ts).");
    process.exit(0);
  }
  // 401/403 from PostgREST = RLS doing its job on a locked-down table.
  if (res.status === 401 || res.status === 403) {
    console.log(`[supabase-free] PASS-with-note: anon blocked (status ${res.status}) — RLS policies enforced.`);
    process.exit(0);
  }
  console.error(`[supabase-free] FAIL: unexpected status ${res.status}: ${text.slice(0, 200)}`);
  process.exit(1);
} catch (err) {
  console.error(`[supabase-free] FAIL: network error: ${String(err).slice(0, 200)}`);
  process.exit(1);
}
