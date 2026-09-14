/**
 * Pure display helpers extracted for unit testing.
 * Logic mirrors `app/analysis/[runId]/page.tsx` (≤1 fraction vs >1 percent).
 */

/** 0.92 → 92, 85 → 85, undefined/NaN → null. */
export function validationPct(rate: number | undefined): number | null {
  if (typeof rate !== "number" || Number.isNaN(rate)) return null;
  return Math.round(rate <= 1 ? rate * 100 : rate);
}

/** Confidence may arrive as 0~1 fraction or >1 percent-style; normalize to 0~100. */
export function confidencePct(confidence: number): number {
  if (Number.isNaN(confidence)) return 0;
  return Math.round(confidence <= 1 ? confidence * 100 : confidence);
}

/** Full run-level validation % (mirrors `app/analysis/[runId]/page.tsx`). */
export function runValidationPct(data: {
  validation_rate?: number;
  evidence?: { confidence: number }[];
} | null): number {
  if (!data) return 0;
  if (typeof data.validation_rate === "number") return validationPct(data.validation_rate) ?? 0;
  const ev = data.evidence ?? [];
  if (ev.length === 0) return 0;
  return Math.round(
    (ev.reduce((s, e) => s + (e.confidence > 1 ? e.confidence / 100 : e.confidence), 0) / ev.length) * 100,
  );
}

/** Strip raw HTML tags from API error text (ErrorState contract). */
export function safeErrorText(message: string, max = 500): string {
  return message.replace(/<[^>]*>/g, "").slice(0, max);
}
