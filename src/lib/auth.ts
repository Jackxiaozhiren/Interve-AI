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

/** The three keys gotrue uses to report a failed callback. */
const CALLBACK_ERROR_KEYS = ['error', 'error_description', 'error_code'] as const;

/**
 * The only callback codes this app will put words around.
 *
 * A shape test is not enough: `error=click-here-to-lose-your-account` is a
 * well-formed slug, and the fragment is a URL a third party can construct. So the
 * set is closed and every member is evidenced — the OAuth ones are the registry in
 * RFC 6749 §4.1.2.1 / §5.2, and the three identity ones are the literals the
 * installed auth-js compares `errorCode` against in `_initialize`. Anything else
 * reports as `provider_error`, and the raw value still reaches the console for
 * attribution.
 */
const REPORTABLE_CODES = new Set([
  'access_denied',
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'unsupported_response_type',
  'temporarily_unavailable',
  'server_error',
  'provider_error',
  'identity_already_exists',
  'identity_not_found',
  'single_identity_not_deletable',
]);

/**
 * Read a provider handoff that came back failed, and take it off the address bar.
 *
 * Nobody else can notice: with this client's `implicit` flowType, auth-js throws
 * on an error-bearing callback and returns it from `_initialize` without
 * notifying any subscriber, and it clears the fragment only when a session came
 * back. So a cancelled sign-in used to land here as an ordinary /login — no
 * message, no console line, and a `#error=…` that every reload re-reads.
 *
 * `url` and `history` are parameters rather than globals so the token rule is
 * testable without a browser: a callback that carries a session or an auth code
 * belongs to the bridge, and rewriting that address would log the visitor out
 * while they are being signed in.
 */
export function consumeProviderCallbackFailure(
  url: { hash: string; search: string; pathname: string },
  history: { replace(next: string): void }
): string | null {
  const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const query = new URLSearchParams(url.search.startsWith('?') ? url.search.slice(1) : url.search);
  // Credential material in either position makes this URL the bridge's, not ours:
  // implicit puts the session in the fragment, PKCE puts the code in the query, and
  // rewriting either would log the visitor out mid-sign-in.
  if (fragment.get('access_token') || fragment.get('refresh_token') || fragment.get('code') || query.get('code')) {
    return null;
  }

  const value = (key: (typeof CALLBACK_ERROR_KEYS)[number]) => fragment.get(key) ?? query.get(key);
  if (!CALLBACK_ERROR_KEYS.some((key) => value(key))) return null;

  // Only gotrue's own identifiers are echoed. Anything else in these keys is
  // attacker-shaped text arriving on a URL a third party controls.
  const reported = value('error') ?? value('error_code') ?? 'provider_error';
  const code = REPORTABLE_CODES.has(reported) ? reported : 'provider_error';
  const description = value('error_description');

  const kept = new URLSearchParams(query);
  for (const key of CALLBACK_ERROR_KEYS) kept.delete(key);
  const search = kept.toString();
  history.replace(`${url.pathname}${search ? `?${search}` : ''}`);

  // The provider's wording stays out of the sentence (it is Google's and gotrue's,
  // not this app's) and goes to the console, where a developer can attribute it.
  console.warn(`[auth] provider callback failed: ${code}${description ? ` — ${description}` : ''}`);
  return `Provider sign-in did not complete (${code}). Please try again, or use the email form below.`;
}

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
