// Phase 2: shared Playwright helpers.
//
// Sessions are HMAC-signed server-side (POST /api/session). Specs must go
// through this helper — seeding the legacy `interve_auth_user` localStorage
// key (dead auth track) or forging the cookie no longer authenticates.
import type { Page } from "@playwright/test";
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
