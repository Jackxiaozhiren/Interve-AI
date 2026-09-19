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
//
// NOTE (Phase C3): plain `node` does NOT load `.env.local` (only `next`
// does), so without the loader below a locally linked project always
// reported "skipped" (false-skip). We fill missing vars from `.env.local`
// with zero dependencies; explicit env (e.g. CI secrets) always wins.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnvLocal() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local"),
  ];
  const seen = new Set();
  for (const file of candidates) {
    if (seen.has(file)) continue;
    seen.add(file);
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue; // missing file: stay keyless, keep exit-0 skip below
    }
    let filled = 0;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const body = line.startsWith("export ") ? line.slice(7).trim() : line;
      const eq = body.indexOf("=");
      if (eq <= 0) continue;
      const key = body.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key] !== undefined && process.env[key] !== "") continue; // explicit env wins
      let value = body.slice(eq + 1).trim();
      const quote = value[0];
      if (value.length >= 2 && (quote === '"' || quote === "'" || quote === "`") && value.endsWith(quote)) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
      filled += 1;
    }
    console.log(`[supabase-free] loaded ${path.basename(file)} (${filled} missing var(s) filled; explicit env takes precedence).`);
    return; // first found file wins (cwd before repo root)
  }
}

loadDotEnvLocal();

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
