// The mount-time session probe releases `isLoading`, and `isLoading` is what
// disables the Google / GitHub / submit buttons on /login and /signup. An
// unbounded await there is therefore a lock on the entry door, not a delay —
// pinned here because the fix is one keyword and easy to "simplify" away.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ctx = readFileSync(new URL("../../src/context/AuthContext.tsx", import.meta.url), "utf8");

describe("auth bootstrap cannot hang the sign-in door", () => {
  it("wraps the probe in a deadline", () => {
    // A call, not an import: `toContain("withTimeout")` is satisfied by the
    // import line alone and stayed green against a call site that dropped it.
    expect(ctx).toMatch(/withTimeout\(\s*\n?\s*supabase\.auth\.getUser\(\)/);
  });

  it("has no unbounded await left on the probe", () => {
    expect(ctx).not.toMatch(/await\s+supabase\.auth\.getUser\(\)/);
  });

  it("declares the deadline as a number, not a bare literal at the call", () => {
    const match = ctx.match(/AUTH_BOOTSTRAP_TIMEOUT_MS\s*=\s*(\d+)/);
    expect(match, "named constant").not.toBeNull();
    const ms = Number(match![1]);
    // Long enough for a slow mobile RTT token refresh, short enough that nobody
    // waits on it to press a button.
    expect(ms).toBeGreaterThanOrEqual(2000);
    expect(ms).toBeLessThanOrEqual(10_000);
  });
});
