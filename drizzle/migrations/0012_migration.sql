create table public.dan_ai_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  persona_key text not null,
  question text not null,
  must_include jsonb not null default '[]',
  must_not jsonb not null default '[]',
  category text not null default 'general',
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.dan_ai_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  round int not null default 1,
  summary jsonb not null default '{}',
  results jsonb not null default '[]'
);
create table public.dan_ai_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dan_ai_test_runs(id) on delete cascade,
  test_id uuid not null references public.dan_ai_tests(id) on delete cascade,
  answer jsonb,
  debug jsonb,
  criteria jsonb not null default '[]',
  code_checks jsonb not null default '[]',
  pass boolean,
  created_at timestamptz not null default now(),
  unique (run_id, test_id)
);
alter table public.dan_ai_tests enable row level security;
alter table public.dan_ai_test_runs enable row level security;
alter table public.dan_ai_test_results enable row level security;
create policy "admins manage tests" on public.dan_ai_tests for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admins manage runs" on public.dan_ai_test_runs for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admins manage results" on public.dan_ai_test_results for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select, insert, update, delete on public.dan_ai_tests, public.dan_ai_test_runs, public.dan_ai_test_results to authenticated;
grant all on public.dan_ai_tests, public.dan_ai_test_runs, public.dan_ai_test_results to service_role;
revoke all on public.dan_ai_tests, public.dan_ai_test_runs, public.dan_ai_test_results from anon;