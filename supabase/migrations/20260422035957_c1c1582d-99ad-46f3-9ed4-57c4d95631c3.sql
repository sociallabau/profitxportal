ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier_seen text;
UPDATE public.profiles SET tier_seen = tier WHERE tier_seen IS NULL;