
-- Tighten weekly_wins and monday_wins: remove broad SELECT policies
DROP POLICY IF EXISTS "all_authenticated_read_wins" ON public.weekly_wins;
DROP POLICY IF EXISTS "authenticated_read_wins" ON public.weekly_wins;
DROP POLICY IF EXISTS "All authenticated users read monday wins" ON public.monday_wins;

-- Add admin read for monday_wins (admins may need cross-user visibility) and ensure owners can read theirs
CREATE POLICY "admin_monday_wins_read" ON public.monday_wins
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_weekly_wins_read" ON public.weekly_wins
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Add missing WITH CHECK to ALL policies
DROP POLICY IF EXISTS "own_monthly" ON public.monthly_totals;
CREATE POLICY "own_monthly" ON public.monthly_totals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_clients" ON public.new_clients;
CREATE POLICY "own_clients" ON public.new_clients
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_roadmap" ON public.roadmap_scores;
CREATE POLICY "own_roadmap" ON public.roadmap_scores
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent profile self-escalation via a trigger (defense in depth, beyond RLS)
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, keep needed grants
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_client_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_monthly_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
