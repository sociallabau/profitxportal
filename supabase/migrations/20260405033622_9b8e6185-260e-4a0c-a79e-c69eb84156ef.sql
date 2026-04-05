
-- Recreate the view with SECURITY INVOKER (default, but explicit)
CREATE OR REPLACE VIEW public.admin_client_overview
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.full_name,
  p.tier,
  p.is_admin,
  mt.month AS last_submission_month,
  mt.nps AS last_nps,
  mt.business_confidence AS last_confidence,
  mt.biggest_win AS last_biggest_win,
  mt.needs_this_month AS last_needs,
  mt.mrr AS last_mrr,
  mt.created_at AS last_submission_at,
  EXTRACT(days FROM now() - mt.created_at)::int AS days_since_submission,
  mw.created_at AS last_monday_win_at,
  EXTRACT(days FROM now() - mw.created_at)::int AS days_since_monday_win,
  ch.health_status AS manual_status,
  ch.notes AS health_notes
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT * FROM public.monthly_totals
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) mt ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.monday_wins
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) mw ON true
LEFT JOIN public.client_health ch ON ch.client_user_id = p.id
WHERE (p.is_admin IS NULL OR p.is_admin = false);
