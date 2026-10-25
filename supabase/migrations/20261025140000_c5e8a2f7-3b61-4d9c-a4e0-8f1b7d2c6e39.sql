-- Their Instagram profile (bio, link, followers, pinned posts), pulled with their posts so Dan AI can help optimise it.
alter table public.member_memory add column if not exists instagram_profile jsonb;
