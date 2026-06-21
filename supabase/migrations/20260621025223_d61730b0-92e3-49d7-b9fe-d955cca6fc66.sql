ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;

UPDATE public.profiles SET tier = CASE
  WHEN tier IN ('onramp', 'on-ramp') THEN 'onboarding'
  WHEN tier = 'growth' THEN 'in_flow_starter'
  WHEN tier IN ('scale', 'starter') THEN 'in_flow_scale'
  ELSE 'onboarding'
END;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('onboarding', 'in_flow_starter', 'in_flow_scale'));

ALTER TABLE public.profiles ALTER COLUMN tier SET DEFAULT 'onboarding';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, tier, is_admin)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'onboarding',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;