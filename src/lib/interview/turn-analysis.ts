import { describeApiFailure, readApiJson } from "@/lib/api/read-response";
import {
  applyBehavioralAnalysis,
  applyStarAnalysis,
  type StarSink,
  type TraitsSink,
} from "@/lib/interview/analysis-projection";

export interface TurnAnalysisInput {
  /** The utterance, already trimmed. */
  transcript: string;
  codeContext: string | null;
  systemDesignContext: string | null;
}

/**
 * Sends one utterance to the two analysis routes and folds whatever comes back
 * into the stores.
 *
 * This is the path that runs after every substantial answer, and until now it had
 * no test: the gate that decides *whether* to run was extracted and covered
 * (shouldRunAnalysis), but nothing checked what happens once it fires. Two things
 * are worth pinning here. Neither response is allowed to reject into the caller —
 * a candidate mid-interview must not lose a turn to a rate limit — and a failure
 * must be attributable, because the previous shape logged
 * "STAR analysis error: SyntaxError: Unexpected token <" for a platform timeout,
 * which pointed every investigation at the parser instead of the server.
 *
 * One sink rather than two: the interview store satisfies both, and the two
 * routes write to disjoint parts of it.
 *
 * No toast by design: this runs between sentences, so a degraded route would
 * notify the candidate several times per answer.
 */
export async function runTurnAnalysis(
  input: TurnAnalysisInput,
  sinks: StarSink & TraitsSink,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const post = (route: string, body: unknown) =>
    fetchImpl(`/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(readApiJson)
      .then((result) => {
        if (result.ok) return result.data;
        console.warn(`${route} analysis unavailable:`, describeApiFailure(result.failure));
        return undefined;
      })
      .catch((err: unknown) => {
        console.error(`${route} analysis request failed:`, err);
        return undefined;
      });

  const [star, behavior] = await Promise.all([
    post("analyze-star", {
      transcript: input.transcript,
      codeContext: input.codeContext,
      systemDesignContext: input.systemDesignContext,
    }),
    post("analyze-behavior", { transcript: input.transcript }),
  ]);

  if (star !== undefined) applyStarAnalysis(star, sinks);
  if (behavior !== undefined) applyBehavioralAnalysis(behavior, sinks);
}
