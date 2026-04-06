-- Add new client value tracking to monthly submissions
ALTER TABLE public.monthly_totals
  ADD COLUMN IF NOT EXISTS new_clients_total_value numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_clients_is_mrr boolean DEFAULT false;

-- Drop and recreate the admin view
DROP VIEW IF EXISTS public.admin_client_overview;

CREATE VIEW public.admin_client_overview AS
SELECT
  p.id,
  p.full_name,
  p.tier,
  p.is_admin,
  mt.month AS last_submission_month,
  mt.mrr_manual AS last_mrr,
  mt.oneoff_revenue AS last_oneoffs,
  mt.total_revenue AS last_total_revenue,
  mt.expenses AS last_expenses,
  mt.ad_spend AS last_ad_spend,
  mt.content_posts AS last_content_posts,
  mt.leads_generated AS last_leads,
  mt.meetings AS last_meetings,
  mt.new_clients AS last_new_clients,
  mt.new_clients_total_value AS last_new_clients_value,
  mt.new_clients_is_mrr AS last_new_clients_is_mrr,
  mt.business_confidence AS last_confidence,
  mt.nps AS last_nps,
  mt.biggest_win AS last_biggest_win,
  mt.needs_this_month AS last_needs,
  mt.created_at AS last_submission_at,
  EXTRACT(days FROM now() - mt.created_at)::int AS days_since_submission,
  (SELECT count(*) FROM public.checklist_progress cp WHERE cp.user_id = p.id AND cp.completed = true)::int AS modules_completed,
  (SELECT count(*) FROM public.weekly_wins ww WHERE ww.user_id = p.id)::int AS total_wins_submitted,
  (SELECT EXTRACT(days FROM now() - max(ww.created_at))::int FROM public.weekly_wins ww WHERE ww.user_id = p.id) AS days_since_last_win,
  (SELECT pv.page FROM public.page_views pv WHERE pv.user_id = p.id GROUP BY pv.page ORDER BY count(*) DESC LIMIT 1) AS most_visited_page,
  (SELECT EXTRACT(days FROM now() - max(pv.viewed_at))::int FROM public.page_views pv WHERE pv.user_id = p.id) AS days_since_last_login,
  (SELECT count(*) FROM public.page_views pv WHERE pv.user_id = p.id AND pv.page = 'roadmap')::int AS roadmap_views,
  (SELECT count(*) FROM public.page_views pv WHERE pv.user_id = p.id AND pv.page = 'financials')::int AS financials_views,
  ch.health_status AS manual_status,
  ch.notes AS health_notes
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT * FROM public.monthly_totals
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) mt ON true
LEFT JOIN public.client_health ch ON ch.client_user_id = p.id
WHERE (p.is_admin IS NULL OR p.is_admin = false);

ALTER VIEW public.admin_client_overview SET (security_invoker = on);

-- Allow admins to update client profiles (tier changes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admins update profiles') THEN
    CREATE POLICY "Admins update profiles"
      ON public.profiles FOR UPDATE
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;