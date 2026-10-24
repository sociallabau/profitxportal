-- Dan AI's member memory: rebuild hourly (only members whose data changed;
-- Instagram is still pulled at most every 2 days inside the rebuild), and
-- watch the newer portal tables too so any change a member makes flags it.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('checklist_progress', 'user_id'), ('client_journey', 'user_id'),
    ('campaign_followers', 'user_id'), ('saved_ideas', 'user_id')
  ) AS v(tbl, col)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_member_memory_dirty ON public.%I', t.tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_member_memory_dirty AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.mark_member_memory_dirty(%L)', t.tbl, t.col);
    END IF;
  END LOOP;
END $$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  PERFORM cron.unschedule('dan-ai-member-memory') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dan-ai-member-memory');
  PERFORM cron.schedule('dan-ai-member-memory', '40 * * * *', $cmd$
    select net.http_post(
      url := 'https://yzpjoxtqpqyzgsptplzr.supabase.co/functions/v1/ask-dan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cGpveHRxcHF5emdzcHRwbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxOTgwMTAsImV4cCI6MjA5MDc3NDAxMH0.OXXC3IiURDxMtCBaGrT31Q6XWJ97fFESPQJoDb-xEQA',
        'x-cron-secret', (select token from private.cron_token where id = 1)
      ),
      body := '{"limit": 6}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cmd$);
END $do$;
