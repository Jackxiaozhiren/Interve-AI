import { supabase } from './supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

export const signInWithOAuth = async (provider: 'google' | 'github') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Must land on a page src/proxy.ts does not guard. This client is
      // createClient(url, key) with no options, so flowType is the default
      // 'implicit' and gotrue returns the session in the URL fragment — which
      // does survive a 307 (measured). /login is chosen anyway to avoid an
      // extra guarded hop, a stale ?from=, and a sign-in that depends on the
      // browser re-applying a fragment across a redirect. LoginForm already
      // forwards to `from || DASHBOARD` once AuthContext has bridged the
      // identity; the bridge is what actually made sign-in work.
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    },
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const getUser = async (): Promise<SupabaseUser | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
};
