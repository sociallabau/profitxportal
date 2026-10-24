-- Members tick build tasks off on the Playbooks page, so they can also untick
-- one Dan hasn't approved yet (a mis-tap, or wrong proof). Approved stays put.
DROP POLICY IF EXISTS member_task_progress_own_untick ON public.member_task_progress;
CREATE POLICY member_task_progress_own_untick ON public.member_task_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status <> 'approved');
