import { supabase } from './supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

export const signInWithOAuth = async (provider: 'google' | 'github') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Must land on a page src/proxy.ts does not guard. supabase-js defaults to
      // PKCE, so the provider returns with ?code=&state= in the query, and a
      // first-time signer has no app cookie yet: /dashboard answered
      // `307 -> /login?from=%2Fdashboard` with the code and state dropped
      // (measured against a running dev server), so no session was ever
      // exchanged. /login is unguarded and LoginForm already forwards to
      // `from || DASHBOARD` once AuthContext has bridged the identity.
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
