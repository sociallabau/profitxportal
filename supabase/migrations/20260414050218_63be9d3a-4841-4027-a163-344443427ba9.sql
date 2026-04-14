
create table if not exists public.hot_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  instagram_handle text,
  email text,
  phone text,
  notes text,
  column_id text not null default 'new',
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.hot_list enable row level security;

create policy "Users can manage their own hot list"
  on public.hot_list
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can view all hot list"
  on public.hot_list
  for select
  using (public.is_admin(auth.uid()));
