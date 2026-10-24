-- Dan AI test suite, per Dan (2026-10-24):
-- * "7 days hands-off" is advice, not a rule every early lead gen answer must carry.
-- * The day-5 scaling answer is Gate 3 advice: CPA column on the lead tracking sheet, leads logged daily in their own growth hub.
-- * FREE_CLIENT_TRAP packed five bad plans into one question; split into realistic questions.
--   Bundling ad spend (AD_SPEND_INSIDE) and switching off awareness (NOT_A_BOUNDARY) already have their own tests.

update public.dan_ai_tests
set must_include = '["don''t kill, don''t bump", "the main issue is follow-up, call within 15–30 mins", "add 3–4 creatives to the same campaign", "references their awareness results or follow-up blocker"]'::jsonb
where name = 'ADS_5_DAYS_EARLY';

update public.dan_ai_tests
set must_include = '["uses their cost per client (~$363 vs $2,000) and says that''s under half, so scaling is allowed once follow-up is sorted", "points them to the CPA column on their lead tracking sheet", "ties it to logging every lead daily in their growth hub (speed to lead, follow-ups)", "15–30 mins"]'::jsonb
where name = 'ADS_5_DAYS_SCALE';

update public.dan_ai_tests set active = false where name = 'FREE_CLIENT_TRAP';

insert into public.dan_ai_tests (name, category, persona_key, question, must_include, must_not, position, active)
select v.name, v.category, 'P_EARLY', v.question, v.must_include::jsonb, '["\"flag to Dan\"", "\"pump the brakes\""]'::jsonb, v.position, true
from (values
  ('FREE_CLIENT_GATE', 'gates', 7,
   'I''ve got 3 retainers now — two at $1,800 and one I''m doing free for 3 months as a case study. So I''m at Gate 1, right?',
   '["first line says no, not Gate 1 yet", "the free client doesn''t count, so 2 paying", "Gate 1 = 3+ paying retainers held for 2 months", "priority = the next paying retainer"]'),
  ('CASE_STUDY_CLIENT_PAGE', 'gates', 18,
   'I''ve posted 2 case studies but they''re on my clients'' pages. Does that tick off the case study task for Gate 1?',
   '["says no, they don''t count yet", "case studies must be posted on their own account, not the client''s", "repost or make them on their own account, then Dan signs them off"]'),
  ('SKIP_BOOST', 'ads', 19,
   'Can I skip the profile visit boost and go straight to lead gen at $50/day?',
   '["says not yet", "at Gate 1 the ad step is a ~$50 profile-visit boost behind their best posts", "awareness comes at Gate 2 and lead gen after that", "doesn''t confuse the $50 boost with $50/day"]')
) as v(name, category, position, question, must_include)
where not exists (select 1 from public.dan_ai_tests t where t.name = v.name);
