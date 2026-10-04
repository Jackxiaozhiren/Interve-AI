// Phase E1: delivery-metric pure helpers extracted from the interview
// God component (behavior-identical; the page wires these in).
//
// WPM / filler counting / analysis-throttle gate. Pure + unit-tested;
// the component keeps only state updates and API calls.

/**
 * Han characters, counted one-per-word. The room runs `lang = 'zh-CN'`, so this
 * is the majority case, not an edge case.
 */
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const HAN_G = new RegExp(HAN.source, "g");
const LATIN_TOKEN = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

/**
 * Words-per-minute. Returns null below minMinutes (page used 0.05 ≈ 3s —
 * shorter windows produce absurd WPM). Empty text yields 0 words, never NaN.
 */
export function computeWpm(text: string, durationMinutes: number, minMinutes = 0.05): number | null {
  if (!(durationMinutes > minMinutes)) return null;
  return Math.round(countWords(text) / durationMinutes);
}

/**
 * Latin words plus Han characters. Splitting on whitespace alone counted an
 * entire Chinese sentence as ONE word, so a fluent candidate's pacing read as
 * ~1 WPM — and two consumers branch on that number (the report page's
 * "below the 100-160 band" advice and CopilotHints' every-3-seconds "you are
 * pacing slowly"), so the metric was not merely inaccurate, it was actively
 * telling Chinese users they speak too slowly.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const han = text.match(HAN_G)?.length ?? 0;
  const latin = text.replace(HAN_G, " ").match(LATIN_TOKEN)?.length ?? 0;
  return han + latin;
}

const EN_FILLERS = "um|uh|like|you know|basically|so|i mean|ah";
const ZH_FILLERS = "那个|就是|然后|嗯|啊|额";

/**
 * English entries keep `\\b`; Chinese ones cannot, because JavaScript's `\\w` is
 * ASCII-only and a Chinese token never forms a `\\b` against its neighbours —
 * that bug made every Chinese filler match zero and the hesitation signal dead.
 * Chinese entries are instead matched standalone: a Han character immediately
 * before or after disqualifies the hit, which keeps 好啊 / 对啊 (natural
 * sentence endings) and 然后我们 / 就是这样 (ordinary connectors running into
 * their clause) out of a count that is supposed to mean hesitation.
 */
export const FILLER_PATTERN = new RegExp(
  `(?:\\b(?:${EN_FILLERS})\\b|${ZH_FILLERS})`,
  "gi",
);

export function countFillers(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const match of text.matchAll(FILLER_PATTERN)) {
    const token = match[0];
    if (HAN.test(token)) {
      const before = text[match.index - 1] ?? "";
      const after = text[match.index + token.length] ?? "";
      if (HAN.test(before) || HAN.test(after)) continue;
    }
    count += 1;
  }
  return count;
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
