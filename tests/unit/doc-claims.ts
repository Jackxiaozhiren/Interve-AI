/**
 * Reading a count out of a document, so a prose number can be compared to code.
 *
 * `expectClaim` is shared by two guards — the README's architecture paragraph and
 * `docs/audit/ARCHITECTURE_CURRENT.md`'s route line — and writing that pair of
 * assertions twice is the shape this repo's new-code duplication gate counts,
 * which is why the README guard's helpers moved here. `claimedNumberIn` serves the
 * README's `(19 entries)` style specifically; the audit doc states its counts
 * inline and reads them with its own pattern.
 *
 * The lookup is positional on purpose: it finds the phrase, then the first
 * `(123 …)` after it, so the number being checked is the one the sentence prints
 * rather than any digit that appears in the file.
 */
import { expect } from "vitest";

/** The integer inside the parentheses that follow a phrase, or null if absent. */
export function claimedNumberIn(body: string, after: string): number | null {
  const at = body.indexOf(after);
  if (at < 0) return null;
  const m = /\((\d+)[^)]*\)/.exec(body.slice(at, at + 400));
  return m ? Number(m[1]) : null;
}

/**
 * A document's stated count and the measurement that owns it, compared.
 *
 * Two failures have to stay distinguishable: the sentence going away (nothing is
 * claimed any more, so the guard has to say it stopped reading) and the number
 * drifting out of date (the claim is still there and is now wrong).
 */
export function expectClaim(claimed: number | null, measured: number, what: string): void {
  expect(claimed, `the document no longer states the ${what} count where this test reads it`).not.toBeNull();
  expect(claimed, `the document says ${claimed}, the code measures ${measured} for ${what}`).toBe(measured);
}
