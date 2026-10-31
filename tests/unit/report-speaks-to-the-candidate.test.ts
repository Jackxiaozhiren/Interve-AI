// The report is read by the person who sat the interview (§15.2-shaped decision,
// owner, 2026-10-31: 候选人). It carried a stats strip mixing two kinds of number:
// what the candidate did (interruptions, average answer length) and how fast our
// own stack ran (TTFT, Whisper duration, TTS startup, round trip). The second kind
// is vendor telemetry. A candidate reading "TTS 启动 0.9s" learns nothing about
// themselves and can reasonably read it as a score.
//
// This guard holds the line at the labels, because the numbers are indistinguishable
// at a glance and the mistake has already been made once.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const REPORT = "src/app/dashboard/report/[id]/page.tsx";

const STACK_METRICS = ["TTFT", "STT 耗时", "TTS 启动", "平均往返"];

describe("the report shows the candidate their interview, not our latency", () => {
  const source = readFileSync(REPORT, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  for (const label of STACK_METRICS) {
    it(`does not label a number "${label}"`, () => {
      expect(
        source.includes(label),
        `the report still renders "${label}", which measures this product's stack rather than the candidate`,
      ).toBe(false);
    });
  }

  it("still shows the two numbers that are about the candidate", () => {
    // Removing the strip wholesale would be the easy way to pass the checks above
    // and would throw away real feedback. These stay.
    expect(source).toContain("打断");
    expect(source).toContain("平均作答");
  });
});
