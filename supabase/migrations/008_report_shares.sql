-- ============================================================================
-- Migration 008: shareable report links (Phase 4 Slice 4b)
-- VERSION: 8.0 | DATE: 2026-11-13 | STATUS: PENDING — apply before the code
--          that writes this table is merged.
-- ============================================================================
-- Severity: high (a wrong read path here is a cross-candidate data leak)
-- Depends on: 001 (interviews), 002/003 (ownership), 006 (anon bridge closed)
--
-- WHAT A SHARE IS
-- A candidate can hand a friend or mentor a link to their own report. Per the
-- owner decision on 2026-11-13:
--   * scope      — report WITHOUT verbatim evidence and without the per-question
--                  review; what is shared is readiness, dimensions, rationale,
--                  strengths/gaps/drills and the roadmap;
--   * lifetime   — 7 days and at most 20 opens;
--   * aggregates — institutional views need a minimum cell of 10 (not built
--                  here; this table only supports the individual link).
--
-- WHY A SNAPSHOT INSTEAD OF A POINTER
-- The row stores the already-redacted projection in `payload`, not just an
-- interview id. Three consequences, all wanted:
--   1. the read path never touches `interviews`, so a bug in the share function
--      cannot return a row that contains evidence or a transcript;
--   2. what the recipient sees cannot drift after the candidate edits the
--      report, and deleting the interview still revokes the link (FK cascade);
--   3. the anonymous caller needs exactly one capability — execute one
--      function — instead of a SELECT policy on a content table.
--
-- WHY THE TOKEN IS NOT STORED
-- The client generates 32 random bytes and sends only sha256(token). The
-- database never holds a usable link: a dump of this table cannot be replayed.
-- There is no signing secret to rotate, and no way for a reader of the table to
-- mint a link.
--
-- WHY CONSUMPTION IS A FUNCTION
-- Counting opens and enforcing expiry must be one atomic step, or two
-- concurrent requests both pass a `views < max_views` check. `UPDATE … WHERE …
-- RETURNING` takes the row lock, increments, and only then returns the payload;
-- a request that lost the race gets zero rows and is indistinguishable from an
-- expired link — which is correct, because both mean "this link is spent".
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.consume_report_share(text);
--   DROP TABLE IF EXISTS public.report_shares;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_shares (
  id           BIGSERIAL PRIMARY KEY,
  interview_id BIGINT NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  -- The redacted projection. Capped so a client cannot use this as blob storage.
  payload      JSONB NOT NULL CHECK (octet_length(payload::text) <= 131072),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  max_views    INTEGER NOT NULL DEFAULT 20 CHECK (max_views > 0 AND max_views <= 200),
  views        INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_shares_interview ON public.report_shares(interview_id);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- The candidate (and only the candidate) may create a link for their own row,
-- and may see their own links. There is no UPDATE policy: opens are counted by
-- the function below, which runs as its owner.
DROP POLICY IF EXISTS "Owner reads own report shares" ON public.report_shares;
CREATE POLICY "Owner reads own report shares" ON public.report_shares
  FOR SELECT TO authenticated
  USING (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner creates report shares" ON public.report_shares;
CREATE POLICY "Owner creates report shares" ON public.report_shares
  FOR INSERT TO authenticated
  WITH CHECK (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()));

-- Anonymous callers get the function and nothing else. The table stays closed:
-- no SELECT grant means a leaked anon key cannot enumerate shares.
REVOKE ALL ON TABLE public.report_shares FROM anon;
GRANT SELECT, INSERT ON TABLE public.report_shares TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.report_shares_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_report_share(p_token_hash text)
RETURNS TABLE (payload jsonb, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.report_shares s
     SET views = s.views + 1
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
     AND s.expires_at > now()
     AND s.views < s.max_views
  RETURNING s.payload, s.expires_at;
$$;

REVOKE ALL ON FUNCTION public.consume_report_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_report_share(text) TO anon, authenticated;

COMMENT ON TABLE public.report_shares IS
  'Snapshot links for candidate report sharing. Stores sha256(token), never the token. Reads go through consume_report_share(), which enforces expiry and the open limit atomically.';
