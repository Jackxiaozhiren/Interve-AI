/**
 * S5 slice 5: server shell. The session list is fetched during render with the
 * parallel SSR cookie session (RLS enforced); the interactive dashboard stays a
 * client island. No session -> `unavailable` and the island performs the
 * original browser read, so login failures degrade rather than blank.
 */
import DashboardClient from "./client";
import { readInterviewsOnServer } from "@/lib/supabase/server-reads";

export default async function DashboardPage() {
  const initial = await readInterviewsOnServer();
  return <DashboardClient initial={initial} />;
}
