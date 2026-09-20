-- Client Journey: onboarding pipeline for newly signed clients.
-- Admin-only board (Dan + Emily). Deliberately does NOT use public.is_admin():
-- that function does not resolve for a uuid argument in this database, so the
-- admin check reads profiles.is_admin inline instead.
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

create index if not exists client_journey_stage_idx on public.client_journey (stage);
create index if not exists client_journey_added_date_idx on public.client_journey (added_date desc);

alter table public.client_journey enable row level security;

-- Shared admin board: any admin can see and manage every client on the journey.
drop policy if exists "Admins can manage the client journey" on public.client_journey;

create policy "Admins can manage the client journey"
  on public.client_journey
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
