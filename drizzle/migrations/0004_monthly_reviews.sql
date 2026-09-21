create table if not exists public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month date not null,
  client_summary text not null,
  admin_breakdown text not null,
  focus text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists monthly_reviews_user_idx on public.monthly_reviews (user_id, month desc);

alter table public.monthly_reviews enable row level security;
grant select, insert, update, delete on public.monthly_reviews to authenticated;
grant all on public.monthly_reviews to service_role;

drop policy if exists "Admins read every review" on public.monthly_reviews;
create policy "Admins read every review" on public.monthly_reviews for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.my_monthly_reviews()
returns table (month date, client_summary text, focus text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.month, r.client_summary, r.focus, r.created_at
  from public.monthly_reviews r
  where r.user_id = auth.uid()
  order by r.month desc
  limit 12;
$$;

grant execute on function public.my_monthly_reviews() to authenticated;