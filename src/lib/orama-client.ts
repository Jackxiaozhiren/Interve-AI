import { create, insertMultiple, search, save, load, type AnyOrama } from '@orama/orama';
import { db } from './db';

export interface ChunkDocument {
  id: string;
  text: string;
}

let oramaInstance: AnyOrama | null = null;

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
export async function restoreKnowledgeHub(): Promise<boolean> {
  try {
    const record = await db.oramaIndex.get('resume-index');
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
export async function initializeKnowledgeHub(resumeText: string): Promise<void> {
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

  // Persist the built index to Dexie
  try {
    const data = await save(oramaInstance);
    await db.oramaIndex.put({
      id: 'resume-index',
      data,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to persist Orama index to Dexie:', error);
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
