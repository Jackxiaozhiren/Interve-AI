// Why this exists: a Postgres undefined-column error (42703) is a deploy bug,
// but src/app/setup/page.tsx caught it and told the user "Database
// unavailable, starting local-only session". That misdiagnosis is the reason
// the interviews-table schema drift survived: every symptom pointed at the
// connection, so nobody looked at the columns.
//
// Classification must stay client-safe (setup/page.tsx is a client component),
// so this lives beside the row contract in src/lib/db.ts rather than in
// src/lib/api/classify-error.ts, which imports the AI SDK and is server-only.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { classifyDbFailure } from "../../src/lib/db";

describe("classifyDbFailure", () => {
  it("reads a Postgres undefined-column error as schema drift, not an outage", () => {
    expect(
      classifyDbFailure({
        code: "42703",
        message: 'column "custom_type_description" of relation "interviews" does not exist',
      })
    ).toBe("schema_drift");
  });

  it("reads a PostgREST schema-cache miss as schema drift", () => {
    // The exact shape the live server threw for the missing `plan` column.
    expect(
      classifyDbFailure({
        code: "PGRST204",
        details: null,
        hint: null,
        message: "Could not find the 'custom_type_description' column of 'interviews' in the schema cache",
      })
    ).toBe("schema_drift");
  });

  it("reads a failed fetch as unreachable", () => {
    expect(classifyDbFailure(new TypeError("fetch failed"))).toBe("unreachable");
  });

  it("reads a dropped socket as unreachable", () => {
    expect(classifyDbFailure(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))).toBe(
      "unreachable"
    );
  });

  it("does not guess for an error it cannot place", () => {
    expect(classifyDbFailure({ code: "42501", message: "permission denied" })).toBe("other");
  });

  it("survives the values callers actually receive", () => {
    expect(classifyDbFailure(null)).toBe("other");
    expect(classifyDbFailure(undefined)).toBe("other");
    expect(classifyDbFailure("boom")).toBe("other");
  });
});

// The classifier is only worth anything if the catch that hid this bug uses it.
// Static contract in the repo's call-site-pin style (see onboarding-tour.test.ts):
// the handler must branch on the classification before claiming anything about
// why the session is running locally.
describe("setup/page.tsx persistence fallback", () => {
  const catchBlock = () => {
    const src = readFileSync(
      new URL("../../src/app/setup/page.tsx", import.meta.url),
      "utf8"
    );
    const m = src.match(/\} catch \(dbError\) \{[\s\S]*?\n      \}/);
    if (!m) throw new Error("the db-write catch in setup/page.tsx was not found");
    return m[0];
  };

  it("classifies the failure instead of assuming an outage", () => {
    expect(catchBlock()).toContain("classifyDbFailure");
  });

  it("gives the drift case its own outcome, so a missing column is not reported as a dead connection", () => {
    expect(catchBlock()).toContain("schema_drift");
  });
});
