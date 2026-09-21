-- Daily log for the Growth Engine.
--
-- The monthly check-in is too coarse to run a business on: one number a month
-- cannot show which channel is working, whether leads are drying up this week,
-- or how fast enquiries are being answered. This is one row per channel per
-- day — a few minutes of logging that makes all of that visible.
create table if not exists public.daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  log_date date not null default current_date,
  channel text not null,
  leads integer not null default 0,
  spend numeric not null default 0,
  meetings integer not null default 0,
  clients_won integer not null default 0,
  value_won numeric not null default 0,
  response_minutes integer,
  content_posts integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per channel per day, so logging twice corrects rather than duplicates.
  unique (user_id, log_date, channel)
);

create index if not exists daily_log_user_date_idx on public.daily_log (user_id, log_date desc);

alter table public.daily_log enable row level security;
grant select, insert, update, delete on public.daily_log to authenticated;

drop policy if exists "Users manage their own daily log" on public.daily_log;
create policy "Users manage their own daily log" on public.daily_log for all
  using (auth.uid() = user_id
     or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (auth.uid() = user_id);
