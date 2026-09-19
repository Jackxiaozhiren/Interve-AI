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
 * Attempts to restore the Orama in-memory index from Dexie.
 * Returns true if successful, false otherwise.
 */
export async function restoreKnowledgeHub(userId: string | null = localHubUserId()): Promise<boolean> {
  try {
    const hubId = hubIdForUser(userId);
    let record = await db.oramaIndex.get(hubId);
    if (!record && hubId !== LEGACY_HUB_ID) {
      // Transition fallback: pre-partition rows live under the legacy id.
      record = await db.oramaIndex.get(LEGACY_HUB_ID);
    }
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
    console.error('Failed to restore Orama index from Dexie:', error);
  }
  return false;
}

/**
 * Initializes the Orama in-memory index with the provided resume text and persists it.
 */
export async function initializeKnowledgeHub(resumeText: string, userId: string | null = localHubUserId()): Promise<void> {
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
  }
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
