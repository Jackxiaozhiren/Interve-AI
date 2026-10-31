/**
 * Turn a Supabase access token into the identity it actually belongs to.
 *
 * This is the only thing standing between "a caller typed an email" and "a caller
 * proved they own it". `POST /api/session` used to accept the former; §15.2 chose
 * Google/GitHub OAuth as the only credential, so the endpoint now has to ask the
 * platform who the token belongs to and believe only that answer.
 *
 * Returns `null` for every failure — missing config, expired token, token for a
 * deleted user, provider outage. The caller turns all of them into one 401 with no
 * cookie, because a distinguishable "your token expired" is a probe oracle.
 *
 * Runtime note: `getUser(token)` is a network call to the project's auth endpoint,
 * so this runs in the route's edge runtime, not in the browser bundle.
 */
import { createClient } from "@supabase/supabase-js";

export interface VerifiedIdentity {
  id: string;
  email: string;
  username: string;
}

export async function verifySupabaseToken(token: string): Promise<VerifiedIdentity | null> {
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) return null;

    const user = data?.user;
    if (!user?.id || !user.email) return null;

    const rawName =
      (user.user_metadata?.name as string | undefined) ??
      (user.user_metadata?.user_name as string | undefined) ??
      user.email.split("@")[0];

    return {
      id: user.id,
      email: user.email,
      username: String(rawName).slice(0, 64) || user.email.split("@")[0],
    };
  } catch {
    return null;
  }
}
