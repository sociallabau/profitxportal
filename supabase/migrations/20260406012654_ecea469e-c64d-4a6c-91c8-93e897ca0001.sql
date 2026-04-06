
CREATE OR REPLACE VIEW public.admin_client_overview
WITH (security_invoker = on)
AS
SELECT p.id,
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
    (EXTRACT(days FROM (now() - mt.created_at)))::integer AS days_since_submission,
    (SELECT count(*) FROM checklist_progress cp WHERE cp.user_id = p.id AND cp.completed = true)::integer AS modules_completed,
    (SELECT count(*) FROM weekly_wins ww WHERE ww.user_id = p.id)::integer AS total_wins_submitted,
    (SELECT (EXTRACT(days FROM (now() - max(ww.created_at))))::integer FROM weekly_wins ww WHERE ww.user_id = p.id) AS days_since_last_win,
    (SELECT pv.page FROM page_views pv WHERE pv.user_id = p.id GROUP BY pv.page ORDER BY count(*) DESC LIMIT 1) AS most_visited_page,
    (SELECT (EXTRACT(days FROM (now() - max(pv.viewed_at))))::integer FROM page_views pv WHERE pv.user_id = p.id) AS days_since_last_login,
    (SELECT count(*) FROM page_views pv WHERE pv.user_id = p.id AND pv.page = 'roadmap')::integer AS roadmap_views,
    (SELECT count(*) FROM page_views pv WHERE pv.user_id = p.id AND pv.page = 'financials')::integer AS financials_views,
    ch.health_status AS manual_status,
    ch.notes AS health_notes
FROM profiles p
LEFT JOIN LATERAL (
    SELECT * FROM monthly_totals WHERE user_id = p.id ORDER BY created_at DESC LIMIT 1
) mt ON true
LEFT JOIN client_health ch ON ch.client_user_id = p.id;
