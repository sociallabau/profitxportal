create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_notes_client_idx on public.client_notes (client_id, created_at desc);

grant select, insert, update, delete on public.client_notes to authenticated;
grant all on public.client_notes to service_role;

alter table public.client_notes enable row level security;

create policy "Admins manage client notes"
  on public.client_notes
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));