// Phase 10: prohibited-capability locks (26).
//
// Six banned pairings must never ship: emotion→hiring, face→personality/
// honesty/intelligence, accent→competence, voice→personality, protected-
// attribute inference, hire-verdict generation. These static guards fail
// the build if any of them reappears. Deliberately precise (word-boundary
// matched with documented allowlists) to avoid CSS-variable noise.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const SRC_DIR = fileURLToPath(new URL("../../src/", import.meta.url));

function srcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };
  walk(SRC_DIR);
  return out;
}

function grepFiles(pattern: RegExp, opts?: { skipComments?: boolean }): { file: string; line: string }[] {
  const hits: { file: string; line: string }[] = [];
  for (const file of srcFiles()) {
    const content = readFileSync(file, "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      // Removal notes in comments describe history; only live code can ship
      // a prohibited capability.
      if (opts?.skipComments && (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*") || line.startsWith("{/*"))) {
        continue;
      }
      if (pattern.test(raw)) hits.push({ file: file.replace(SRC_DIR, "src/"), line: line.slice(0, 120) });
    }
  }
  return hits;
}

describe("prohibited capabilities (static locks)", () => {
  it("no face-analysis libraries in dependencies", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const banned = ["face-api.js", "faceapi", "@mediapipe", "@tensorflow-models/face-landmarks-detection", "@tensorflow-models/face-detection", "human", "face-blur"];
    for (const dep of Object.keys(pkg.dependencies)) {
      for (const b of banned) {
        expect(dep.startsWith(b) || dep === b, `banned dep: ${dep}`).toBe(false);
      }
    }
  });

  it("no face-landmark identifiers in src", () => {
    expect(grepFiles(/face-api|mediapipe|FaceMesh|face_landmarker|faceLandmarker|FaceLandmarker/)).toEqual([]);
  });

  it("no accent-based assessment", () => {
    // Tailwind `accent-*` classes are styling noise, not assessment.
    const hits = grepFiles(/(?<![\w-])accent(?![\w-])/i);
    expect(hits).toEqual([]);
  });

  it("no emotion-score consumers (sentiment pipeline stays callerless)", () => {
    // Definition sites (analyze-chunk schema + chunk prompt builder, which
    // must name the exact schema keys for the model to comply — live-verified
    // 2026-09-13) + mock payload are allowed; any READER outside them
    // reintroduces emotion→product coupling.
    const hits = grepFiles(/sentimentScore/, { skipComments: true }).filter(
      (h) => !h.file.endsWith("src/app/api/analyze-chunk/route.ts") && !h.file.endsWith("src/ai/providers/mock.ts") && !h.file.endsWith("src/ai/prompts/chunk.ts")
    );
    expect(hits).toEqual([]);
  });

  it("no hire-verdict writes (legacy reads only)", () => {
    // db.ts holds the optional type field; everything else must only read.
    const hits = grepFiles(/hireVerdict\s*:/).filter((h) => !h.file.endsWith("src/lib/db.ts"));
    expect(hits).toEqual([]);
  });

  it("no culture-fit generation (legacy reads only)", () => {
    const hits = grepFiles(/cultureFitAdvisor\s*:/).filter((h) => !h.file.endsWith("src/lib/db.ts"));
    expect(hits).toEqual([]);
  });

  it("no protected-attribute inference", () => {
    const hits = grepFiles(/\b(race|gender|religion|politics|ethnicity|sexual orientation|disability)\b/i).filter(
      (h) => !h.line.includes("trace")
    );
    expect(hits).toEqual([]);
  });

  it("evaluation contract exposes no banned dimensions", () => {
    // The FORBIDDEN clause (prompts/evaluation.ts) names them to prohibit
    // them — the only allowed mention.
    const prompt = readFileSync(new URL("../../src/ai/prompts/evaluation.ts", import.meta.url), "utf8");
    expect(prompt).toMatch(/FORBIDDEN/);
    const rubrics = readFileSync(new URL("../../src/ai/rubrics/index.ts", import.meta.url), "utf8");
    for (const bannedId of ["emotion", "personality", "cultureFit", "hire", "accent"]) {
      expect(rubrics).not.toContain(`"${bannedId}"`);
    }
  });
});
