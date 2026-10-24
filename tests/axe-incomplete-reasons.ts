/**
 * axe-core's complete vocabulary for "I could not judge this node's contrast".
 *
 * `color-contrast` puts a node in `results.incomplete` rather than `violations`
 * whenever it cannot work out what is behind the text. Each such node carries the
 * reason twice: once as English prose in `any[0].message`, and once as a stable
 * identifier in `any[0].data.messageKey`. The lane buckets and ratchets over the
 * key, not the prose.
 *
 * That choice was forced by measurement, not taste. An earlier version of this
 * table matched hand-written phrases, and three of them were wrong: the message
 * ending "because it is overlapped by another element" is emitted under the key
 * `bgOverlap`, whose *own* dictionary entry reads "because of element overlap", so
 * two different surface wordings had to be merged into one bucket or one would fall
 * through; `content is too short` is `shortTextContent`, which is not a background
 * problem at all; and `outsideViewport` — a harness condition, not a product blind
 * spot — was unrecognised and counted nowhere. Prose is axe's UI copy. The key is
 * its API.
 *
 * `tests/unit/axe-incomplete-vocabulary.test.ts` reads the installed axe bundle and
 * derives the full set of keys whose messages mean "undeterminable", then requires
 * this table to cover it exactly — so an axe upgrade that adds, drops or repurposes
 * a reason goes red there, instead of turning a chosen ceiling into a count of
 * something else.
 */
export const AXE_CONTRAST_REASON_KEYS = [
  'bgContrast',
  'bgGradient',
  'bgImage',
  'bgOverlap',
  'complexTextShadows',
  'default',
  'elmPartiallyObscured',
  'elmPartiallyObscuring',
  'fgAlpha',
  'imgNode',
  'outsideViewport',
  'pseudoContent',
  'shortTextContent',
] as const;

export type AxeContrastBucket = (typeof AXE_CONTRAST_REASON_KEYS)[number];

/**
 * What each reason actually costs the lane, since they are not interchangeable:
 * two of these describe the harness rather than the product, and one describes a
 * node axe declined to treat as text at all.
 */
export const REASON_MEANING: Record<AxeContrastBucket, string> = {
  bgContrast: 'axe could not resolve the background at all',
  bgGradient: 'a gradient sits behind the text, so there is no single background colour to compare',
  bgImage: 'an image sits behind the text',
  bgOverlap: 'another element overlaps this one, so the painted background is a composite axe will not guess',
  complexTextShadows: 'text shadows change the effective glyph colour',
  default: 'no reason was attached — the least diagnosable case in the set',
  elmPartiallyObscured: 'this text is partly covered by something else',
  elmPartiallyObscuring: 'this text partly covers something else',
  fgAlpha: 'the text colour itself is translucent',
  imgNode: 'the node contains a rasterised child',
  outsideViewport: 'the node is outside the viewport: a harness condition, not a product one',
  pseudoContent: 'a pseudo-element is involved in the paint',
  shortTextContent: 'axe refused to decide whether the node is text at all — where real failures hid',
};

/**
 * A declared bucket, or the key axe used when this table does not know it. The
 * second case comes back as data rather than being coerced into the bucket union:
 * an unknown reason must not be able to borrow another bucket's ceiling.
 */
export type ReasonClassification = { bucket: AxeContrastBucket } | { unknownKey: string };

type ContrastNode = {
  any?: { data?: unknown; message?: string }[];
};

export function classifyContrastNode(node: ContrastNode): ReasonClassification {
  const data = node.any?.[0]?.data as { messageKey?: unknown } | undefined;
  const key = data?.messageKey;
  if (typeof key !== "string") {
    // Falling back to prose here would silently re-adopt the bug this table exists
    // to fix, so a node without a key is reported as its own unknown reason.
    return { unknownKey: `<no messageKey; message: ${(node.any?.[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 90)}>` };
  }
  return (AXE_CONTRAST_REASON_KEYS as readonly string[]).includes(key)
    ? { bucket: key as AxeContrastBucket }
    : { unknownKey: key };
}
