-- Cron jobs authenticate with a token the database generates and keeps to
-- itself. Lovable Cloud won't allow ALTER DATABASE settings or Vault writes,
-- and the old CRON_SECRET value sat in plain text in an early migration, so
-- the functions now accept only this token (checked via verify_cron_token).
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.cron_token FROM PUBLIC, anon, authenticated;
INSERT INTO private.cron_token (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_token WHERE id = 1 AND token = _token);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text) TO service_role;

-- Re-register the three jobs to send that token. The URL and anon key are
-- public values (the anon key only gets the call past the functions gateway).
DO $do$
DECLARE
  job record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  FOR job IN SELECT * FROM (VALUES
    ('dan-ai-drive-sync', '*/30 * * * *', 'drive-sync', '{}'),
    ('dan-ai-transcribe', '15 * * * *', 'transcribe', '{"limit": 3}'),
    ('dan-ai-member-memory', '40 3-8 */2 * *', 'ask-dan', '{"limit": 15}')
  ) AS v(name, schedule, fn, body)
  LOOP
    PERFORM cron.unschedule(job.name) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = job.name);
    PERFORM cron.schedule(job.name, job.schedule, format($cmd$
      select net.http_post(
        url := 'https://yzpjoxtqpqyzgsptplzr.supabase.co/functions/v1/%s',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cGpveHRxcHF5emdzcHRwbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxOTgwMTAsImV4cCI6MjA5MDc3NDAxMH0.OXXC3IiURDxMtCBaGrT31Q6XWJ97fFESPQJoDb-xEQA',
          'x-cron-secret', (select token from private.cron_token where id = 1)
        ),
        body := %L::jsonb
      );
    $cmd$, job.fn, job.body));
  END LOOP;
END $do$;
