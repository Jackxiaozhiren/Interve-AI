// Phase E1: interview session snapshot persistence (verbatim port from the
// interview page). Local snapshots expire after 30 days (Privacy Center).
// Storage is injected (localStorage in prod, Map-backed fake in tests).

export interface SessionSnapshot {
  messages: unknown[];
  wpm: number;
  fillerWordsCount: number;
  savedAt: number;
}

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function sessionKey(interviewId: string): string {
  return `interve_session_${interviewId}`;
}

export function saveSession(
  storage: SessionStorage,
  interviewId: string,
  snapshot: Omit<SessionSnapshot, "savedAt">,
  nowMs = Date.now()
): void {
  try {
    storage.setItem(sessionKey(interviewId), JSON.stringify({ ...snapshot, savedAt: nowMs }));
  } catch {
    // Quota/private-mode failures must never break the interview.
  }
}

export type LoadedSession =
  | { status: "none" }
  | { status: "expired" }
  | { status: "found"; snapshot: SessionSnapshot };

export function loadSession(
  storage: SessionStorage,
  interviewId: string,
  nowMs = Date.now()
): LoadedSession {
  let raw: string | null;
  try {
    raw = storage.getItem(sessionKey(interviewId));
  } catch {
    return { status: "none" };
  }
  if (!raw) return { status: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "none" };
  }
  if (!parsed || typeof parsed !== "object") return { status: "none" };
  const snap = parsed as Partial<SessionSnapshot>;
  if (typeof snap.savedAt === "number" && nowMs - snap.savedAt > SESSION_TTL_MS) {
    try {
      storage.removeItem(sessionKey(interviewId));
    } catch {
      // Best effort.
    }
    return { status: "expired" };
  }
  if (Array.isArray(snap.messages) && snap.messages.length > 0) {
    return {
      status: "found",
      snapshot: {
        messages: snap.messages,
        wpm: typeof snap.wpm === "number" ? snap.wpm : 0,
        fillerWordsCount: typeof snap.fillerWordsCount === "number" ? snap.fillerWordsCount : 0,
        savedAt: typeof snap.savedAt === "number" ? snap.savedAt : nowMs,
      },
    };
  }
  return { status: "none" };
}

export function clearSession(storage: SessionStorage, interviewId: string): void {
  try {
    storage.removeItem(sessionKey(interviewId));
  } catch {
    // Best effort.
  }
}
