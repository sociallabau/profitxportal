-- Replace the over-permissive own_profile policy with scoped ones
DROP POLICY IF EXISTS "own_profile" ON public.profiles;

CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "own_profile_insert" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Restrictive policy: blocks self-modification of sensitive fields
CREATE POLICY "own_profile_update_safe" ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
    AND tier IS NOT DISTINCT FROM (SELECT p.tier FROM public.profiles p WHERE p.id = auth.uid())
    AND coach_notes IS NOT DISTINCT FROM (SELECT p.coach_notes FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Permissive update policy: user can update their own row (gated by the restrictive one above)
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);