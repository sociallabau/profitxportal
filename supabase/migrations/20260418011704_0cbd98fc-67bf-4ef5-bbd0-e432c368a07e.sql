DROP POLICY IF EXISTS own_profile_update_safe ON public.profiles;

CREATE POLICY own_profile_update_safe ON public.profiles
AS RESTRICTIVE FOR UPDATE TO public
USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    auth.uid() = id
    AND NOT (is_admin IS DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()))
    AND NOT (tier IS DISTINCT FROM (SELECT p.tier FROM public.profiles p WHERE p.id = auth.uid()))
    AND NOT (coach_notes IS DISTINCT FROM (SELECT p.coach_notes FROM public.profiles p WHERE p.id = auth.uid()))
  )
);