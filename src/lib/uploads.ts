/**
 * The resume-upload contract, in one place.
 *
 * `src/app/dashboard/resume/page.tsx` promised "PDF, DOCX, 或 TXT，最大 10MB"
 * while `src/app/api/parse-resume/route.ts` refused everything except PDF and
 * `image/*` and rejected anything over 5MB. So a user on that page picked a .docx,
 * or an 8MB PDF, and got a 400 the UI had told them was impossible. The setup
 * wizard already said 5MB, which is how the disagreement stayed hidden.
 *
 * The cap is exported so the enforcing route and the copy that quotes it cannot
 * drift again; `tests/unit/user-facing-numbers.test.ts` checks the copy against
 * this value rather than against a comment.
 */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const MAX_RESUME_MB = MAX_RESUME_BYTES / (1024 * 1024);

/**
 * What `parse-resume` actually accepts today: a real PDF, or an image (the OCR
 * path). SVG is refused by name inside the route even though it is an `image/*`,
 * because it can carry scripts and the parser must never see one.
 */
export const ACCEPTED_RESUME_KINDS = ["PDF", "PNG/JPG 截图"] as const;
