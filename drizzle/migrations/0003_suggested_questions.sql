create table if not exists public.suggested_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  theme text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suggested_questions_position_idx on public.suggested_questions (position);

alter table public.suggested_questions enable row level security;
grant select on public.suggested_questions to authenticated;
grant insert, update, delete on public.suggested_questions to authenticated;
grant all on public.suggested_questions to service_role;

drop policy if exists "Everyone reads suggested questions" on public.suggested_questions;
create policy "Everyone reads suggested questions" on public.suggested_questions for select
  using (auth.uid() is not null);

drop policy if exists "Admins rebuild suggested questions" on public.suggested_questions;
create policy "Admins rebuild suggested questions" on public.suggested_questions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));