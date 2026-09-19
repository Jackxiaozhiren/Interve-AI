// Phase E2: typed Supabase shim (ex-Dexie-compat, no-explicit-any exemption REMOVED).
//
// Domain types come from ./db (import type only — no runtime cycle).
// Supabase-js is untyped here (no generated Database), so row payloads
// cross the boundary through ONE documented cast each in toCamelCase;
// everything else is fully typed. Timestamps arrive as ISO strings at
// runtime while domain types say Date (pre-existing looseness — callers
// cope; reviving Dates would change behavior, so it stays as is).
import { supabase } from './supabase';
import type {
  Interview,
  CandidateEvaluation,
  PracticeSession,
  TelemetryEvent,
  Achievement,
  OramaIndexData,
  Assessment,
} from './db';

// Generic converter functions (single sanctioned cast site each).
export function toCamelCase<T>(obj: unknown): T {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((v) => convert(v));
    } else if (value !== null && value !== undefined && (value as Record<string, unknown>).constructor === Object) {
      return Object.keys(value as Record<string, unknown>).reduce(
        (result, key) => {
          const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          result[camelKey] = convert((value as Record<string, unknown>)[key]);
          return result;
        },
        {} as Record<string, unknown>
      );
    }
    return value;
  };
  return convert(obj) as T;
}

export function toSnakeCase(obj: unknown): Record<string, unknown> {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((v) => convert(v));
    } else if (value !== null && value !== undefined && (value as Record<string, unknown>).constructor === Object) {
      return Object.keys(value as Record<string, unknown>).reduce(
        (result, key) => {
          const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
          result[snakeKey] = convert((value as Record<string, unknown>)[key]);
          return result;
        },
        {} as Record<string, unknown>
      );
    }
    return value;
  };
  return convert(obj) as Record<string, unknown>;
}

// B1-1 owner binding (002 bridge cutover prep): stamp `user_id` with the
// Supabase auth uid when a session exists (OAuth logins). Demo logins have
// no Supabase JWT → rows stay NULL-bridged (legacy anon path, unchanged).
// Never overwrites a caller-bound user_id (e.g. the orama memory path).
// Reads are untouched (RLS USING decides visibility server-side).
async function currentOwnerId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function stampOwner(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if ("user_id" in row) return row;
  const uid = await currentOwnerId();
  return uid ? { ...row, user_id: uid } : row;
}

// Wrapper for Interviews
const interviews = {
  async add(data: Partial<Interview>): Promise<number | string> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { data: result, error } = await supabase.from('interviews').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id as number | string;
  },
  async get(id: number | string): Promise<Interview | undefined> {
    const { data, error } = await supabase.from('interviews').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return undefined; // not found
      throw error;
    }
    return toCamelCase<Interview>(data);
  },
  async update(id: number | string, changes: Partial<Interview>): Promise<void> {
    const snakeChanges = await stampOwner(toSnakeCase(changes as Record<string, unknown>));
    snakeChanges.updated_at = new Date().toISOString();
    const { error } = await supabase.from('interviews').update(snakeChanges).eq('id', id);
    if (error) throw error;
  },
  // Phase 10: user-controlled deletion (Privacy Center).
  async remove(id: number | string): Promise<void> {
    const { error } = await supabase.from('interviews').delete().eq('id', id);
    if (error) throw error;
  },
  orderBy(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      reverse() {
        return {
          async toArray(): Promise<Interview[]> {
            const { data, error } = await supabase.from('interviews').select('*').order(snakeField, { ascending: false });
            if (error) throw error;
            return toCamelCase<Interview[]>(data || []);
          }
        }
      },
      async toArray(): Promise<Interview[]> {
        const { data, error } = await supabase.from('interviews').select('*').order(snakeField, { ascending: true });
        if (error) throw error;
        return toCamelCase<Interview[]>(data || []);
      }
    }
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: unknown) {
        return {
          async count(): Promise<number> {
            const { count, error } = await supabase.from('interviews').select('*', { count: 'exact', head: true }).eq(snakeField, value);
            if (error) throw error;
            return count || 0;
          },
          async sortBy(sortField: string): Promise<Interview[]> {
            const snakeSortField = sortField.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            const { data, error } = await supabase.from('interviews').select('*').eq(snakeField, value).order(snakeSortField, { ascending: true });
            if (error) throw error;
            return toCamelCase<Interview[]>(data || []);
          }
        }
      }
    }
  }
};

// Wrapper for Evaluations
const evaluations = {
  async add(data: Partial<CandidateEvaluation>): Promise<number | string> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { data: result, error } = await supabase.from('evaluations').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id as number | string;
  },
  async update(id: number | string, changes: Partial<CandidateEvaluation>): Promise<void> {
    const snakeChanges = await stampOwner(toSnakeCase(changes as Record<string, unknown>));
    snakeChanges.updated_at = new Date().toISOString();
    const { error } = await supabase.from('evaluations').update(snakeChanges).eq('id', id);
    if (error) throw error;
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: unknown) {
        return {
          async first(): Promise<CandidateEvaluation | undefined> {
            const { data, error } = await supabase.from('evaluations').select('*').eq(snakeField, value).single();
            if (error) {
              if (error.code === 'PGRST116') return undefined;
              throw error;
            }
            return toCamelCase<CandidateEvaluation>(data);
          }
        }
      }
    }
  }
};

// Wrapper for PracticeSessions
const practiceSessions = {
  async add(data: Partial<PracticeSession>): Promise<number | string> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { data: result, error } = await supabase.from('practice_sessions').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id as number | string;
  },
  // Phase 10: user-controlled deletion + export (Privacy Center).
  async remove(id: number | string): Promise<void> {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) throw error;
  },
  async toArray(): Promise<PracticeSession[]> {
    const { data, error } = await supabase.from('practice_sessions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return toCamelCase<PracticeSession[]>(data || []);
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: unknown) {
        return {
          async toArray(): Promise<PracticeSession[]> {
            const { data, error } = await supabase.from('practice_sessions').select('*').eq(snakeField, value).order('created_at', { ascending: false });
            if (error) throw error;
            return toCamelCase<PracticeSession[]>(data || []);
          }
        }
      }
    }
  }
};

// Wrapper for Telemetry
const telemetry = {
  async add(data: Partial<TelemetryEvent>): Promise<void> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { error } = await supabase.from('telemetry').insert(snakeData);
    if (error) throw error;
  },
  orderBy(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const run = async (limit: number | undefined, descending: boolean): Promise<TelemetryEvent[]> => {
      let query = supabase.from('telemetry').select('*').order(snakeField, { ascending: !descending });
      // D3: Dexie-compatible .limit() — bounds transfer on live lists.
      // Telemetry panels read recent windows; user-data exports stay uncapped.
      if (limit !== undefined) query = query.limit(limit) as typeof query;
      const { data, error } = await query;
      if (error) throw error;
      return toCamelCase<TelemetryEvent[]>(data || []);
    };
    const chain = (descending: boolean, limit?: number): { toArray: () => Promise<TelemetryEvent[]>; limit: (n: number) => { toArray: () => Promise<TelemetryEvent[]> }; reverse: () => { toArray: () => Promise<TelemetryEvent[]>; limit: (n: number) => { toArray: () => Promise<TelemetryEvent[]> } } } => ({
      toArray: () => run(limit, descending),
      limit: (n: number) => chain(descending, n),
      reverse: () => chain(!descending, limit),
    });
    return chain(false);
  }
};

// Wrapper for Achievements
const achievements = {
  async add(data: Partial<Achievement>): Promise<void> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { error } = await supabase.from('achievements').insert(snakeData);
    // Ignore duplicate key errors for achievements
    if (error && error.code !== '23505') throw error;
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: unknown) {
        return {
          async first(): Promise<Achievement | undefined> {
            const { data, error } = await supabase.from('achievements').select('*').eq(snakeField, value).single();
            if (error) {
              if (error.code === 'PGRST116') return undefined;
              throw error;
            }
            return toCamelCase<Achievement>(data);
          }
        }
      }
    }
  },
  orderBy(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      reverse() {
        return {
          async toArray(): Promise<Achievement[]> {
            const { data, error } = await supabase.from('achievements').select('*').order(snakeField, { ascending: false });
            if (error) throw error;
            return toCamelCase<Achievement[]>(data || []);
          }
        }
      },
      async toArray(): Promise<Achievement[]> {
        const { data, error } = await supabase.from('achievements').select('*').order(snakeField, { ascending: true });
        if (error) throw error;
        return toCamelCase<Achievement[]>(data || []);
      }
    }
  },
  async toArray(): Promise<Achievement[]> {
    const { data, error } = await supabase.from('achievements').select('*');
    if (error) throw error;
    return toCamelCase<Achievement[]>(data || []);
  }
};

// Wrapper for OramaIndex
const oramaIndex = {
  async get(id: string): Promise<OramaIndexData | undefined> {
    const { data, error } = await supabase.from('orama_index').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw error;
    }
    return toCamelCase<OramaIndexData>(data);
  },
  async put(data: OramaIndexData): Promise<void> {
    const snakeData = await stampOwner(toSnakeCase(data as unknown as Record<string, unknown>));
    const { error } = await supabase.from('orama_index').upsert(snakeData);
    if (error) throw error;
  }
};

// Wrapper for Assessments
const assessments = {
  async add(data: Partial<Assessment>): Promise<number | string> {
    const snakeData = await stampOwner(toSnakeCase(data as Record<string, unknown>));
    const { data: result, error } = await supabase.from('assessments').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id as number | string;
  }
};

export const dbClient = {
  interviews,
  evaluations,
  practiceSessions,
  telemetry,
  achievements,
  oramaIndex,
  assessments
};

import { useState, useEffect } from 'react';

export function useLiveQuery<T>(querier: () => Promise<T> | T | undefined, deps: React.DependencyList = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const result = await querier();
        if (isMounted) setData(result as T);
      } catch (err) {
        console.error('useLiveQuery error:', err);
      }
    };
    fetchData();
    return () => { isMounted = false; };
    // `deps` is caller-controlled by design (variable dep list): callers pass
    // inline closures, so a static list cannot be verified. Tracked debt, see
    // MASTER_AUDIT P2-3. Do not remove without refactoring all call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
