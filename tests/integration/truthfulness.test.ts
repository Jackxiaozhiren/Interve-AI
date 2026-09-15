// Phase 3: truthfulness regression guards (P0 Fake AI).
//
// Static contract tests: they fail if anyone reintroduces random-number
// metrics, fake vision persistence, unconsumed emotion pipelines, or
// heuristic-driven pressure manipulation. Decorative canvas randomness
// (landing/chat backgrounds) is explicitly allowlisted — it never feeds
// a score, a hint, or storage.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");
const exists = (p: string) => existsSync(new URL(p, ROOT));

// Metric paths: anything here must be measured or explicitly labeled.
const METRIC_COMPONENTS = [
  "src/components/interview/CameraSelfView.tsx",
  "src/components/interview/TelemetryWidget.tsx",
  "src/components/interview/SystemHealthIndicator.tsx",
  "src/components/interview/LiveStats.tsx",
  "src/components/interview/CopilotHints.tsx",
];

describe("no fabricated metrics", () => {
  it("VisionTelemetry (random eye/posture/expression) is gone", () => {
    expect(exists("src/components/interview/VisionTelemetry.tsx")).toBe(false);
  });

  it("no Math.random in metric components or the interview page", () => {
    const files = [...METRIC_COMPONENTS, "src/app/interview/page.tsx"];
    for (const f of files) {
      expect(read(f), f).not.toMatch(/Math\.random/);
    }
  });

  it("no vision-derived identifiers survive in src", () => {
    const interview = read("src/app/interview/page.tsx");
    for (const banned of ["visionData", "setVisionData", "onVisionDataUpdate", "bodyLanguageScore"]) {
      expect(interview, banned).not.toContain(banned);
    }
  });

  it("nothing persists bodyLanguage scores anymore", () => {
    const interview = read("src/app/interview/page.tsx");
    expect(interview).not.toContain("bodyLanguage:");
  });
});

describe("no dead emotion pipeline", () => {
  it("interview page no longer calls analyze-chunk or tracks sentiment", () => {
    const interview = read("src/app/interview/page.tsx");
    expect(interview).not.toContain("analyze-chunk");
    expect(interview).not.toContain("setSentimentScore");
    expect(interview).not.toContain("setAccuracyScore");
  });
});

describe("no heuristic pressure manipulation", () => {
  it("interview-chat has no cognitive-load pressure branches", () => {
    const route = read("src/app/api/interview-chat/route.ts");
    expect(route).not.toContain("currentCognitiveLoad");
    expect(route).not.toContain("加大压力");
    expect(route).not.toContain("绝不可再咄咄逼人");
  });
});

describe("honesty labels present", () => {
  it("CameraSelfView states local-only, no analysis (via locale dictionary)", () => {
    const c = read("src/components/interview/CameraSelfView.tsx");
    expect(c).toContain("t.interview.localOnly");
    expect(c).toContain("t.interview.noVisualAnalysis");
    expect(c).not.toMatch(/\d+%/);
  });

  it("LiveStats badges AI estimates as experimental (via locale dictionary)", () => {
    const c = read("src/components/interview/LiveStats.tsx");
    expect(c).toContain("t.interview.experimental");
    expect(c).not.toContain("AI ASSESS");
  });
});
