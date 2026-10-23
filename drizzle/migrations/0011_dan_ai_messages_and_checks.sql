CREATE TABLE public.dan_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dan_ai_messages_thread_idx ON public.dan_ai_messages (user_id, thread_id, created_at);
GRANT SELECT, INSERT ON public.dan_ai_messages TO authenticated;
GRANT ALL ON public.dan_ai_messages TO service_role;
ALTER TABLE public.dan_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read dan ai messages" ON public.dan_ai_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Own insert dan ai messages" ON public.dan_ai_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.dan_ai_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question text NOT NULL,
  draft jsonb,
  final jsonb,
  pass boolean NOT NULL DEFAULT false,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dan_ai_checks TO authenticated;
GRANT ALL ON public.dan_ai_checks TO service_role;
ALTER TABLE public.dan_ai_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read dan ai checks" ON public.dan_ai_checks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));