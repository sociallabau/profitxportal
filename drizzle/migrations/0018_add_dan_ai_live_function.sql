CREATE OR REPLACE FUNCTION public.dan_ai_live()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT value = 'true' FROM public.admin_settings WHERE key = 'dan_ai_members_live'), false);
$$;
REVOKE ALL ON FUNCTION public.dan_ai_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dan_ai_live() TO authenticated;