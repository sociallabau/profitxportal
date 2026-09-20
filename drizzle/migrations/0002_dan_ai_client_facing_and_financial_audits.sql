create table if not exists public.voice_profile (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default 'default',
  content text not null,
  built_from integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.voice_profile enable row level security;
grant select, insert, update, delete on public.voice_profile to authenticated;
grant all on public.voice_profile to service_role;

drop policy if exists "Admins manage the voice profile" on public.voice_profile;
create policy "Admins manage the voice profile" on public.voice_profile for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create table if not exists public.client_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  question text not null,
  answer text,
  next_steps jsonb,
  resource text,
  created_at timestamptz not null default now()
);

create index if not exists client_questions_user_idx on public.client_questions (user_id, created_at desc);

alter table public.client_questions enable row level security;
grant select, insert on public.client_questions to authenticated;
grant all on public.client_questions to service_role;

drop policy if exists "Users see their own questions" on public.client_questions;
create policy "Users see their own questions" on public.client_questions for select
  using (auth.uid() = user_id
     or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "Users log their own questions" on public.client_questions;
create policy "Users log their own questions" on public.client_questions for insert
  with check (auth.uid() = user_id);

alter table public.monthly_totals
  add column if not exists expense_contractors numeric,
  add column if not exists expense_software numeric,
  add column if not exists expense_owner_pay numeric,
  add column if not exists expense_other numeric;

create table if not exists public.financial_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null default 'pnl',
  filename text,
  period text,
  source_text text,
  audit text,
  created_at timestamptz not null default now()
);

create index if not exists financial_audits_user_idx on public.financial_audits (user_id, created_at desc);

alter table public.financial_audits enable row level security;
grant select, insert, delete on public.financial_audits to authenticated;
grant all on public.financial_audits to service_role;

drop policy if exists "Users manage their own audits" on public.financial_audits;
create policy "Users manage their own audits" on public.financial_audits for all
  using (auth.uid() = user_id
     or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (auth.uid() = user_id);

create or replace function public.search_knowledge_public(q text, limit_n integer default 24)
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
security definer
set search_path = public
as $$
  select c.id, d.id, d.title, d.source_type, c.content,
         ts_rank(c.tsv, websearch_to_tsquery('english', q)) as rank
  from public.knowledge_chunks c
  join public.knowledge_docs d on d.id = c.doc_id
  where d.source_type in ('teaching', 'transcript')
    and c.tsv @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit limit_n;
$$;

grant execute on function public.search_knowledge_public(text, integer) to authenticated;