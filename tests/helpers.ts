// Phase 2: shared Playwright helpers.
//
// Sessions are HMAC-signed with the same code the server uses. Specs must go
// through this helper — seeding the legacy `interve_auth_user` localStorage
// key (dead auth track) or forging an unsigned cookie no longer authenticates.
import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { BASE_URL } from "../playwright.config";
import {
  SESSION_COOKIE,
  getSessionSecret,
  signSession,
} from "../src/lib/api/session";

/**
 * Make the test process agree with the dev server about the signing key.
 *
 * Next loads .env.local into the server it spawns for the webServer step, so
 * getSessionSecret() there returns the project secret; the Playwright process
 * never sees that file, so the same call here returned the dev fallback and every
 * cookie this helper minted failed verification — the guard bounced each spec to
 * /login and the suite died on timeouts rather than an auth error.
 *
 * Precedence mirrors Next (real env wins), so a job that exports
 * SESSION_SECRET — the perf lane, for one — is not silently overridden. The
 * value is used in memory only and never logged.
 */
function ensureSessionSecret(): void {
  if (process.env.SESSION_SECRET) return;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      const m = text.match(/^SESSION_SECRET=(.*)$/m);
      const value = m?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (value && value.length >= 16) {
        process.env.SESSION_SECRET = value;
        return;
      }
    } catch {
      /* file absent — that is the CI case, fall through to the next candidate */
    }
  }
}

/**
 * Mint a valid app session directly instead of asking /api/session for one.
 *
 * The endpoint is the thing under test elsewhere, and it is about to stop
 * accepting caller-chosen identities. Signing here keeps the 15 spec call sites
 * working unchanged while that changes, and it is not a bypass: the helper holds
 * no secret the server does not already resolve from the same function, so in dev
 * and in CI both sides derive the same key (the fallback), and in the perf lane
 * both read SESSION_SECRET from the job env. The signature is produced by the
 * production signer, so a spec can never authenticate with a cookie the real
 * verifier would reject.
 */
export async function loginAs(page: Page, email = "e2e@example.com"): Promise<void> {
  const id = randomUUID();
  const username = email.split("@")[0] || "e2e";
  ensureSessionSecret();
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error(
      "loginAs: getSessionSecret() returned null — a production NODE_ENV without SESSION_SECRET. " +
        "Set SESSION_SECRET for the test process, as the perf job does."
    );
  }
  const signed = await signSession({ id, email, username }, secret);

  // HttpOnly, so it has to go through the context cookie jar rather than the
  // page's document.cookie. The origin comes from the config, not page.url():
  // every caller runs before the first navigation, when that is about:blank.
  // `url` alone — Playwright rejects a cookie that carries both url and path,
  // and derives the path from the url.
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(signed),
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // Local UI copy (drives AuthContext) + onboarding flag, installed before
  // first navigation so the initial render is already authenticated.
  await page.addInitScript(
    ({ id, email, username }: { id: string; email: string; username: string }) => {
      window.localStorage.setItem(
        "interveai_user",
        JSON.stringify({ id, username, email, loginTime: Date.now() })
      );
      window.localStorage.setItem("interve_has_seen_onboarding", "true");
    },
    { id, email, username }
  );
}

/**
 * Give the browser a Supabase auth session, i.e. model the OAuth-signed-in
 * account rather than the demo cookie login.
 *
 * Why this exists: stampOwner() refuses to write user-content rows with no
 * owner (an ownerless row lands in 003's "Legacy anon select unowned" bridge,
 * readable by any holder of the publishable key). loginAs() only mints the
 * app's own cookie, which Supabase knows nothing about, so specs that assert
 * real persistence — mock-journey's /dashboard/report/<digits> — need an
 * account. This is the identity class that path belongs to, not a workaround.
 *
 * The storage key mirrors src/lib/supabase.ts exactly, including its
 * placeholder fallback, so if the test process and the built client ever
 * disagree the write is refused and the spec fails loudly instead of silently
 * testing a degraded mode.
 */
export async function seedSupabaseSession(page: Page, uid = randomUUID()): Promise<string> {
  const url = supabaseUrlForTests();
  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const session = {
    access_token: "e2e-fake-access-token",
    token_type: "bearer",
    // Future expiry keeps GoTrueClient from attempting a refresh, which would
    // leave rest/v1 and hit the real network for an auth endpoint.
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    refresh_token: "e2e-fake-refresh-token",
    user: { id: uid, aud: "authenticated", role: "authenticated", email: "e2e@example.com" },
  };
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(session) }
  );
  return uid;
}

/**
 * The URL the browser bundle actually got. next dev reads .env.local into the
 * inlined NEXT_PUBLIC_* value, and the Playwright process does not inherit it,
 * so deriving only from process.env produced a placeholder storage key while the
 * app looked for its real project ref — the write was then refused for a harness
 * bug, not a product one. Same precedence as src/lib/supabase.ts's fallback.
 */
function supabaseUrlForTests(): string {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  // process.cwd(), not import.meta.url: Playwright compiles spec helpers to CJS
  // and import.meta breaks the module load outright.
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      const m = text.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
      if (m?.[1]?.trim()) return m[1].trim();
    } catch {
      /* file absent — that is the CI case, fall through */
    }
  }
  return "https://placeholder.supabase.co";
}

/**
 * In-memory PostgREST stand-in for the documented no-DB mock lane.
 * Moved verbatim out of tests/mock-journey.spec.ts so any spec can reach the
 * interview room without a database.
 */
interface Row {
  id: number;
  [k: string]: unknown;
}

export function createPostgrestStub() {
  const tables = new Map<string, Map<number, Row>>();
  let nextId = 1;
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  return async function handler(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const tableName = url.pathname.split('/').pop() ?? '';
    const method = req.method();
    const q = url.searchParams;

    if (tableName === 'telemetry' || tableName === 'achievements' || tableName === 'evaluations' || tableName === 'assessments' || tableName === 'orama_index') {
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }

    if (tableName !== 'interviews' && tableName !== 'practice_sessions') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const store = table(tableName);

    if (method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      const row = { ...body, id: nextId++ } as Row;
      store.set(row.id, row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (method === 'PATCH' || method === 'PUT') {
      const idEq = q.get('id');
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (idEq?.startsWith('eq.')) {
        const id = Number(idEq.slice(3));
        const prev = store.get(id);
        if (prev) store.set(id, { ...prev, ...body });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (method === 'DELETE') {
      const idEq = q.get('id');
      if (idEq?.startsWith('eq.')) store.delete(Number(idEq.slice(3)));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    // GET
    const idEq = q.get('id');
    if (idEq?.startsWith('eq.')) {
      const row = store.get(Number(idEq.slice(3)));
      if (!row) {
        return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    let rows = [...store.values()];
    for (const [k, v] of q.entries()) {
      if (k === 'select' || k === 'order') continue;
      if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    }
    const order = q.get('order');
    if (order) {
      const [field, dir] = order.split('.');
      rows.sort((a, b) => {
        const av = String(a[field] ?? '');
        const bv = String(b[field] ?? '');
        return dir === 'desc' ? (av < bv ? 1 : -1) : av < bv ? -1 : 1;
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  };
}

