import { beforeEach, describe, expect, it, vi } from "vitest";
import { runTurnAnalysis, type TurnAnalysisInput } from "@/lib/interview/turn-analysis";
import type { StarSink, TraitsSink } from "@/lib/interview/analysis-projection";

/**
 * The per-utterance analysis path. It runs after every substantial answer in a
 * live interview and had no coverage at all: the throttle in front of it was
 * tested, the dispatch behind it was not.
 */

const input: TurnAnalysisInput = {
  transcript: "I led a team of four to cut latency by 30%",
  codeContext: "func main() {}",
  systemDesignContext: "boxes and arrows",
};

function sinks() {
  // One object satisfying both sink interfaces, as the real store is.
  return {
    setStarProgress: vi.fn(),
    setStarBehavior: vi.fn(),
    setBehavioralTraits: vi.fn(),
    setGrounding: vi.fn(),
    setConfidence: vi.fn(),
  } as unknown as StarSink & TraitsSink;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const STAR_BODY = {
  s: { progress: 3, evidence: ["I led a team of four"] },
  t: { progress: 2 },
  a: { progress: 4 },
  r: { progress: 3 },
};
const BEHAVIOR_BODY = { leadership: 4, ownership: 3, communication: 4, resilience: 3, learningAgility: 3 };

function fetchStub(routes: Record<string, Response>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const key = String(url);
    calls.push({
      url: key,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    const res = routes[key];
    if (!res) throw new Error(`unstubbed route ${key}`);
    return res;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("runTurnAnalysis", () => {
  it("asks both routes, once each, with the transcript and board context", async () => {
    const { impl, calls } = fetchStub({
      "/api/analyze-star": json(STAR_BODY),
      "/api/analyze-behavior": json(BEHAVIOR_BODY),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await runTurnAnalysis(input, sinks(), impl);

    expect(calls.map((c) => c.url).sort()).toEqual(["/api/analyze-behavior", "/api/analyze-star"]);
    const star = calls.find((c) => c.url === "/api/analyze-star")!.body;
    expect(star).toEqual({
      transcript: input.transcript,
      codeContext: input.codeContext,
      systemDesignContext: input.systemDesignContext,
    });
    // Behavioral analysis deliberately sees only the answer, not the boards.
    expect(calls.find((c) => c.url === "/api/analyze-behavior")!.body).toEqual({
      transcript: input.transcript,
    });
  });

  it("folds a successful pair into the sinks", async () => {
    const { impl } = fetchStub({
      "/api/analyze-star": json(STAR_BODY),
      "/api/analyze-behavior": json(BEHAVIOR_BODY),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = sinks();

    await runTurnAnalysis(input, s, impl);

    expect(s.setStarProgress).toHaveBeenCalled();
    expect(s.setBehavioralTraits).toHaveBeenCalled();
  });

  it("names the status on a rate limit and leaves the stores untouched", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { impl } = fetchStub({
      "/api/analyze-star": json({ error: { code: "RATE_LIMITED", message: "Daily AI budget exceeded" }, requestId: "r1" }, 429),
      "/api/analyze-behavior": json({ error: { code: "RATE_LIMITED", message: "Daily AI budget exceeded" }, requestId: "r2" }, 429),
    });
    const s = sinks();

    await expect(runTurnAnalysis(input, s, impl)).resolves.toBeUndefined();

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/analyze-star analysis unavailable/);
    expect(logged).toMatch(/429/);
    expect(logged).toMatch(/RATE_LIMITED/);
    expect(s.setStarProgress).not.toHaveBeenCalled();
    expect(s.setBehavioralTraits).not.toHaveBeenCalled();
  });

  it("calls a platform rejection what it is instead of blaming the parse", async () => {
    // The regression this exists for: `.then(res => res.json())` threw on an HTML
    // body and the catch reported "SyntaxError", sending the next investigation
    // after the parser rather than the duration budget.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { impl } = fetchStub({
      "/api/analyze-star": new Response("<html>Function timed out</html>", { status: 200, headers: { "content-type": "text/html" } }),
      "/api/analyze-behavior": new Response("<html>Function timed out</html>", { status: 504, headers: { "content-type": "text/html" } }),
    });

    await runTurnAnalysis(input, sinks(), impl);

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/无法解析的响应/);
    expect(logged).not.toMatch(/SyntaxError/);
  });

  it("never rejects into the interview when the network itself fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const impl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const s = sinks();

    await expect(runTurnAnalysis(input, s, impl)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(s.setStarProgress).not.toHaveBeenCalled();
  });

  it("survives a well-formed response the projection refuses to apply", async () => {
    // A 200 whose payload has no STAR progress is a model-quality problem, not a
    // crash: the projection returns false and the interview carries on.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { impl } = fetchStub({
      "/api/analyze-star": json({ unexpected: "shape" }),
      "/api/analyze-behavior": json({ unexpected: "shape" }),
    });

    await expect(runTurnAnalysis(input, sinks(), impl)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
