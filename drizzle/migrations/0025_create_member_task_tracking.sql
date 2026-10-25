-- Members track a monthly build task as they go (e.g. 5 of 8 posts, "working on it"), between ticks.
-- Separate from member_task_progress, where a row means ticked off and Dan reviews it.
CREATE TABLE IF NOT EXISTS public.member_task_tracking (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.playbook_tasks(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period = 'once' OR period ~ '^\d{4}-\d{2}$'),
  working boolean NOT NULL DEFAULT false,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_task_tracking TO authenticated;
GRANT ALL ON public.member_task_tracking TO service_role;

ALTER TABLE public.member_task_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_task_tracking_read ON public.member_task_tracking;
CREATE POLICY member_task_tracking_read ON public.member_task_tracking FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS member_task_tracking_insert ON public.member_task_tracking;
CREATE POLICY member_task_tracking_insert ON public.member_task_tracking FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS member_task_tracking_update ON public.member_task_tracking;
CREATE POLICY member_task_tracking_update ON public.member_task_tracking FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS member_task_tracking_delete ON public.member_task_tracking;
CREATE POLICY member_task_tracking_delete ON public.member_task_tracking FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));