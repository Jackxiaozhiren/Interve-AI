// Phase 9: locale dictionary parity (i18n architecture).
// Every key under `interview` (and existing namespaces) must exist in
// both locales: a missing zh key renders `undefined` at runtime.
import { describe, it, expect } from "vitest";
import { dictionaries, type Dictionary } from "../../src/lib/i18n/dictionaries";

function keysOf(obj: object, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...keysOf(v as object, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function getPath(obj: object, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc !== null && typeof acc === "object" && k in acc) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

describe("dictionaries", () => {
  it("en and zh share identical key sets with non-empty strings", () => {
    const en = keysOf(dictionaries.en).sort();
    const zh = keysOf(dictionaries.zh).sort();
    expect(zh).toEqual(en);
    for (const path of en) {
      const v = getPath(dictionaries.zh, path);
      expect(typeof v, path).toBe("string");
      expect((v as string).length, path).toBeGreaterThan(0);
    }
  });

  it("covers the Phase 9 interview chrome", () => {
    const t = (dictionaries.en as Dictionary).interview;
    for (const k of ["turn", "difficultyMedium", "showAiEstimates", "experimental", "localOnly", "strainCaption"] as const) {
      expect(t[k].length).toBeGreaterThan(0);
    }
  });

  it("covers the Phase 6 (V2) settings preferences chrome", () => {
    const t = (dictionaries.en as Dictionary).settings;
    for (const k of [
      "language",
      "languageDesc",
      "english",
      "chinese",
      "accessibility",
      "accessibilityDesc",
      "calmMode",
      "calmModeDesc",
      "liveCaptions",
      "liveCaptionsDesc",
      "dyslexiaMode",
      "dyslexiaModeDesc",
      "liveInsights",
      "liveInsightsDesc",
      "on",
      "off",
    ] as const) {
      expect(t[k].length).toBeGreaterThan(0);
    }
  });

  it("LanguageToggle exposes an accessible name (not bare EN/中)", async () => {
    const fs = await import("node:fs");
    const path = new URL("../../src/components/LanguageToggle.tsx", import.meta.url);
    const src = fs.readFileSync(path, "utf8");
    expect(src).toContain("aria-label");
  });
});
