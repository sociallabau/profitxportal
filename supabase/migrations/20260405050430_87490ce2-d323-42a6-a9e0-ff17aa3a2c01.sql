-- 1. Add columns to monthly_totals
ALTER TABLE public.monthly_totals
  ADD COLUMN IF NOT EXISTS ad_spend numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meetings int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrr_manual numeric(10,2) DEFAULT 0;

-- 2. Create page_views table
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  page text NOT NULL,
  viewed_at timestamptz DEFAULT now()
);
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_views' AND policyname='Users insert own page views') THEN
    CREATE POLICY "Users insert own page views" ON public.page_views FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_views' AND policyname='Admins read all page views') THEN
    CREATE POLICY "Admins read all page views" ON public.page_views FOR SELECT USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 3. Add source and cash_amount to weekly_wins
ALTER TABLE public.weekly_wins
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'quick_win',
  ADD COLUMN IF NOT EXISTS cash_amount numeric(10,2) DEFAULT 0;

-- 4. Admin checklist policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklist_progress' AND policyname='Admins read all checklist progress') THEN
    CREATE POLICY "Admins read all checklist progress" ON public.checklist_progress FOR SELECT USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 5. Recreate admin_client_overview view
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
  (SELECT count(*) FROM public.page_views pv WHERE pv.user_id = p.id AND pv.page = 'roadmap')::int AS roadmap_views,
  (SELECT count(*) FROM public.page_views pv WHERE pv.user_id = p.id AND pv.page = 'financials')::int AS financials_views,
  (SELECT count(*) FROM public.page_views pv WHERE pv.user_id = p.id AND pv.page = 'cash-menu')::int AS cash_views,
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