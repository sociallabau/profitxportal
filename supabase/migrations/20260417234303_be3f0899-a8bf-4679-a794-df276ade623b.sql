DROP POLICY IF EXISTS own_profile_update_safe ON public.profiles;

CREATE POLICY own_profile_update_safe ON public.profiles
AS RESTRICTIVE
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    public.is_admin(auth.uid())
    OR (
      NOT (is_admin IS DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (tier IS DISTINCT FROM (SELECT p.tier FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (coach_notes IS DISTINCT FROM (SELECT p.coach_notes FROM profiles p WHERE p.id = auth.uid()))
    )
  )
);