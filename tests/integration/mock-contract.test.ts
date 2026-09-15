// Phase 5: mock contract tests — canned payloads validate against the
// routes' own exported output schemas, so mocks cannot drift from reality.
import { describe, it, expect, beforeEach } from "vitest";
import { MOCK_PAYLOADS, MOCK_STREAMS, mockV2Evaluation, isMockEnabled } from "../../src/ai/providers/mock";
import { BehaviorOutputSchema } from "../../src/app/api/analyze-behavior/route";
import { StarOutputSchema } from "../../src/app/api/analyze-star/route";
import { ChunkOutputSchema } from "../../src/app/api/analyze-chunk/route";
import { AnalyzeCodeSchema } from "../../src/app/api/analyze-code/route";
import { PracticeOutputSchema } from "../../src/app/api/analyze-practice/route";
import { AlignmentOutputSchema } from "../../src/app/api/analyze-alignment/route";
import { MatchOutputSchema } from "../../src/app/api/analyze-match/route";
import { ParseJdOutputSchema } from "../../src/app/api/parse-jd/route";
import { InitContextOutputSchema } from "../../src/app/api/init-context/route";
import { HintsOutputSchema } from "../../src/app/api/copilot/route";
import { TrendsOutputSchema } from "../../src/app/api/analyze-trends/route";
import { EvaluationV2Schema } from "../../src/ai/evaluation-contract";
import { z } from "zod";

const VisionOutputSchema = z.object({ feedback: z.string() });
const HintOutputSchema = z.object({ hint: z.string() });
const ResumeOutputSchema = z.object({ text: z.string(), isOcrFallback: z.boolean() });

describe("mock payloads match route output schemas", () => {
  const cases: [string, z.ZodType, unknown][] = [
    ["analyze-alignment", AlignmentOutputSchema, MOCK_PAYLOADS["analyze-alignment"]],
    ["analyze-behavior", BehaviorOutputSchema, MOCK_PAYLOADS["analyze-behavior"]],
    ["analyze-chunk", ChunkOutputSchema, MOCK_PAYLOADS["analyze-chunk"]],
    ["analyze-code", AnalyzeCodeSchema, MOCK_PAYLOADS["analyze-code"]],
    ["analyze-match/matchData", MatchOutputSchema, (MOCK_PAYLOADS["analyze-match"] as { matchData: unknown }).matchData],
    ["analyze-practice", PracticeOutputSchema, MOCK_PAYLOADS["analyze-practice"]],
    ["analyze-star", StarOutputSchema, MOCK_PAYLOADS["analyze-star"]],
    ["analyze-trends", TrendsOutputSchema, MOCK_PAYLOADS["analyze-trends"]],
    ["analyze-vision", VisionOutputSchema, MOCK_PAYLOADS["analyze-vision"]],
    ["copilot", HintsOutputSchema, (MOCK_PAYLOADS["copilot"] as { hints: unknown }).hints],
    ["generate-hint", HintOutputSchema, MOCK_PAYLOADS["generate-hint"]],
    ["parse-jd", ParseJdOutputSchema, MOCK_PAYLOADS["parse-jd"]],
    ["parse-resume", ResumeOutputSchema, MOCK_PAYLOADS["parse-resume"]],
    ["analyze-interview/v2", EvaluationV2Schema, mockV2Evaluation()],
    ["init-context", InitContextOutputSchema, JSON.parse(MOCK_STREAMS["init-context"])],
  ];
  for (const [name, schema, payload] of cases) {
    it(`${name}: mock validates`, () => {
      expect(schema.safeParse(payload).success, name).toBe(true);
    });
  }
});

describe("mock mode integration (no provider keys needed)", () => {
  beforeEach(() => {
    process.env.AI_MOCK = "1";
    process.env.SESSION_SECRET = "phase5-test-secret-0123456789abcdef";
  });

  it("isMockEnabled honors env, never in production", async () => {
    expect(isMockEnabled()).toBe(true);
    const { POST } = await import("../../src/app/api/analyze-behavior/route");
    const { signSession } = await import("../../src/lib/api/session");
    const signed = await signSession(
      { id: "44444444-4444-4444-8444-444444444444", email: "m@t.st", username: "m" },
      process.env.SESSION_SECRET!
    );
    const res = await POST(
      new Request("http://t/api/analyze-behavior", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `interveai_user=${encodeURIComponent(signed)}`,
          "x-forwarded-for": "10.99.0.1",
        },
        body: JSON.stringify({ transcript: "Mock transcript without keys." }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-mock")).toBe("1");
    const body = await res.json();
    expect(body.leadership).toBe(70);
  });

  it("mock mode still enforces auth", async () => {
    const { POST } = await import("../../src/app/api/analyze-behavior/route");
    const res = await POST(
      new Request("http://t/api/analyze-behavior", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.99.0.2" },
        body: JSON.stringify({ transcript: "x" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("mock interview-chat returns a parseable UI-message stream", async () => {
    const { POST } = await import("../../src/app/api/interview-chat/route");
    const { signSession } = await import("../../src/lib/api/session");
    const signed = await signSession(
      { id: "55555555-5555-5555-8555-555555555555", email: "m@t.st", username: "m" },
      process.env.SESSION_SECRET!
    );
    const res = await POST(
      new Request("http://t/api/interview-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `interveai_user=${encodeURIComponent(signed)}`,
          "x-forwarded-for": "10.99.0.3",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    // Frames must match the installed ai v6 UIMessageChunk schema, which is
    // what DefaultChatTransport parses (plain text never renders — P0).
    const text = await res.text();
    const frames = text.split("\n\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
    expect(frames.length).toBeGreaterThanOrEqual(4);
    const parsed = frames.map((f) => JSON.parse(f.slice("data: ".length)) as { type: string });
    expect(parsed.map((p) => p.type)).toEqual(["start", "text-start", "text-delta", "text-end", "finish"]);
    expect(JSON.stringify(parsed)).toContain("Mock interviewer");
  });
});
