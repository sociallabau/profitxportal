-- Run the Drive sync and transcription on a schedule, so new calls land in
-- the knowledge base without anyone clicking anything.
--
-- Before running this, set the two settings below to real values:
--   app.settings.supabase_url  — https://<project-ref>.supabase.co
--   app.settings.cron_secret   — must match the CRON_SECRET edge function secret
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every 30 minutes: pull in anything new from Drive.
select cron.unschedule('dan-ai-drive-sync')
where exists (select 1 from cron.job where jobname = 'dan-ai-drive-sync');

select cron.schedule(
  'dan-ai-drive-sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/drive-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Hourly: send anything still untranscribed to Deepgram.
select cron.unschedule('dan-ai-transcribe')
where exists (select 1 from cron.job where jobname = 'dan-ai-transcribe');

select cron.schedule(
  'dan-ai-transcribe',
  '15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/transcribe',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := '{"limit": 3}'::jsonb
  );
  $$
);
