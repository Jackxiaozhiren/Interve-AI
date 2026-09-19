// Phase C1: quota ledger correctness (keyless, zero quota, zero network).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ptDayKey,
  providerBudget,
  quotaCheck,
  quotaRecord,
  readLedger,
} from "../../scripts/quota-ledger.mjs";

function tmpLedger(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "quota-ledger-")), "ledger.json");
}

describe("ptDayKey (RPD windows align to PT midnight = Beijing 15:00)", () => {
  it("rolls over at 07:00Z in September (PDT, UTC-7)", () => {
    expect(ptDayKey(new Date("2026-09-17T06:59:59.000Z"))).toBe("2026-09-16");
    expect(ptDayKey(new Date("2026-09-17T07:00:00.000Z"))).toBe("2026-09-17");
  });

  it("rolls over at 08:00Z in January (PST, UTC-8)", () => {
    expect(ptDayKey(new Date("2026-01-15T07:59:59.000Z"))).toBe("2026-01-14");
    expect(ptDayKey(new Date("2026-01-15T08:00:00.000Z"))).toBe("2026-01-15");
  });
});

describe("providerBudget", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["QUOTA_ZHIPU_RPD", "QUOTA_GEMINI_RPD"]) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("defaults: gemini 20 (V3 iron rule), zhipu 50 provisional", () => {
    expect(providerBudget("gemini")).toBe(20);
    expect(providerBudget("zhipu")).toBe(50);
  });

  it("env overrides win; garbage falls back to defaults", () => {
    process.env.QUOTA_GEMINI_RPD = "5";
    process.env.QUOTA_ZHIPU_RPD = "not-a-number";
    expect(providerBudget("gemini")).toBe(5);
    expect(providerBudget("zhipu")).toBe(50);
  });
});

describe("quotaCheck / quotaRecord (temp files, no repo state touched)", () => {
  it("fresh ledger fits; recorded calls reduce remaining", () => {
    const f = tmpLedger();
    expect(quotaCheck("zhipu", 3, { ledgerFile: f }).ok).toBe(true);
    quotaRecord("zhipu", 3, { ledgerFile: f });
    const c = quotaCheck("zhipu", 48, { ledgerFile: f });
    expect(c.used).toBe(3);
    expect(c.remaining).toBe(47);
    expect(c.ok).toBe(false); // 48 > 47 left
    expect(quotaCheck("zhipu", 47, { ledgerFile: f }).ok).toBe(true);
  });

  it("providers are counted separately", () => {
    const f = tmpLedger();
    quotaRecord("zhipu", 50, { ledgerFile: f });
    expect(quotaCheck("zhipu", 1, { ledgerFile: f }).ok).toBe(false);
    expect(quotaCheck("gemini", 20, { ledgerFile: f }).ok).toBe(true);
  });

  it("stale PT windows roll over to zero", () => {
    const f = tmpLedger();
    quotaRecord("gemini", 20, { ledgerFile: f, now: new Date("2026-09-16T12:00:00.000Z") });
    const c = quotaCheck("gemini", 20, { ledgerFile: f, now: new Date("2026-09-17T12:00:00.000Z") });
    expect(c.used).toBe(0);
    expect(c.ok).toBe(true);
  });

  it("corrupt ledger files read as fresh instead of throwing", () => {
    const f = tmpLedger();
    fs.writeFileSync(f, "{not json", "utf8");
    expect(readLedger(f)).toEqual({ version: 1, windows: {} });
    expect(quotaCheck("zhipu", 1, { ledgerFile: f }).ok).toBe(true);
  });

  it("rejects unknown providers and negative counts (never silently)", () => {
    const f = tmpLedger();
    expect(() => quotaCheck("openai" as never, 1, { ledgerFile: f })).toThrow();
    expect(() => quotaRecord("zhipu", -1, { ledgerFile: f })).toThrow();
  });
});

describe("evalEnv quota gate (evals/runner.ts)", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["ZHIPU_API_KEY", "SESSION_SECRET", "QUOTA_LEDGER_PATH"]) {
      saved[k] = process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("self-skips with a quota reason when the ledger is exhausted", async () => {
    const f = tmpLedger();
    process.env.QUOTA_LEDGER_PATH = f;
    process.env.ZHIPU_API_KEY = "dummy-units-never-hit-network";
    process.env.SESSION_SECRET = "dummy";
    quotaRecord("zhipu", 50, { ledgerFile: f }); // burn the whole provisional RPD
    const { evalEnv } = await import("../../evals/runner");
    const env = evalEnv(3);
    expect(env.ready).toBe(false);
    expect(env.reason).toContain("quota ledger");
  });

  it("stays ready on a fresh ledger (no behavior change for funded runs)", async () => {
    process.env.QUOTA_LEDGER_PATH = tmpLedger();
    process.env.ZHIPU_API_KEY = "dummy-units-never-hit-network";
    const { evalEnv } = await import("../../evals/runner");
    expect(evalEnv(3).ready).toBe(true);
  });
});
