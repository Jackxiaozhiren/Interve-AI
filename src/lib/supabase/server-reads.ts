/**
 * S5 slice 2: the server-side counterpart of db.interviews.get(id).
 *
 * The parallel SSR cookies issued by POST /api/session give a Server Component
 * a Supabase client that carries the signed-in user's JWT. `getUser()` validates
 * that token with the auth server, and the uid is then passed to the existing
 * api-client read so RLS and the explicit user_id predicate stay identical to
 * the browser path.
 *
 * A missing session, a failed validation or any read error returns
 * "unavailable" rather than throwing: the route falls back to its original
 * client-side read. "not_found" is distinct — that is a real answer from a
 * valid session and must render the not-found state, not trigger a second read.
 */
import type { Interview } from "@/lib/db";
import { db } from "@/lib/db";
import { createServerSupabase } from "./server";

export type ServerRead<T> =
  | { status: "ok"; value: T }
  | { status: "not_found" }
  | { status: "unavailable" };

export async function readInterviewOnServer(id: number | string): Promise<ServerRead<Interview>> {
  const client = await createServerSupabase();
  if (!client) return { status: "unavailable" };

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { status: "unavailable" };

    // Same reader, injected transport: no second wildcard-select site and
    // no service_role. A signed-in user can only ever read their own row.
    const row = await db.interviews.get(id, client, data.user.id);
    return row ? { status: "ok", value: row } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}
