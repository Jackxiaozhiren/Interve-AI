// Phase 7: retry-a-question deep links (Replay/Report → Practice hub).
// Unicode-safe base64url encode/decode for arbitrary question text.

export function encodeRetryQuestion(question: string): string {
  const bytes = new TextEncoder().encode(question.slice(0, 2000));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRetryQuestion(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const text = new TextDecoder().decode(bytes);
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

export function retryPracticeHref(question: string): string {
  return `/practice?retry=${encodeRetryQuestion(question)}`;
}
