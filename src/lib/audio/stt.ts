// Phase 8: STT session observability (19.2).
//
// Records what the recognizer actually did — partial vs final transcripts,
// per-final confidence, reconnects, language mix. Pure + tested; the page
// feeds Web SpeechRecognition events into it.

export type SttLang = "zh" | "en" | "other";

export function detectLang(text: string): SttLang {
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return "zh";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "other";
}

export interface SttFinal {
  text: string;
  /** 0-1 recognizer confidence when provided, else null. */
  confidence: number | null;
  lang: SttLang;
}

export interface SttStats {
  partials: number;
  finals: number;
  avgConfidence: number | null;
  reconnects: number;
  /** Share of final-result characters that are CJK (0-1), null if none. */
  zhRatio: number | null;
  langSwitches: number;
}

export interface SttSession {
  recordPartial: (text: string) => void;
  recordFinal: (text: string, confidence?: number | null) => void;
  recordReconnect: () => void;
  stats: () => SttStats;
  reset: () => void;
}

export function createSttSession(): SttSession {
  let partials = 0;
  const finals: SttFinal[] = [];
  let reconnects = 0;
  let langSwitches = 0;
  let lastLang: SttLang | null = null;

  return {
    recordPartial: () => {
      partials += 1;
    },
    recordFinal: (text, confidence = null) => {
      const lang = detectLang(text);
      if (lastLang !== null && lang !== lastLang && lang !== "other" && lastLang !== "other") {
        langSwitches += 1;
      }
      lastLang = lang;
      finals.push({
        text,
        confidence: typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null,
        lang,
      });
    },
    recordReconnect: () => {
      reconnects += 1;
    },
    stats: () => {
      const confs = finals.map((f) => f.confidence).filter((c): c is number => c !== null);
      const chars = finals.reduce((a, f) => a + f.text.length, 0);
      const zhChars = finals
        .filter((f) => f.lang === "zh")
        .reduce((a, f) => a + f.text.length, 0);
      return {
        partials,
        finals: finals.length,
        avgConfidence: confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
        reconnects,
        zhRatio: chars > 0 ? zhChars / chars : null,
        langSwitches,
      };
    },
    reset: () => {
      partials = 0;
      finals.length = 0;
      reconnects = 0;
      langSwitches = 0;
      lastLang = null;
    },
  };
}
