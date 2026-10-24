-- CASE_STUDY_DEF: Dan doesn't want the result + testimonial formula spelled out, just that BTS posts count as case studies.
update public.dan_ai_tests
set must_include = '["says BTS posts count as case studies (1–2 BTS posts = 1, 3+ BTS = 2)", "must be posted on the member''s own account, not the client''s", "Dan signs off"]'::jsonb,
    must_not = coalesce(must_not, '[]'::jsonb) || '["spells out the result + testimonial = 1 formula"]'::jsonb
where name = 'CASE_STUDY_DEF';