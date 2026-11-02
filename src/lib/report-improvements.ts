import type { EvaluationView } from "@/lib/eval-compat";

/**
 * P0-2 (PRD F-4 §1–§2): the three changes the report opens with, each wired to
 * the words that earned it.
 *
 * Two constraints shaped this.
 *
 * 1. Nothing is invented. The sentence is the dimension's own `improvement`,
 *    the quote is its own `evidence[0]`, and a dimension with no evidence is
 *    dropped rather than shown without proof — that is the same rule the
 *    evaluation contract enforces with `.min(1)` on the array.
 * 2. The round number is derived, never guessed. Evidence quotes are verbatim
 *    by contract, so the transcript is searched for the one that contains them.
 *    When a quote is a paraphrase the transcript never said, `round` stays null
 *    and the UI shows the quote without claiming a turn — a wrong round number
 *    is worse than no round number, because the reader clicks it and lands on
 *    words that are not there.
 */

export interface TranscriptTurn {
  id: string;
  role: string;
  content: string;
}

export interface CitedImprovement {
  dimensionId: string;
  name: string;
  /** One sentence: what to change (the dimension's own improvement). */
  sentence: string;
  /** Verbatim quote from this session (the dimension's own evidence). */
  quote: string;
  /** 1-based index among the candidate's turns, or null when unverified. */
  round: number | null;
  messageId: string | null;
}

/** Quoted text is compared without whitespace, quotes or punctuation. */
function stripForMatch(text: string): string {
  return text
    .replace(/[\s"'“”‘’`·]/g, "")
    .replace(/[…]+/g, "")
    .replace(/[，。！？、；：,.!?;:—–\-]/g, "")
    .toLowerCase();
}

/**
 * A message short enough to be contained in almost any quote is not evidence
 * that the quote came from it ("好的", "嗯"). Below this length, the reverse
 * containment test is not run at all.
 *
 * Eight, not twenty: the quotes are Chinese, where eight characters is already
 * a clause ("我们大概快了一点点" is eleven). The floor only has to exclude
 * acknowledgements, and a threshold tuned for English words excluded most real
 * Chinese answers from the swallowed-quote case.
 */
const MIN_WHOLE_MESSAGE_MATCH = 8;

export function locateQuote(
  quote: string,
  transcript: TranscriptTurn[],
): { round: number; messageId: string } | null {
  const needle = stripForMatch(quote);
  if (needle.length < 6) return null;

  const userTurns = transcript.filter((m) => m.role === "user");
  for (let i = 0; i < userTurns.length; i++) {
    const hay = stripForMatch(userTurns[i].content);
    if (hay.length === 0) continue;
    // Either the quote sits inside the answer (the usual case), or the answer
    // sits inside the quote — a model that quoted the whole turn and added a
    // leading "候选人说：" still pointed at this turn.
    const contained = hay.includes(needle);
    const truncated = hay.length >= MIN_WHOLE_MESSAGE_MATCH && needle.includes(hay);
    if (contained || truncated) {
      return { round: i + 1, messageId: userTurns[i].id };
    }
  }
  return null;
}

/**
 * Weakest-first, evidence-bearing dimensions, capped at `limit`.
 * A legacy row has dimensions with empty `evidence` and therefore yields no
 * items — the block does not render rather than promising a citation it lacks.
 */
export function topImprovements(
  view: EvaluationView,
  transcript: TranscriptTurn[],
  limit = 3,
): CitedImprovement[] {
  return view.dimensions
    .filter((dim) => dim.evidence.length > 0 && dim.improvement.trim().length > 0)
    .map((dim) => ({ dim, order: view.dimensions.indexOf(dim) }))
    .sort((a, b) => (a.dim.score100 - b.dim.score100) || (a.order - b.order))
    .slice(0, limit)
    .map(({ dim }) => {
      const quote = dim.evidence[0];
      const hit = locateQuote(quote, transcript);
      return {
        dimensionId: dim.id,
        name: dim.name,
        sentence: dim.improvement,
        quote,
        round: hit?.round ?? null,
        messageId: hit?.messageId ?? null,
      };
    });
}
