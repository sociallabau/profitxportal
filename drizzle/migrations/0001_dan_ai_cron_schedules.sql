-- lovable-cron-fallback-reviewed: Google Drive has no webhook here; a 30-minute poll is the required freshness window for new call transcripts.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('dan-ai-drive-sync')
where exists (select 1 from cron.job where jobname = 'dan-ai-drive-sync');

select cron.schedule(
  'dan-ai-drive-sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://yzpjoxtqpqyzgsptplzr.supabase.co/functions/v1/drive-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'd114f708d4a41fd39af0541aebcb193ced07b910fdecee786645ba51ac9dd0c4'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('dan-ai-transcribe')
where exists (select 1 from cron.job where jobname = 'dan-ai-transcribe');

select cron.schedule(
  'dan-ai-transcribe',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://yzpjoxtqpqyzgsptplzr.supabase.co/functions/v1/transcribe',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'd114f708d4a41fd39af0541aebcb193ced07b910fdecee786645ba51ac9dd0c4'
    ),
    body := '{"limit": 3}'::jsonb
  );
  $$
);