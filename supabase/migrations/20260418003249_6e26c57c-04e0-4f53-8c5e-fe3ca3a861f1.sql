ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS retainer_tier_1 numeric,
  ADD COLUMN IF NOT EXISTS retainer_tier_2 numeric,
  ADD COLUMN IF NOT EXISTS retainer_tier_3 numeric;