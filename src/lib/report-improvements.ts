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
  /** What the card prints: the quote as a fragment, never the whole answer. */
  fragment: string;
  /** 1-based index among the candidate's turns, or null when unverified. */
  round: number | null;
  messageId: string | null;
  /**
   * When an earlier item already cites this same sentence, its 1-based position.
   *
   * Measured on a real session (2026-11-02, interviews id=2): GLM wrote the same
   * 138-character evidence sentence for three dimensions, and the block printed it
   * three times over — three different pieces of advice, one wall of repeated text.
   * The advice is not the model's mistake; repeating the quote is mine.
   */
  repeatOf: number | null;
}

/**
 * A quote longer than this is cut to a fragment. PRD F-4 says 原话片段.
 *
 * 40, not the 60 first tried: the card is 808 px wide at 1280, the round badge
 * takes ~100 px of the row, and 13 px CJK type fits ~46 characters in what is
 * left. At 60 the fragment wrapped under the badge and every cited item grew a
 * line — three items then pushed the block 90 px below a 720 px fold, which is
 * the defect this fix exists for. One line, one clause, and the click opens the
 * whole turn anyway.
 */
const FRAGMENT_MAX = 40;

const BREAK_AFTER = /[，。；、！？,.;!?]/;

/**
 * The first `max` characters of a quote, cut at a clause boundary when there is
 * one near the limit, with an ellipsis. A fragment, not a summary: the words are
 * still the candidate's own, which is the whole point of the citation.
 */
export function quoteFragment(quote: string, max = FRAGMENT_MAX): string {
  const text = quote.trim();
  if (text.length <= max) return text;
  let cut = max;
  // `max - 1` and not `max`: a break at index max would make the slice max + 1
  // characters long, and the caller's one-line budget is a hard limit.
  for (let i = Math.min(max, text.length - 1) - 1; i >= max - 15 && i > 0; i--) {
    if (BREAK_AFTER.test(text[i])) {
      cut = i + 1;
      break;
    }
  }
  return `${text.slice(0, cut).trimEnd()}…`;
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
    .map(({ dim }, index, all) => {
      const quote = dim.evidence[0];
      const hit = locateQuote(quote, transcript);
      // Same turn, or (when the quote could not be placed) the same words: either
      // way the reader has already been shown this sentence.
      const key = hit?.messageId ?? stripForMatch(quote);
      const earlier = all.findIndex((other, i) => {
        if (i >= index) return false;
        const otherQuote = other.dim.evidence[0];
        const otherKey = locateQuote(otherQuote, transcript)?.messageId ?? stripForMatch(otherQuote);
        return otherKey === key;
      });
      return {
        dimensionId: dim.id,
        name: dim.name,
        sentence: dim.improvement,
        quote,
        fragment: quoteFragment(quote),
        round: hit?.round ?? null,
        messageId: hit?.messageId ?? null,
        repeatOf: earlier >= 0 ? earlier + 1 : null,
      };
    });
}
