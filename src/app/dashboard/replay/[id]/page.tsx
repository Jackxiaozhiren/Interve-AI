/**
 * S5 slice 2: server shell. The row is fetched during render with the
 * parallel SSR cookie session (RLS enforced); the interactive replay tree
 * stays a client island. No session -> `unavailable` and the island performs
 * the original browser read, so login failures degrade rather than blank.
 */
import ReplayClient from "./client";
import { readInterviewOnServer } from "@/lib/supabase/server-reads";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initial = await readInterviewOnServer(Number(id));
  return <ReplayClient id={id} initial={initial} />;
}
