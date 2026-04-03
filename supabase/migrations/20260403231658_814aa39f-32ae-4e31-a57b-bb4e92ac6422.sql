-- Goals table (client sets their 90-day MRR target)
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  target_mrr numeric not null,
  starting_mrr numeric default 0,
  target_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.goals enable row level security;
create policy "own_goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin_goals" on public.goals for select using (
  public.is_admin(auth.uid())
);

-- Resources table (admin-managed, all clients can read)
create table public.resources (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  url text not null,
  category text not null,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.resources enable row level security;
create policy "clients_read_resources" on public.resources
  for select to authenticated using (is_active = true);
create policy "admin_manage_resources" on public.resources
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Add extra columns to profiles
alter table public.profiles
  add column if not exists coach_notes text,
  add column if not exists onboarded boolean default false,
  add column if not exists milestones_hit integer[] default '{}';