-- Archiving a client hides them from the portal without touching their data.
-- Their submissions, reviews and history all stay; clearing the column brings
-- them straight back.
alter table public.profiles
  add column if not exists archived_at timestamptz;

create index if not exists profiles_archived_idx on public.profiles (archived_at)
  where archived_at is not null;

-- Archive the two clients Dan asked to hide. Their data is untouched; to bring
-- either back, set archived_at to null.
update public.profiles
set archived_at = now()
where archived_at is null
  and (full_name ilike 'harrison roberts' or full_name ilike 'jacob watson');
