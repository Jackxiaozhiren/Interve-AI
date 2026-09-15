// Phase 5: deterministic mock provider tier (Primary/Fallback/Mock).
//
// `AI_MOCK=1` (never honored in production) short-circuits every AI route
// AFTER the auth/rate-limit/validation gate, returning canned payloads that
// validate against the routes' own output schemas (see mock contract
// tests). Purpose: offline development, keyless CI smoke, and the future
// AI-eval harness. Auth semantics are preserved — anonymous callers still
// get 401 in mock mode.
import { okResponse } from "@/lib/api/errors";

export const MOCK_HEADER = "x-mock";

export function isMockEnabled(): boolean {
  return process.env.AI_MOCK === "1" && process.env.NODE_ENV !== "production";
}

/** Canned JSON envelope mirroring okResponse + mock marker. */
export function mockJson<T>(route: string, payload: T, requestId: string) {
  void route;
  return okResponse(payload, requestId, { headers: { [MOCK_HEADER]: "1" } });
}

/**
 * Canned UI-message SSE stream for streaming routes (interview-chat,
 * init-context). Byte shapes mirror `toUIMessageStreamResponse()` output
 * (verified against the installed ai v6 `UIMessageChunk` schema), which is
 * what DefaultChatTransport parses — plain text does NOT parse (P0 found
 * by the mock journey: text/plain responses never render).
 */
export function mockTextStream(text: string, requestId: string): Response {
  const frames = [
    { type: "start", messageId: "mock-1" },
    { type: "text-start", id: "mock-t1" },
    { type: "text-delta", id: "mock-t1", delta: text },
    { type: "text-end", id: "mock-t1" },
    { type: "finish" },
  ];
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "x-request-id": requestId,
      [MOCK_HEADER]: "1",
    },
  });
}

/** Per-route canned payloads. Shapes are pinned by mock contract tests. */
export const MOCK_PAYLOADS = {
  "analyze-alignment": {
    matchScore: 72,
    strengths: ["Relevant backend experience", "Clear communication"],
    gaps: ["Distributed systems depth"],
    recommendedFocus: "Probe distributed-systems trade-offs and on-call experience.",
    evidence: ["5 years building backend services", "Hiring: distributed systems experience required"],
    confidence: "medium",
  },
  "analyze-behavior": {
    leadership: 70,
    problemSolving: 75,
    communication: 72,
    evidence: ["I led the migration of our checkout service"],
    confidence: "medium",
  },
  "analyze-chunk": {
    sentimentScore: 70,
    technicalAccuracy: 60,
    evidence: ["the cache layer handles spikes"],
    confidence: "medium",
  },
  "analyze-code": {
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    issues: [],
    hints: ["Consider edge cases for empty input."],
    isOptimal: false,
  },
  "analyze-interview": null, // V2 evaluation mock lives in mockV2Evaluation()
  "analyze-match": {
    matchData: {
      overallScore: 68,
      alignedSkills: ["TypeScript", "React"],
      missingSkills: ["System design at scale"],
      recommendations: ["Prepare a scaling story with numbers."],
      evidence: ["3 years of TypeScript and React", "Hiring: large-scale system design"],
      confidence: "medium",
    },
  },
  "analyze-practice": {
    score: 75,
    strengths: ["Direct answer"],
    improvements: ["Add a quantified result"],
    evidence: ["We rebuilt reporting over two months"],
    confidence: "medium",
    drillIds: ["behavioral-v1:impact"],
  },
  "analyze-star": {
    s: { progress: 70, confidence: 60, timeSpentSeconds: 20 },
    t: { progress: 65, confidence: 60, timeSpentSeconds: 15 },
    a: { progress: 75, confidence: 70, timeSpentSeconds: 40 },
    r: { progress: 55, confidence: 50, timeSpentSeconds: 10 },
    evidence: ["When our checkout latency spiked", "I rebuilt the retry queue over two weeks"],
    confidence: "medium",
  },
  "analyze-trends": {
    recurringFlaws: ["Unquantified impact statements"],
    keyStrengths: ["Structured communication"],
    growthActionPlan: "Add metrics to every STAR result this week.",
  },
  "analyze-vision": {
    feedback: "Mock review: the diagram shows a single service with no load balancer; add caching and a queue for spikes.",
  },
  copilot: {
    hints: ["Mention the migration scope and your role", "Quantify the latency win"],
  },
  "generate-hint": {
    hint: "Mock hint: consider what happens on empty input first.",
  },
  "init-context": null, // streamed mock lives in MOCK_STREAMS
  "interview-chat": null, // streamed mock lives in MOCK_STREAMS
  "parse-jd": {
    title: "Mock engineer's assessment",
    questions: [
      { question: "Describe a scaling challenge you solved.", rationale: "Signals depth.", expectedSkills: ["caching", "queues"] },
    ],
  },
  "parse-resume": {
    text: "Mock Candidate\nSenior Engineer with mock experience.",
    isOcrFallback: false,
  },
} as const;

/** Canned full-text streams for streaming routes. */
export const MOCK_STREAMS = {
  "interview-chat": "[Tech] Mock interviewer: walk me through a recent hard bug.",
  "init-context":
    '{"cheatsheet": ["Mock requirement"], "topPredictions": [{"question": "Mock question 1?", "rationale": "Mock rationale.", "keyPointsToHit": ["Mock point"]}, {"question": "Mock question 2?", "rationale": "Mock rationale.", "keyPointsToHit": ["Mock point"]}, {"question": "Mock question 3?", "rationale": "Mock rationale.", "keyPointsToHit": ["Mock point"]}, {"question": "Mock question 4?", "rationale": "Mock rationale.", "keyPointsToHit": ["Mock point"]}, {"question": "Mock question 5?", "rationale": "Mock rationale.", "keyPointsToHit": ["Mock point"]}]}',
} as const;

/** Minimal V2 evaluation mock (matches EvaluationV2Schema). */
export function mockV2Evaluation() {
  return {
    version: "2.0",
    rubricId: "general-v1",
    readiness: "developing",
    readinessRationale: "Mock assessment: even coverage with thin evidence on depth.",
    dimensions: [
      {
        id: "relevance",
        score: 4,
        evidence: ["Mock answer excerpt addressing the question."],
        rationale: "Mock rationale.",
        confidence: "medium",
        improvement: "Mock drill: restate the question first.",
      },
    ],
    strengths: ["Mock strength"],
    weaknesses: ["Mock gap"],
    nextDrills: ["Mock drill"],
    qaReview: [],
  };
}
