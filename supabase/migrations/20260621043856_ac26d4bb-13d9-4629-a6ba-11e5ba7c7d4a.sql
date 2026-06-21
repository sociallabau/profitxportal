DROP POLICY IF EXISTS own_content ON public.content_posts;
CREATE POLICY own_content ON public.content_posts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);