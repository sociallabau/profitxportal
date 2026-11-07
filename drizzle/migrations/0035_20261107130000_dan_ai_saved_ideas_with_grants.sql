-- Dan AI can now save a content idea a member brainstorms with it in chat. The existing
-- saved_ideas table is a swipe-file of outlier videos (source_url, transcript, etc.) with
-- no free-text field, so reusing it would misuse its meaning — this is a small table of its own.

CREATE TABLE public.dan_ai_saved_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idea text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dan_ai_saved_ideas TO authenticated;
GRANT ALL ON public.dan_ai_saved_ideas TO service_role;

ALTER TABLE public.dan_ai_saved_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dan_ai_saved_ideas" ON public.dan_ai_saved_ideas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all dan_ai_saved_ideas" ON public.dan_ai_saved_ideas
  FOR SELECT USING (public.is_admin(auth.uid()));
