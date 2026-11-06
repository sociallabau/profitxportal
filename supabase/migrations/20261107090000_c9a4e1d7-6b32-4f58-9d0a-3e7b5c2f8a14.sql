-- Client care: who has actually been in touch with each client, and when.
-- Admin-only (Dan and anyone with is_admin, e.g. Emily). Never member-readable.

-- One row per contact: a WhatsApp catch-up, a 1:1 call, a quarterly call, a group call they came to.
CREATE TABLE IF NOT EXISTS public.client_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('whatsapp', 'call', 'quarterly_call', 'group_call', 'other')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text,
  author_id uuid,
  -- 'manual' = typed in by Dan/Emily; the others come from the log-touchpoints endpoint (WhatsApp scan, call recordings).
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp_scan', 'recording_scan')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_touchpoints_client_idx ON public.client_touchpoints (client_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_touchpoints TO authenticated;
GRANT ALL ON public.client_touchpoints TO service_role;

ALTER TABLE public.client_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage client touchpoints" ON public.client_touchpoints;
CREATE POLICY "Admins manage client touchpoints" ON public.client_touchpoints
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- One row per client: how often Dan wants to touch base, his own read on them, and the short AI snapshot.
CREATE TABLE IF NOT EXISTS public.client_care (
  client_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- NULL = follow what they asked for in their Context Room (weekly / fortnightly / monthly), else every 30 days.
  touch_every_days integer CHECK (touch_every_days BETWEEN 7 AND 180),
  -- Dan's call, which beats the automatic status. NULL = let the numbers decide.
  dan_read text CHECK (dan_read IN ('good', 'watch', 'needs_help')),
  dan_read_note text,
  dan_read_by uuid,
  dan_read_at timestamptz,
  -- Short AI summary: who they are + numbers + context room. Rebuilt from the portal data, never member-readable.
  snapshot text,
  checkin_bullets jsonb,
  snapshot_month text,
  snapshot_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_care TO authenticated;
GRANT ALL ON public.client_care TO service_role;

ALTER TABLE public.client_care ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage client care" ON public.client_care;
CREATE POLICY "Admins manage client care" ON public.client_care
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
