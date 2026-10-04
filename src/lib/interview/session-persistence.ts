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

/**
 * `SessionStorage` plus positional key access — the shape of the DOM `Storage`
 * interface, so `localStorage` satisfies both without an adapter. Only the
 * expiry sweep needs to enumerate; everything else stays key-addressed.
 */
export interface IndexedSessionStorage extends SessionStorage {
  readonly length: number;
  key(index: number): string | null;
}

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function sessionKey(interviewId: string): string {
  return `interve_session_${interviewId}`;
}

const SESSION_PREFIX = "interve_session_";

export interface PruneReport {
  /** Session keys this storage held, regardless of age. */
  scanned: number;
  /** Keys deleted: past the TTL, or unreadable and so never able to age out. */
  removed: number;
}

/**
 * Delete snapshots older than the TTL — including the ones for interviews the
 * candidate will never reopen.
 *
 * `loadSession` already honours the TTL, but only for the key it is handed, and
 * reaching it again means visiting `/interview?id=<that id>`. An abandoned
 * session therefore kept its transcript past the 30 days both `/privacy` and the
 * dashboard's data inventory promise. Walking the prefix is the only way to make
 * that promise true without the user doing anything.
 *
 * A snapshot with no readable `savedAt` is removed rather than kept: it cannot be
 * dated, so it can never satisfy an expiry rule, and the alternative is that the
 * oldest, least-removable data is exactly the data that survives.
 */
export function pruneExpiredSessions(
  storage: IndexedSessionStorage,
  nowMs = Date.now()
): PruneReport {
  const report: PruneReport = { scanned: 0, removed: 0 };

  // Descending: removeItem() shifts every later key into the freed index, and an
  // ascending walk would step over the one that moved up.
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(SESSION_PREFIX)) continue;
    report.scanned += 1;

    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      continue; // unreadable storage must not break the page that mounted for it
    }
    if (raw === null) continue;

    let expired = true;
    try {
      const parsed = JSON.parse(raw) as Partial<SessionSnapshot> | null;
      expired =
        typeof parsed?.savedAt !== "number" ||
        nowMs - parsed.savedAt > SESSION_TTL_MS;
    } catch {
      expired = true;
    }
    if (!expired) continue;

    try {
      storage.removeItem(key);
      report.removed += 1;
    } catch {
      // Best effort, same rule as clearSession.
    }
  }

  return report;
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
