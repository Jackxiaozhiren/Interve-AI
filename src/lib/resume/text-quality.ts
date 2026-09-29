/**
 * Deciding whether a PDF's text layer is usable.
 *
 * Two defects lived in the one expression this replaces, both measured:
 *
 *  - The quality test counted `[a-zA-Z0-9]`, so any document in Chinese,
 *    Japanese, Korean, Cyrillic, Arabic or Greek scored as garbage. A realistic
 *    540-character Chinese resume scored 0.29 against a 0.3 threshold: it
 *    triggered the OCR fallback from right next to the boundary, and the
 *    outcome depended on how much English the resume happened to contain. This
 *    app's interface is Chinese-first, so that is the normal case, not the
 *    edge case. Counting `\p{L}|\p{N}` judges "is this characters or junk"
 *    without preferring one script.
 *
 *  - pdf-parse appends a `-- N of M --` marker per page, and that string is
 *    both junk in the user's stored resume text and, on a marker-only
 *    extraction, enough letters and digits to look like content. Stripping it
 *    first makes the length rule mean what it says.
 *
 * What actually detects a scanned page is length: a measured image-only PDF
 * (a PNG through cupsfilter) extracts to `"\n\n-- 1 of 1 --\n\n"`, which is
 * nothing once the marker goes.
 */
const PAGE_MARKER = /[ \t]*--[ \t]*\d+[ \t]+of[ \t]+\d+[ \t]*--[ \t]*/gi;

/** Minimum extracted characters before a text layer is considered usable. */
const MIN_USEFUL_CHARS = 50;

/** Ratio of characters-to-junk below which the text layer is treated as noise. */
const MIN_LETTER_RATIO = 0.3;

export function stripPageMarkers(text: string): string {
  return text.replace(PAGE_MARKER, "").trim();
}

export function shouldOcrFallback(text: string): boolean {
  const content = stripPageMarkers(text);
  if (content.length < MIN_USEFUL_CHARS) return true;
  const lettersAndDigits = (content.match(/\p{L}|\p{N}/gu) ?? []).length;
  return lettersAndDigits / content.length < MIN_LETTER_RATIO;
}
