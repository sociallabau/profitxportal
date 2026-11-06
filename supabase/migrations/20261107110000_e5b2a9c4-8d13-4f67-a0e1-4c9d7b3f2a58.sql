-- Client Health round two: replies, planned quarterly dates, and "what changed this week".
-- Admin-only, never member-readable. Safe to run twice.

-- 1. Record when a client messages us ('client_message'), separately from the team reaching out.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.client_touchpoints'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%whatsapp%'
  LOOP
    EXECUTE format('ALTER TABLE public.client_touchpoints DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.client_touchpoints
  ADD CONSTRAINT client_touchpoints_kind_check
  CHECK (kind IN ('whatsapp', 'call', 'quarterly_call', 'group_call', 'other', 'client_message'));

-- 2. A planned date for the next quarterly call. Used to spread everyone's first call across the quarter.
ALTER TABLE public.client_care ADD COLUMN IF NOT EXISTS quarterly_due_on date;

-- 3. A weekly snapshot of where each client sits, so the Monday digest can say who got worse.
CREATE TABLE IF NOT EXISTS public.client_status_log (
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_on date NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('act', 'reach', 'quarterly', 'new', 'good')),
  status text NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (client_id, snapshot_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_status_log TO authenticated;
GRANT ALL ON public.client_status_log TO service_role;

ALTER TABLE public.client_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage client status log" ON public.client_status_log;
CREATE POLICY "Admins manage client status log" ON public.client_status_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
