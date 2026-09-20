create table if not exists public.client_journey (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  phone text not null,
  email text,
  stage text not null default 'new',
  notes text,
  added_date timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_journey TO authenticated;
GRANT ALL ON public.client_journey TO service_role;

alter table public.client_journey enable row level security;

drop policy if exists "Admins can manage the client journey" on public.client_journey;

create policy "Admins can manage the client journey"
  on public.client_journey
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));