/**
 * The origin a candidate redirect is resolved against, never a real host: it
 * exists so `//host`, `/\host` and `javascript:` all come back with an origin that
 * is not this one, which is the only comparison that catches every escaping shape.
 */
const SENTINEL_ORIGIN = "http://self.invalid";

/**
 * Decide where a `?from=` value may send the visitor after sign-in.
 *
 * Anything that is not a path on this origin becomes the fallback. `startsWith('/')`
 * rejects the scheme-shaped and bare-host forms outright, and the sentinel
 * resolution catches the two that survive a prefix test: protocol-relative
 * `//evil.example` and `/\evil.example`, which URL parsing turns into another host.
 *
 * The returned string is a path plus query — a fragment is dropped, because the
 * router's job is the page, and `..` is normalised rather than refused so that a
 * traversal attempt resolves inside the app instead of reaching the router raw.
 */
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let target: URL;
  try {
    target = new URL(raw, SENTINEL_ORIGIN);
  } catch {
    return fallback;
  }
  if (target.origin !== SENTINEL_ORIGIN) return fallback;
  return `${target.pathname}${target.search}`;
}
