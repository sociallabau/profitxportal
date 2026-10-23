CREATE TABLE public.roadmap_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  answers jsonb NOT NULL,
  issue text NOT NULL,
  focus text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.roadmap_audits TO authenticated;
GRANT ALL ON public.roadmap_audits TO service_role;
ALTER TABLE public.roadmap_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.roadmap_audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own or admin read" ON public.roadmap_audits FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));