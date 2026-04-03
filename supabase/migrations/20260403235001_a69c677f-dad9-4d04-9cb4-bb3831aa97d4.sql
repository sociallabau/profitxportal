
create table public.cash_menu_actions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  action_key text not null,
  completed_at timestamptz default now(),
  note text,
  unique(user_id, action_key)
);

alter table public.cash_menu_actions enable row level security;

create policy "own_cash_actions" on public.cash_menu_actions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin_view_cash_actions" on public.cash_menu_actions
  for select using (public.is_admin(auth.uid()));
