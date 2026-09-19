// Phase 11: dataset contract tests (keyless) — the harness inputs
// themselves are validated on every run, so rot is caught without keys.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RUBRICS } from "../../src/ai/rubrics";
import { READINESS_LEVELS } from "../../src/ai/evaluation-contract";

const ROOT = new URL("../../", import.meta.url);
const load = (p: string) => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"));

describe("golden.json", () => {
  it("is well-formed with unique ids and in-anchor bands", () => {
    const g = load("evals/golden.json") as {
      version: string;
      cases: { id: string; track: string; framework?: string; rubricId: string; messages: { role: string; content: string }[]; expected: { readiness: string; dimensions: Record<string, [number, number]> } }[];
    };
    expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
    const ids = g.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.cases.length).toBeGreaterThanOrEqual(12);
    const tracks = new Set(g.cases.map((c) => c.track));
    for (const t of ["behavioral", "technical", "coding", "system-design", "data-ml", "product"]) {
      expect(tracks, t).toContain(t);
    }
    for (const c of g.cases) {
      const rubric = RUBRICS[c.rubricId];
      expect(rubric, `${c.id}: rubric`).toBeDefined();
      expect(READINESS_LEVELS as readonly string[]).toContain(c.expected.readiness);
      expect(c.messages.length).toBeGreaterThanOrEqual(2);
      const dimIds = new Set(rubric.dimensions.map((d) => d.id));
      for (const [dim, band] of Object.entries(c.expected.dimensions)) {
        expect(dimIds, `${c.id}/${dim}`).toContain(dim);
        expect(band[0]).toBeGreaterThanOrEqual(1);
        expect(band[1]).toBeLessThanOrEqual(5);
        expect(band[0]).toBeLessThanOrEqual(band[1]);
      }
      // Full rubric coverage per case (no silent dimension gaps).
      expect(Object.keys(c.expected.dimensions).sort()).toEqual([...dimIds].sort());
    }
  });
});

describe("injection-cases.json", () => {
  it("pairs clean/attacked transcripts per vector", () => {
    const j = load("evals/injection-cases.json") as {
      demandMarkers: string[];
      cases: { id: string; vector: string; clean: unknown[]; attacked: unknown[] }[];
    };
    expect(j.demandMarkers.length).toBeGreaterThan(0);
    const ids = j.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of j.cases) {
      expect(["resume", "answer", "jd"].includes(c.vector), c.id).toBe(true);
      expect(c.clean.length).toBeGreaterThan(0);
      expect(c.attacked.length).toBeGreaterThan(0);
      expect(JSON.stringify(c.attacked)).not.toBe(JSON.stringify(c.clean));
    }
  });
});

describe("fairness-pairs.json", () => {
  it("pairs differ while keeping structure parallel", () => {
    const j = load("evals/fairness-pairs.json") as {
      pairs: { id: string; variantA: { role: string; content: string }[]; variantB: { role: string; content: string }[] }[];
    };
    const ids = j.pairs.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(j.pairs.length).toBeGreaterThanOrEqual(4);
    for (const p of j.pairs) {
      expect(p.variantA.length).toBe(p.variantB.length);
      expect(JSON.stringify(p.variantA)).not.toBe(JSON.stringify(p.variantB));
      // Same shape: roles aligned turn by turn.
      expect(p.variantA.map((m) => m.role)).toEqual(p.variantB.map((m) => m.role));
    }
  });
});

describe("practice-golden.json (Phase 4)", () => {
  it("cases are well-formed with in-range bands and answer-grounded quotes", () => {
    const g = load("evals/practice-golden.json") as {
      version: string;
      cases: {
        id: string;
        question: { title: string; description?: string; category?: string };
        answer: string;
        expected: { scoreBand: [number, number]; mustQuote: string[] };
      }[];
    };
    expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
    const ids = g.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.cases.length).toBeGreaterThanOrEqual(5);
    for (const c of g.cases) {
      expect(c.question.title.length, `${c.id}: question`).toBeGreaterThan(0);
      expect(c.answer.length, `${c.id}: answer non-empty`).toBeGreaterThan(0);
      expect(c.answer.length, `${c.id}: answer within route cap`).toBeLessThanOrEqual(20000);
      const [lo, hi] = c.expected.scoreBand;
      expect(lo, `${c.id}: band`).toBeGreaterThanOrEqual(0);
      expect(hi, `${c.id}: band`).toBeLessThanOrEqual(100);
      expect(lo, `${c.id}: band ordered`).toBeLessThanOrEqual(hi);
      // Self-consistency: every authored quote must occur verbatim in the
      // answer, or the keyed suite could never pass — catch rot keylessly.
      expect(c.expected.mustQuote.length, `${c.id}: quotes`).toBeGreaterThan(0);
      for (const q of c.expected.mustQuote) {
        expect(c.answer, `${c.id}: quote "${q}" in answer`).toContain(q);
      }
    }
  });
});

describe("turn-golden.json (Phase 9 turn-level steering)", () => {
  it("cases are well-formed with in-range bands and transcript-grounded quotes", () => {
    const g = load("evals/turn-golden.json") as {
      version: string;
      lane: string;
      cases: {
        id: string;
        question: string;
        answer: string;
        expected: { avgProgressBand: [number, number]; mustQuote: string[] };
      }[];
    };
    expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(g.lane).toBe("analyze-star");
    const ids = g.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(g.cases.length).toBeGreaterThanOrEqual(3);
    for (const c of g.cases) {
      expect(c.question.length, `${c.id}: question`).toBeGreaterThan(0);
      expect(c.answer.length, `${c.id}: answer non-empty`).toBeGreaterThan(0);
      const transcript = `Q: ${c.question}\nA: ${c.answer}`;
      expect(transcript.length, `${c.id}: within route cap`).toBeLessThanOrEqual(120000);
      const [lo, hi] = c.expected.avgProgressBand;
      expect(lo, `${c.id}: band`).toBeGreaterThanOrEqual(0);
      expect(hi, `${c.id}: band`).toBeLessThanOrEqual(100);
      expect(lo, `${c.id}: band ordered`).toBeLessThanOrEqual(hi);
      // Self-consistency mirrors practice-golden: quotes must occur verbatim
      // in the serialized transcript the keyed suite actually sends.
      expect(c.expected.mustQuote.length, `${c.id}: quotes`).toBeGreaterThan(0);
      for (const q of c.expected.mustQuote) {
        expect(transcript, `${c.id}: quote "${q}" in transcript`).toContain(q);
      }
    }
  });
});

describe("bias-cases.json (Phase A3 bias audit)", () => {
  it("same-substance triplets with no authored scores (differential only)", () => {
    const g = load("evals/bias-cases.json") as {
      version: string;
      flagDrift: number;
      cases: {
        id: string;
        lane: string;
        transform: string;
        mustQuote: string[];
        base: unknown;
        variant: unknown;
      }[];
    };
    expect(g.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(g.flagDrift).toBe(20);
    const ids = g.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const transforms = new Set(g.cases.map((c) => c.transform));
    for (const t of ["position", "verbosity", "agreeableness"]) {
      expect(transforms, t).toContain(t);
    }
    for (const c of g.cases) {
      expect(["analyze-practice", "analyze-interview"], `${c.id}: lane`).toContain(c.lane);
      // Variant must differ (a transform happened) but keep the substance.
      expect(JSON.stringify(c.variant), `${c.id}: transformed`).not.toBe(JSON.stringify(c.base));
      const both = `${JSON.stringify(c.base)}\n${JSON.stringify(c.variant)}`;
      expect(c.mustQuote.length, `${c.id}: quotes`).toBeGreaterThan(0);
      for (const q of c.mustQuote) {
        expect(both, `${c.id}: substance "${q}" in base`).toContain(q);
        // quote must survive in the VARIANT too (else drift is substance loss, not bias)
        expect(JSON.stringify(c.variant), `${c.id}: substance "${q}" in variant`).toContain(q);
      }
      // Differential purity: no absolute verdicts to fit — drift only.
      expect(both, `${c.id}: no authored scores`).not.toMatch(/scoreBand|avgProgressBand|"expected"|"readiness"/);
    }
  });
});
