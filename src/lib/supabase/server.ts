/**
 * Supabase client for Server Components (S5). Reads the parallel SSR cookies
 * issued by POST /api/session, so RLS-protected rows can be fetched on the
 * server with the signed-in user's identity.
 *
 * Cookie writes are deliberately a no-op here: Next forbids setting cookies
 * from a Server Component. `src/proxy.ts` owns token refresh and writes the
 * renewed cookies to the response before render.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SSR_COOKIE_OPTIONS } from "./session-bridge";

export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: SSR_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      // Refresh happens in proxy.ts, where a response is available to carry
      // Set-Cookie. A silent no-op here is safer than throwing in a render.
      setAll: () => {},
    },
  });
}
