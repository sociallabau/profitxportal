-- Quarterly call goals: what was agreed on each 30-minute call, and whether it was hit by the next one.
-- Admin-only, never member-readable.
CREATE TABLE IF NOT EXISTS public.client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_on date NOT NULL DEFAULT current_date,
  goal text NOT NULL CHECK (char_length(goal) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hit', 'missed', 'dropped')),
  reviewed_at timestamptz,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_goals_client_idx ON public.client_goals (client_id, set_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_goals TO authenticated;
GRANT ALL ON public.client_goals TO service_role;

ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage client goals" ON public.client_goals;
CREATE POLICY "Admins manage client goals" ON public.client_goals
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Weekly digest: Sunday 20:30 UTC, which is Monday 6:30am or 7:30am in Sydney depending on daylight saving.
-- Same pattern as the Dan AI jobs: the cron token lives in a private table the database reads itself.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  PERFORM cron.unschedule('client-weekly-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'client-weekly-digest');
  PERFORM cron.schedule('client-weekly-digest', '30 20 * * 0', $cmd$
    select net.http_post(
      url := 'https://yzpjoxtqpqyzgsptplzr.supabase.co/functions/v1/weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cGpveHRxcHF5emdzcHRwbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxOTgwMTAsImV4cCI6MjA5MDc3NDAxMH0.OXXC3IiURDxMtCBaGrT31Q6XWJ97fFESPQJoDb-xEQA',
        'x-cron-secret', (select token from private.cron_token where id = 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cmd$);
END $do$;
