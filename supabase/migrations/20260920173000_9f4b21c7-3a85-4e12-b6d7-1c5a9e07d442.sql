-- Transcription pipeline for the calls Google never transcribed.
-- A one-time token lets the transcription provider fetch the media through
-- our own proxy, so nothing in Drive is ever made public.
alter table public.transcription_jobs
  add column if not exists access_token text,
  add column if not exists transcript_chars integer,
  add column if not exists submitted_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists transcription_jobs_token_idx
  on public.transcription_jobs (access_token) where access_token is not null;
