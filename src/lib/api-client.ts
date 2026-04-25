/* eslint-disable */
import { supabase } from './supabase';

// Type helper to recursively convert snake_case to camelCase
type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
  : S;

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
  : S;

// Generic converter functions
export function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamelCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toSnakeCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// Wrapper for Interviews
const interviews = {
  async add(data: any): Promise<number | string> {
    const snakeData = toSnakeCase(data);
    const { data: result, error } = await supabase.from('interviews').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id;
  },
  async get(id: number | string): Promise<any | undefined> {
    const { data, error } = await supabase.from('interviews').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return undefined; // not found
      throw error;
    }
    return toCamelCase(data);
  },
  async update(id: number | string, changes: any): Promise<void> {
    const snakeChanges = toSnakeCase(changes);
    snakeChanges.updated_at = new Date().toISOString();
    const { error } = await supabase.from('interviews').update(snakeChanges).eq('id', id);
    if (error) throw error;
  },
  orderBy(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      reverse() {
        return {
          async toArray(): Promise<any[]> {
            const { data, error } = await supabase.from('interviews').select('*').order(snakeField, { ascending: false });
            if (error) throw error;
            return toCamelCase(data || []);
          }
        }
      },
      async toArray(): Promise<any[]> {
        const { data, error } = await supabase.from('interviews').select('*').order(snakeField, { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
      }
    }
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: any) {
        return {
          async count(): Promise<number> {
            const { count, error } = await supabase.from('interviews').select('*', { count: 'exact', head: true }).eq(snakeField, value);
            if (error) throw error;
            return count || 0;
          },
          async sortBy(sortField: string): Promise<any[]> {
            const snakeSortField = sortField.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            const { data, error } = await supabase.from('interviews').select('*').eq(snakeField, value).order(snakeSortField, { ascending: true });
            if (error) throw error;
            return toCamelCase(data || []);
          }
        }
      }
    }
  }
};

// Wrapper for Evaluations
const evaluations = {
  async add(data: any): Promise<number | string> {
    const snakeData = toSnakeCase(data);
    const { data: result, error } = await supabase.from('evaluations').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id;
  },
  async update(id: number | string, changes: any): Promise<void> {
    const snakeChanges = toSnakeCase(changes);
    snakeChanges.updated_at = new Date().toISOString();
    const { error } = await supabase.from('evaluations').update(snakeChanges).eq('id', id);
    if (error) throw error;
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: any) {
        return {
          async first(): Promise<any | undefined> {
            const { data, error } = await supabase.from('evaluations').select('*').eq(snakeField, value).single();
            if (error) {
              if (error.code === 'PGRST116') return undefined;
              throw error;
            }
            return toCamelCase(data);
          }
        }
      }
    }
  }
};

// Wrapper for PracticeSessions
const practiceSessions = {
  async add(data: any): Promise<number | string> {
    const snakeData = toSnakeCase(data);
    const { data: result, error } = await supabase.from('practice_sessions').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id;
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: any) {
        return {
          async toArray(): Promise<any[]> {
            const { data, error } = await supabase.from('practice_sessions').select('*').eq(snakeField, value).order('created_at', { ascending: false });
            if (error) throw error;
            return toCamelCase(data || []);
          }
        }
      }
    }
  }
};

// Wrapper for Telemetry
const telemetry = {
  async add(data: any): Promise<void> {
    const snakeData = toSnakeCase(data);
    const { error } = await supabase.from('telemetry').insert(snakeData);
    if (error) throw error;
  },
  orderBy(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      async toArray(): Promise<any[]> {
        const { data, error } = await supabase.from('telemetry').select('*').order(snakeField, { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
      }
    }
  }
};

// Wrapper for Achievements
const achievements = {
  async add(data: any): Promise<void> {
    const snakeData = toSnakeCase(data);
    const { error } = await supabase.from('achievements').insert(snakeData);
    // Ignore duplicate key errors for achievements
    if (error && error.code !== '23505') throw error;
  },
  where(field: string) {
    const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return {
      equals(value: any) {
        return {
          async first(): Promise<any | undefined> {
            const { data, error } = await supabase.from('achievements').select('*').eq(snakeField, value).single();
            if (error) {
              if (error.code === 'PGRST116') return undefined;
              throw error;
            }
            return toCamelCase(data);
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
          async toArray(): Promise<any[]> {
            const { data, error } = await supabase.from('achievements').select('*').order(snakeField, { ascending: false });
            if (error) throw error;
            return toCamelCase(data || []);
          }
        }
      },
      async toArray(): Promise<any[]> {
        const { data, error } = await supabase.from('achievements').select('*').order(snakeField, { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
      }
    }
  },
  async toArray(): Promise<any[]> {
    const { data, error } = await supabase.from('achievements').select('*');
    if (error) throw error;
    return toCamelCase(data || []);
  }
};

// Wrapper for OramaIndex
const oramaIndex = {
  async get(id: string): Promise<any | undefined> {
    const { data, error } = await supabase.from('orama_index').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw error;
    }
    return toCamelCase(data);
  },
  async put(data: any): Promise<void> {
    const snakeData = toSnakeCase(data);
    const { error } = await supabase.from('orama_index').upsert(snakeData);
    if (error) throw error;
  }
};

// Wrapper for Assessments
const assessments = {
  async add(data: any): Promise<number | string> {
    const snakeData = toSnakeCase(data);
    const { data: result, error } = await supabase.from('assessments').insert(snakeData).select('id').single();
    if (error) throw error;
    return result.id;
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

export function useLiveQuery<T>(querier: () => Promise<T> | T | undefined, deps: any[] = []): T | undefined {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
