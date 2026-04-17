ALTER TABLE public.saved_ideas
  ADD COLUMN IF NOT EXISTS source_video_url text,
  ADD COLUMN IF NOT EXISTS transcript text;

-- Allow updating transcript on own saved ideas (table previously had no UPDATE policy)
DROP POLICY IF EXISTS "Users can update own saved ideas" ON public.saved_ideas;
CREATE POLICY "Users can update own saved ideas"
  ON public.saved_ideas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);