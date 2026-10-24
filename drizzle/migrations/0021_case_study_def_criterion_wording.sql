-- CASE_STUDY_DEF: "their own account" read as the client's account to the grader. Name whose account it is.
update public.dan_ai_tests
set must_include = (
  select jsonb_agg(case when c #>> '{}' = 'must be on their own account'
    then to_jsonb('must be posted on the member''s own account, not the client''s'::text) else c end)
  from jsonb_array_elements(must_include) c
)
where name = 'CASE_STUDY_DEF';