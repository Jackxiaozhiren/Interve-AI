// Phase E1: delivery-metric pure helpers extracted from the interview
// God component (behavior-identical; the page wires these in).
//
// WPM / filler counting / analysis-throttle gate. Pure + unit-tested;
// the component keeps only state updates and API calls.

/** Verbatim from the interview page (EN + ZH fillers). Global flag: reset lastIndex per call via match(). */
export const FILLER_PATTERN =
  /\b(um|uh|like|you know|basically|so|i mean|ah|那个|就是|然后|嗯|啊|额)\b/gi;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Words-per-minute. Returns null below minMinutes (page used 0.05 ≈ 3s —
 * shorter windows produce absurd WPM). Empty text yields 0 words, never NaN.
 */
export function computeWpm(text: string, durationMinutes: number, minMinutes = 0.05): number | null {
  if (!(durationMinutes > minMinutes)) return null;
  return Math.round(countWords(text) / durationMinutes);
}

export function countFillers(text: string): number {
  const matches = text.match(FILLER_PATTERN);
  return matches ? matches.length : 0;
}

export interface AnalysisGateInput {
  textLen: number;
  nowMs: number;
  lastMs: number;
  hasCodeCtx: boolean;
  hasDesignCtx: boolean;
}

/**
 * Heavy STAR/behavioral analysis throttle (verbatim port): substantial
 * utterance + 15s cooldown, or code/design context + 20s cooldown.
 * Saves API calls and backend congestion on rapid stop-start recordings.
 */
export function shouldRunAnalysis(input: AnalysisGateInput): boolean {
  const { textLen, nowMs, lastMs, hasCodeCtx, hasDesignCtx } = input;
  const since = nowMs - lastMs;
  return (
    (textLen >= 10 && since > 15000) ||
    (hasCodeCtx && since > 20000) ||
    (hasDesignCtx && since > 20000)
  );
}
