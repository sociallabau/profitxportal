-- Gate 1 is the first 2 months after onboarding: 8 weeks to 3 paying retainers, which
-- moves a member to Gate 2 (Fuel). Add an optional week range to playbook_tasks so Gate 1's
-- build list can show that organising timeline; left null for every other gate, which is
-- achievement-gated rather than time-boxed.

ALTER TABLE public.playbook_tasks
  ADD COLUMN IF NOT EXISTS week_start smallint,
  ADD COLUMN IF NOT EXISTS week_end smallint;

ALTER TABLE public.playbook_tasks
  ADD CONSTRAINT playbook_tasks_week_range_chk
  CHECK (week_start IS NULL OR (week_start >= 1 AND week_end >= week_start));

-- Gate 1's 4 seeded tasks, by position: offer + profile in week 1, then content weekly
-- for the first month while conversations weekly carries the second month home.
UPDATE public.playbook_tasks SET week_start = 1, week_end = 1 WHERE gate = 1 AND position = 1;
UPDATE public.playbook_tasks SET week_start = 1, week_end = 1 WHERE gate = 1 AND position = 2;
UPDATE public.playbook_tasks SET week_start = 1, week_end = 4 WHERE gate = 1 AND position = 3;
UPDATE public.playbook_tasks SET week_start = 4, week_end = 8 WHERE gate = 1 AND position = 4;
