/**
 * The rules for recording an objection, separated from the button that records
 * it so they can be tested without a browser.
 *
 * Two invariants matter more than the UX:
 *
 *   - **An objection is never silently dropped.** If the append would exceed
 *     the cap, the caller is told so it can say "you already recorded the
 *     maximum" instead of writing nothing and showing a success toast.
 *   - **The same objection is not stored twice.** A double click, a retry
 *     after a flaky response, or a second tab must not turn one disagreement
 *     into three entries that look like three people complaining.
 */
import type { ReportDispute, ReportDisputeReason } from "@/lib/db";

/** Closed vocabulary: the four things a candidate can actually dispute. */
export const DISPUTE_REASONS: { value: ReportDisputeReason; label: string }[] = [
  { value: "evidence", label: "引用的证据不准确，或断章取义" },
  { value: "rubric", label: "评分档位与评分标准的描述不符" },
  { value: "transcript", label: "我的回答没有被完整记录" },
  { value: "other", label: "其他原因" },
];

/** Per-report cap. Enough for a genuine disagreement, small enough to read. */
export const MAX_DISPUTES_PER_REPORT = 20;

/** Note cap, mirrored by the UI's maxlength so the counter cannot lie. */
export const MAX_DISPUTE_NOTE = 500;

export function isDisputeReason(value: unknown): value is ReportDisputeReason {
  return DISPUTE_REASONS.some((r) => r.value === value);
}

/** Same dimension, same reason, same words — one objection, not two. */
function sameDispute(a: ReportDispute, b: ReportDispute): boolean {
  return (
    a.dimensionId === b.dimensionId &&
    a.reason === b.reason &&
    (a.note ?? "").trim() === (b.note ?? "").trim()
  );
}

export type AppendResult =
  | { ok: true; disputes: ReportDispute[] }
  | { ok: false; error: "duplicate" | "limit" | "invalid" };

/**
 * Append an objection to the existing list.
 *
 * Returns a discriminated result rather than throwing: the caller has to say
 * something different for "already recorded" and "too many", and an exception
 * would collapse those into a generic failure the candidate cannot act on.
 */
export function appendDispute(
  existing: ReportDispute[] | undefined,
  dispute: ReportDispute
): AppendResult {
  const list = Array.isArray(existing) ? existing : [];
  if (!dispute.dimensionId.trim()) return { ok: false, error: "invalid" };
  if (!isDisputeReason(dispute.reason)) return { ok: false, error: "invalid" };
  const note = (dispute.note ?? "").trim();
  if (note.length > MAX_DISPUTE_NOTE) return { ok: false, error: "invalid" };

  const normalized: ReportDispute = {
    dimensionId: dispute.dimensionId,
    reason: dispute.reason,
    ...(note ? { note } : {}),
    createdAt: dispute.createdAt,
  };

  if (list.some((d) => sameDispute(d, normalized))) {
    return { ok: false, error: "duplicate" };
  }
  if (list.length >= MAX_DISPUTES_PER_REPORT) {
    return { ok: false, error: "limit" };
  }
  return { ok: true, disputes: [...list, normalized] };
}

/** Whether a dimension already carries an objection (any reason). */
export function hasDisputed(existing: ReportDispute[] | undefined, dimensionId: string): boolean {
  return Array.isArray(existing) && existing.some((d) => d.dimensionId === dimensionId);
}
