-- Dan AI: a private knowledge base of Dan's own words, so Dan or Emily can get
-- an answer in his voice instead of retyping the same reply.
-- Admin-only throughout (Dan + Emily), same inline profiles.is_admin check the
-- Client Journey board uses.

-- A source document: a training transcript, a call, a WhatsApp export, a note.
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'transcript',
  source_url text,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

-- Documents are split into chunks so a question retrieves only relevant passages.
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.knowledge_docs(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_tsv_idx on public.knowledge_chunks using gin (tsv);
create index if not exists knowledge_chunks_doc_idx on public.knowledge_chunks (doc_id);

-- Answers Dan has approved. Reused verbatim when the same question comes back,
-- which is the whole point: answer it well once, never retype it.
create table if not exists public.saved_answers (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  tsv tsvector generated always as (to_tsvector('english', question || ' ' || answer)) stored,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_answers_tsv_idx on public.saved_answers using gin (tsv);

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.saved_answers enable row level security;

grant select, insert, update, delete on public.knowledge_docs to authenticated;
grant select, insert, update, delete on public.knowledge_chunks to authenticated;
grant select, insert, update, delete on public.saved_answers to authenticated;

drop policy if exists "Admins manage knowledge docs" on public.knowledge_docs;
create policy "Admins manage knowledge docs" on public.knowledge_docs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Admins manage knowledge chunks" on public.knowledge_chunks;
create policy "Admins manage knowledge chunks" on public.knowledge_chunks for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Admins manage saved answers" on public.saved_answers;
create policy "Admins manage saved answers" on public.saved_answers for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Full-text retrieval. security invoker so the policies above still apply.
create or replace function public.search_knowledge(q text, limit_n integer default 24)
returns table (
  chunk_id uuid,
  doc_id uuid,
  title text,
  source_type text,
  content text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, d.id, d.title, d.source_type, c.content,
         ts_rank(c.tsv, websearch_to_tsquery('english', q)) as rank
  from public.knowledge_chunks c
  join public.knowledge_docs d on d.id = c.doc_id
  where c.tsv @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit limit_n;
$$;

create or replace function public.search_saved_answers(q text, limit_n integer default 3)
returns table (
  id uuid,
  question text,
  answer text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.question, s.answer,
         ts_rank(s.tsv, websearch_to_tsquery('english', q)) as rank
  from public.saved_answers s
  where s.tsv @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit limit_n;
$$;

grant execute on function public.search_knowledge(text, integer) to authenticated;
grant execute on function public.search_saved_answers(text, integer) to authenticated;
