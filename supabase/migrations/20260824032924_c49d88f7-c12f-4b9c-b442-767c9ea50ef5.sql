ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_revoked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_admin(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.tier := OLD.tier;
    NEW.coach_notes := OLD.coach_notes;
    NEW.access_revoked := OLD.access_revoked;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.profiles SET access_revoked = true WHERE id = '7ede620e-afd0-44cd-aeb1-bd974faf04d1';