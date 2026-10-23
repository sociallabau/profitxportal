create table if not exists public.admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.admin_settings to authenticated;
grant all on public.admin_settings to service_role;

alter table public.admin_settings enable row level security;

create policy "Admins manage admin settings"
  on public.admin_settings
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));