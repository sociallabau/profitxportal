-- Drive ingestion for Dan AI: pulls the text Google already generates
-- (Meet transcripts, Gemini notes) into the knowledge base, and keeps a
-- queue of video files that still need transcribing.

-- Lets the sync skip anything already ingested.
alter table public.knowledge_docs
  add column if not exists source_id text;

-- The sync runs as the service role, where auth.uid() is null.
alter table public.knowledge_docs alter column created_by drop not null;

create unique index if not exists knowledge_docs_source_id_idx
  on public.knowledge_docs (source_id) where source_id is not null;

-- One row per Drive video awaiting or undergoing transcription.
create table if not exists public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  title text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'pending',
  provider text,
  provider_job_id text,
  error text,
  doc_id uuid references public.knowledge_docs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transcription_jobs_status_idx on public.transcription_jobs (status);

-- Remembers how far each folder has been synced.
create table if not exists public.drive_sync_state (
  folder_id text primary key,
  folder_name text,
  last_synced_at timestamptz,
  last_result text,
  updated_at timestamptz not null default now()
);

alter table public.transcription_jobs enable row level security;
alter table public.drive_sync_state enable row level security;

grant select, insert, update, delete on public.transcription_jobs to authenticated;
grant select, insert, update, delete on public.drive_sync_state to authenticated;

drop policy if exists "Admins manage transcription jobs" on public.transcription_jobs;
create policy "Admins manage transcription jobs" on public.transcription_jobs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Admins manage drive sync state" on public.drive_sync_state;
create policy "Admins manage drive sync state" on public.drive_sync_state for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
