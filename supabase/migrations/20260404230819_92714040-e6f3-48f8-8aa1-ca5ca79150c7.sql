DROP POLICY IF EXISTS "Users can view own wins" ON public.weekly_wins;
DROP POLICY IF EXISTS "users read own wins" ON public.weekly_wins;
DROP POLICY IF EXISTS "own_wins" ON public.weekly_wins;
DROP POLICY IF EXISTS "admin_wins" ON public.weekly_wins;

CREATE POLICY "authenticated_read_wins"
ON public.weekly_wins
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "owners_manage_wins"
ON public.weekly_wins
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.checklist_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_key)
);

ALTER TABLE public.checklist_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own checklist" ON public.checklist_progress;
DROP POLICY IF EXISTS "own_checklist_progress" ON public.checklist_progress;

CREATE POLICY "own_checklist_progress"
ON public.checklist_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);