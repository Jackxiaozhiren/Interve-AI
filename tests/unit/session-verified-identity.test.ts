// POST /api/session used to mint a session cookie for any well-formed identity
// the caller typed (`LoginSchema` validated the shape, not the ownership). With
// the identity decision recorded as §15.2 = a, the endpoint must derive the
// identity from a verified Supabase token and ignore whatever the body claims —
// otherwise the cookie is a claim about a person that nobody checked.
//
// The third case is the one that matters: a caller who holds a valid token for
// account A must not be able to obtain a session stamped as account B.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));
vi.mock("@/lib/api/verify-supabase-token", () => ({ verifySupabaseToken: verifyMock }));

import { POST } from "@/app/api/session/route";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { verifySessionCookie } from "@/lib/api/session";

const VERIFIED = {
  id: "a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3",
  email: "verified@t.st",
  username: "verified",
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://test/api/session", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

function cookieValue(res: Response): string | null {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const m = raw.match(/interveai_user=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

describe("a session cookie is only issued for a verified identity", () => {
  const saved = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "a3-test-secret-0123456789abcdef";
    resetRateLimits();
    verifyMock.mockReset();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved;
  });

  it("refuses a caller who presents no token at all", async () => {
    const res = await post({ id: VERIFIED.id, email: VERIFIED.email, username: VERIFIED.username });
    expect(res.status).toBe(401);
    expect(cookieValue(res), "a refusal must not set a cookie").toBeNull();
  });

  it("refuses a token the platform will not confirm", async () => {
    verifyMock.mockResolvedValue(null);
    const res = await post({}, { authorization: "Bearer not-a-real-token" });
    expect(res.status).toBe(401);
    expect(cookieValue(res)).toBeNull();
  });

  it("stamps the verified identity, not the one the body asks for", async () => {
    verifyMock.mockResolvedValue(VERIFIED);
    const impostor = "b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4";
    const res = await post(
      { id: impostor, email: "someone-else@t.st", username: "someone-else" },
      { authorization: "Bearer good-token" }
    );
    expect(res.status).toBe(200);

    const value = cookieValue(res);
    expect(value, "a verified call must set the cookie").not.toBeNull();
    const session = await verifySessionCookie(value as string, process.env.SESSION_SECRET as string);
    expect(session?.id).toBe(VERIFIED.id);
    expect(session?.email).toBe(VERIFIED.email);
  });
});
