-- Admin engagement analytics: aggregate page popularity and daily activity across all
-- members, from the page_views events usePageTracking already logs. This is a content/
-- curriculum usage signal (which pages get opened), never a per-client risk signal —
-- Client Health deliberately does not use portal logins to judge an individual client.
--
-- Plain SQL (not SECURITY DEFINER): runs with the caller's own privileges, so the existing
-- "Admins read all page views" RLS policy on page_views and "admin_profiles" policy on
-- profiles are what actually restrict this to admins seeing everyone; a non-admin caller
-- gets back only their own activity, same as querying page_views directly.

CREATE OR REPLACE FUNCTION public.admin_page_popularity(_days int DEFAULT 90)
RETURNS TABLE (page text, views bigint, unique_members bigint)
LANGUAGE sql STABLE
AS $$
  SELECT pv.page, count(*) AS views, count(DISTINCT pv.user_id) AS unique_members
  FROM public.page_views pv
  JOIN public.profiles p ON p.id = pv.user_id AND (p.is_admin IS NULL OR p.is_admin = false)
  WHERE pv.viewed_at >= now() - (_days || ' days')::interval
  GROUP BY pv.page
  ORDER BY views DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_activity_by_day(_days int DEFAULT 30)
RETURNS TABLE (day date, views bigint, unique_members bigint)
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('day', pv.viewed_at)::date AS day, count(*) AS views, count(DISTINCT pv.user_id) AS unique_members
  FROM public.page_views pv
  JOIN public.profiles p ON p.id = pv.user_id AND (p.is_admin IS NULL OR p.is_admin = false)
  WHERE pv.viewed_at >= now() - (_days || ' days')::interval
  GROUP BY day
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION public.admin_page_popularity(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_by_day(int) TO authenticated;
