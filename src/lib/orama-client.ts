import { create, insertMultiple, search, save, load, type AnyOrama } from '@orama/orama';
import { db } from './db';

export interface ChunkDocument {
  id: string;
  text: string;
}

let oramaInstance: AnyOrama | null = null;

const LEGACY_HUB_ID = 'resume-index';

/**
 * Phase B4-fix (E-phase correction): the Supabase `orama_index` table is
 * LIVE behind this module (via dbClient) with anon-bridge-readable legacy
 * rows — a single global id leaks every user's resume chunks to any anon
 * client. Partition by local user id; stamp `user_id` so rows leave the
 * NULL bridge. Anon-key writes with user_id set are DENIED by the 003
 * policies — the existing try/catch degrades to memory-only indexing,
 * which is correct (no new unowned PII rows, session still works).
 */
export function localHubUserId(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem("interveai_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

export function hubIdForUser(userId: string | null): string {
  return userId ? `${LEGACY_HUB_ID}:${userId}` : LEGACY_HUB_ID;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Splits text into chunks.
 * Uses a basic sliding window / chunking approach.
 */
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if (currentChunk.length + p.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = currentChunk.slice(-overlap) + ' ' + p;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + p;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Attempts to restore the Orama in-memory index from the account's orama_index
 * row (read through `db.oramaIndex`, i.e. the hosted database — no browser
 * storage is involved). Returns true if successful, false otherwise.
 */
export async function restoreKnowledgeHub(userId: string | null = localHubUserId()): Promise<boolean> {
  try {
    // Only the caller's own partition. The pre-partition row under the bare
    // legacy id has no `user_id` to check it against, so serving it here would
    // hand one person's resume chunks to whoever signed in next; relocating it
    // is an administrator's migration, which is also what `deleteKnowledgeHub`
    // refuses to do on a user's behalf. An anonymous caller has no partition to
    // name, so it still resolves to the legacy id — the same row 003's anon
    // bridge already exposes, and the row 006 is written to close.
    const record = await db.oramaIndex.get(hubIdForUser(userId));
    if (record && record.data) {
      oramaInstance = await create({
        schema: {
          text: 'string',
        },
      });
      await load(oramaInstance as AnyOrama, record.data as Parameters<typeof load>[1]);
      return true;
    }
  } catch (error) {
    console.error('Failed to restore Orama index from orama_index:', error);
  }
  return false;
}

/**
 * Initializes the Orama in-memory index with the provided resume text and persists it.
 *
 * Returns whether the row actually landed. The 003 owner policies refuse an
 * anonymous-key write, and this function has always degraded to memory-only rather
 * than crashing — which is right for the user in front of the screen and wrong to
 * report as success, because the next page load has nothing to restore.
 */
export async function initializeKnowledgeHub(
  resumeText: string,
  userId: string | null = localHubUserId()
): Promise<"persisted" | "memory-only"> {
  oramaInstance = await create({
    schema: {
      text: 'string',
    },
  });

  const chunks = chunkText(resumeText);
  const docs = chunks.map((chunk, index) => ({
    id: `chunk-${index}`,
    text: chunk,
  }));

  await insertMultiple(oramaInstance, docs);

  // Persist the built index remotely (user-partitioned; anon-denied writes
  // degrade to memory-only via the catch below — never a crash).
  try {
    const data = await save(oramaInstance);
    await db.oramaIndex.put({
      id: hubIdForUser(userId),
      // UUID session ids leave the anon NULL bridge via user_id; anon-key
      // writes then fail closed (003) and the catch degrades gracefully.
      ...(userId && isUuid(userId) ? { user_id: userId } : {}),
      data,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to persist Orama index remotely:', error);
    return "memory-only";
  }
  return "persisted";
}

/**
 * Make the hub usable for this account, restoring the stored row when there is one
 * and building it from the interview's own resume text when there is not.
 *
 * The read path (`restoreKnowledgeHub` on mount, `queryKnowledgeHub` per answer) has
 * been live since Phase B4 while nothing in production ever wrote the row, so every
 * restore returned false and every retrieval answered empty — including for accounts
 * whose privacy page says a serialized index of theirs is stored. Doing the build
 * where the resume text and the reader meet means one seam covers a first interview,
 * a resumed one and a device switch, and it turns a false restore into a branch with
 * a next step instead of a warning at the end of the road.
 *
 * The outcome is named rather than boolean because the two degraded states need
 * different answers: `no-resume` means there is nothing to index, and `memory-only`
 * means this session works and the next reload will not.
 */
export async function ensureKnowledgeHub(
  resumeText: string | null | undefined,
  userId: string | null = localHubUserId()
): Promise<"restored" | "built" | "memory-only" | "no-resume"> {
  if (oramaInstance) return "restored";
  if (await restoreKnowledgeHub()) return "restored";
  const text = (resumeText ?? "").trim();
  if (!text) return "no-resume";
  return (await initializeKnowledgeHub(text, userId)) === "persisted" ? "built" : "memory-only";
}

/**
 * Queries the Orama index for relevant context based on a prompt.
 */
export async function queryKnowledgeHub(prompt: string, limit = 5): Promise<string[]> {
  if (!oramaInstance) {
    throw new Error('Knowledge Hub not initialized. Call initializeKnowledgeHub first.');
  }

  const results = await search(oramaInstance, {
    term: prompt,
    properties: ['text'],
    limit,
    tolerance: 1, // Allow some typos
  });

  // Orama types are not fully up to date with the hit structure
  return results.hits.map((hit: unknown) => (hit as { document: { text: string } }).document.text);
}

/**
 * Resets the in-memory index (e.g., when a new resume is uploaded).
 */
export function resetKnowledgeHub() {
  oramaInstance = null;
}

/**
 * Erase this account's serialized resume index.
 *
 * The row is a second copy of the candidate's resume — the whole document,
 * chunked and serialized — so `orama_index` has to answer to "delete my data"
 * like every other table the Privacy Center lists. Only the caller's own
 * partition is removed: the pre-partition legacy row is shared between
 * accounts, and deleting it from here would destroy other people's data. That
 * row is an administrator's migration, not a user action.
 *
 * Throws when the server refuses, so the Privacy Center reports the failure
 * instead of claiming the account is clean.
 */
export async function deleteKnowledgeHub(userId: string | null = localHubUserId()): Promise<void> {
  const hubId = hubIdForUser(userId);
  try {
    await db.oramaIndex.remove(hubId);
  } finally {
    resetKnowledgeHub();
  }
}
