// Phase 2: shared Playwright helpers.
//
// Sessions are HMAC-signed server-side (POST /api/session). Specs must go
// through this helper — seeding the legacy `interve_auth_user` localStorage
// key (dead auth track) or forging the cookie no longer authenticates.
import type { Page, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";

export async function loginAs(page: Page, email = "e2e@example.com"): Promise<void> {
  const id = randomUUID();
  const username = email.split("@")[0] || "e2e";
  const res = await page.request.post("/api/session", {
    data: { id, email, username },
  });
  if (!res.ok()) {
    throw new Error(`seed session failed: ${res.status()} ${await res.text()}`);
  }
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

